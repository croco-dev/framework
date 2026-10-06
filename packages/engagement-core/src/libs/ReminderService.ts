import {
  assertReminderInput,
  assertReminderScope,
  reminderOccurrenceId,
  ReminderAccessDeniedProblem,
  ReminderConflictProblem,
  ReminderDispatchProblem,
  ReminderInvalidProblem,
  ReminderNotFoundProblem,
} from "./ReminderContracts";
import { nextOccurrence } from "./nextOccurrence";
import type { EngagementSendResult } from "./EngagementService";
import type {
  Reminder,
  ReminderAccess,
  ReminderCommand,
  ReminderInput,
  ReminderOccurrence,
  ReminderRevisionCommand,
  ReminderStore,
  ReminderTransaction,
} from "./ReminderContracts";

export type ReminderServiceOptions = Readonly<{
  store: ReminderStore;
  clock: () => Date;
  authorize: (access: ReminderAccess, action: "read" | "write" | "operate") => Promise<boolean>;
  validateInput: (access: ReminderAccess, input: ReminderInput) => Promise<void>;
  resourceState: (reminder: Reminder) => Promise<"active" | "completed" | "deleted">;
  send: (reminder: Reminder, occurrence: ReminderOccurrence) => Promise<EngagementSendResult>;
}>;

export class ReminderService {
  constructor(private readonly options: ReminderServiceOptions) {}

  async create(command: ReminderCommand & { id: string; input: ReminderInput }): Promise<Reminder> {
    command = structuredClone(command);
    await this.authorize(command, "write", true);
    assertReminderInput(command.input);
    await this.options.validateInput(structuredClone(command), structuredClone(command.input));
    if (!command.id?.trim()) throw new ReminderInvalidProblem("Reminder id is required");
    return this.mutate(
      command,
      ["create", command.id, inputFingerprint(command.input)],
      (transaction, now) => {
        if (transaction.reminders.some((item) => item.id === command.id))
          throw new ReminderConflictProblem("Reminder id already exists");
        const reminder: Reminder = {
          ...snapshotInput(command.input),
          id: command.id,
          scope: structuredClone(command.scope),
          subject: command.subject,
          version: 1,
          state: "active",
          nextScheduledAt: nextOccurrence(command.input.schedule, command.input.timezone, now),
        };
        transaction.saveReminder(reminder);
        return reminder;
      },
    );
  }

  async update(command: ReminderRevisionCommand & { input: ReminderInput }): Promise<Reminder> {
    command = structuredClone(command);
    await this.authorize(command, "write", true);
    assertReminderInput(command.input);
    await this.options.validateInput(structuredClone(command), structuredClone(command.input));
    return this.mutate(
      command,
      ["update", command.id, command.expectedVersion, inputFingerprint(command.input)],
      (transaction, now) => {
        const existing = this.revision(transaction, command);
        this.requireEnabled(existing);
        const reminder: Reminder = {
          ...existing,
          ...snapshotInput(command.input),
          version: existing.version + 1,
          state: "active",
          nextScheduledAt: nextOccurrence(command.input.schedule, command.input.timezone, now),
        };
        this.invalidate(transaction, existing.id, "superseded");
        transaction.saveReminder(reminder);
        return reminder;
      },
    );
  }

  async snooze(command: ReminderRevisionCommand & { until: Date }): Promise<Reminder> {
    command = structuredClone(command);
    await this.authorize(command, "write", true);
    return this.mutate(
      command,
      ["snooze", command.id, command.expectedVersion, command.until],
      (transaction, now) => {
        if (
          !(command.until instanceof Date) ||
          !Number.isFinite(command.until.getTime()) ||
          command.until <= now
        )
          throw new ReminderInvalidProblem("Snooze must end in the future");
        const existing = this.revision(transaction, command);
        this.requireEnabled(existing);
        const reminder: Reminder = {
          ...existing,
          version: existing.version + 1,
          state: "snoozed",
          nextScheduledAt: new Date(command.until),
        };
        this.invalidate(transaction, existing.id, "superseded");
        transaction.saveReminder(reminder);
        return reminder;
      },
    );
  }

  async cancel(command: ReminderRevisionCommand): Promise<Reminder> {
    command = structuredClone(command);
    await this.authorize(command, "write");
    return this.mutate(command, ["cancel", command.id, command.expectedVersion], (transaction) => {
      const existing = this.revision(transaction, command);
      const reminder: Reminder = {
        ...existing,
        version: existing.version + 1,
        state: "canceled",
        nextScheduledAt: null,
      };
      this.invalidate(transaction, existing.id, "canceled");
      transaction.saveReminder(reminder);
      return reminder;
    });
  }

  async list(access: ReminderAccess): Promise<readonly Reminder[]> {
    access = structuredClone(access);
    await this.authorize(access, "read");
    return this.options.store.transact(
      access.scope,
      access.subject,
      async (transaction) => transaction.reminders,
    );
  }

  async history(access: ReminderAccess): Promise<readonly ReminderOccurrence[]> {
    access = structuredClone(access);
    await this.authorize(access, "read");
    return this.options.store.transact(
      access.scope,
      access.subject,
      async (transaction) => transaction.occurrences,
    );
  }

  async dueOccurrences(access: ReminderAccess): Promise<readonly ReminderOccurrence[]> {
    access = structuredClone(access);
    await this.authorize(access, "operate");
    return this.materialize(access);
  }

  async runDue(access: ReminderAccess): Promise<readonly ReminderOccurrence[]> {
    access = structuredClone(access);
    await this.authorize(access, "operate");
    const referenceTime = this.now();
    const occurrences = await this.materialize(access, referenceTime);
    for (const occurrence of occurrences) {
      if (occurrence.state !== "pending" && occurrence.state !== "claimed") continue;
      const admitted = await this.options.store.transact(
        access.scope,
        access.subject,
        async (transaction) => {
          const current = transaction.occurrences.find((item) => item.id === occurrence.id);
          if (
            !current ||
            (current.state !== "pending" && current.state !== "claimed") ||
            current.scheduledAt > referenceTime
          )
            return undefined;
          transaction.saveOccurrence({ ...current, state: "claimed" });
          const reminder = transaction.reminders.find((item) => item.id === current.reminderId);
          if (!reminder) throw new ReminderNotFoundProblem();
          let reason: ReminderOccurrence["reason"];
          if (reminder.state === "canceled") reason = "canceled";
          else if (reminder.version !== current.reminderVersion) reason = "superseded";
          else if (
            referenceTime.getTime() - current.scheduledAt.getTime() >
            reminder.lateDeliveryMs
          )
            reason = "skip-missed";
          if (!reason) {
            const state = await this.options.resourceState(structuredClone(reminder));
            if (state === "completed") reason = "resource-completed";
            else if (state === "deleted") reason = "resource-deleted";
            else if (state !== "active")
              throw new ReminderInvalidProblem(
                "Resource state must be active, completed or deleted",
              );
          }
          if (reason) {
            transaction.saveOccurrence({
              ...current,
              state: reason === "skip-missed" ? "expired" : "suppressed",
              reason,
            });
            return undefined;
          }
          const admittedOccurrence: ReminderOccurrence = {
            ...current,
            state: "unknown",
            reason: "acceptance-unknown",
          };
          transaction.saveOccurrence(admittedOccurrence);
          return { reminder, occurrence: admittedOccurrence };
        },
      );
      if (!admitted) continue;
      let result: EngagementSendResult;
      try {
        result = await this.options.send(
          structuredClone(admitted.reminder),
          structuredClone(admitted.occurrence),
        );
      } catch (cause) {
        await this.options.store.transact(access.scope, access.subject, async (transaction) => {
          const current = transaction.occurrences.find((item) => item.id === occurrence.id);
          if (current?.state === "unknown")
            transaction.saveOccurrence({ ...current, reason: "send-failed" });
        });
        throw new ReminderDispatchProblem(cause);
      }
      await this.options.store.transact(access.scope, access.subject, async (transaction) => {
        const current = transaction.occurrences.find((item) => item.id === occurrence.id);
        if (current?.state !== "unknown") return;
        if (result.status === "queued")
          transaction.saveOccurrence({
            ...current,
            state: "queued",
            reason: undefined,
            executionIds: [...result.executionIds],
          });
        else transaction.saveOccurrence({ ...current, state: "suppressed", reason: result.reason });
      });
    }
    return this.options.store.transact(
      access.scope,
      access.subject,
      async (transaction) => transaction.occurrences,
    );
  }

  async reconcile(
    command: ReminderCommand & {
      occurrenceId: string;
      evidence: string;
      outcome: "accepted" | "not-accepted";
      executionIds: readonly string[];
    },
  ): Promise<Reminder> {
    command = structuredClone(command);
    await this.authorize(command, "operate");
    if (
      !command.evidence?.trim() ||
      !["accepted", "not-accepted"].includes(command.outcome) ||
      (command.outcome === "accepted" &&
        (command.executionIds.length === 0 || command.executionIds.some((id) => !id.trim()))) ||
      (command.outcome === "not-accepted" && command.executionIds.length > 0)
    )
      throw new ReminderInvalidProblem(
        "Reconciliation requires evidence and execution ids matching the acceptance outcome",
      );
    return this.mutate(
      command,
      ["reconcile", command.occurrenceId, command.evidence, command.outcome, command.executionIds],
      (transaction) => {
        const occurrence = transaction.occurrences.find((item) => item.id === command.occurrenceId);
        if (!occurrence) throw new ReminderNotFoundProblem();
        if (occurrence.state !== "unknown")
          throw new ReminderConflictProblem("Only unknown acceptance can be reconciled");
        const reminder = transaction.reminders.find((item) => item.id === occurrence.reminderId);
        if (!reminder) throw new ReminderNotFoundProblem();
        transaction.saveOccurrence({
          ...occurrence,
          state: command.outcome === "accepted" ? "queued" : "suppressed",
          executionIds: [...command.executionIds],
          reason: command.outcome === "accepted" ? undefined : "send-failed",
        });
        return reminder;
      },
      { occurrenceId: command.occurrenceId, evidence: command.evidence, outcome: command.outcome },
    );
  }

  private async materialize(
    access: ReminderAccess,
    referenceTime = this.now(),
  ): Promise<readonly ReminderOccurrence[]> {
    return this.options.store.transact(access.scope, access.subject, async (transaction) => {
      const now = referenceTime;
      for (const reminder of transaction.reminders) {
        if (
          reminder.state === "canceled" ||
          !reminder.nextScheduledAt ||
          reminder.nextScheduledAt > now
        )
          continue;
        let scheduledAt = reminder.nextScheduledAt;
        const expiredSnooze =
          reminder.state === "snoozed" &&
          now.getTime() - scheduledAt.getTime() > reminder.lateDeliveryMs;
        if (expiredSnooze) {
          const snoozeId = reminderOccurrenceId(reminder, scheduledAt);
          if (!transaction.occurrences.some((item) => item.id === snoozeId)) {
            transaction.saveOccurrence({
              id: snoozeId,
              reminderId: reminder.id,
              reminderVersion: reminder.version,
              scheduledAt: new Date(scheduledAt),
              state: "expired",
              reason: "skip-missed",
              executionIds: [],
            });
          }
        }
        if (reminder.state === "active" || expiredSnooze) {
          let cursor = new Date(
            Math.max(
              scheduledAt.getTime() - (expiredSnooze ? 0 : 1),
              now.getTime() - 8 * 86_400_000,
            ),
          );
          for (let step = 0; step < 10; step++) {
            const candidate = nextOccurrence(reminder.schedule, reminder.timezone, cursor);
            if (candidate > now) break;
            scheduledAt = candidate;
            cursor = candidate;
          }
        }
        for (const occurrence of transaction.occurrences) {
          if (
            occurrence.reminderId === reminder.id &&
            occurrence.scheduledAt < scheduledAt &&
            (occurrence.state === "pending" || occurrence.state === "claimed")
          ) {
            transaction.saveOccurrence({ ...occurrence, state: "expired", reason: "skip-missed" });
          }
        }
        const expired = now.getTime() - scheduledAt.getTime() > reminder.lateDeliveryMs;
        const id = reminderOccurrenceId(reminder, scheduledAt);
        if (!transaction.occurrences.some((item) => item.id === id))
          transaction.saveOccurrence({
            id,
            reminderId: reminder.id,
            reminderVersion: reminder.version,
            scheduledAt: new Date(scheduledAt),
            state: expired ? "expired" : "pending",
            ...(expired ? { reason: "skip-missed" as const } : {}),
            executionIds: [],
          });
        transaction.saveReminder({
          ...reminder,
          state: "active",
          nextScheduledAt: nextOccurrence(reminder.schedule, reminder.timezone, now),
        });
      }
      return transaction.occurrences;
    });
  }

  private async authorize(
    access: ReminderAccess,
    action: "read" | "write" | "operate",
    ownerOnly = false,
  ): Promise<void> {
    assertReminderScope(access.scope, access.subject);
    if (
      !access.actor?.id?.trim() ||
      !access.actor.reason?.trim() ||
      (ownerOnly && access.actor.id !== access.subject)
    )
      throw new ReminderAccessDeniedProblem();
    if (!(await this.options.authorize(structuredClone(access), action)))
      throw new ReminderAccessDeniedProblem();
  }

  private now(): Date {
    const now = new Date(this.options.clock());
    if (!Number.isFinite(now.getTime()))
      throw new ReminderInvalidProblem("Clock must return a valid date");
    return now;
  }

  private revision(transaction: ReminderTransaction, command: ReminderRevisionCommand): Reminder {
    const reminder = transaction.reminders.find((item) => item.id === command.id);
    if (!reminder) throw new ReminderNotFoundProblem();
    if (reminder.version !== command.expectedVersion)
      throw new ReminderConflictProblem("Reminder version has changed");
    return reminder;
  }

  private requireEnabled(reminder: Reminder): void {
    if (reminder.state === "canceled")
      throw new ReminderConflictProblem("Canceled reminders cannot be re-enabled");
  }

  private invalidate(
    transaction: ReminderTransaction,
    id: string,
    reason: "canceled" | "superseded",
  ): void {
    for (const occurrence of transaction.occurrences) {
      if (
        occurrence.reminderId === id &&
        (occurrence.state === "pending" || occurrence.state === "claimed")
      )
        transaction.saveOccurrence({ ...occurrence, state: "suppressed", reason });
    }
  }

  private async mutate(
    command: ReminderCommand,
    fields: readonly unknown[],
    operation: (transaction: ReminderTransaction, now: Date) => Reminder,
    audit: { occurrenceId?: string; evidence?: string; outcome?: "accepted" | "not-accepted" } = {},
  ): Promise<Reminder> {
    if (!command.idempotencyKey?.trim())
      throw new ReminderInvalidProblem("Idempotency key is required");
    const fingerprint = JSON.stringify([command.actor.id, command.actor.reason, ...fields]);
    return this.options.store.transact(command.scope, command.subject, async (transaction) => {
      const existing = transaction.mutations.find(
        (item) => item.idempotencyKey === command.idempotencyKey,
      );
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          throw new ReminderConflictProblem("Idempotency key was used for a different mutation");
        return existing.result;
      }
      const now = this.now();
      const reminder = operation(transaction, now);
      transaction.saveMutation({
        ...audit,
        idempotencyKey: command.idempotencyKey,
        fingerprint,
        actor: command.actor.id,
        reason: command.actor.reason,
        recordedAt: now,
        result: reminder,
      });
      return reminder;
    });
  }
}

function inputFingerprint(input: ReminderInput): readonly unknown[] {
  return [
    input.topic,
    input.resourceRef,
    input.timezone,
    input.schedule.localTime,
    [...input.schedule.weekdays].sort(),
    input.channel,
    input.lateDeliveryMs,
  ];
}

function snapshotInput(input: ReminderInput): ReminderInput {
  return {
    topic: input.topic,
    resourceRef: input.resourceRef,
    timezone: input.timezone,
    schedule: { localTime: input.schedule.localTime, weekdays: [...input.schedule.weekdays] },
    channel: input.channel,
    lateDeliveryMs: input.lateDeliveryMs,
  };
}
