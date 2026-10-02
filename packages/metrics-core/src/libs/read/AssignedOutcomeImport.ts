import { decodeSource } from "@croco/etl-core/source";
import type { SourceLimits, SourceSchema } from "@croco/etl-core/source";
import { OutcomeProblem } from "../outcome/OutcomeProblem";
import {
  OutcomeLedgerNormalizer,
  outcomeText,
  requireOutcome,
} from "../outcome/OutcomeLedgerNormalizer";
import type { MoneyEvent, OutcomeCutoff, OutcomeScope } from "../outcome/types";

export const ASSIGNED_OUTCOME_FIELDS = [
  "app",
  "environment",
  "tenant",
  "source",
  "eventId",
  "subject",
  "kind",
  "amountMinor",
  "currency",
  "occurredAt",
  "observedAt",
  "relatedPaymentId",
  "valuationKind",
  "correctionSource",
  "correctionEventId",
] as const;
const nullable = new Set<string>([
  "subject",
  "relatedPaymentId",
  "correctionSource",
  "correctionEventId",
]);
export function assignedOutcomeSourceSchema(
  format: "csv" | "jsonl",
  limits: SourceLimits,
): SourceSchema {
  return {
    format,
    encoding: "utf-8",
    limits,
    fields: ASSIGNED_OUTCOME_FIELDS.map((name) => ({
      name,
      type: "string",
      nullable: nullable.has(name),
      ...(nullable.has(name) ? { nullValues: [""] } : {}),
    })),
  };
}
export class AssignedOutcomeRowProblem extends OutcomeProblem {
  constructor(
    readonly row: number,
    reason: string,
  ) {
    super(`row_${row}:${reason}`);
  }
}
export function parseAssignedOutcomeRow(
  row: Readonly<Record<string, unknown>>,
  ordinal: number,
): MoneyEvent {
  try {
    for (const field of ASSIGNED_OUTCOME_FIELDS)
      requireOutcome(
        nullable.has(field)
          ? row[field] === null || typeof row[field] === "string"
          : typeof row[field] === "string",
        "invalid_row_field",
      );
    const text = (field: (typeof ASSIGNED_OUTCOME_FIELDS)[number]): string => {
      const value = row[field];
      requireOutcome(typeof value === "string", "invalid_row_field");
      return value;
    };
    const subject = row.subject;
    requireOutcome(subject === null || typeof subject === "string", "invalid_subject");
    requireOutcome(
      (row.correctionSource === null) === (row.correctionEventId === null),
      "incomplete_correction_reference",
    );
    const kind = text("kind");
    requireOutcome(
      ["payment", "refund", "cashback", "direct_contact_cost", "noncash_grant"].includes(kind),
      "invalid_kind",
    );
    const valuationKind = text("valuationKind");
    requireOutcome(
      valuationKind === "cash" || valuationKind === "face_value",
      "invalid_valuation_kind",
    );
    const event: MoneyEvent = {
      scope: { app: text("app"), environment: text("environment"), tenant: text("tenant") },
      source: text("source"),
      eventId: text("eventId"),
      subject,
      kind: kind as MoneyEvent["kind"],
      amountMinor: text("amountMinor"),
      currency: text("currency"),
      occurredAt: text("occurredAt"),
      observedAt: text("observedAt"),
      valuationKind,
      ...(row.relatedPaymentId === null ? {} : { relatedPaymentId: text("relatedPaymentId") }),
    };
    new OutcomeLedgerNormalizer().normalize([event], {
      scope: event.scope,
      cutoff: { effectiveAt: event.occurredAt, knownAt: event.observedAt },
    });
    if (row.correctionSource !== null) {
      requireOutcome(
        outcomeText(row.correctionSource) && outcomeText(row.correctionEventId),
        "invalid_correction_reference",
      );
      event.correctionOf = { source: row.correctionSource, eventId: row.correctionEventId };
    }
    return event;
  } catch (error) {
    if (error instanceof OutcomeProblem) throw new AssignedOutcomeRowProblem(ordinal, error.reason);
    throw error;
  }
}
export async function importAssignedOutcomeEvents(
  bytes: AsyncIterable<Uint8Array>,
  options: {
    format: "csv" | "jsonl";
    limits: SourceLimits;
    scope: OutcomeScope;
    cutoff: OutcomeCutoff;
  },
): Promise<MoneyEvent[]> {
  const events: MoneyEvent[] = [];
  for await (const row of decodeSource(
    bytes,
    assignedOutcomeSourceSchema(options.format, options.limits),
  ))
    events.push(parseAssignedOutcomeRow(row, events.length + 1));
  new OutcomeLedgerNormalizer().normalize(events, {
    scope: options.scope,
    cutoff: options.cutoff,
    maxEvents: options.limits.maxRecords,
  });
  return events;
}
