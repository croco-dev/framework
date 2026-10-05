import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { PostgresSavedIntentStore } from "../index";
import type { ExperiencePgDatabase, ExperiencePgExecutor } from "../index";
import type { SavedIntentMutation, SavedIntentPolicy } from "@croco/experience-core";

const url = process.env.EXPERIENCE_TEST_DATABASE_URL;
const dialect = new PgDialect();
type Client = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};
type Pool = Client & { connect(): Promise<Client & { release(): void }>; end(): Promise<void> };
function database(pool: Pool): ExperiencePgDatabase {
  const executor = (client: Client): ExperiencePgExecutor => ({
    execute: (statement) => {
      const query = dialect.sqlToQuery(statement);
      return client.query(query.sql, query.params);
    },
  });
  return {
    ...executor(pool),
    transaction: async (work) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(executor(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
const scope = { appId: "shop", environment: "test", tenantId: "tenant-a" };
const subject = { kind: "customer", id: "customer-a" };
const now = "2026-10-01T12:00:00.000Z";
function command(overrides: Partial<SavedIntentMutation> = {}): SavedIntentMutation {
  return {
    scope,
    subject,
    resourceType: "report",
    resourceId: "1",
    sourceKind: "explicit",
    expectedRevision: null,
    idempotencyKey: randomUUID(),
    operation: "save",
    id: randomUUID(),
    now,
    ...overrides,
  };
}

describe.skipIf(!url)("PostgreSQL saved intent durability", () => {
  it("migrates, serializes devices, replays exactly, preserves suppression and erases subject copies", async () => {
    const require = createRequire(import.meta.url);
    const { Pool: PgPool } = require("pg") as {
      Pool: new (options: { connectionString: string; max: number }) => Pool;
    };
    const poolA = new PgPool({ connectionString: url as string, max: 3 });
    const poolB = new PgPool({ connectionString: url as string, max: 3 });
    const up = readFileSync(
      new URL("../../migrations/0002_saved_intent.up.sql", import.meta.url),
      "utf8",
    );
    const down = readFileSync(
      new URL("../../migrations/0002_saved_intent.down.sql", import.meta.url),
      "utf8",
    );
    let poolAClosed = false;
    await poolA.query(up);
    try {
      const storeA = new PostgresSavedIntentStore(database(poolA));
      const storeB = new PostgresSavedIntentStore(database(poolB));
      const save = command({ progressRef: "report-progress:5" });
      const saved = await storeA.mutate(save);
      expect(saved.revision).toBe(1);
      expect(
        await storeB.mutate({ ...save, id: randomUUID(), now: "2026-10-02T12:00:00Z" }),
      ).toEqual(saved);
      await expect(storeB.mutate({ ...save, progressRef: "different" })).rejects.toThrow(
        "different saved intent command",
      );
      const competitors = await Promise.allSettled([
        storeA.mutate(command({ expectedRevision: 1, operation: "complete" })),
        storeB.mutate(command({ expectedRevision: 1, operation: "complete" })),
      ]);
      expect(competitors.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(competitors.filter((result) => result.status === "rejected")).toHaveLength(1);
      const recent = await storeB.mutate(command({ sourceKind: "recent" }));
      const removed = await storeA.mutate(command({ operation: "remove", expectedRevision: 2 }));
      expect(removed).toMatchObject({ state: "removed", revision: 3 });
      expect(removed.progressRef).toBeUndefined();
      await expect(
        storeB.mutate(command({ sourceKind: "recent", expectedRevision: recent.revision })),
      ).rejects.toThrow("revision");
      const suppressed = await storeB.mutate(
        command({ sourceKind: "recent", expectedRevision: 2 }),
      );
      expect(suppressed.state).toBe("removed");
      expect(await storeB.mutate(save)).toEqual(saved);
      expect(
        (await storeA.list({ scope, subject, offset: 0, limit: 10 })).every(
          (intent) => intent.state === "removed",
        ),
      ).toBe(true);
      // Another resource type and tenant may use the same resource and command identifiers.
      await storeA.mutate(command({ resourceType: "task", idempotencyKey: "isolated" }));
      const pinned = await storeA.mutate(
        command({ resourceType: "task", operation: "pin", expectedRevision: 1, pinOrder: 0 }),
      );
      expect((await storeB.list({ scope, subject, offset: 0, limit: 1 }))[0]?.id).toBe(pinned.id);
      const otherScope = { ...scope, tenantId: "tenant-b" };
      await storeB.mutate(command({ scope: otherScope, idempotencyKey: "isolated" }));
      expect(
        await storeA.list({
          scope: { ...scope, environment: "production" },
          subject,
          offset: 0,
          limit: 10,
        }),
      ).toEqual([]);
      expect(
        await storeA.list({ scope, subject: { ...subject, id: "stranger" }, offset: 0, limit: 10 }),
      ).toEqual([]);
      // Purging removes historical payloads and receipts but never the resource suppression.
      await storeA.purgeExpired({
        scope,
        subject,
        resourceType: "report",
        before: now,
      });
      expect(
        (
          await poolA.query(
            "SELECT count(*)::integer AS count FROM croco_saved_intent_receipts WHERE result ->> 'resourceType' = 'report' AND scope_key = $1",
            [JSON.stringify(Object.values(scope))],
          )
        ).rows[0]?.count,
      ).toBe(0);
      expect((await storeB.mutate(command({ sourceKind: "recent" }))).state).toBe("removed");
      const restored = await storeA.mutate(command());
      expect(restored.state).toBe("saved");
      const completed = await storeA.mutate(
        command({ operation: "complete", expectedRevision: restored.revision }),
      );
      expect(completed.state).toBe("completed");
      const policy: SavedIntentPolicy = {
        scope,
        resourceType: "report",
        displayLimit: 5,
        retentionDays: 30,
        excludeCompleted: true,
        revision: 1,
        actorId: "operator",
        reason: "Approved retention",
        updatedAt: now,
      };
      const policyCommand = { policy, expectedRevision: null, idempotencyKey: "policy-1" };
      expect(await storeA.updatePolicy(policyCommand)).toEqual(policy);
      expect(
        await storeB.updatePolicy({
          ...policyCommand,
          policy: { ...policy, updatedAt: "2026-10-03T00:00:00Z" },
        }),
      ).toEqual(policy);
      await expect(
        storeB.updatePolicy({ ...policyCommand, policy: { ...policy, actorId: "someone-else" } }),
      ).rejects.toThrow("different policy command");
      await expect(
        storeB.updatePolicy({
          ...policyCommand,
          idempotencyKey: "stale",
          policy: { ...policy, revision: 2 },
        }),
      ).rejects.toThrow("revision");
      expect(
        await storeA.readPolicy({ scope: otherScope, resourceType: "report" }),
      ).toBeUndefined();
      // Close the writer pool and construct a new adapter, with no retained process state.
      await poolA.end();
      poolAClosed = true;
      const restarted = new PgPool({ connectionString: url as string, max: 2 });
      try {
        const store = new PostgresSavedIntentStore(database(restarted));
        expect(
          (await store.list({ scope, subject, offset: 0, limit: 10 })).find(
            (item) => item.id === completed.id,
          ),
        ).toEqual(completed);
        expect(await store.readPolicy({ scope, resourceType: "report" })).toEqual(policy);
        // An exclusive subject lock blocks new writes, so privacy deletion cannot miss a concurrent transaction.
        const holder = await restarted.connect();
        try {
          await holder.query("BEGIN");
          await holder.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
            JSON.stringify(Object.values(scope)),
            JSON.stringify(Object.values(subject)),
          ]);
          let finished = false;
          const write = storeB.mutate(command({ resourceId: "locked" })).then((result) => {
            finished = true;
            return result;
          });
          await new Promise((resolve) => setTimeout(resolve, 100));
          expect(finished).toBe(false);
          await holder.query("COMMIT");
          await write;
        } finally {
          await holder.query("ROLLBACK");
          holder.release();
        }
        await store.deleteSubject({ scope, subject });
        expect(await store.list({ scope, subject, offset: 0, limit: 10 })).toEqual([]);
        for (const table of [
          "croco_saved_intents",
          "croco_saved_intent_receipts",
          "croco_saved_intent_suppression",
        ]) {
          const remaining = await restarted.query(
            `SELECT count(*)::integer AS count FROM ${table} WHERE scope_key = $1 AND subject_key = $2`,
            [JSON.stringify(Object.values(scope)), JSON.stringify(Object.values(subject))],
          );
          expect(remaining.rows[0]?.count).toBe(0);
        }
        expect(await store.readPolicy({ scope, resourceType: "report" })).toEqual(policy);
        expect(await store.list({ scope: otherScope, subject, offset: 0, limit: 10 })).toHaveLength(
          1,
        );
      } finally {
        await restarted.end();
      }
      await poolB.query(down);
      await poolB.query(up);
      expect(await storeB.list({ scope, subject, offset: 0, limit: 10 })).toEqual([]);
    } finally {
      await poolB.query(down);
      await poolB.end();
      if (!poolAClosed) await poolA.end();
    }
  }, 30000);
});
