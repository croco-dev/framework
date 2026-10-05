import { Problem, ProblemCategory } from "@croco/problems-core";
import type { Reminder, ReminderOccurrence } from "@croco/engagement-core";

export type ReminderOperationsRow = Readonly<{
  reminder: Reminder;
  nextLocalTime: string | null;
  occurrences: readonly ReminderOccurrence[];
}>;
export type ReminderOperationsState =
  | { kind: "loading" | "empty" }
  | { kind: "denied" | "error"; message: string }
  | { kind: "ready" | "partial"; rows: readonly ReminderOperationsRow[]; message?: string };
export type ReminderOperatorCancel = Readonly<{
  scope: Reminder["scope"];
  subject: string;
  id: string;
  expectedVersion: number;
  actor: string;
  reason: string;
  idempotencyKey: string;
}>;
export interface ReminderOperationsSource {
  load(): Promise<ReminderOperationsState>;
  cancel(request: ReminderOperatorCancel): Promise<ReminderOperationsState>;
}
export class ReminderOperationsProblem extends Problem {
  constructor(detail: string) {
    super("admin-core/reminder-operation-invalid", ProblemCategory.ValidationError, detail);
  }
}
export function assertReminderOperatorCancel(request: ReminderOperatorCancel): void {
  if (
    [
      request.scope?.app,
      request.scope?.environment,
      request.scope?.tenantId,
      request.subject,
      request.id,
      request.actor,
      request.reason,
      request.idempotencyKey,
    ].some((value) => typeof value !== "string" || !value.trim()) ||
    !Number.isSafeInteger(request.expectedVersion) ||
    request.expectedVersion < 1
  ) {
    throw new ReminderOperationsProblem(
      "Cancellation requires scope, subject, actor, reason, idempotency key and current version.",
    );
  }
}
export async function loadReminderOperations(
  source: ReminderOperationsSource,
  permissions: readonly string[],
): Promise<ReminderOperationsState> {
  if (!permissions.includes("reminder.read"))
    return { kind: "denied", message: "Reminder read permission is required." };
  return source.load();
}
