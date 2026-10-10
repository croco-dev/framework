import { OutcomeProblem } from "./OutcomeProblem";
import type { MoneyEvent, OutcomeCutoff, OutcomeScope } from "./types";

export const OUTCOME_KINDS = [
  "payment",
  "refund",
  "cashback",
  "direct_contact_cost",
  "noncash_grant",
] as const;
export const OUTCOME_DEFAULT_MAX_EVENTS = 100000;
export const OUTCOME_DEFAULT_MAX_ASSIGNMENTS = 100000;

export function requireOutcome(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new OutcomeProblem(reason);
}
export function outcomeText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 1024;
}
export function outcomeTime(value: string): number {
  requireOutcome(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value),
    "invalid_time",
  );
  const time = Date.parse(value);
  requireOutcome(
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 19) === value.slice(0, 19),
    "invalid_time",
  );
  return time;
}
export function outcomeScope(scope: OutcomeScope): void {
  requireOutcome(
    scope && outcomeText(scope.app) && outcomeText(scope.environment) && outcomeText(scope.tenant),
    "invalid_scope",
  );
}
export function sameOutcomeScope(a: OutcomeScope, b: OutcomeScope): boolean {
  return a.app === b.app && a.environment === b.environment && a.tenant === b.tenant;
}
export function outcomeKey(source: string, eventId: string): string {
  return JSON.stringify([source, eventId]);
}
export function canonicalOutcomeJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalOutcomeJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalOutcomeJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export class OutcomeLedgerNormalizer {
  normalize(
    events: readonly MoneyEvent[],
    options: { scope: OutcomeScope; cutoff: OutcomeCutoff; maxEvents?: number },
  ): {
    events: MoneyEvent[];
    counts: { received: number; duplicates: number; excludedByCutoff: number; superseded: number };
  } {
    outcomeScope(options.scope);
    const effective = outcomeTime(options.cutoff.effectiveAt);
    const known = outcomeTime(options.cutoff.knownAt);
    const limit = options.maxEvents ?? OUTCOME_DEFAULT_MAX_EVENTS;
    requireOutcome(
      Number.isSafeInteger(limit) && limit > 0 && events.length <= limit,
      "event_bound_exceeded",
    );
    const unique = new Map<string, MoneyEvent>();
    const payloads = new Map<string, string>();
    const counts = { received: events.length, duplicates: 0, excludedByCutoff: 0, superseded: 0 };
    for (const event of events) {
      outcomeScope(event.scope);
      requireOutcome(sameOutcomeScope(event.scope, options.scope), "scope_mismatch");
      requireOutcome(
        outcomeText(event.source) && outcomeText(event.eventId),
        "invalid_source_reference",
      );
      requireOutcome(OUTCOME_KINDS.includes(event.kind), "invalid_kind");
      requireOutcome(
        typeof event.amountMinor === "string" &&
          /^(0|[1-9]\d*)$/.test(event.amountMinor) &&
          event.amountMinor.length <= 1000,
        "invalid_amount_minor",
      );
      requireOutcome(
        typeof event.currency === "string" && /^[A-Z]{3}$/.test(event.currency),
        "invalid_currency",
      );
      requireOutcome(
        event.valuationKind === (event.kind === "noncash_grant" ? "face_value" : "cash"),
        "invalid_valuation_kind",
      );
      outcomeTime(event.occurredAt);
      outcomeTime(event.observedAt);
      if (event.relatedPaymentId !== undefined)
        requireOutcome(outcomeText(event.relatedPaymentId), "invalid_payment_reference");
      if (event.correctionOf)
        requireOutcome(
          outcomeText(event.correctionOf.source) && outcomeText(event.correctionOf.eventId),
          "invalid_correction_reference",
        );
      const key = outcomeKey(event.source, event.eventId);
      const payload = canonicalOutcomeJson(event);
      if (payloads.has(key)) {
        requireOutcome(payloads.get(key) === payload, "conflicting_event_payload");
        counts.duplicates++;
      } else {
        payloads.set(key, payload);
        unique.set(key, event);
      }
    }
    const eligible = new Map<string, MoneyEvent>();
    for (const [key, event] of unique) {
      if (outcomeTime(event.occurredAt) > effective || outcomeTime(event.observedAt) > known)
        counts.excludedByCutoff++;
      else eligible.set(key, event);
    }
    const superseded = new Set<string>();
    const reachable = new Map(eligible);
    for (const [key, event] of reachable) {
      if (!event.correctionOf) continue;
      const targetKey = outcomeKey(event.correctionOf.source, event.correctionOf.eventId);
      const target = unique.get(targetKey);
      requireOutcome(
        target &&
          outcomeTime(target.observedAt) <= known &&
          targetKey !== key &&
          !superseded.has(targetKey),
        "invalid_correction_target",
      );
      requireOutcome(
        target.source === event.source &&
          target.subject === event.subject &&
          target.kind === event.kind &&
          target.currency === event.currency &&
          target.relatedPaymentId === event.relatedPaymentId,
        "correction_identity_mismatch",
      );
      requireOutcome(
        outcomeTime(event.observedAt) > outcomeTime(target.observedAt),
        "correction_order_invalid",
      );
      superseded.add(targetKey);
      reachable.set(targetKey, target);
    }
    counts.superseded = superseded.size;
    return {
      events: [...eligible]
        .filter(([key]) => !superseded.has(key))
        .map(([, event]) => structuredClone(event)),
      counts,
    };
  }
}
