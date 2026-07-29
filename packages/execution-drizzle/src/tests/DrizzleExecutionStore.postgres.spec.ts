import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createExecutionCheckpointStoreConformanceSuite } from "@croco/execution-core";
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
          timeout integer,
          idempotency_key varchar(255),
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
  },
);
