import {
  ReminderInvalidProblem,
  type Reminder,
  type ReminderOccurrence,
} from "@croco/engagement-core";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzleReminderStore,
  createEngagementSchema,
  dropEngagementSchema,
  engagementReminderBuckets,
  engagementReminders,
  engagementReminderOccurrences,
  engagementReminderMutations,
} from "../index";

const connectionString = process.env.ENGAGEMENT_POSTGRES_URL ?? "";
const describePostgres = connectionString ? describe : describe.skip;
const schema = {
  engagementReminderBuckets,
  engagementReminders,
  engagementReminderOccurrences,
  engagementReminderMutations,
};
const scope = { app: "app", environment: "test", tenantId: "tenant" };
const reminder: Reminder = {
  scope,
  subject: "user",
  id: "reminder",
  topic: "study",
  resourceRef: "lesson",
  timezone: "UTC",
  schedule: { localTime: "09:00", weekdays: [1] },
  channel: "email",
  lateDeliveryMs: Number.MAX_SAFE_INTEGER,
  version: 1,
  state: "active",
  nextScheduledAt: new Date("2026-10-05T09:00:00Z"),
};
const occurrence: ReminderOccurrence = {
  id: "occurrence",
  reminderId: reminder.id,
  reminderVersion: 1,
  scheduledAt: new Date("2026-10-05T09:00:00Z"),
  state: "unknown",
  executionIds: [],
};

describePostgres("DrizzleReminderStore PostgreSQL", () => {
  const pools = [new Pool({ connectionString, max: 1 }), new Pool({ connectionString, max: 1 })];
  const databases = pools.map((pool) => drizzle(pool, { schema }));
  const stores = databases.map((db) => new DrizzleReminderStore(db));
  beforeAll(async () => {
    await dropEngagementSchema(databases[0]);
    await createEngagementSchema(databases[0]);
  });
  beforeEach(async () => {
    await databases[0].execute(
      sql`truncate engagement_reminder_mutations, engagement_reminder_occurrences, engagement_reminders, engagement_reminder_buckets`,
    );
  });
  afterAll(async () => {
    await dropEngagementSchema(databases[0]);
    await Promise.all(pools.map((pool) => pool.end()));
  });

  it("serializes creation in an empty subject and competing occurrence claims across connections", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        stores[index % 2].transact(scope, "user", async (tx) => {
          if (tx.reminders.length) return false;
          tx.saveReminder(reminder);
          tx.saveOccurrence({ ...occurrence, state: "pending" });
          return true;
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const claims = await Promise.all(
      stores.map((store) =>
        store.transact(scope, "user", async (tx) => {
          const current = tx.occurrences[0];
          if (current.state !== "pending") return false;
          tx.saveOccurrence({ ...current, state: "claimed" });
          return true;
        }),
      ),
    );
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("rehydrates replay dates and reconciliation audit after a fresh connection", async () => {
    const mutation = {
      idempotencyKey: "create",
      fingerprint: "fingerprint",
      actor: "operator",
      reason: "verified",
      recordedAt: new Date("2026-10-05T08:00:00Z"),
      result: reminder,
      occurrenceId: occurrence.id,
      evidence: "provider-proof",
      outcome: "accepted" as const,
    };
    await stores[0].transact(scope, "user", async (tx) => {
      tx.saveReminder(reminder);
      tx.saveOccurrence(occurrence);
      tx.saveMutation(mutation);
    });
    const pool = new Pool({ connectionString, max: 1 });
    try {
      const restarted = new DrizzleReminderStore(drizzle(pool, { schema }));
      await restarted.transact(scope, "user", async (tx) => {
        expect(tx.reminders).toEqual([reminder]);
        expect(tx.occurrences).toEqual([occurrence]);
        expect(tx.mutations).toEqual([mutation]);
      });
    } finally {
      await pool.end();
    }
  });

  it("isolates every scope dimension and rejects cross-subject writes", async () => {
    await stores[0].transact(scope, "user", async (tx) => tx.saveReminder(reminder));
    for (const other of [
      { ...scope, app: "other" },
      { ...scope, environment: "other" },
      { ...scope, tenantId: "other" },
    ]) {
      await stores[1].transact(other, "user", async (tx) => {
        expect(tx.reminders).toEqual([]);
      });
    }
    await stores[1].transact(scope, "other", async (tx) => {
      expect(tx.reminders).toEqual([]);
    });
    await expect(
      stores[1].transact(scope, "other", async (tx) => tx.saveReminder(reminder)),
    ).rejects.toThrow(ReminderInvalidProblem);
    await expect(
      stores[1].transact(scope, "other", async (tx) => tx.saveOccurrence(occurrence)),
    ).rejects.toThrow(ReminderInvalidProblem);
    await expect(
      stores[1].transact(scope, "other", async (tx) =>
        tx.saveMutation({
          idempotencyKey: "bad",
          fingerprint: "bad",
          actor: "user",
          reason: "bad",
          recordedAt: new Date(),
          result: reminder,
        }),
      ),
    ).rejects.toThrow(ReminderInvalidProblem);
  });

  it("rolls back pending writes and database failures atomically", async () => {
    await expect(
      stores[0].transact(scope, "user", async (tx) => {
        tx.saveReminder(reminder);
        throw new ReminderInvalidProblem("abort");
      }),
    ).rejects.toThrow(ReminderInvalidProblem);
    await expect(
      stores[0].transact(scope, "user", async (tx) => {
        tx.saveReminder(reminder);
        tx.saveOccurrence(occurrence);
        tx.saveOccurrence({ ...occurrence, id: "duplicate" });
      }),
    ).rejects.toThrow();
    await stores[1].transact(scope, "user", async (tx) => {
      expect(tx.reminders).toEqual([]);
      expect(tx.occurrences).toEqual([]);
    });
  });

  it("adds reminder tables idempotently without altering existing contact rows and drops them", async () => {
    await databases[0].execute(
      sql`insert into engagement_contact_policy_buckets (scope_key, subject) values ('existing', 'user')`,
    );
    await createEngagementSchema(databases[0]);
    expect(
      (
        await databases[0].execute(
          sql`select subject from engagement_contact_policy_buckets where scope_key = 'existing'`,
        )
      ).rows,
    ).toEqual([{ subject: "user" }]);
    await dropEngagementSchema(databases[0]);
    expect(
      (
        await databases[0].execute(
          sql`select to_regclass('engagement_reminder_buckets') as bucket, to_regclass('engagement_reminders') as reminder, to_regclass('engagement_reminder_occurrences') as occurrence, to_regclass('engagement_reminder_mutations') as mutation`,
        )
      ).rows[0],
    ).toEqual({ bucket: null, reminder: null, occurrence: null, mutation: null });
    await createEngagementSchema(databases[0]);
  });
});
