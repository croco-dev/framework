import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ExecutionManagerImpl,
  createExecutionCheckpointStoreConformanceSuite,
} from "@croco/execution-core";
import { DrizzleExecutionStore } from "../libs/DrizzleExecutionStore";
import type { PoolClient } from "pg";
import type { Execution } from "@croco/execution-core";

const connectionString = process.env.EXECUTION_POSTGRES_URL ?? "";

async function waitUntilCheckpointWriterBlocks(pool: Pool, applicationName: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await pool.query<{ wait_event_type: string | null }>(
      `
        select wait_event_type
        from pg_stat_activity
        where application_name = $1
          and state = 'active'
      `,
      [applicationName],
    );
    if (result.rows.some((row) => row.wait_event_type === "Lock")) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`Checkpoint writer '${applicationName}' did not block on the row lock`);
}

async function identify(client: PoolClient, applicationName: string): Promise<void> {
  await client.query("select set_config('application_name', $1, false)", [applicationName]);
}

describe.skipIf(connectionString.length === 0)(
  "DrizzleExecutionStore PostgreSQL checkpoint conformance",
  () => {
    let pool!: Pool;
    let store!: DrizzleExecutionStore<never>;
    let contentionSequence = 0;

    beforeAll(async () => {
      pool = new Pool({ connectionString, max: 6 });
      store = new DrizzleExecutionStore(drizzle(pool) as never);
      await pool.query(`
        create table if not exists executions (
          id varchar(26) primary key,
          type text not null,
          status text not null,
          payload json,
          result json,
          error json,
          attempts integer not null default 0,
          max_attempts integer not null default 1,
          created_at timestamp not null default now(),
          started_at timestamp,
          completed_at timestamp,
          scheduled_for timestamp,
          timeout bigint,
          idempotency_key varchar(255),
          request_fingerprint varchar(64),
          replay_of varchar(26),
          logs jsonb,
          parent_id varchar(26),
          metadata json,
          checkpoints json,
          progress json,
          continuation jsonb
        )
      `);
      await pool.query(`
        create unique index if not exists executions_idempotency_key_idx
        on executions (idempotency_key)
      `);
      await pool.query("alter table executions alter column timeout type bigint");
    });

    beforeEach(async () => {
      await pool.query("truncate table executions");
    });

    afterAll(async () => {
      await pool.end();
    });

    const suite = createExecutionCheckpointStoreConformanceSuite({
      createStore: () => store,
      runConcurrentWrites: async (_store, executionId, writes) => {
        const firstClient = await pool.connect();
        const secondClient = await pool.connect();
        const contentionId = ++contentionSequence;
        const secondApplicationName = `execution-checkpoint-writer-${contentionId}`;
        let firstCommitted = false;
        let blockedWrite: Promise<Execution> | undefined;

        try {
          await Promise.all([
            identify(firstClient, `execution-checkpoint-lock-holder-${contentionId}`),
            identify(secondClient, secondApplicationName),
          ]);
          await firstClient.query("begin");

          const firstStore = new DrizzleExecutionStore(drizzle(firstClient) as never);
          const secondStore = new DrizzleExecutionStore(drizzle(secondClient) as never);
          expect(writes).toHaveLength(2);
          const firstWrite = writes[0];
          const secondWrite = writes[1];
          assert.isDefined(firstWrite);
          assert.isDefined(secondWrite);

          await firstStore.mergeCheckpoint(executionId, firstWrite.key, firstWrite.value);
          blockedWrite = secondStore.mergeCheckpoint(
            executionId,
            secondWrite.key,
            secondWrite.value,
          );
          void blockedWrite.catch(() => undefined);
          await waitUntilCheckpointWriterBlocks(pool, secondApplicationName);

          await firstClient.query("commit");
          firstCommitted = true;
          await blockedWrite;
          return { lastAppliedWrite: 1 };
        } finally {
          if (!firstCommitted) {
            await firstClient.query("rollback");
          }
          if (blockedWrite) {
            await Promise.allSettled([blockedWrite]);
          }
          firstClient.release();
          secondClient.release();
        }
      },
    });

    for (const testCase of suite.cases) {
      // oxlint-disable-next-line jest/valid-title -- exported conformance cases own stable names
      it(testCase.name, testCase.run, 10_000);
    }

    it.each([2_147_483_647, 2_147_483_648])(
      "round-trips timeout %i without narrowing it to a 32-bit integer",
      async (timeout) => {
        const created = await store.create({ type: "timeout-boundary", timeout });

        expect(created.timeout).toBe(timeout);
        await expect(store.findById(created.id)).resolves.toMatchObject({ timeout });
      },
    );

    it("clears explicitly undefined optional fields in PostgreSQL", async () => {
      const created = await store.create({
        type: "clear-optional-fields",
        scheduledFor: new Date("2026-01-02T00:00:00.000Z"),
        idempotencyKey: "previous-key",
        requestFingerprint: "a".repeat(64),
        replayOf: "source-execution",
        parentId: "parent-execution",
        metadata: { source: "api" },
      });

      const cleared = await store.update(created.id, {
        scheduledFor: undefined,
        idempotencyKey: undefined,
        requestFingerprint: undefined,
        replayOf: undefined,
        parentId: undefined,
        metadata: undefined,
      });

      expect(cleared).toMatchObject({
        scheduledFor: undefined,
        idempotencyKey: undefined,
        requestFingerprint: undefined,
        replayOf: undefined,
        parentId: undefined,
        metadata: undefined,
      });
      await expect(store.findById(created.id)).resolves.toMatchObject({
        scheduledFor: undefined,
        idempotencyKey: undefined,
        requestFingerprint: undefined,
        replayOf: undefined,
        parentId: undefined,
        metadata: undefined,
      });
    });

    it("returns an existing PostgreSQL execution unchanged for an empty update", async () => {
      const created = await store.create({
        type: "empty-update",
        metadata: { source: "api" },
      });

      await expect(store.update(created.id, {})).resolves.toEqual(created);
      await expect(store.findById(created.id)).resolves.toEqual(created);
    });

    it("atomically reuses keyed replays across PostgreSQL connections and manager restarts", async () => {
      const source = await store.create({ type: "task", payload: { recipient: "recipient-1" } });
      await store.update(source.id, { status: "failed" });
      const firstClient = await pool.connect();
      const secondClient = await pool.connect();
      let pending: Promise<unknown>[] = [];
      try {
        const firstStore = new DrizzleExecutionStore(drizzle(firstClient) as never);
        const secondStore = new DrizzleExecutionStore(drizzle(secondClient) as never);
        const firstManager = new ExecutionManagerImpl(firstStore);
        const secondManager = new ExecutionManagerImpl(secondStore);
        const params = {
          idempotencyKey: "shared-key",
          reason: "provider restored",
          metadata: { recoveryActorId: "operator-1", recoveryAuditIdempotencyKey: "shared-key" },
        };
        // Hold the first insert uncommitted so the other connection reaches real unique-index contention.
        await firstClient.query("begin");
        const replay = await firstManager.replay(source.id, params);
        const applicationName = `execution-replay-contender-${++contentionSequence}`;
        await identify(secondClient, applicationName);
        const contender = secondManager.replay(source.id, params);
        pending = [contender];
        void contender.catch(() => undefined);
        await waitUntilCheckpointWriterBlocks(pool, applicationName);
        await firstClient.query("commit");
        expect(await contender).toEqual(replay);
        expect(await new ExecutionManagerImpl(store).replay(source.id, params)).toEqual(replay);
        await expect(
          secondManager.replay(source.id, { ...params, payload: { recipient: "recipient-2" } }),
        ).rejects.toMatchObject({ code: "execution/idempotency-conflict" });
        const independent = await secondManager.replay(source.id, {
          ...params,
          idempotencyKey: "another-key",
        });
        expect(independent.id).not.toBe(replay.id);
        expect(await store.list({ replayOf: source.id })).toHaveLength(2);
      } finally {
        await firstClient.query("rollback");
        await Promise.allSettled(pending);
        firstClient.release();
        secondClient.release();
      }
    });

    it("reuses JSON-persisted pre-key replay receipts without rewriting them", async () => {
      const source = await store.create({ type: "task", payload: { account: "account-1" } });
      await store.update(source.id, { status: "failed" });
      const manager = new ExecutionManagerImpl(store);
      const intent = {
        reason: "provider restored",
        metadata: { actor: "operator-1", ticket: undefined },
      };
      const legacy = await manager.replay(source.id, intent);
      const before = await store.findById(legacy.id);
      const params = { ...intent, idempotencyKey: "legacy-key", legacyReplayId: legacy.id };
      expect(await new ExecutionManagerImpl(store).replay(source.id, params)).toEqual(before);
      await expect(
        manager.replay(source.id, { ...params, metadata: { actor: "operator-2" } }),
      ).rejects.toMatchObject({ code: "execution/idempotency-conflict" });
      expect(await store.findById(legacy.id)).toEqual(before);
      expect(await store.list({ replayOf: source.id })).toHaveLength(1);
    });

    it("reports duplicate idempotency key updates as conflict Problems", async () => {
      await store.create({
        type: "idempotency-owner",
        idempotencyKey: "owned-key",
      });
      const contender = await store.create({
        type: "idempotency-contender",
        idempotencyKey: "contender-key",
      });

      await expect(
        store.update(contender.id, { idempotencyKey: "owned-key" }),
      ).rejects.toMatchObject({
        code: "execution/conflict",
      });
      await expect(store.findById(contender.id)).resolves.toMatchObject({
        idempotencyKey: "contender-key",
      });
    });
  },
);
