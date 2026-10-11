import { Problem, ProblemCategory } from "@croco/problems-core";

export type EventSourceEnvelope = {
  readonly sourceRef: string;
  readonly outboxMessageId: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly subject: string;
  readonly occurredAt: string;
  readonly origin: string;
};

export class EventSourceEnvelopeProblem extends Problem {
  readonly code = "etl-core/invalid-event-envelope";
  readonly category = ProblemCategory.ValidationError;

  constructor() {
    super(undefined, undefined, "The confirmed source event envelope is invalid.");
  }
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validOccurrence(value: string): boolean {
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(
      value,
    );
  if (!parts) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (monthDays[month - 1] ?? 0) &&
    Number(hourText) <= 23 &&
    Number(minuteText) <= 59 &&
    Number(secondText) <= 59 &&
    (zone === "Z" || Number(zone.slice(1, 3)) < 14 || zone.endsWith(":00"))
  );
}

export function parseEventSourceEnvelope(value: unknown): EventSourceEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EventSourceEnvelopeProblem();
  }

  const input = value as Record<string, unknown>;
  if (
    !nonBlank(input.sourceRef) ||
    !nonBlank(input.outboxMessageId) ||
    !nonBlank(input.eventId) ||
    !nonBlank(input.eventType) ||
    !Number.isSafeInteger(input.schemaVersion) ||
    Number(input.schemaVersion) < 1 ||
    !nonBlank(input.subject) ||
    !nonBlank(input.origin) ||
    !nonBlank(input.occurredAt)
  ) {
    throw new EventSourceEnvelopeProblem();
  }

  if (!validOccurrence(input.occurredAt)) {
    throw new EventSourceEnvelopeProblem();
  }
  const occurredAt = new Date(input.occurredAt);
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new EventSourceEnvelopeProblem();
  }

  return {
    sourceRef: input.sourceRef,
    outboxMessageId: input.outboxMessageId,
    eventId: input.eventId,
    eventType: input.eventType,
    schemaVersion: Number(input.schemaVersion),
    subject: input.subject,
    occurredAt: occurredAt.toISOString(),
    origin: input.origin,
  };
}
