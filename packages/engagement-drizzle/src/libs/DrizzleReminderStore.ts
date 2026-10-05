import {
  EngagementPersistenceProblem,
  ReminderInvalidProblem,
  type Reminder,
  type ReminderMutation,
  type ReminderOccurrence,
  type ReminderScope,
  type ReminderStore,
  type ReminderTransaction,
} from "@croco/engagement-core";
import { Problem } from "@croco/problems-core";
import { and, asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  engagementReminderBuckets,
  engagementReminders,
  engagementReminderOccurrences,
  engagementReminderMutations,
} from "./schema";

const schema = {
  engagementReminderBuckets,
  engagementReminders,
  engagementReminderOccurrences,
  engagementReminderMutations,
};
export type DrizzleReminderClient = NodePgDatabase<typeof schema>;

export class DrizzleReminderStore implements ReminderStore {
  constructor(private readonly db: DrizzleReminderClient) {}

  async transact<T>(
    scope: ReminderScope,
    subject: string,
    operation: (transaction: ReminderTransaction) => Promise<T>,
  ): Promise<T> {
    const scopeKey = scopeIdentity(scope, subject);
    const contains = (reminder: Reminder) => {
      if (
        scopeIdentity(reminder.scope, reminder.subject) !== scopeKey ||
        reminder.subject !== subject
      ) {
        throw new ReminderInvalidProblem("Reminder does not belong to the locked subject");
      }
    };
    try {
      return await this.db.transaction(async (tx) => {
        await tx
          .insert(engagementReminderBuckets)
          .values({ scopeKey, subject })
          .onConflictDoNothing();
        await tx
          .select()
          .from(engagementReminderBuckets)
          .where(
            and(
              eq(engagementReminderBuckets.scopeKey, scopeKey),
              eq(engagementReminderBuckets.subject, subject),
            ),
          )
          .for("update");
        const reminderRows = await tx
          .select()
          .from(engagementReminders)
          .where(
            and(
              eq(engagementReminders.scopeKey, scopeKey),
              eq(engagementReminders.subject, subject),
            ),
          )
          .orderBy(asc(engagementReminders.id));
        const occurrenceRows = await tx
          .select()
          .from(engagementReminderOccurrences)
          .where(
            and(
              eq(engagementReminderOccurrences.scopeKey, scopeKey),
              eq(engagementReminderOccurrences.subject, subject),
            ),
          )
          .orderBy(
            asc(engagementReminderOccurrences.scheduledAt),
            asc(engagementReminderOccurrences.id),
          );
        const mutationRows = await tx
          .select()
          .from(engagementReminderMutations)
          .where(
            and(
              eq(engagementReminderMutations.scopeKey, scopeKey),
              eq(engagementReminderMutations.subject, subject),
            ),
          )
          .orderBy(
            asc(engagementReminderMutations.recordedAt),
            asc(engagementReminderMutations.idempotencyKey),
          );
        const reminders = reminderRows.map(
          ({ scopeKey: _key, ...row }): Reminder => ({ ...row, scope: { ...scope } }),
        );
        const occurrences = occurrenceRows.map(
          ({ scopeKey: _key, subject: _subject, reason, ...row }): ReminderOccurrence => ({
            ...row,
            ...(reason === null ? {} : { reason }),
          }),
        );
        const mutations = mutationRows.map(
          ({
            scopeKey: _key,
            subject: _subject,
            result,
            occurrenceId,
            evidence,
            outcome,
            ...row
          }): ReminderMutation => ({
            ...row,
            result: {
              ...result,
              nextScheduledAt:
                result.nextScheduledAt === null ? null : new Date(result.nextScheduledAt),
            },
            ...(occurrenceId === null ? {} : { occurrenceId }),
            ...(evidence === null ? {} : { evidence }),
            ...(outcome === null ? {} : { outcome }),
          }),
        );
        const pendingReminders = new Map<string, Reminder>();
        const pendingOccurrences = new Map<string, ReminderOccurrence>();
        const pendingMutations = new Map<string, ReminderMutation>();
        const result = await operation({
          get reminders() {
            return snapshot(reminders, pendingReminders, (item) => item.id);
          },
          get occurrences() {
            return snapshot(occurrences, pendingOccurrences, (item) => item.id);
          },
          get mutations() {
            return snapshot(mutations, pendingMutations, (item) => item.idempotencyKey);
          },
          saveReminder: (reminder) => {
            contains(reminder);
            pendingReminders.set(reminder.id, structuredClone(reminder));
          },
          saveOccurrence: (occurrence) => {
            pendingOccurrences.set(occurrence.id, structuredClone(occurrence));
          },
          saveMutation: (mutation) => {
            contains(mutation.result);
            pendingMutations.set(mutation.idempotencyKey, structuredClone(mutation));
          },
        });
        const reminderIds = new Set([
          ...reminderRows.map((row) => row.id),
          ...pendingReminders.keys(),
        ]);
        for (const occurrence of pendingOccurrences.values()) {
          if (!reminderIds.has(occurrence.reminderId))
            throw new ReminderInvalidProblem(
              "Occurrence does not belong to a reminder in the locked subject",
            );
        }
        for (const mutation of pendingMutations.values()) {
          if (!reminderIds.has(mutation.result.id))
            throw new ReminderInvalidProblem(
              "Mutation does not belong to a reminder in the locked subject",
            );
          if (
            mutation.occurrenceId !== undefined &&
            !occurrenceRows.some((row) => row.id === mutation.occurrenceId) &&
            !pendingOccurrences.has(mutation.occurrenceId)
          )
            throw new ReminderInvalidProblem(
              "Mutation occurrence does not belong to the locked subject",
            );
        }
        for (const reminder of pendingReminders.values()) {
          const { scope: _scope, ...row } = reminder;
          await tx
            .insert(engagementReminders)
            .values({ ...row, scopeKey })
            .onConflictDoUpdate({
              target: [
                engagementReminders.scopeKey,
                engagementReminders.subject,
                engagementReminders.id,
              ],
              set: row,
            });
        }
        for (const occurrence of pendingOccurrences.values()) {
          const row = { ...occurrence, reason: occurrence.reason ?? null };
          await tx
            .insert(engagementReminderOccurrences)
            .values({ ...row, scopeKey, subject })
            .onConflictDoUpdate({
              target: [
                engagementReminderOccurrences.scopeKey,
                engagementReminderOccurrences.subject,
                engagementReminderOccurrences.id,
              ],
              set: row,
            });
        }
        for (const mutation of pendingMutations.values()) {
          const row = {
            ...mutation,
            result: {
              ...mutation.result,
              nextScheduledAt: mutation.result.nextScheduledAt?.toISOString() ?? null,
            },
            occurrenceId: mutation.occurrenceId ?? null,
            evidence: mutation.evidence ?? null,
            outcome: mutation.outcome ?? null,
          };
          await tx
            .insert(engagementReminderMutations)
            .values({ ...row, scopeKey, subject })
            .onConflictDoUpdate({
              target: [
                engagementReminderMutations.scopeKey,
                engagementReminderMutations.subject,
                engagementReminderMutations.idempotencyKey,
              ],
              set: row,
            });
        }
        return result;
      });
    } catch (error) {
      if (error instanceof Problem) throw error;
      throw new EngagementPersistenceProblem(
        "transact-reminder",
        scope.tenantId,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}

function scopeIdentity(scope: ReminderScope, subject: string): string {
  if (
    [scope.app, scope.environment, scope.tenantId, subject].some(
      (value) => typeof value !== "string" || !value.trim(),
    )
  )
    throw new ReminderInvalidProblem(
      "Reminder persistence requires app, environment, tenant and subject",
    );
  return JSON.stringify([scope.app, scope.environment, scope.tenantId]);
}

function snapshot<T>(
  rows: readonly T[],
  pending: ReadonlyMap<string, T>,
  key: (value: T) => string,
): T[] {
  return structuredClone([
    ...new Map([...rows.map((row) => [key(row), row] as const), ...pending]).values(),
  ]);
}
