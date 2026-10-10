import { randomUUID } from "node:crypto";

import { postgresResource } from "@croco/testing-resources";
import { c, compileFact, defineFact, validateRow } from "@croco/warehouse-core";
import {
  generatePostgresFactSchema,
  PostgresWarehouseCatalog,
  PostgresWarehouseReader,
  PostgresWarehouseWriter,
} from "@croco/warehouse-postgres/facts";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { compileDataConfig } from "../libs/compiler";

import type { PostgresTestConnection } from "@croco/testing-resources";
import type { WarehouseAccess, WarehouseQuality } from "@croco/warehouse-core/runtime";

const fact = defineFact("compiler_payments", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One payment", key: ["id"] },
  columns: {
    id: c.id(),
    amount: c.int64(),
    at: c.instant({ precision: "millisecond" }),
    note: c.nullable(c.string()),
  },
  time: { event: "at" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});

const quality: WarehouseQuality = {
  freshness: { observedAt: "2026-09-27T12:00:00.000Z", newestEventAt: "2026-09-27T10:00:00.000Z" },
  temporalCompleteness: "complete",
  populationCoverage: "complete",
  validity: "valid",
  reproducibility: "reproducible",
  sourceCoverage: [
    {
      sourceRef: "payments",
      from: "2026-09-27",
      through: "2026-09-27",
      state: "complete",
      gaps: [],
      late: false,
    },
  ],
};

describe.skipIf(process.env.CROCO_TEST_REAL_RESOURCES !== "1")(
  "compiler PostgreSQL artifact",
  () => {
    let connection: PostgresTestConnection;
    let cancellationPool: Pool;
    let dispose: () => Promise<void> | void;

    beforeAll(async () => {
      const resource = postgresResource({ id: "data-compiler", mode: "commit" });
      const started = await resource.start({
        register: () => undefined,
        testId: "data-compiler",
        workerId: "warehouse-tooling",
      });
      connection = started.connection;
      dispose = started.dispose;
      cancellationPool = new Pool({ connectionString: connection.connectionString, max: 1 });
    }, 180_000);

    afterAll(async () => {
      await cancellationPool?.end();
      await dispose?.();
    });

    it("installs compiler SQL in public and serves validated published rows without runtime installers", async () => {
      const compiled = await compileDataConfig({
        connections: [{ id: "warehouse", env: "DATABASE_URL" }],
        sources: [],
        models: [
          {
            backend: "postgres",
            fact,
            connection: "warehouse",
            location: { file: "src/tests/DataCompiler.integration.spec.ts", line: 20, column: 1 },
          },
        ],
        pipelines: [],
      });
      const descriptor = await compileFact(fact);
      const generated = await generatePostgresFactSchema(descriptor);
      const migration = compiled.files["migrations/candidate.sql"];
      expect(migration).toBeTypeOf("string");
      const client = await connection.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("CREATE SCHEMA app");
        await client.query(
          "CREATE TABLE app.warehouse_candidates (application_owned TEXT PRIMARY KEY)",
        );
        await client.query("INSERT INTO app.warehouse_candidates VALUES ('preserve-me')");
        await client.query("SET LOCAL search_path=app,public");
        await client.query(migration);
        expect((await client.query("SELECT * FROM app.warehouse_candidates")).rows).toEqual([
          { application_owned: "preserve-me" },
        ]);
        expect(
          (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='app'")).rows,
        ).toEqual([{ tablename: "warehouse_candidates" }]);
        const metadata = await client.query<{ tablename: string }>(
          "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'warehouse_%' ORDER BY tablename",
        );
        expect(metadata.rows.map((entry) => entry.tablename)).toEqual([
          "warehouse_candidates",
          "warehouse_heads",
          "warehouse_models",
          "warehouse_mutations",
          "warehouse_receipts",
          "warehouse_snapshots",
          "warehouse_suppressions",
        ]);
        const physical = await client.query<{ name: string; sql_type: string; nullable: boolean }>(
          `SELECT attname AS name, format_type(atttypid, atttypmod) AS sql_type, NOT attnotnull AS nullable
         FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped AND attname LIKE 'c_%'
         ORDER BY attname`,
          [`public.${generated.tableName}`],
        );
        expect(physical.rows).toEqual(
          generated.columns.map((column) => ({
            name: column.name,
            sql_type: column.sqlType
              .replace(/^TIMESTAMPTZ\((\d)\)$/, "timestamp($1) with time zone")
              .toLowerCase(),
            nullable: column.nullable,
          })),
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      const access: WarehouseAccess = {
        scope: { application: "compiler-test", environment: "test", tenant: "one" },
        actor: "operator",
        roles: ["read", "import", "publish"],
        columns: Object.keys(descriptor.columns),
        permissionEpoch: 0,
        privacyEpoch: 0,
      };
      const catalog = new PostgresWarehouseCatalog(connection.pool, descriptor, () => access);
      const writer = new PostgresWarehouseWriter(connection.pool, descriptor, () => access);
      const reader = new PostgresWarehouseReader(
        connection.pool,
        descriptor,
        () => access,
        "compiler-integration-cursor-secret-32bytes",
        cancellationPool,
      );
      const candidate = await catalog.createCandidate({
        access,
        id: randomUUID(),
        transformHash: "compiler-artifact",
        sourceRefs: ["payments"],
        expectedHead: null,
        partitionSelection: null,
        audit: {
          reason: "verify generated migration",
          expectedRevision: 0,
          idempotencyKey: randomUUID(),
        },
      });
      const row = validateRow(descriptor, {
        id: "payment-1",
        amount: "9007199254740993",
        at: "2026-09-27T10:00:00.000Z",
        note: null,
      });
      const receipt = await writer.write({
        access,
        candidateId: candidate.id,
        fence: candidate.fence,
        batchId: "one",
        attempt: 1,
        rows: [row],
      });
      expect(receipt).toMatchObject({ state: "durable", inserted: 1 });
      await catalog.sealCandidate({
        access,
        candidateId: candidate.id,
        fence: candidate.fence,
        expectedBatchIds: ["one"],
        quality,
        audit: { reason: "validated row", expectedRevision: 0, idempotencyKey: randomUUID() },
      });
      const snapshot = await catalog.publishCandidate({
        access,
        candidateId: candidate.id,
        fence: candidate.fence,
        audit: {
          reason: "publish generated schema data",
          expectedRevision: 0,
          idempotencyKey: randomUUID(),
        },
      });
      const page = await reader.read({
        access,
        snapshotId: snapshot.id,
        projection: ["id", "amount", "at", "note"],
        filters: [],
        order: [{ column: "id", direction: "asc" }],
        maxRows: 10,
        maxBytes: 4096,
        timeoutMs: 5000,
      });
      expect(page.rows).toEqual([row]);
    }, 120_000);
  },
);
