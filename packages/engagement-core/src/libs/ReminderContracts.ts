import { Problem, ProblemCategory } from "@croco/problems-core";
import type { ContactPolicyScope } from "./ContactPolicy";
import type { MessageChannel } from "./MessageContracts";

export type ReminderScope = ContactPolicyScope;
export type ReminderSchedule = Readonly<{ localTime: string; weekdays: readonly number[] }>;
export type ReminderInput = Readonly<{
  topic: string;
  resourceRef: string;
  timezone: string;
  schedule: ReminderSchedule;
  channel: MessageChannel;
  lateDeliveryMs: number;
}>;
export type Reminder = ReminderInput &
  Readonly<{
    id: string;
    scope: ReminderScope;
    subject: string;
    version: number;
    state: "active" | "snoozed" | "canceled";
    nextScheduledAt: Date | null;
  }>;
export type ReminderOccurrence = Readonly<{
  id: string;
  reminderId: string;
  reminderVersion: number;
  scheduledAt: Date;
  state: "pending" | "claimed" | "queued" | "suppressed" | "expired" | "unknown";
  reason?:
    | "canceled"
    | "superseded"
    | "preference"
    | "suppression"
    | "no-endpoint"
    | "resource-completed"
    | "resource-deleted"
    | "skip-missed"
    | "send-failed"
    | "acceptance-unknown";
  executionIds: readonly string[];
}>;
export type ReminderMutation = Readonly<{
  idempotencyKey: string;
  fingerprint: string;
  actor: string;
  reason: string;
  recordedAt: Date;
  result: Reminder;
  occurrenceId?: string;
  evidence?: string;
  outcome?: "accepted" | "not-accepted";
}>;
export interface ReminderTransaction {
  readonly reminders: readonly Reminder[];
  readonly occurrences: readonly ReminderOccurrence[];
  readonly mutations: readonly ReminderMutation[];
  saveReminder(reminder: Reminder): void;
  saveOccurrence(occurrence: ReminderOccurrence): void;
  saveMutation(mutation: ReminderMutation): void;
}
/** Serializes each app/environment/tenant/subject, including an initially empty subject. */
export interface ReminderStore {
  transact<T>(
    scope: ReminderScope,
    subject: string,
    operation: (transaction: ReminderTransaction) => Promise<T>,
  ): Promise<T>;
}
export type ReminderActor = Readonly<{ id: string; reason: string }>;
export type ReminderAccess = Readonly<{
  scope: ReminderScope;
  subject: string;
  actor: ReminderActor;
}>;
export type ReminderCommand = ReminderAccess & Readonly<{ idempotencyKey: string }>;
export type ReminderRevisionCommand = ReminderCommand &
  Readonly<{ id: string; expectedVersion: number }>;

export class ReminderInvalidProblem extends Problem {
  constructor(detail: string) {
    super("engagement-core/reminder-invalid", ProblemCategory.ValidationError, detail);
  }
}
export class ReminderConflictProblem extends Problem {
  constructor(detail: string) {
    super("engagement-core/reminder-conflict", ProblemCategory.Conflict, detail);
  }
}
export class ReminderAccessDeniedProblem extends Problem {
  constructor() {
    super(
      "engagement-core/reminder-access-denied",
      ProblemCategory.Forbidden,
      "Reminder access requires a verified subject and server permission",
    );
  }
}
export class ReminderNotFoundProblem extends Problem {
  constructor() {
    super(
      "engagement-core/reminder-not-found",
      ProblemCategory.NotFound,
      "Reminder does not exist in the requested subject scope",
    );
  }
}
export function assertReminderScope(scope: ReminderScope, subject: string): void {
  if (!scope || typeof scope !== "object")
    throw new ReminderInvalidProblem("A reminder scope is required");
  if (
    [scope.app, scope.environment, scope.tenantId, subject].some(
      (value) => typeof value !== "string" || !value.trim(),
    )
  )
    throw new ReminderInvalidProblem("App, environment, tenant and subject are required");
}
export function reminderOccurrenceId(reminder: Reminder, scheduledAt: Date): string {
  return JSON.stringify([
    reminder.scope.app,
    reminder.scope.environment,
    reminder.scope.tenantId,
    reminder.subject,
    reminder.id,
    reminder.version,
    scheduledAt.toISOString(),
  ]);
}
export function assertReminderInput(input: ReminderInput): void {
  if (!input || typeof input !== "object")
    throw new ReminderInvalidProblem("Reminder input must be an object");
  if (
    typeof input.topic !== "string" ||
    typeof input.resourceRef !== "string" ||
    !input.topic.trim() ||
    !input.resourceRef?.trim() ||
    !["email", "push", "sms", "inApp"].includes(input.channel) ||
    !Number.isSafeInteger(input.lateDeliveryMs) ||
    input.lateDeliveryMs < 0
  )
    throw new ReminderInvalidProblem(
      "Topic, resource, channel and an explicit nonnegative late delivery window are required",
    );
  assertReminderSchedule(input.schedule, input.timezone);
}
export function assertReminderSchedule(schedule: ReminderSchedule, timezone: string): void {
  if (
    !schedule ||
    typeof schedule !== "object" ||
    typeof schedule.localTime !== "string" ||
    !Array.isArray(schedule.weekdays)
  )
    throw new ReminderInvalidProblem("Schedule requires a local time and weekdays");
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.localTime) ||
    schedule.weekdays.length === 0 ||
    new Set(schedule.weekdays).size !== schedule.weekdays.length ||
    schedule.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    throw new ReminderInvalidProblem(
      "Schedule requires HH:mm and unique weekdays 0 (Sunday) through 6",
    );
  if (typeof timezone !== "string" || !timezone.trim() || /^[+-]/.test(timezone))
    throw new ReminderInvalidProblem("An IANA timezone is required");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    throw new ReminderInvalidProblem("Timezone is not a supported IANA identifier");
  }
}

export class ReminderDispatchProblem extends Problem {
  constructor(cause: unknown) {
    super(
      "engagement-core/reminder-dispatch-failed",
      ProblemCategory.InternalServerError,
      "Reminder dispatch acceptance is unknown; inspect provider evidence before reconciliation",
      {
        cause: cause instanceof Error ? cause : new Error(String(cause)),
        extensions: { retryable: false },
      },
    );
  }
}
