import {
  hashAssignedOutcomeInput,
  hashAssignedOutcomeDefinition,
  ASSIGNED_OUTCOME_DEFINITION,
} from "@croco/metrics-core";
import {
  createAssignedOutcomeQuery,
  MetricReadService,
  parseAssignedOutcomeReport,
} from "@croco/metrics-core/runtime";
import { createNetOutcomeOperations, NetOutcomeProblem } from "@croco/admin-core";
import type { AssignedOutcomeInput, AssignedOutcomeReport, MoneyEvent } from "@croco/metrics-core";
import type { NetOutcomeRequest } from "@croco/admin-core";
export const request: NetOutcomeRequest = {
  cutoff: { effectiveAt: "2026-09-30T00:00:00.000Z", knownAt: "2026-10-01T00:00:00.000Z" },
  revision: "1",
};
export const scope = { app: "golden-example", environment: "test", tenant: "sanitized" };
export async function goldenInput(
  selected: NetOutcomeRequest = request,
): Promise<AssignedOutcomeInput> {
  const assignments = Array.from({ length: 200 }, (_, index) => ({
    subject: `unit-${index}`,
    arm: index < 100 ? "control" : "treatment",
  }));
  const events: MoneyEvent[] = [];
  for (const index of [0, 100]) {
    const assignment = assignments[index];
    if (!assignment) throw new Error("Missing assigned subject");
    events.push({
      scope,
      source: "ledger",
      eventId: `payment-${index}`,
      subject: assignment.subject,
      kind: "payment",
      amountMinor: assignment.arm === "control" ? "100000" : "110000",
      currency: "USD",
      occurredAt: "2026-09-01T00:00:00.000Z",
      observedAt: "2026-09-01T00:00:00.000Z",
      valuationKind: "cash",
    });
  }
  const sample = events[1];
  if (!sample) throw new Error("Missing treatment event");
  const control = events[0];
  if (!control) throw new Error("Missing control event");
  events.push({
    ...control,
    eventId: "refund-control",
    kind: "refund",
    amountMinor: "20000",
    relatedPaymentId: "payment-0",
  });
  events.push({
    ...sample,
    eventId: "refund-treatment",
    kind: "refund",
    amountMinor: "15000",
    relatedPaymentId: "payment-100",
  });
  events.push({ ...sample, eventId: "cashback-treatment", kind: "cashback", amountMinor: "20000" });
  events.push({
    ...sample,
    eventId: "contact-treatment",
    kind: "direct_contact_cost",
    amountMinor: "1000",
  });
  events.push({
    ...sample,
    eventId: "grant-treatment",
    kind: "noncash_grant",
    amountMinor: "500",
    valuationKind: "face_value",
  });
  const input: AssignedOutcomeInput = {
    assignmentSnapshot: {
      id: "golden-100-per-arm",
      scope,
      unit: "person",
      arms: ["control", "treatment"],
      assignments,
    },
    events,
    cutoff: selected.cutoff,
    revision: selected.revision,
    metricDefinitionVersion: ASSIGNED_OUTCOME_DEFINITION.version,
    inputHash: "",
    definitionHash: await hashAssignedOutcomeDefinition(),
    currencies: ["USD"],
    sources: ["ledger"],
    baselineArm: "control",
    costCompleteness: ["control", "treatment"].flatMap((arm) =>
      (["payment", "refund", "cashback", "direct_contact_cost", "noncash_grant"] as const).map(
        (kind) => ({ arm, kind, currency: "USD", source: "ledger", status: "complete" as const }),
      ),
    ),
    retention: assignments.map((assignment, index) => ({
      subject: assignment.subject,
      retained: index % 5 !== 0,
    })),
  };
  input.inputHash = await hashAssignedOutcomeInput(input);
  return input;
}
export function createExample(mode = "ready") {
  return createNetOutcomeOperations(
    {
      async read(selected) {
        if (mode === "error") throw new Error("example failure");
        if (mode === "empty") return null;
        const input = await goldenInput(selected);
        if (mode === "partial") {
          input.costCompleteness = input.costCompleteness.map((cost) =>
            cost.arm === "treatment" && cost.kind === "direct_contact_cost"
              ? { ...cost, status: "pending", pendingCount: 2 }
              : cost,
          );
          input.inputHash = await hashAssignedOutcomeInput(input);
        }
        return readRegisteredInput(input);
      },
      async drilldown(selected) {
        const input = await goldenInput(selected);
        const subjects = new Set(
          input.assignmentSnapshot.assignments
            .filter((entry) => entry.arm === selected.arm)
            .map((entry) => entry.subject),
        );
        const rows = input.events.filter(
          (event) =>
            event.subject &&
            subjects.has(event.subject) &&
            event.currency === selected.currency &&
            event.source === selected.source &&
            event.occurredAt <= selected.cutoff.effectiveAt &&
            event.observedAt <= selected.cutoff.knownAt,
        );
        return {
          rows: rows.slice(0, selected.limit).map((event) => ({
            kind: event.kind,
            occurredAt: event.occurredAt,
            maskedReference: "[masked]",
          })),
          truncated: rows.length > selected.limit,
          assumptions: [
            `Arm ${selected.arm}`,
            `Currency ${selected.currency}`,
            `Source ${selected.source}`,
            `Through ${selected.cutoff.effectiveAt}`,
            "Synthetic assigned population; event references masked; no causal assumption",
          ],
        };
      },
    },
    {
      currentScope: () => scope,
      authorize: async () =>
        mode === "denied" ? null : { permissionEpoch: "1", privacyEpoch: "1" },
    },
  );
}

/** The raw fixture remains inside the server; only the sanitized admin report crosses HTTP. */
async function readRegisteredInput(input: AssignedOutcomeInput): Promise<AssignedOutcomeReport> {
  const budget = {
    maxWindowMs: 366 * 86400000,
    maxRows: 1000,
    maxBytes: 1000000,
    maxTimeMs: 5000,
    maxConcurrency: 1,
    maxCost: 1000,
  };
  const { definition, query } = await createAssignedOutcomeQuery({
    id: "assigned-outcomes",
    sourceRefs: ["ledger"],
    limits: budget,
  });
  const context = {
    principal: { ...scope, subject: "example-server" },
    allowedFields: definition.requiredFields,
    allowRaw: true,
    budget,
    sourceRevisions: [{ sourceRef: "ledger", revision: input.revision }],
    snapshotRefs: [input.assignmentSnapshot.id],
  };
  const service = new MetricReadService([definition], [query], {
    currentContext: () => context,
    authorize: async () => ({ permissionEpoch: "1", privacyEpoch: "1" }),
  });
  const result = await service.runRegisteredQuery(query.id, input, {
    from: "2026-01-01T00:00:00.000Z",
    to: new Date(Date.parse(input.cutoff.effectiveAt) + 1).toISOString(),
  });
  if (result.status !== "verified" && result.status !== "partial")
    throw new NetOutcomeProblem("source-unavailable");
  if (!result.result) throw new NetOutcomeProblem("source-unavailable");
  return parseAssignedOutcomeReport(result.result.data, input.definitionHash);
}
