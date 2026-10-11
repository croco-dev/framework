import {
  canonicalOutcomeJson,
  OUTCOME_DEFAULT_MAX_ASSIGNMENTS,
  OUTCOME_KINDS,
  OutcomeLedgerNormalizer,
  outcomeKey,
  outcomeText,
  requireOutcome,
} from "./OutcomeLedgerNormalizer";
import type {
  AssignedOutcomeInput,
  AssignedOutcomeReport,
  OutcomeRational,
  OutcomeKind,
  MoneyEvent,
} from "./types";

export const ASSIGNED_OUTCOME_DEFINITION = Object.freeze({
  version: "assigned-net-v1",
  formula: "payment-refund-cashback-direct_contact_cost",
  denominator: "all_frozen_assigned_units",
  noncash: "separate_face_value",
  currencies: "separate_without_conversion",
  corrections: "source_referenced_replacements_at_effective_and_known_cutoffs",
  refundRate: "refunded_assigned_subjects/paying_assigned_subjects",
  retentionRate: "retained_assigned_subjects/all_assigned_units",
});

async function hashOutcomeContent(content: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalOutcomeJson(content));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashAssignedOutcomeDefinition(): Promise<string> {
  return hashOutcomeContent(ASSIGNED_OUTCOME_DEFINITION);
}

export function outcomeRational(numerator: bigint, denominator: bigint): OutcomeRational | null {
  if (denominator === BigInt(0)) return null;
  let a = numerator < BigInt(0) ? -numerator : numerator;
  let b = denominator;
  while (b !== BigInt(0)) [a, b] = [b, a % b];
  return { numerator: (numerator / a).toString(), denominator: (denominator / a).toString() };
}

export async function hashAssignedOutcomeInput(input: AssignedOutcomeInput): Promise<string> {
  const { inputHash: _inputHash, ...content } = input;
  return hashOutcomeContent(content);
}

export function compareAssignedOutcomes(input: AssignedOutcomeInput): AssignedOutcomeReport {
  requireOutcome(
    input.metricDefinitionVersion === ASSIGNED_OUTCOME_DEFINITION.version,
    "unsupported_metric_definition",
  );
  const snapshot = input.assignmentSnapshot;
  const limit = input.maxAssignments ?? OUTCOME_DEFAULT_MAX_ASSIGNMENTS;
  requireOutcome(
    Number.isSafeInteger(limit) && limit > 0 && snapshot.assignments.length <= limit,
    "assignment_bound_exceeded",
  );
  for (const value of [
    snapshot.id,
    snapshot.unit,
    input.revision,
    input.metricDefinitionVersion,
    input.inputHash,
    input.definitionHash,
  ])
    requireOutcome(outcomeText(value), "missing_provenance");
  requireOutcome(
    snapshot.arms.length > 0 &&
      snapshot.arms.length <= limit &&
      new Set(snapshot.arms).size === snapshot.arms.length &&
      snapshot.arms.every(outcomeText) &&
      snapshot.arms.includes(input.baselineArm),
    "invalid_arms",
  );
  requireOutcome(
    input.currencies.length > 0 &&
      input.currencies.length <= 100 &&
      new Set(input.currencies).size === input.currencies.length &&
      input.currencies.every((currency) => /^[A-Z]{3}$/.test(currency)),
    "invalid_currencies",
  );
  requireOutcome(
    input.sources.length > 0 &&
      input.sources.length <= 100 &&
      new Set(input.sources).size === input.sources.length &&
      input.sources.every(outcomeText),
    "invalid_sources",
  );
  requireOutcome(
    snapshot.arms.length * input.sources.length * input.currencies.length * OUTCOME_KINDS.length <=
      100000,
    "coverage_dimension_bound_exceeded",
  );
  const assignments = new Map<string, string>();
  const subjectsByArm = new Map(snapshot.arms.map((arm) => [arm, [] as string[]]));
  for (const assignment of snapshot.assignments) {
    requireOutcome(
      outcomeText(assignment.subject) &&
        snapshot.arms.includes(assignment.arm) &&
        !assignments.has(assignment.subject),
      "invalid_assignment",
    );
    assignments.set(assignment.subject, assignment.arm);
    subjectsByArm.get(assignment.arm)?.push(assignment.subject);
  }
  const normalized = new OutcomeLedgerNormalizer().normalize(input.events, {
    scope: snapshot.scope,
    cutoff: input.cutoff,
    maxEvents: input.maxEvents,
  });
  const diagnostics: AssignedOutcomeReport["diagnostics"] = [];
  const accepted: MoneyEvent[] = [];
  const payments = new Map<string, MoneyEvent>();
  const sourceEvents = new Map(
    input.events.map((row) => [outcomeKey(row.source, row.eventId), row]),
  );
  for (const event of normalized.events) {
    requireOutcome(
      input.sources.includes(event.source) && input.currencies.includes(event.currency),
      "undeclared_source_or_currency",
    );
    if (event.kind === "payment") {
      payments.set(outcomeKey(event.source, event.eventId), event);
      let current = event;
      const visited = new Set<string>();
      while (current.correctionOf) {
        const reference = outcomeKey(current.correctionOf.source, current.correctionOf.eventId);
        requireOutcome(!visited.has(reference), "correction_cycle");
        visited.add(reference);
        payments.set(reference, event);
        const previous = sourceEvents.get(reference);
        requireOutcome(previous, "invalid_correction_target");
        current = previous;
      }
    }
  }
  for (const event of normalized.events) {
    let code: "missing_subject" | "unassigned_event" | "orphan_refund" | undefined;
    if (!outcomeText(event.subject)) code = "missing_subject";
    else if (!assignments.has(event.subject)) code = "unassigned_event";
    else if (event.kind === "refund") {
      const payment = event.relatedPaymentId
        ? payments.get(outcomeKey(event.source, event.relatedPaymentId))
        : undefined;
      if (!payment || payment.subject !== event.subject || payment.currency !== event.currency)
        code = "orphan_refund";
    }
    if (code) diagnostics.push({ code, source: event.source, eventId: event.eventId });
    else accepted.push(event);
  }
  const coverage = new Map<string, AssignedOutcomeInput["costCompleteness"][number]>();
  const coverageKey = (arm: string, source: string, kind: OutcomeKind, currency: string): string =>
    JSON.stringify([arm, source, kind, currency]);
  requireOutcome(
    input.costCompleteness.length <=
      snapshot.arms.length * input.sources.length * OUTCOME_KINDS.length * input.currencies.length,
    "coverage_bound_exceeded",
  );
  for (const item of input.costCompleteness) {
    requireOutcome(
      snapshot.arms.includes(item.arm) &&
        input.sources.includes(item.source) &&
        OUTCOME_KINDS.includes(item.kind) &&
        input.currencies.includes(item.currency),
      "invalid_cost_coverage",
    );
    requireOutcome(["complete", "missing", "pending"].includes(item.status), "invalid_cost_status");
    requireOutcome(
      item.pendingCount === undefined ||
        (Number.isSafeInteger(item.pendingCount) &&
          item.pendingCount >= 0 &&
          (item.status !== "complete" || item.pendingCount === 0)),
      "invalid_pending_count",
    );
    const key = coverageKey(item.arm, item.source, item.kind, item.currency);
    requireOutcome(!coverage.has(key), "duplicate_cost_coverage");
    coverage.set(key, item);
  }
  const retention = new Map<string, boolean | null>();
  requireOutcome(
    (input.retention?.length ?? 0) <= snapshot.assignments.length,
    "retention_bound_exceeded",
  );
  for (const row of input.retention ?? []) {
    requireOutcome(
      assignments.has(row.subject) &&
        !retention.has(row.subject) &&
        (row.retained === null || typeof row.retained === "boolean"),
      "invalid_retention",
    );
    retention.set(row.subject, row.retained);
  }
  const acceptedByArmCurrency = new Map<string, MoneyEvent[]>();
  for (const event of accepted) {
    const key = JSON.stringify([
      event.currency,
      event.subject === null ? undefined : assignments.get(event.subject),
    ]);
    const bucket = acceptedByArmCurrency.get(key) ?? [];
    bucket.push(event);
    acceptedByArmCurrency.set(key, bucket);
  }
  const rejected = normalized.events.length - accepted.length;
  const byCurrency = input.currencies.map((currency) => {
    const arms = snapshot.arms.map((arm) => {
      const subjects = subjectsByArm.get(arm) ?? [];
      const totals: Record<OutcomeKind, bigint> = {
        payment: BigInt(0),
        refund: BigInt(0),
        cashback: BigInt(0),
        direct_contact_cost: BigInt(0),
        noncash_grant: BigInt(0),
      };
      const paying = new Set<string>();
      const refunded = new Set<string>();
      for (const event of acceptedByArmCurrency.get(JSON.stringify([currency, arm])) ?? []) {
        if (event.subject === null) continue;
        totals[event.kind] += BigInt(event.amountMinor);
        if (event.kind === "payment") paying.add(event.subject);
        if (event.kind === "refund") refunded.add(event.subject);
      }
      const complete =
        rejected === 0 &&
        input.sources.every((source) =>
          OUTCOME_KINDS.every(
            (kind) => coverage.get(coverageKey(arm, source, kind, currency))?.status === "complete",
          ),
        );
      if (!complete) diagnostics.push({ code: "incomplete_cost", arm, currency });
      if (subjects.length === 0) diagnostics.push({ code: "zero_denominator", arm, currency });
      const retentionKnown = subjects.every(
        (subject) => typeof retention.get(subject) === "boolean",
      );
      if (!retentionKnown) diagnostics.push({ code: "unknown_retention", arm, currency });
      const net = totals.payment - totals.refund - totals.cashback - totals.direct_contact_cost;
      return {
        arm,
        assignedUnits: subjects.length,
        components: {
          payment: totals.payment.toString(),
          refund: totals.refund.toString(),
          cashback: totals.cashback.toString(),
          direct_contact_cost: totals.direct_contact_cost.toString(),
          noncash_grant: totals.noncash_grant.toString(),
        },
        netMinor: net.toString(),
        complete,
        perUnit: complete ? outcomeRational(net, BigInt(subjects.length)) : null,
        refundRate: complete ? outcomeRational(BigInt(refunded.size), BigInt(paying.size)) : null,
        refundRateDenominator: "paying_assigned_subjects" as const,
        retentionRate: retentionKnown
          ? outcomeRational(
              BigInt(subjects.filter((subject) => retention.get(subject) === true).length),
              BigInt(subjects.length),
            )
          : null,
        retentionRateDenominator: "assigned_units" as const,
      };
    });
    const baseline = arms.find((arm) => arm.arm === input.baselineArm);
    requireOutcome(baseline, "invalid_baseline");
    return {
      currency,
      arms,
      delta: arms
        .filter((arm) => arm.arm !== input.baselineArm)
        .map((arm) => ({
          arm: arm.arm,
          baselineArm: input.baselineArm,
          value:
            arm.perUnit && baseline.perUnit
              ? outcomeRational(
                  BigInt(arm.perUnit.numerator) * BigInt(baseline.perUnit.denominator) -
                    BigInt(baseline.perUnit.numerator) * BigInt(arm.perUnit.denominator),
                  BigInt(arm.perUnit.denominator) * BigInt(baseline.perUnit.denominator),
                )
              : null,
        })),
    };
  });
  return {
    sources: [...input.sources],
    assignmentSnapshot: structuredClone(snapshot),
    cutoff: { ...input.cutoff },
    revision: input.revision,
    metricDefinitionVersion: input.metricDefinitionVersion,
    inputHash: input.inputHash,
    definitionHash: input.definitionHash,
    costCompleteness: structuredClone(input.costCompleteness),
    byCurrency,
    diagnostics,
    counts: { ...normalized.counts, accepted: accepted.length, rejected },
    quality: diagnostics.length === 0 ? "complete" : "partial",
  };
}
