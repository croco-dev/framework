import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExecutionManagerImpl } from "@croco/execution-core";
import { DrizzleExecutionStore } from "@croco/execution-drizzle";
import { postgresResource } from "@croco/testing-resources";
import { c, compileFact, defineFact, encodeIdentity, validateRow } from "@croco/warehouse-core";
import {
  installPostgresFactSchema,
  installPostgresWarehouseSchema,
  PostgresWarehouseCatalog,
  PostgresWarehouseReader,
  PostgresWarehouseWriter,
} from "../facts";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPipelineOperations } from "@croco/etl-core/pipeline";
import { PostgresPipelinePublication } from "../pipeline/PostgresPipelinePublication";
import { defineProjection } from "@croco/etl-core/pipeline";
import type { PostgresTestConnection } from "@croco/testing-resources";
import type { FactDescriptor } from "@croco/warehouse-core";
import type { WarehouseAccess } from "@croco/warehouse-core/runtime";
import type { PipelineDefinition, PipelineRuntime } from "@croco/etl-core/pipeline";

const fact = defineFact("etl_pipeline_integration", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One imported payment", key: ["id"] },
  columns: { id: c.id(), amount: c.int64(), occurredAt: c.instant({ precision: "millisecond" }) },
  time: { event: "occurredAt" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});
const schema = {
  format: "jsonl",
  encoding: "utf-8",
  fields: [
    { name: "id", type: "string" },
    { name: "amount", type: "string" },
    { name: "occurredAt", type: "string" },
  ],
  limits: { maxBytes: 10000, maxRowBytes: 1000, maxRecords: 100 },
} as const;
const project = defineProjection({
  source: schema,
  target: fact,
  columns: {
    id: { kind: "column", field: "id" },
    amount: { kind: "column", field: "amount" },
    occurredAt: { kind: "column", field: "occurredAt" },
  },
});
const rows = [
  { id: "first", amount: "9223372036854775807", occurredAt: "2026-10-07T00:00:00.000Z" },
  { id: "second", amount: "20", occurredAt: "2026-10-07T00:01:00.000Z" },
];

describe.skipIf(process.env.CROCO_TEST_REAL_RESOURCES !== "1")(
  "file-to-PostgreSQL pipeline",
  () => {
    let connection: PostgresTestConnection;
    let cancellationPool: Pool;
    let dispose: () => Promise<void> | void;
    let descriptor: FactDescriptor;
    let directory: string;
    let definition: PipelineDefinition;

    beforeAll(async () => {
      const started = await postgresResource({ id: "etl-pipeline", mode: "commit" }).start({
        register: () => undefined,
        testId: "etl-pipeline",
        workerId: "etl-core",
      });
      connection = started.connection;
      dispose = started.dispose;
      cancellationPool = new Pool({ connectionString: connection.connectionString, max: 1 });
      descriptor = await compileFact(fact);
      await installPostgresWarehouseSchema(connection.pool);
      await installPostgresFactSchema(connection.pool, descriptor);
      await connection.pool.query(`CREATE TABLE executions (
      id varchar(26) PRIMARY KEY, type text NOT NULL, status text NOT NULL, payload json, result json, error json,
      attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 1,
      created_at timestamp NOT NULL DEFAULT now(), started_at timestamp, completed_at timestamp, scheduled_for timestamp,
      timeout bigint, idempotency_key varchar(255) UNIQUE, request_fingerprint varchar(64), replay_of varchar(26),
      logs jsonb, parent_id varchar(26), metadata json, checkpoints json, progress json, continuation jsonb
    )`);
      directory = await mkdtemp(join(tmpdir(), "etl-pg-"));
      const path = join(directory, "payments.jsonl");
      const content = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
      await writeFile(path, content);
      definition = {
        id: "payments",
        version: 1,
        source: {
          id: "payments-file",
          partitions: [
            {
              id: "payments-partition",
              path,
              schema,
              revision: createHash("sha256").update(content).digest("hex"),
              replayability: "snapshot-stable",
            },
          ],
          coverage: {
            sourceRef: "payments-file",
            from: "2026-10-07",
            through: "2026-10-07",
            state: "complete",
            gaps: [],
            late: false,
          },
        },
        project,
        load: "strict",
        resume: "checkpoint",
      };
    }, 180_000);

    afterAll(async () => {
      await cancellationPool?.end();
      await dispose?.();
      if (directory) await rm(directory, { recursive: true, force: true });
    });

    function services(pool: Pool = connection.pool) {
      let access: WarehouseAccess = {
        scope: { application: "etl-test", environment: "test", tenant: randomUUID() },
        actor: "operator",
        roles: ["read", "import", "publish", "drop"],
        columns: Object.keys(descriptor.columns),
        permissionEpoch: 0,
        privacyEpoch: 0,
      };
      const resolveAccess = () => access;
      const manager = () =>
        new ExecutionManagerImpl(new DrizzleExecutionStore(drizzle(connection.pool) as never));
      const publication = () => new PostgresPipelinePublication(pool, descriptor, resolveAccess);
      const owner = publication();
      const runtime: PipelineRuntime = {
        executions: owner.executions,
        publication: owner,
        catalog: new PostgresWarehouseCatalog(connection.pool, descriptor, resolveAccess),
        writer: new PostgresWarehouseWriter(connection.pool, descriptor, resolveAccess),
        resolveAccess,
        chunkSize: 1,
        maxAttempts: 3,
        previewLimit: 10,
        maxInputRecords: 100,
        clock: () => new Date("2026-10-07T01:00:00.000Z"),
      };
      const reader = new PostgresWarehouseReader(
        connection.pool,
        descriptor,
        resolveAccess,
        "etl-integration-cursor-secret-32bytes",
        cancellationPool,
      );
      return {
        runtime,
        manager,
        publication,
        resolveAccess,
        setPrivacyEpoch(epoch: number) {
          access = { ...access, privacyEpoch: epoch };
        },
        read: async (snapshotId: string) =>
          reader.read({
            access,
            snapshotId,
            projection: ["id", "amount", "occurredAt"],
            filters: [],
            order: [{ column: "id", direction: "asc" }],
            maxRows: 10,
            maxBytes: 10000,
            timeoutMs: 5000,
          }),
      };
    }

    it("publishes exact file values and durably completes the execution", async () => {
      const store = services();
      const operations = createPipelineOperations(definition, store.runtime);
      const publication = vi.spyOn(store.runtime.publication, "publish");
      const result = await operations.run();
      expect(result).toMatchObject({
        state: "published",
        inputCount: 2,
        outputCount: 2,
        rejectedCount: 0,
      });
      expect(result.snapshotId).toBeTypeOf("string");
      expect((await store.read(result.snapshotId as string)).rows).toEqual(rows);
      expect(await store.manager().get(result.executionId)).toMatchObject({
        status: "completed",
        attempts: 1,
        result,
      });
      const request = publication.mock.calls[0][0];
      await expect(store.runtime.publication.publish(request)).resolves.toEqual(result);
      await expect(
        store.runtime.publication.publish({
          ...request,
          result: { ...request.result, outputCount: 999 },
        }),
      ).rejects.toThrow("binding-changed");
      expect(
        (await store.runtime.catalog.describeDataset({ access: store.resolveAccess() })).revision,
      ).toBe(1);
    });

    it("restores a nonzero durable cursor with a different chunk size after a checkpoint fault", async () => {
      const store = services();
      const saveCheckpoint = store.runtime.executions.checkpointAttempt.bind(
        store.runtime.executions,
      );
      let checkpointCount = 0;
      const checkpoint = vi
        .spyOn(store.runtime.executions, "checkpointAttempt")
        .mockImplementation(async (...args) => {
          checkpointCount++;
          if (checkpointCount === 2) throw new Error("checkpoint fault after durable write");
          return saveCheckpoint(...args);
        });
      await expect(createPipelineOperations(definition, store.runtime).run()).rejects.toThrow(
        "checkpoint fault",
      );
      const failed = await connection.pool.query<{ id: string }>(
        "SELECT id FROM executions WHERE status='failed' AND payload->'scope'->>'tenant'=$1",
        [store.resolveAccess().scope.tenant],
      );
      expect(failed.rows).toHaveLength(1);
      const executionId = failed.rows[0].id;
      const receipts = await connection.pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM warehouse_receipts WHERE candidate_id=$1",
        [`etl:${executionId}`],
      );
      expect(receipts.rows[0].count).toBe("2");
      const saved = await store.manager().get(executionId);
      expect(saved.checkpoints?.["payments.cursor"]).toMatchObject({
        cursor: { partition: 0, record: 1, counts: { input: 1, output: 1 } },
      });
      checkpoint.mockRestore();
      const restartedOwner = store.publication();
      const restarted = createPipelineOperations(definition, {
        ...store.runtime,
        executions: restartedOwner.executions,
        publication: restartedOwner,
        chunkSize: 3,
      });
      const result = await restarted.retry(executionId);
      expect(result).toMatchObject({ state: "published", inputCount: 2, outputCount: 2 });
      expect((await store.read(result.snapshotId as string)).rows).toEqual(rows);
      const finalReceipts = await connection.pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM warehouse_receipts WHERE candidate_id=$1",
        [`etl:${executionId}`],
      );
      expect(finalReceipts.rows[0].count).toBe("2");
      expect(await store.manager().get(executionId)).toMatchObject({
        status: "completed",
        attempts: 2,
      });
    });

    it("keeps identities and row counts stable across chunk sizes and duplicate records", async () => {
      const store = services();
      const content =
        [rows[0], rows[1], rows[0]].map((row) => JSON.stringify(row)).join("\n") + "\n";
      const path = join(directory, "duplicate-payments.jsonl");
      await writeFile(path, content);
      const duplicateDefinition: PipelineDefinition = {
        ...definition,
        source: {
          ...definition.source,
          partitions: [
            {
              ...definition.source.partitions[0],
              path,
              revision: createHash("sha256").update(content).digest("hex"),
            },
          ],
        },
      };
      const first = await createPipelineOperations(duplicateDefinition, store.runtime).run();
      const secondOwner = store.publication();
      const second = await createPipelineOperations(duplicateDefinition, {
        ...store.runtime,
        executions: secondOwner.executions,
        publication: secondOwner,
        chunkSize: 3,
      }).run();
      for (const result of [first, second]) {
        expect(result).toMatchObject({ state: "published", inputCount: 3, outputCount: 3 });
        expect((await store.read(result.snapshotId as string)).rows).toEqual(rows);
      }
      const receipts = async (executionId: string) =>
        (
          await connection.pool.query<{ batch_id: string; inserted: number; identical: number }>(
            "SELECT batch_id, (receipt->>'inserted')::integer AS inserted, (receipt->>'identical')::integer AS identical FROM warehouse_receipts WHERE candidate_id=$1 ORDER BY batch_id",
            [`etl:${executionId}`],
          )
        ).rows;
      const initial = await receipts(first.executionId);
      const reimported = await receipts(second.executionId);
      expect(initial).toHaveLength(3);
      expect(initial.reduce((sum, receipt) => sum + receipt.inserted, 0)).toBe(2);
      expect(initial.reduce((sum, receipt) => sum + receipt.identical, 0)).toBe(1);
      expect(reimported.map((receipt) => receipt.batch_id)).toEqual(
        initial.map((receipt) => receipt.batch_id),
      );
      expect(reimported.reduce((sum, receipt) => sum + receipt.inserted, 0)).toBe(0);
      expect(reimported.reduce((sum, receipt) => sum + receipt.identical, 0)).toBe(3);
      const binding = await connection.pool.query<{ table_name: string }>(
        "SELECT table_name FROM warehouse_models WHERE model_version=$1",
        [descriptor.semanticHash],
      );
      const physical = await connection.pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM "${binding.rows[0].table_name}" WHERE _candidate=ANY($1::text[])`,
        [[`etl:${first.executionId}`, `etl:${second.executionId}`]],
      );
      expect(physical.rows[0].count).toBe("2");
    });

    it("allows only one of two runs bound to the same published head to publish", async () => {
      const store = services();
      let arrived = 0;
      let release: () => void = () => undefined;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const describeDataset = store.runtime.catalog.describeDataset.bind(store.runtime.catalog);
      vi.spyOn(store.runtime.catalog, "describeDataset").mockImplementation(async (request) => {
        const dataset = await describeDataset(request);
        arrived++;
        if (arrived === 2) release();
        await barrier;
        return dataset;
      });
      const outcomes = await Promise.allSettled([
        createPipelineOperations(definition, store.runtime).run(),
        createPipelineOperations(definition, store.runtime).run(),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
      const dataset = await describeDataset({ access: store.resolveAccess() });
      expect(dataset.revision).toBe(1);
      expect((await store.read(dataset.head?.id as string)).rows).toEqual(rows);
    });

    it.each(["cancel", "timeout"] as const)(
      "keeps the prior head when %s wins inside publication",
      async (action) => {
        const store = services();
        const prior = await createPipelineOperations(definition, store.runtime).run();
        const complete = ExecutionManagerImpl.prototype.completeAttempt;
        let executionId = "";
        const interception = vi
          .spyOn(ExecutionManagerImpl.prototype, "completeAttempt")
          .mockImplementationOnce(async function (this: ExecutionManagerImpl, token, result) {
            executionId = token.executionId;
            await store.runtime.executions[action](executionId);
            return complete.call(this, token, result);
          });
        try {
          await expect(createPipelineOperations(definition, store.runtime).run()).rejects.toThrow();
        } finally {
          interception.mockRestore();
        }
        expect(await store.manager().get(executionId)).toMatchObject({
          status: action === "cancel" ? "cancelled" : "timed_out",
        });
        const dataset = await store.runtime.catalog.describeDataset({
          access: store.resolveAccess(),
        });
        expect(dataset.head?.id).toBe(prior.snapshotId);
        expect(dataset.revision).toBe(1);
        expect((await store.read(prior.snapshotId as string)).rows).toEqual(rows);
      },
    );

    it("rolls publication back when aborted during execution completion", async () => {
      const store = services();
      const prior = await createPipelineOperations(definition, store.runtime).run();
      const controller = new AbortController();
      const complete = ExecutionManagerImpl.prototype.completeAttempt;
      let executionId = "";
      const interception = vi
        .spyOn(ExecutionManagerImpl.prototype, "completeAttempt")
        .mockImplementationOnce(async function (this: ExecutionManagerImpl, token, result) {
          executionId = token.executionId;
          const completed = await complete.call(this, token, result);
          controller.abort();
          return completed;
        });
      try {
        await expect(
          createPipelineOperations(definition, {
            ...store.runtime,
            signal: controller.signal,
          }).run(),
        ).rejects.toThrow("interrupted");
      } finally {
        interception.mockRestore();
      }
      expect(await store.manager().get(executionId)).toMatchObject({ status: "failed" });
      const dataset = await store.runtime.catalog.describeDataset({
        access: store.resolveAccess(),
      });
      expect(dataset.head?.id).toBe(prior.snapshotId);
      expect(dataset.revision).toBe(1);
      expect((await store.read(prior.snapshotId as string)).rows).toEqual(rows);
    });

    it("rolls publication back when execution completion fails", async () => {
      const store = services();
      const interception = vi
        .spyOn(ExecutionManagerImpl.prototype, "completeAttempt")
        .mockRejectedValueOnce(new Error("completion persistence failed"));
      try {
        await expect(createPipelineOperations(definition, store.runtime).run()).rejects.toThrow(
          "completion persistence failed",
        );
      } finally {
        interception.mockRestore();
      }
      const dataset = await store.runtime.catalog.describeDataset({
        access: store.resolveAccess(),
      });
      expect(dataset.head).toBeNull();
      expect(dataset.revision).toBe(0);
      const executions = await connection.pool.query<{ status: string }>(
        "SELECT status FROM executions WHERE payload->'scope'->>'tenant'=$1",
        [store.resolveAccess().scope.tenant],
      );
      expect(executions.rows).toEqual([{ status: "failed" }]);
    });

    it("commits publication and completion before a waiting cancellation can win", async () => {
      const store = services();
      const complete = ExecutionManagerImpl.prototype.completeAttempt;
      let cancellation: Promise<unknown> | undefined;
      const interception = vi
        .spyOn(ExecutionManagerImpl.prototype, "completeAttempt")
        .mockImplementationOnce(async function (this: ExecutionManagerImpl, token, result) {
          const completed = await complete.call(this, token, result);
          cancellation = store.runtime.executions.cancel(token.executionId).then(
            (value) => ({ ok: true, value }),
            (error) => ({ ok: false, error }),
          );
          const deadline = Date.now() + 5000;
          let waiting = false;
          while (Date.now() < deadline) {
            const locks = await connection.pool.query<{ count: string }>(
              "SELECT count(*)::text AS count FROM pg_stat_activity WHERE wait_event_type='Lock' AND query ILIKE '%update%executions%'",
            );
            if (Number(locks.rows[0].count) > 0) {
              waiting = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          expect(waiting).toBe(true);
          return completed;
        });
      let result;
      try {
        result = await createPipelineOperations(definition, store.runtime).run();
      } finally {
        interception.mockRestore();
      }
      expect(await cancellation).toMatchObject({ ok: false });
      expect(await store.manager().get(result.executionId)).toMatchObject({
        status: "completed",
        result,
      });
      expect((await store.read(result.snapshotId as string)).rows).toEqual(rows);
    });

    it("reconciles a lost publication COMMIT acknowledgement from durable completion", async () => {
      let lost = false;
      const faultPool = new Proxy(connection.pool, {
        get(target, property) {
          if (property === "connect")
            return async () => {
              const client = await target.connect();
              let publishing = false;
              return new Proxy(client, {
                get(clientTarget, clientProperty) {
                  if (clientProperty === "query")
                    return async (...args: unknown[]) => {
                      const value: unknown = Reflect.apply(clientTarget.query, clientTarget, args);
                      const response: unknown = await value;
                      if (
                        typeof args[0] === "string" &&
                        args[0].startsWith("UPDATE warehouse_candidates SET state") &&
                        Array.isArray(args[1]) &&
                        args[1][1] === "published"
                      )
                        publishing = true;
                      if (args[0] === "COMMIT" && publishing && !lost) {
                        lost = true;
                        throw new Error("publication COMMIT response lost");
                      }
                      return response;
                    };
                  const value: unknown = Reflect.get(clientTarget, clientProperty);
                  return typeof value === "function" ? value.bind(clientTarget) : value;
                },
              });
            };
          const value: unknown = Reflect.get(target, property);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const store = services(faultPool);
      const result = await createPipelineOperations(definition, store.runtime).run();
      expect(lost).toBe(true);
      expect(await store.manager().get(result.executionId)).toMatchObject({
        status: "completed",
        result,
      });
      expect((await store.read(result.snapshotId as string)).rows).toEqual(rows);
    });

    it("preserves privacy suppression when the file is imported again", async () => {
      const store = services();
      await createPipelineOperations(definition, store.runtime).run();
      const identity = encodeIdentity(
        descriptor,
        validateRow(descriptor, rows[0]),
        store.resolveAccess().scope,
      );
      const suppression = await store.runtime.catalog.suppress({
        access: store.resolveAccess(),
        identities: [identity],
        audit: {
          reason: "erase imported payment",
          expectedRevision: 1,
          idempotencyKey: randomUUID(),
        },
      });
      store.setPrivacyEpoch(suppression.privacyEpoch);
      await expect(createPipelineOperations(definition, store.runtime).run()).rejects.toThrow(
        "WAREHOUSE_EPOCH_CHANGED",
      );
      await expect(
        store.runtime.catalog.describeDataset({ access: store.resolveAccess() }),
      ).rejects.toThrow("WAREHOUSE_EPOCH_CHANGED");
      const binding = await connection.pool.query<{ table_name: string }>(
        "SELECT table_name FROM warehouse_models WHERE model_version=$1",
        [descriptor.semanticHash],
      );
      const remaining = await connection.pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM "${binding.rows[0].table_name}" WHERE _identity=$1`,
        [identity],
      );
      expect(remaining.rows[0].count).toBe("0");
    });
  },
);
