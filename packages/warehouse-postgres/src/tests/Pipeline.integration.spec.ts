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
import type { WarehouseAccess, WriteReceipt } from "@croco/warehouse-core/runtime";
import type { PipelineDefinition, PipelineRuntime } from "@croco/etl-core/pipeline";
import type { WarehousePostgresPool } from "../facts/client";

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
        setPermissionEpoch(epoch: number) {
          access = { ...access, permissionEpoch: epoch };
        },
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

    async function fileDefinition(input: typeof rows): Promise<PipelineDefinition> {
      const content = input.map((row) => JSON.stringify(row)).join("\n");
      const path = join(directory, `manifest-${randomUUID()}.jsonl`);
      await writeFile(path, content);
      const inputSchema = {
        ...schema,
        limits: { ...schema.limits, maxBytes: 200_000, maxRecords: 100 },
      };
      return {
        ...definition,
        project: defineProjection({ source: inputSchema, target: fact, columns: project.columns }),
        source: {
          ...definition.source,
          partitions: [
            {
              ...definition.source.partitions[0],
              path,
              schema: inputSchema,
              revision: createHash("sha256").update(content).digest("hex"),
            },
          ],
        },
      };
    }

    it.each([
      "missing",
      "extra",
      "payload",
      "binding",
      "sequence",
      "future-attempt",
      "indeterminate",
    ] as const)(
      "keeps the prior snapshot when the bounded manifest has a %s receipt",
      async (fault) => {
        const store = services();
        const prior = await createPipelineOperations(definition, store.runtime).run();
        const seal = store.runtime.catalog.sealCandidate.bind(store.runtime.catalog);
        vi.spyOn(store.runtime.catalog, "sealCandidate").mockImplementationOnce(async (request) => {
          const stored = await connection.pool.query<{
            batch_id: string;
            receipt: WriteReceipt;
            payload_hash: string;
            attempt: number;
          }>(
            "SELECT batch_id,receipt,payload_hash,attempt FROM warehouse_receipts WHERE candidate_id=$1 ORDER BY receipt->'evidence'->>'sequence'",
            [request.candidateId],
          );
          expect(stored.rows).toHaveLength(2);
          const first = stored.rows[0];
          if (fault === "missing") {
            await connection.pool.query(
              "DELETE FROM warehouse_receipts WHERE candidate_id=$1 AND batch_id=$2",
              [request.candidateId, first.batch_id],
            );
          } else if (fault === "extra") {
            await connection.pool.query(
              "INSERT INTO warehouse_receipts(candidate_id,batch_id,attempt,payload_hash,receipt) VALUES($1,$2,$3,$4,$5)",
              [
                request.candidateId,
                "unexpected-batch",
                first.attempt,
                first.payload_hash,
                { ...first.receipt, batchId: "unexpected-batch" },
              ],
            );
          } else if (fault === "payload") {
            await connection.pool.query(
              "UPDATE warehouse_receipts SET payload_hash=$3 WHERE candidate_id=$1 AND batch_id=$2",
              [request.candidateId, first.batch_id, "c".repeat(64)],
            );
          } else {
            const changed =
              fault === "binding"
                ? {
                    ...first.receipt,
                    evidence: { ...first.receipt.evidence, bindingHash: "d".repeat(64) },
                  }
                : fault === "sequence"
                  ? {
                      ...stored.rows[1].receipt,
                      evidence: { ...stored.rows[1].receipt.evidence, sequence: 1 },
                    }
                  : fault === "future-attempt"
                    ? { ...first.receipt, attempt: 2 }
                    : { ...first.receipt, state: "indeterminate" };
            await connection.pool.query(
              "UPDATE warehouse_receipts SET receipt=$3,attempt=$4 WHERE candidate_id=$1 AND batch_id=$2",
              [
                request.candidateId,
                fault === "sequence" ? stored.rows[1].batch_id : first.batch_id,
                changed,
                fault === "future-attempt" ? 2 : first.attempt,
              ],
            );
          }
          return seal(request);
        });
        await expect(createPipelineOperations(definition, store.runtime).run()).rejects.toThrow(
          "WAREHOUSE_RECEIPTS_INCOMPLETE",
        );
        const dataset = await store.runtime.catalog.describeDataset({
          access: store.resolveAccess(),
        });
        expect(dataset.headId).toBe(prior.snapshotId);
        expect(dataset.revision).toBe(1);
        expect((await store.read(prior.snapshotId as string)).rows).toEqual(rows);
      },
    );

    it("denies cross-tenant receipt diagnostics and forged read authority", async () => {
      const owner = services();
      const result = await createPipelineOperations(definition, owner.runtime).run();
      const request = {
        access: owner.resolveAccess(),
        candidateId: `etl:${result.executionId}`,
        limit: 1,
      };
      const otherTenant = services();
      await expect(otherTenant.runtime.catalog.readReceipts(request)).rejects.toThrow(
        "WAREHOUSE_CANDIDATE_FENCE",
      );
      const noRead = new PostgresWarehouseCatalog(connection.pool, descriptor, () => ({
        ...owner.resolveAccess(),
        roles: ["import"],
      }));
      await expect(noRead.readReceipts(request)).rejects.toThrow("WAREHOUSE_ACCESS_DENIED");
    });

    it("seals across receipt pages and records an all-filtered final partial range", async () => {
      const store = services();
      const input = Array.from({ length: 35 }, (_, index) => ({
        ...rows[index % 2],
        id: `range-${String(index).padStart(2, "0")}`,
      }));
      const source = await fileDefinition(input);
      const checkpointBytes: number[] = [];
      const checkpoint = store.runtime.executions.checkpointAttempt.bind(store.runtime.executions);
      vi.spyOn(store.runtime.executions, "checkpointAttempt").mockImplementation(
        async (...args) => {
          checkpointBytes.push(Buffer.byteLength(JSON.stringify(args[2])));
          return checkpoint(...args);
        },
      );
      const result = await createPipelineOperations(
        {
          ...source,
          processor: {
            artifactHash: "a".repeat(64),
            dependencies: [],
            process: (row) => (row.id === "range-34" ? null : row),
          },
        },
        { ...store.runtime, chunkSize: 2 },
      ).run();
      expect(result).toMatchObject({
        state: "published",
        inputCount: 35,
        outputCount: 34,
        filteredCount: 1,
      });
      expect(Math.max(...checkpointBytes)).toBeLessThan(3000);
      const all: WriteReceipt[] = [];
      let afterBatchId: string | undefined;
      for (;;) {
        const page = await store.runtime.catalog.readReceipts({
          access: store.resolveAccess(),
          candidateId: `etl:${result.executionId}`,
          afterBatchId,
          limit: 7,
        });
        expect(page.length).toBeLessThanOrEqual(7);
        all.push(...page);
        expect(all.length).toBeLessThanOrEqual(18);
        if (page.length < 7) break;
        afterBatchId = page.at(-1)?.batchId;
      }
      expect(all).toHaveLength(18);
      expect(new Set(all.map((receipt) => receipt.batchId)).size).toBe(18);
      expect(all.find((receipt) => receipt.evidence?.sequence === 18)).toMatchObject({
        inserted: 0,
        identical: 0,
        evidence: { from: 35, through: 35, filtered: 1, rejected: 0, rejections: [] },
      });
      const physical = await connection.pool.query<{ count: number }>(
        "SELECT sum((receipt->>'inserted')::integer)::integer AS count FROM warehouse_receipts WHERE candidate_id=$1",
        [`etl:${result.executionId}`],
      );
      expect(physical.rows).toEqual([{ count: 34 }]);
    });

    it("stores quarantine diagnostics in bounded receipt pages instead of checkpoints", async () => {
      const store = services();
      const sensitive = "private-invalid-amount";
      const input = Array.from({ length: 80 }, (_, index) => ({
        ...rows[0],
        id: `rejected-${index}`,
        amount: sensitive,
      }));
      const source = await fileDefinition(input);
      const checkpointBytes: number[] = [];
      const checkpoint = store.runtime.executions.checkpointAttempt.bind(store.runtime.executions);
      vi.spyOn(store.runtime.executions, "checkpointAttempt").mockImplementation(
        async (...args) => {
          checkpointBytes.push(Buffer.byteLength(JSON.stringify(args[2])));
          return checkpoint(...args);
        },
      );
      const result = await createPipelineOperations(
        { ...source, load: "quarantine" },
        { ...store.runtime, chunkSize: 5 },
      ).run();
      expect(result).toMatchObject({
        state: "partial",
        inputCount: 80,
        outputCount: 0,
        rejectedCount: 80,
        snapshotId: null,
      });
      expect(Math.max(...checkpointBytes)).toBeLessThan(3000);
      const saved = await store.manager().get(result.executionId);
      expect(JSON.stringify(saved.checkpoints)).not.toContain(sensitive);
      const all: WriteReceipt[] = [];
      let afterBatchId: string | undefined;
      for (;;) {
        const page = await store.runtime.catalog.readReceipts({
          access: store.resolveAccess(),
          candidateId: `etl:${result.executionId}`,
          afterBatchId,
          limit: 7,
        });
        expect(page.every((receipt) => (receipt.evidence?.rejections.length ?? 0) <= 5)).toBe(true);
        all.push(...page);
        expect(all.length).toBeLessThanOrEqual(16);
        if (page.length < 7) break;
        afterBatchId = page.at(-1)?.batchId;
      }
      const rejected = all.flatMap((receipt) => receipt.evidence?.rejections ?? []);
      expect(rejected).toHaveLength(80);
      expect(rejected.map((item) => item.record).sort((a, b) => a - b)).toEqual(
        Array.from({ length: 80 }, (_, index) => index + 1),
      );
      expect(
        rejected.every(
          (item) =>
            item.sourceId === "payments-partition" &&
            item.reason.length > 0 &&
            item.sensitivity === "sensitive",
        ),
      ).toBe(true);
      expect(JSON.stringify(all)).not.toContain(sensitive);
      await connection.pool.query(
        "UPDATE warehouse_candidates SET created_at='2000-01-01' WHERE id=$1",
        [`etl:${result.executionId}`],
      );
      await store.runtime.catalog.expireSnapshots({
        access: store.resolveAccess(),
        before: "2001-01-01T00:00:00Z",
        audit: {
          reason: "Expired diagnostic retention",
          expectedRevision: 0,
          idempotencyKey: "expire-diagnostics",
        },
      });
      const retained = await connection.pool.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM warehouse_receipts WHERE candidate_id=$1",
        [`etl:${result.executionId}`],
      );
      expect(retained.rows).toEqual([{ count: 0 }]);
      expect((await store.manager().get(result.executionId)).checkpoints).toEqual(
        saved.checkpoints,
      );
      expect(
        (await store.runtime.catalog.describeDataset({ access: store.resolveAccess() })).headId,
      ).toBeNull();
    });

    it("loads 1000 exact payments in ten atomic batches through the production pipeline", async () => {
      const store = services();
      const input = Array.from({ length: 1000 }, (_, index) => ({
        ...rows[index % 2],
        id: `payment-${String(index).padStart(4, "0")}`,
      }));
      const largeSchema = {
        ...schema,
        limits: { ...schema.limits, maxBytes: 200_000, maxRecords: 1000 },
      };
      const content = input.map((row) => JSON.stringify(row)).join("\n");
      const path = join(directory, "batch-payments.jsonl");
      await writeFile(path, content);
      const statements: string[] = [];
      let maxParameters = 0;
      const pool: WarehousePostgresPool = {
        async query<T>(sql: string, values?: unknown[]) {
          const result = await connection.pool.query(sql, values);
          return { rows: result.rows as T[] };
        },
        async connect() {
          const client = await connection.pool.connect();
          return {
            async query<T>(sql: string, values?: unknown[]) {
              statements.push(sql);
              maxParameters = Math.max(maxParameters, values?.length ?? 0);
              const result = await client.query(sql, values);
              return { rows: result.rows as T[] };
            },
            release: (error?: Error | boolean) => client.release(error),
          };
        },
      };
      const writer = new PostgresWarehouseWriter(pool, descriptor, store.resolveAccess);
      const writes = vi.spyOn(writer, "write");
      const result = await createPipelineOperations(
        {
          ...definition,
          project: defineProjection({
            source: largeSchema,
            target: fact,
            columns: project.columns,
          }),
          source: {
            ...definition.source,
            partitions: [
              {
                ...definition.source.partitions[0],
                path,
                schema: largeSchema,
                revision: createHash("sha256").update(content).digest("hex"),
              },
            ],
          },
        },
        { ...store.runtime, writer, chunkSize: 100, maxInputRecords: 1000 },
      ).run();
      expect(result).toMatchObject({ state: "published", inputCount: 1000, outputCount: 1000 });
      expect(writes).toHaveBeenCalledTimes(10);
      expect(statements.filter((sql) => sql === "BEGIN")).toHaveLength(10);
      expect(statements.filter((sql) => sql === "COMMIT")).toHaveLength(10);
      expect(statements).toHaveLength(100);
      expect(maxParameters).toBe(700);
      const receipts = await connection.pool.query<{ count: number; inserted: number }>(
        "SELECT count(*)::integer AS count, sum((receipt->>'inserted')::integer)::integer AS inserted FROM warehouse_receipts WHERE candidate_id=$1",
        [`etl:${result.executionId}`],
      );
      expect(receipts.rows).toEqual([{ count: 10, inserted: 1000 }]);
      const reader = new PostgresWarehouseReader(
        connection.pool,
        descriptor,
        store.resolveAccess,
        "etl-integration-cursor-secret-32bytes",
        cancellationPool,
      );
      const request = {
        access: store.resolveAccess(),
        snapshotId: result.snapshotId as string,
        projection: ["id", "amount", "occurredAt"],
        filters: [],
        order: [{ column: "id", direction: "asc" as const }],
        maxRows: 100,
        maxBytes: 200_000,
        timeoutMs: 5000,
      };
      const actual = [];
      let cursor: string | undefined;
      do {
        const page = await reader.read({ ...request, cursor });
        actual.push(...page.rows);
        cursor = page.nextCursor ?? undefined;
      } while (cursor && actual.length <= input.length);
      expect(cursor).toBeUndefined();
      expect(actual).toEqual(input);
      expect(await store.manager().get(result.executionId)).toMatchObject({
        status: "completed",
        result,
      });
    }, 60_000);

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

    it("requires fixed batch boundaries when restoring a nonzero cursor after a checkpoint fault", async () => {
      const store = services();
      const saveCheckpoint = store.runtime.executions.checkpointAttempt.bind(
        store.runtime.executions,
      );
      let checkpointCount = 0;
      const checkpoint = vi
        .spyOn(store.runtime.executions, "checkpointAttempt")
        .mockImplementation(async (...args) => {
          if (args[1] === "payments.chunkCheckpoint") checkpointCount++;
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
      expect(saved.checkpoints?.["payments.chunkCheckpoint"]).toMatchObject({
        cursor: { cursor: { partition: 0, record: 1, counts: { input: 1, output: 1 } } },
        processedCount: 1,
      });
      checkpoint.mockRestore();
      const restartedOwner = store.publication();
      const restarted = createPipelineOperations(definition, {
        ...store.runtime,
        executions: restartedOwner.executions,
        publication: restartedOwner,
        chunkSize: 3,
      });
      await expect(restarted.retry(executionId)).rejects.toThrow("binding-changed");
      expect((await store.manager().get(executionId)).attempts).toBe(1);
      const result = await createPipelineOperations(definition, {
        ...store.runtime,
        executions: restartedOwner.executions,
        publication: restartedOwner,
      }).retry(executionId);
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
      expect(reimported).toHaveLength(1);
      expect(reimported[0].batch_id).not.toBe(initial[0].batch_id);
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
      const prior = await createPipelineOperations(definition, store.runtime).run();
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
      await expect(store.read(prior.snapshotId as string)).rejects.toThrow(
        "WAREHOUSE_EPOCH_CHANGED",
      );
      await expect(
        store.runtime.catalog.pinSnapshot({ access: store.resolveAccess() }),
      ).rejects.toThrow("WAREHOUSE_EPOCH_CHANGED");
      const dataset = await store.runtime.catalog.describeDataset({
        access: store.resolveAccess(),
      });
      expect(dataset).toMatchObject({
        headId: prior.snapshotId,
        headStatus: "stale",
        revision: 2,
        privacyEpoch: 1,
      });
      await expect(createPipelineOperations(definition, store.runtime).run()).rejects.toThrow(
        "WAREHOUSE_IDENTITY_SUPPRESSED",
      );
      const content = JSON.stringify(rows[1]) + "\n";
      const path = join(directory, `privacy-${randomUUID()}.jsonl`);
      await writeFile(path, content);
      const refreshed: PipelineDefinition = {
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
      const result = await createPipelineOperations(refreshed, store.runtime).run();
      expect(result.state).toBe("published");
      expect((await store.read(result.snapshotId as string)).rows).toEqual([rows[1]]);
      expect(
        await store.runtime.catalog.describeDataset({ access: store.resolveAccess() }),
      ).toMatchObject({
        headId: result.snapshotId,
        headStatus: "readable",
        revision: 3,
      });
      await expect(store.read(prior.snapshotId as string)).rejects.toThrow(
        "WAREHOUSE_EPOCH_CHANGED",
      );
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
    it("republishes against the retained CAS identity when head snapshot metadata expires", async () => {
      const store = services();
      const operations = createPipelineOperations(definition, store.runtime);
      const prior = await operations.run();
      await connection.pool.query("UPDATE warehouse_snapshots SET expires_at=now() WHERE id=$1", [
        prior.snapshotId,
      ]);
      expect(
        await store.runtime.catalog.describeDataset({ access: store.resolveAccess() }),
      ).toMatchObject({
        headId: prior.snapshotId,
        head: null,
        headStatus: "unavailable",
        revision: 1,
      });
      await expect(store.read(prior.snapshotId as string)).rejects.toThrow(
        "WAREHOUSE_SNAPSHOT_UNAVAILABLE",
      );
      const result = await operations.run();
      expect((await store.read(result.snapshotId as string)).rows).toEqual(rows);
      expect(
        await store.runtime.catalog.describeDataset({ access: store.resolveAccess() }),
      ).toMatchObject({
        headId: result.snapshotId,
        headStatus: "readable",
        revision: 2,
      });
    });
    it("republishes after permission synchronization while retaining publication CAS fencing", async () => {
      const store = services();
      const operations = createPipelineOperations(definition, store.runtime);
      const prior = await operations.run();
      store.setPermissionEpoch(7);
      await store.runtime.catalog.synchronizePermissionEpoch({
        access: store.resolveAccess(),
        audit: {
          reason: "new permission policy",
          expectedRevision: 1,
          idempotencyKey: randomUUID(),
        },
      });
      await expect(store.read(prior.snapshotId as string)).rejects.toThrow(
        "WAREHOUSE_EPOCH_CHANGED",
      );
      await expect(
        store.runtime.catalog.pinSnapshot({ access: store.resolveAccess() }),
      ).rejects.toThrow("WAREHOUSE_EPOCH_CHANGED");
      expect(
        await store.runtime.catalog.describeDataset({ access: store.resolveAccess() }),
      ).toMatchObject({
        headId: prior.snapshotId,
        headStatus: "stale",
        revision: 2,
        permissionEpoch: 7,
      });
      // Hold both runs after observing the same stale head/revision, before either creates a candidate.
      const describeDataset = store.runtime.catalog.describeDataset.bind(store.runtime.catalog);
      let release: () => void = () => undefined;
      const bothObserved = new Promise<void>((resolve) => {
        release = resolve;
      });
      let observed = 0;
      vi.spyOn(store.runtime.catalog, "describeDataset").mockImplementation(async (request) => {
        const dataset = await describeDataset(request);
        if (++observed === 2) release();
        await bothObserved;
        return dataset;
      });
      const outcomes = await Promise.allSettled([operations.run(), operations.run()]);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      const loser = outcomes.find((outcome) => outcome.status === "rejected");
      expect(loser).toMatchObject({
        status: "rejected",
        reason: { code: "WAREHOUSE_REVISION_CONFLICT" },
      });
      const dataset = await describeDataset({ access: store.resolveAccess() });
      expect(dataset).toMatchObject({ headStatus: "readable", revision: 3, permissionEpoch: 7 });
      expect(dataset.head?.permissionEpoch).toBe(7);
      expect((await store.read(dataset.headId as string)).rows).toEqual(rows);
      await expect(store.read(prior.snapshotId as string)).rejects.toThrow(
        "WAREHOUSE_EPOCH_CHANGED",
      );
    });
  },
);
