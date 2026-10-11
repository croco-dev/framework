import { randomUUID } from "node:crypto";

import { postgresResource, type PostgresTestConnection } from "@croco/testing-resources";
import { c, compileFact, defineFact, encodeIdentity, validateRow } from "@croco/warehouse-core";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  generatePostgresFactSchema,
  generatePostgresWarehouseSchema,
  installPostgresFactSchema,
  installPostgresWarehouseSchema,
  PostgresWarehouseCatalog,
  PostgresWarehouseReader,
  PostgresWarehouseWriter,
} from "../facts";

import type { FactDescriptor } from "@croco/warehouse-core";
import type {
  WarehouseAccess,
  WarehouseQuality,
  WarehouseReadRequest,
} from "@croco/warehouse-core/runtime";
import type { WarehousePostgresPool } from "../facts";

const realResourcesEnabled = process.env.CROCO_TEST_REAL_RESOURCES === "1";

const captures = defineFact("warehouse_capture_integration", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One confirmed capture", key: ["captureId"] },
  columns: {
    captureId: c.id(),
    amount: c.moneyMinor({ currency: "currency", min: BigInt(0) }),
    currency: c.currencyCode(),
    capturedAt: c.instant({ precision: "millisecond" }),
    privateNote: c.nullable(c.string({ sensitivity: "sensitive" })),
  },
  time: { event: "capturedAt" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});

const searchDaily = defineFact("warehouse_search_integration", {
  version: 1,
  kind: "aggregate",
  scope: "tenant",
  grain: { description: "One query per index and local date", key: ["day", "indexId", "queryId"] },
  columns: {
    day: c.date({ zone: "Asia/Seoul" }),
    indexId: c.id(),
    queryId: c.id(),
    searches: c.int64({ min: BigInt(0) }),
    rate: c.decimal({ precision: 12, scale: 2 }),
  },
  time: { event: "day" },
  write: { mode: "replace-range", duplicate: "ignore-identical", conflict: "reject" },
  aggregate: {
    date: "day",
    series: ["indexId"],
    dimensions: ["queryId"],
    measures: {
      searches: { unit: "search", reaggregate: "sum" },
      rate: { unit: "ratio", reaggregate: "none" },
    },
  },
});

const quality: WarehouseQuality = {
  freshness: { observedAt: "2026-09-27T12:00:00.000Z", newestEventAt: "2026-09-27T10:00:00.000Z" },
  temporalCompleteness: "complete",
  populationCoverage: "complete",
  validity: "valid",
  reproducibility: "reproducible",
  sourceCoverage: [
    {
      sourceRef: "captures",
      from: "2026-09-27",
      through: "2026-09-27",
      state: "complete",
      gaps: [],
      late: false,
    },
  ],
};

describe.skipIf(!realResourcesEnabled)("PostgreSQL warehouse facts", () => {
  let connection: PostgresTestConnection;
  let cancellationPool: Pool;
  let dispose: () => Promise<void> | void;
  let descriptor: FactDescriptor;
  let searchDescriptor: FactDescriptor;

  beforeAll(async () => {
    const resource = postgresResource({ id: "warehouse-facts", mode: "commit" });
    const started = await resource.start({
      register: () => undefined,
      testId: "warehouse-facts",
      workerId: "warehouse-postgres",
    });
    connection = started.connection;
    cancellationPool = new Pool({ connectionString: connection.connectionString, max: 1 });
    dispose = started.dispose;
    descriptor = await compileFact(captures);
    searchDescriptor = await compileFact(searchDaily);
    const migration = [
      generatePostgresWarehouseSchema(),
      (await generatePostgresFactSchema(descriptor)).sql,
      (await generatePostgresFactSchema(searchDescriptor)).sql,
    ].join("\n");
    const migrationClient = await connection.pool.connect();
    try {
      await migrationClient.query("BEGIN");
      await migrationClient.query("CREATE SCHEMA app");
      await migrationClient.query(
        "CREATE TABLE app.warehouse_candidates (application_owned TEXT PRIMARY KEY)",
      );
      await migrationClient.query("INSERT INTO app.warehouse_candidates VALUES ('preserve-me')");
      await migrationClient.query("SET LOCAL search_path=app,public");
      await migrationClient.query(migration);
      const applicationTable = await migrationClient.query(
        "SELECT * FROM app.warehouse_candidates",
      );
      expect(applicationTable.rows).toEqual([{ application_owned: "preserve-me" }]);
      const metadata = await migrationClient.query<{ tablename: string }>(
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
      const applicationObjects = await migrationClient.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname='app' ORDER BY tablename",
      );
      expect(applicationObjects.rows).toEqual([{ tablename: "warehouse_candidates" }]);
      await migrationClient.query("COMMIT");
    } catch (error) {
      await migrationClient.query("ROLLBACK");
      throw error;
    } finally {
      migrationClient.release();
    }
    for (const model of [descriptor, searchDescriptor]) {
      const generated = await generatePostgresFactSchema(model);
      const physical = await connection.pool.query<{
        name: string;
        sql_type: string;
        nullable: boolean;
      }>(
        `SELECT attname AS name, format_type(atttypid, atttypmod) AS sql_type, NOT attnotnull AS nullable
         FROM pg_attribute
         WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped AND attname LIKE 'c_%'
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
    }
  }, 180_000);

  afterAll(async () => {
    await cancellationPool?.end();
    await dispose?.();
  });

  function services(tenant: string, model: FactDescriptor = descriptor) {
    let access: WarehouseAccess = {
      scope: { application: "warehouse-test", environment: "test", tenant },
      actor: "operator",
      roles: ["read", "import", "publish", "drop"],
      columns: Object.keys(model.columns),
      permissionEpoch: 0,
      privacyEpoch: 0,
    };
    const resolveAccess = () => access;
    return {
      access: () => access,
      resolveAccess,
      setPrivacyEpoch: (privacyEpoch: number) => {
        access = { ...access, privacyEpoch };
      },
      setPermissionEpoch: (permissionEpoch: number) => {
        access = { ...access, permissionEpoch };
      },
      catalog: new PostgresWarehouseCatalog(connection.pool, model, resolveAccess),
      writer: new PostgresWarehouseWriter(connection.pool, model, resolveAccess),
      reader: new PostgresWarehouseReader(
        connection.pool,
        model,
        resolveAccess,
        "warehouse-integration-cursor-secret-32bytes",
        cancellationPool,
      ),
    };
  }

  function row(captureId: string, amount: string) {
    return validateRow(descriptor, {
      captureId,
      amount,
      currency: "USD",
      capturedAt: "2026-09-27T10:00:00.000Z",
      privateNote: "hidden",
    });
  }

  function poolWithLostCommitResponse(): WarehousePostgresPool {
    let lost = false;
    return {
      query: async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
        const result = await connection.pool.query(sql, params);
        return { rows: result.rows as T[], rowCount: result.rowCount };
      },
      connect: async () => {
        const client = await connection.pool.connect();
        return {
          query: async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
            const result = await client.query(sql, params);
            if (sql === "COMMIT" && !lost) {
              lost = true;
              throw new Error("commit response lost");
            }
            return { rows: result.rows as T[], rowCount: result.rowCount };
          },
          release: (error?: Error | boolean) => client.release(error),
        };
      },
    };
  }

  it("preserves quoted descriptor text when installing generated migration SQL", async () => {
    const description = "it's \\ $warehouse_binding$; DROP TABLE warehouse_models;";
    const quoted = await compileFact({
      ...captures,
      name: "warehouse_quoted_integration",
      grain: { ...captures.grain, description },
    });
    const client = await connection.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query((await generatePostgresFactSchema(quoted)).sql);
      const stored = await client.query<{ descriptor: FactDescriptor }>(
        "SELECT descriptor FROM warehouse_models WHERE model_version=$1",
        [quoted.semanticHash],
      );
      expect(stored.rows[0].descriptor.grain.description).toBe(description);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("replays generated migrations after documentation-only changes", async () => {
    const documented = await compileFact({
      ...captures,
      description: "Reviewed capture model documentation",
      grain: { ...captures.grain, description: "Reviewed capture grain documentation" },
      columns: {
        ...captures.columns,
        captureId: {
          ...captures.columns.captureId,
          description: "Reviewed capture identifier documentation",
        },
      },
    });
    expect(documented.semanticHash).toBe(descriptor.semanticHash);
    await connection.pool.query((await generatePostgresFactSchema(documented)).sql);
    await connection.pool.query((await generatePostgresFactSchema(descriptor)).sql);
  });

  it("replays generated SQL and rejects a conflicting stored model binding", async () => {
    const generated = await generatePostgresFactSchema(descriptor);
    await connection.pool.query(generated.sql);
    const client = await connection.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE warehouse_models SET descriptor=jsonb_set(descriptor, '{columns,amount,type}', '\"string\"'::jsonb) WHERE model_version=$1",
        [descriptor.semanticHash],
      );
      await expect(client.query(generated.sql)).rejects.toThrow("WAREHOUSE_BINDING_CONFLICT");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("publishes only sealed facts and preserves a pinned page after the head advances", async () => {
    const store = services(randomUUID());
    const candidateId = randomUUID();
    const candidate = await store.catalog.createCandidate({
      access: store.access(),
      id: candidateId,
      transformHash: "transform-v1",
      sourceRefs: ["captures"],
      expectedHead: null,
      partitionSelection: null,
      audit: { reason: "load captures", expectedRevision: 0, idempotencyKey: randomUUID() },
    });
    await expect(store.catalog.pinSnapshot({ access: store.access() })).rejects.toThrow();
    const first = await store.writer.write({
      access: store.access(),
      candidateId,
      fence: candidate.fence,
      batchId: "batch-1",
      attempt: 1,
      rows: [row("capture-1", "9223372036854775807"), row("capture-2", "25")],
    });
    expect(first.state).toBe("durable");
    expect(first.inserted).toBe(2);
    const replay = await store.writer.write({
      access: store.access(),
      candidateId,
      fence: candidate.fence,
      batchId: "batch-2",
      attempt: 1,
      rows: [row("capture-1", "9223372036854775807")],
    });
    expect(replay.identical).toBe(1);
    await expect(
      store.writer.write({
        access: store.access(),
        candidateId,
        fence: candidate.fence,
        batchId: "conflict",
        attempt: 1,
        rows: [row("capture-1", "30")],
      }),
    ).rejects.toThrow();
    await store.catalog.sealCandidate({
      access: store.access(),
      candidateId,
      fence: candidate.fence,
      expectedBatchIds: ["batch-1", "batch-2"],
      quality,
      audit: { reason: "coverage verified", expectedRevision: 0, idempotencyKey: randomUUID() },
    });
    await expect(
      store.writer.write({
        access: store.access(),
        candidateId,
        fence: candidate.fence,
        batchId: "late",
        attempt: 1,
        rows: [row("capture-3", "1")],
      }),
    ).rejects.toThrow();
    const snapshot = await store.catalog.publishCandidate({
      access: store.access(),
      candidateId,
      fence: candidate.fence,
      audit: {
        reason: "publish verified captures",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      },
    });
    const request = {
      access: store.access(),
      snapshotId: snapshot.id,
      projection: ["captureId", "amount"],
      filters: [],
      order: [{ column: "captureId", direction: "asc" as const }],
      maxRows: 1,
      maxBytes: 4096,
      timeoutMs: 5000,
    };
    await expect(
      store.reader.read({
        ...request,
        order: [{ column: "captureId", direction: "asc,pg_sleep(1)" }],
      } as unknown as WarehouseReadRequest),
    ).rejects.toThrow("WAREHOUSE_INVALID_ORDER");
    const page = await store.reader.read(request);
    expect(page.rows).toEqual([{ captureId: "capture-1", amount: "9223372036854775807" }]);
    expect(page.nextCursor).toBeTruthy();
    const restrictedAccess = { ...store.access(), columns: ["amount"] };
    const restrictedReader = new PostgresWarehouseReader(
      connection.pool,
      descriptor,
      () => restrictedAccess,
      "warehouse-integration-cursor-secret-32bytes",
      cancellationPool,
    );
    const restrictedRequest = {
      ...request,
      access: restrictedAccess,
      projection: ["amount"],
      order: [{ column: "amount", direction: "asc" as const }],
    };
    const restrictedPage = await restrictedReader.read(restrictedRequest);
    expect(restrictedPage.nextCursor).toBeTruthy();
    expect(
      Buffer.from(restrictedPage.nextCursor ?? "", "base64url").toString("utf8"),
    ).not.toContain("capture-2");
    const encryptedCursor = restrictedPage.nextCursor ?? "";
    const tamperedCursor = `${encryptedCursor[0] === "A" ? "B" : "A"}${encryptedCursor.slice(1)}`;
    await expect(
      restrictedReader.read({ ...restrictedRequest, cursor: tamperedCursor }),
    ).rejects.toThrow("WAREHOUSE_INVALID_CURSOR");
    const restrictedNext = await restrictedReader.read({
      ...restrictedRequest,
      cursor: restrictedPage.nextCursor ?? undefined,
    });
    expect(restrictedNext.rows).toEqual([{ amount: "9223372036854775807" }]);
    const secondCandidateId = randomUUID();
    const secondCandidate = await store.catalog.createCandidate({
      access: store.access(),
      id: secondCandidateId,
      transformHash: "transform-v1",
      sourceRefs: ["captures"],
      expectedHead: snapshot.id,
      partitionSelection: null,
      audit: { reason: "append capture", expectedRevision: 1, idempotencyKey: randomUUID() },
    });
    await store.writer.write({
      access: store.access(),
      candidateId: secondCandidateId,
      fence: secondCandidate.fence,
      batchId: "batch-3",
      attempt: 1,
      rows: [row("capture-3", "100")],
    });
    await store.catalog.sealCandidate({
      access: store.access(),
      candidateId: secondCandidateId,
      fence: secondCandidate.fence,
      expectedBatchIds: ["batch-3"],
      quality,
      audit: { reason: "coverage verified", expectedRevision: 1, idempotencyKey: randomUUID() },
    });
    await store.catalog.publishCandidate({
      access: store.access(),
      candidateId: secondCandidateId,
      fence: secondCandidate.fence,
      audit: { reason: "publish append", expectedRevision: 1, idempotencyKey: randomUUID() },
    });
    const pinnedNext = await store.reader.read({
      ...request,
      cursor: page.nextCursor ?? undefined,
    });
    expect(pinnedNext.rows).toEqual([{ captureId: "capture-2", amount: "25" }]);
    expect(pinnedNext.nextCursor).toBeNull();
    store.setPermissionEpoch(1);
    await store.catalog.synchronizePermissionEpoch({
      access: store.access(),
      audit: { reason: "role policy changed", expectedRevision: 2, idempotencyKey: randomUUID() },
    });
    await expect(store.reader.read({ ...request, access: store.access() })).rejects.toThrow();
  }, 120_000);

  it("isolates tenants and suppresses facts across old snapshots and reimports", async () => {
    const left = services(randomUUID());
    const right = services(randomUUID());
    const candidateId = randomUUID();
    const candidate = await left.catalog.createCandidate({
      access: left.access(),
      id: candidateId,
      transformHash: "transform-v1",
      sourceRefs: ["captures"],
      expectedHead: null,
      partitionSelection: null,
      audit: { reason: "load", expectedRevision: 0, idempotencyKey: randomUUID() },
    });
    await left.writer.write({
      access: left.access(),
      candidateId,
      fence: candidate.fence,
      batchId: "batch",
      attempt: 1,
      rows: [row("same", "1"), row("other", "2")],
    });
    await left.catalog.sealCandidate({
      access: left.access(),
      candidateId,
      fence: candidate.fence,
      expectedBatchIds: ["batch"],
      quality,
      audit: { reason: "verified", expectedRevision: 0, idempotencyKey: randomUUID() },
    });
    const snapshot = await left.catalog.publishCandidate({
      access: left.access(),
      candidateId,
      fence: candidate.fence,
      audit: { reason: "publish", expectedRevision: 0, idempotencyKey: randomUUID() },
    });
    await expect(
      right.catalog.pinSnapshot({ access: right.access(), snapshotId: snapshot.id }),
    ).rejects.toThrow();
    const selected = await left.reader.read({
      access: left.access(),
      snapshotId: snapshot.id,
      projection: ["captureId"],
      filters: [],
      order: [{ column: "captureId", direction: "asc" }],
      maxRows: 10,
      maxBytes: 4096,
      timeoutMs: 5000,
    });
    expect(selected.rows).toEqual([{ captureId: "other" }, { captureId: "same" }]);
    const failedId = randomUUID();
    const failedCandidate = await left.catalog.createCandidate({
      access: left.access(),
      id: failedId,
      transformHash: "transform-v1",
      sourceRefs: ["captures"],
      expectedHead: snapshot.id,
      partitionSelection: null,
      audit: { reason: "attempt failed load", expectedRevision: 1, idempotencyKey: randomUUID() },
    });
    await left.catalog.failCandidate({
      access: left.access(),
      candidateId: failedId,
      fence: failedCandidate.fence,
      audit: { reason: "source unavailable", expectedRevision: 1, idempotencyKey: randomUUID() },
    });
    const dataset = await left.catalog.describeDataset({ access: left.access() });
    expect(dataset.head?.id).toBe(snapshot.id);
    expect(
      dataset.candidates.some(
        (candidate) => candidate.id === failedId && candidate.state === "failed",
      ),
    ).toBe(true);
    const identity = encodeIdentity(descriptor, row("same", "1"), left.access().scope);
    const suppressionRequest = {
      access: left.access(),
      identities: [identity],
      audit: { reason: "erase subject", expectedRevision: 1, idempotencyKey: randomUUID() },
    };
    const suppression = await left.catalog.suppress(suppressionRequest);
    expect(await left.catalog.suppress(suppressionRequest)).toEqual(suppression);
    left.setPrivacyEpoch(suppression.privacyEpoch);
    await expect(
      left.reader.read({
        access: left.access(),
        snapshotId: snapshot.id,
        projection: ["captureId"],
        filters: [],
        order: [{ column: "captureId", direction: "asc" }],
        maxRows: 10,
        maxBytes: 4096,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow();
    const retryId = randomUUID();
    const retry = await left.catalog.createCandidate({
      access: left.access(),
      id: retryId,
      transformHash: "transform-v1",
      sourceRefs: ["captures"],
      expectedHead: snapshot.id,
      partitionSelection: null,
      audit: {
        reason: "test suppressed replay",
        expectedRevision: 2,
        idempotencyKey: randomUUID(),
      },
    });
    await expect(
      left.writer.write({
        access: left.access(),
        candidateId: retryId,
        fence: retry.fence,
        batchId: "suppressed-retry",
        attempt: 1,
        rows: [row("same", "1")],
      }),
    ).rejects.toThrow();
    const removalRequest = {
      access: left.access(),
      snapshotId: snapshot.id,
      audit: { reason: "remove publication", expectedRevision: 2, idempotencyKey: randomUUID() },
    };
    const removed = await left.catalog.removePublication(removalRequest);
    expect(await left.catalog.removePublication(removalRequest)).toEqual(removed);
    left.setPrivacyEpoch(removed.privacyEpoch);
    expect((await left.catalog.describeDataset({ access: left.access() })).head).toBeNull();
    const replacementId = randomUUID();
    const replacement = await left.catalog.createCandidate({
      access: left.access(),
      id: replacementId,
      transformHash: "transform-v1",
      sourceRefs: ["captures"],
      expectedHead: null,
      partitionSelection: null,
      audit: { reason: "start new publication", expectedRevision: 3, idempotencyKey: randomUUID() },
    });
    await left.writer.write({
      access: left.access(),
      candidateId: replacementId,
      fence: replacement.fence,
      batchId: "replacement",
      attempt: 1,
      rows: [row("new", "3")],
    });
    await left.catalog.sealCandidate({
      access: left.access(),
      candidateId: replacementId,
      fence: replacement.fence,
      expectedBatchIds: ["replacement"],
      quality,
      audit: {
        reason: "verify new publication",
        expectedRevision: 3,
        idempotencyKey: randomUUID(),
      },
    });
    const republished = await left.catalog.publishCandidate({
      access: left.access(),
      candidateId: replacementId,
      fence: replacement.fence,
      audit: { reason: "publish new head", expectedRevision: 3, idempotencyKey: randomUUID() },
    });
    const afterRemoval = await left.reader.read({
      access: left.access(),
      snapshotId: republished.id,
      projection: ["captureId"],
      filters: [],
      order: [{ column: "captureId", direction: "asc" }],
      maxRows: 10,
      maxBytes: 4096,
      timeoutMs: 5000,
    });
    expect(afterRemoval.rows).toEqual([{ captureId: "new" }]);
  }, 120_000);

  it("replaces a complete aggregate partition while old snapshots keep exact typed rows", async () => {
    const store = services(randomUUID(), searchDescriptor);
    const range = { from: "2026-09-27", through: "2026-09-27", series: { indexId: "products" } };
    const firstId = randomUUID();
    const first = await store.catalog.createCandidate({
      access: store.access(),
      id: firstId,
      transformHash: "search-transform-v1",
      sourceRefs: ["search"],
      expectedHead: null,
      partitionSelection: range,
      audit: { reason: "load search partition", expectedRevision: 0, idempotencyKey: randomUUID() },
    });
    await store.writer.write({
      access: store.access(),
      candidateId: firstId,
      fence: first.fence,
      batchId: "search-1",
      attempt: 1,
      rows: [
        validateRow(searchDescriptor, {
          day: "2026-09-27",
          indexId: "products",
          queryId: "coats",
          searches: "9223372036854775807",
          rate: "12.3",
        }),
      ],
    });
    const searchQuality: WarehouseQuality = {
      ...quality,
      sourceCoverage: [
        {
          sourceRef: "search",
          from: "2026-09-27",
          through: "2026-09-27",
          state: "complete",
          gaps: [],
          late: false,
        },
      ],
    };
    await store.catalog.sealCandidate({
      access: store.access(),
      candidateId: firstId,
      fence: first.fence,
      expectedBatchIds: ["search-1"],
      quality: searchQuality,
      audit: {
        reason: "verified search partition",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      },
    });
    const old = await store.catalog.publishCandidate({
      access: store.access(),
      candidateId: firstId,
      fence: first.fence,
      audit: {
        reason: "publish search partition",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      },
    });
    const read = (snapshotId: string) =>
      store.reader.read({
        access: store.access(),
        snapshotId,
        projection: ["day", "queryId", "searches", "rate"],
        filters: [],
        order: [
          { column: "day", direction: "asc" },
          { column: "queryId", direction: "asc" },
        ],
        maxRows: 10,
        maxBytes: 4096,
        timeoutMs: 5000,
      });
    expect((await read(old.id)).rows).toEqual([
      {
        day: "2026-09-27",
        queryId: "coats",
        searches: "9223372036854775807",
        rate: "12.30",
      },
    ]);
    const emptyId = randomUUID();
    const empty = await store.catalog.createCandidate({
      access: store.access(),
      id: emptyId,
      transformHash: "search-transform-v1",
      sourceRefs: ["search"],
      expectedHead: old.id,
      partitionSelection: range,
      audit: {
        reason: "replace with verified empty partition",
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
      },
    });
    await store.catalog.sealCandidate({
      access: store.access(),
      candidateId: emptyId,
      fence: empty.fence,
      expectedBatchIds: [],
      quality: {
        ...searchQuality,
        sourceCoverage: [
          {
            sourceRef: "search",
            from: "2026-09-27",
            through: "2026-09-27",
            state: "empty",
            gaps: [],
            late: false,
          },
        ],
      },
      audit: {
        reason: "source confirms no rows",
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
      },
    });
    const current = await store.catalog.publishCandidate({
      access: store.access(),
      candidateId: emptyId,
      fence: empty.fence,
      audit: {
        reason: "publish empty search partition",
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
      },
    });
    expect((await read(current.id)).rows).toEqual([]);
    expect((await read(old.id)).rows).toHaveLength(1);
    await connection.pool.query(
      "UPDATE warehouse_snapshots SET data=jsonb_set(data,'{createdAt}',to_jsonb($2::text)) WHERE id=$1",
      [old.id, "2020-01-01T00:00:00.000Z"],
    );
    expect(
      await store.catalog.expireSnapshots({
        access: store.access(),
        before: "2021-01-01T00:00:00.000Z",
        audit: { reason: "expire old snapshot", expectedRevision: 2, idempotencyKey: randomUUID() },
      }),
    ).toEqual({ expired: 1 });
    await expect(read(old.id)).rejects.toThrow("WAREHOUSE_SNAPSHOT_UNAVAILABLE");
    const binding = await connection.pool.query<{ table_name: string }>(
      "SELECT table_name FROM warehouse_models WHERE model_version=$1",
      [searchDescriptor.semanticHash],
    );
    const physical = await connection.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "${binding.rows[0].table_name}" WHERE _scope=$1`,
      [
        JSON.stringify([
          store.access().scope.application,
          store.access().scope.environment,
          store.access().scope.tenant,
        ]),
      ],
    );
    expect(Number(physical.rows[0].count)).toBe(0);
    const beforeRemovalId = randomUUID();
    const beforeRemoval = await store.catalog.createCandidate({
      access: store.access(),
      id: beforeRemovalId,
      transformHash: "search-transform-v1",
      sourceRefs: ["search"],
      expectedHead: current.id,
      partitionSelection: range,
      audit: { reason: "load before removal", expectedRevision: 2, idempotencyKey: randomUUID() },
    });
    await store.writer.write({
      access: store.access(),
      candidateId: beforeRemovalId,
      fence: beforeRemoval.fence,
      batchId: "before-removal",
      attempt: 1,
      rows: [
        validateRow(searchDescriptor, {
          day: "2026-09-27",
          indexId: "products",
          queryId: "scarves",
          searches: "1",
          rate: "1.00",
        }),
      ],
    });
    await store.catalog.sealCandidate({
      access: store.access(),
      candidateId: beforeRemovalId,
      fence: beforeRemoval.fence,
      expectedBatchIds: ["before-removal"],
      quality: searchQuality,
      audit: { reason: "verify before removal", expectedRevision: 2, idempotencyKey: randomUUID() },
    });
    const beforeRemovalSnapshot = await store.catalog.publishCandidate({
      access: store.access(),
      candidateId: beforeRemovalId,
      fence: beforeRemoval.fence,
      audit: {
        reason: "publish before removal",
        expectedRevision: 2,
        idempotencyKey: randomUUID(),
      },
    });
    const removed = await store.catalog.removePublication({
      access: store.access(),
      snapshotId: beforeRemovalSnapshot.id,
      audit: {
        reason: "remove aggregate publication",
        expectedRevision: 3,
        idempotencyKey: randomUUID(),
      },
    });
    store.setPrivacyEpoch(removed.privacyEpoch);
    const afterRemovalId = randomUUID();
    const afterRemoval = await store.catalog.createCandidate({
      access: store.access(),
      id: afterRemovalId,
      transformHash: "search-transform-v1",
      sourceRefs: ["search"],
      expectedHead: null,
      partitionSelection: range,
      audit: { reason: "load after removal", expectedRevision: 4, idempotencyKey: randomUUID() },
    });
    await store.writer.write({
      access: store.access(),
      candidateId: afterRemovalId,
      fence: afterRemoval.fence,
      batchId: "after-removal",
      attempt: 1,
      rows: [
        validateRow(searchDescriptor, {
          day: "2026-09-27",
          indexId: "products",
          queryId: "hats",
          searches: "2",
          rate: "2.00",
        }),
      ],
    });
    await store.catalog.sealCandidate({
      access: store.access(),
      candidateId: afterRemovalId,
      fence: afterRemoval.fence,
      expectedBatchIds: ["after-removal"],
      quality: searchQuality,
      audit: { reason: "verify after removal", expectedRevision: 4, idempotencyKey: randomUUID() },
    });
    const afterRemovalSnapshot = await store.catalog.publishCandidate({
      access: store.access(),
      candidateId: afterRemovalId,
      fence: afterRemoval.fence,
      audit: { reason: "publish after removal", expectedRevision: 4, idempotencyKey: randomUUID() },
    });
    expect((await read(afterRemovalSnapshot.id)).rows).toEqual([
      {
        day: "2026-09-27",
        queryId: "hats",
        searches: "2",
        rate: "2.00",
      },
    ]);
  }, 120_000);

  it("keeps physical objects and snapshot metadata bounded across repeated publications and retention", async () => {
    const store = services(randomUUID());
    let head: string | null = null;
    const publishDurations: number[] = [];
    for (let revision = 0; revision < 24; revision++) {
      const candidateId = randomUUID();
      const candidate = await store.catalog.createCandidate({
        access: store.access(),
        id: candidateId,
        transformHash: "synthetic-v1",
        sourceRefs: ["captures"],
        expectedHead: head,
        partitionSelection: null,
        audit: {
          reason: "synthetic load",
          expectedRevision: revision,
          idempotencyKey: randomUUID(),
        },
      });
      await store.writer.write({
        access: store.access(),
        candidateId,
        fence: candidate.fence,
        batchId: `batch-${revision}`,
        attempt: 1,
        rows: [row(`synthetic-${revision}`, String(revision))],
      });
      await store.catalog.sealCandidate({
        access: store.access(),
        candidateId,
        fence: candidate.fence,
        expectedBatchIds: [`batch-${revision}`],
        quality,
        audit: {
          reason: "synthetic coverage",
          expectedRevision: revision,
          idempotencyKey: randomUUID(),
        },
      });
      const started = performance.now();
      const snapshot = await store.catalog.publishCandidate({
        access: store.access(),
        candidateId,
        fence: candidate.fence,
        audit: {
          reason: "synthetic publication",
          expectedRevision: revision,
          idempotencyKey: randomUUID(),
        },
      });
      publishDurations.push(performance.now() - started);
      expect(snapshot.segmentRefs).toHaveLength(1);
      head = snapshot.id;
    }
    const binding = await connection.pool.query<{ table_name: string }>(
      "SELECT table_name FROM warehouse_models WHERE model_version=$1",
      [descriptor.semanticHash],
    );
    const scope = JSON.stringify([
      store.access().scope.application,
      store.access().scope.environment,
      store.access().scope.tenant,
    ]);
    const physical = await connection.pool.query<{ rows: string; candidates: string }>(
      `SELECT count(*)::text AS rows,count(DISTINCT _candidate)::text AS candidates FROM "${binding.rows[0].table_name}" WHERE _scope=$1`,
      [scope],
    );
    expect(physical.rows[0]).toEqual({ rows: "24", candidates: "24" });
    const objects = await connection.pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM pg_tables WHERE schemaname=current_schema() AND tablename LIKE 'wh_fact_%'",
    );
    expect(Number(objects.rows[0].count)).toBe(2);
    expect(Math.max(...publishDurations)).toBeLessThan(5000);
    const staleId = randomUUID();
    const stale = await store.catalog.createCandidate({
      access: store.access(),
      id: staleId,
      transformHash: "synthetic-v1",
      sourceRefs: ["captures"],
      expectedHead: head,
      partitionSelection: null,
      audit: { reason: "stage old failure", expectedRevision: 24, idempotencyKey: randomUUID() },
    });
    await store.writer.write({
      access: store.access(),
      candidateId: staleId,
      fence: stale.fence,
      batchId: "stale",
      attempt: 1,
      rows: [row("stale", "1")],
    });
    await store.catalog.failCandidate({
      access: store.access(),
      candidateId: staleId,
      fence: stale.fence,
      audit: { reason: "source failed", expectedRevision: 24, idempotencyKey: randomUUID() },
    });
    await connection.pool.query(
      "UPDATE warehouse_candidates SET created_at='2020-01-01' WHERE id=$1",
      [staleId],
    );
    await store.catalog.expireSnapshots({
      access: store.access(),
      before: "2021-01-01T00:00:00.000Z",
      audit: { reason: "prune stale staging", expectedRevision: 24, idempotencyKey: randomUUID() },
    });
    const residue = await connection.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "${binding.rows[0].table_name}" WHERE _scope=$1 AND _candidate=$2`,
      [scope, staleId],
    );
    const receipt = await connection.pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM warehouse_receipts WHERE candidate_id=$1",
      [staleId],
    );
    const candidate = await connection.pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM warehouse_candidates WHERE id=$1",
      [staleId],
    );
    expect([residue.rows[0].count, receipt.rows[0].count, candidate.rows[0].count]).toEqual([
      "0",
      "0",
      "0",
    ]);
  }, 120_000);

  it("serializes a second connection writing against candidate sealing", async () => {
    const store = services(randomUUID());
    const candidateId = randomUUID();
    const candidate = await store.catalog.createCandidate({
      access: store.access(),
      id: candidateId,
      transformHash: "transform-v1",
      sourceRefs: ["captures"],
      expectedHead: null,
      partitionSelection: null,
      audit: {
        reason: "prepare concurrent load",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      },
    });
    await store.writer.write({
      access: store.access(),
      candidateId,
      fence: candidate.fence,
      batchId: "first",
      attempt: 1,
      rows: [row("first", "1")],
    });
    const [write, seal] = await Promise.allSettled([
      store.writer.write({
        access: store.access(),
        candidateId,
        fence: candidate.fence,
        batchId: "second",
        attempt: 1,
        rows: [row("second", "2")],
      }),
      store.catalog.sealCandidate({
        access: store.access(),
        candidateId,
        fence: candidate.fence,
        expectedBatchIds: ["first"],
        quality,
        audit: {
          reason: "seal current receipts",
          expectedRevision: 0,
          idempotencyKey: randomUUID(),
        },
      }),
    ]);
    expect(write.status === "fulfilled" && seal.status === "fulfilled").toBe(false);
    if (seal.status === "rejected") {
      expect(write.status).toBe("fulfilled");
      await store.catalog.sealCandidate({
        access: store.access(),
        candidateId,
        fence: candidate.fence,
        expectedBatchIds: ["first", "second"],
        quality,
        audit: { reason: "seal both receipts", expectedRevision: 0, idempotencyKey: randomUUID() },
      });
    } else {
      expect(write.status).toBe("rejected");
    }
    const snapshot = await store.catalog.publishCandidate({
      access: store.access(),
      candidateId,
      fence: candidate.fence,
      audit: {
        reason: "publish sealed receipts",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      },
    });
    const page = await store.reader.read({
      access: store.access(),
      snapshotId: snapshot.id,
      projection: ["captureId"],
      filters: [],
      order: [{ column: "captureId", direction: "asc" }],
      maxRows: 10,
      maxBytes: 4096,
      timeoutMs: 5000,
    });
    expect(page.rows).toEqual(
      seal.status === "fulfilled"
        ? [{ captureId: "first" }]
        : [{ captureId: "first" }, { captureId: "second" }],
    );
  }, 120_000);

  it("reconciles a committed batch after its PostgreSQL response is lost", async () => {
    const store = services(randomUUID());
    const candidateId = randomUUID();
    const candidate = await store.catalog.createCandidate({
      access: store.access(),
      id: candidateId,
      transformHash: "transform-v1",
      sourceRefs: ["captures"],
      expectedHead: null,
      partitionSelection: null,
      audit: {
        reason: "prepare fault injection",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      },
    });
    const uncertain = new PostgresWarehouseWriter(
      poolWithLostCommitResponse(),
      descriptor,
      store.resolveAccess,
    );
    const request = {
      access: store.access(),
      candidateId,
      fence: candidate.fence,
      batchId: "response-lost",
      attempt: 1,
      rows: [row("fault", "10")],
    };
    expect((await uncertain.write(request)).state).toBe("indeterminate");
    expect((await store.writer.reconcileReceipt(request))?.state).toBe("durable");
    expect((await store.writer.write(request)).state).toBe("durable");
  }, 120_000);

  it("reconciles an epoch-changing suppression after a committed response is lost", async () => {
    const store = services(randomUUID());
    const candidateId = randomUUID();
    const candidate = await store.catalog.createCandidate({
      access: store.access(),
      id: candidateId,
      transformHash: "transform-v1",
      sourceRefs: ["captures"],
      expectedHead: null,
      partitionSelection: null,
      audit: {
        reason: "load before suppression",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      },
    });
    await store.writer.write({
      access: store.access(),
      candidateId,
      fence: candidate.fence,
      batchId: "batch",
      attempt: 1,
      rows: [row("private", "1")],
    });
    await store.catalog.sealCandidate({
      access: store.access(),
      candidateId,
      fence: candidate.fence,
      expectedBatchIds: ["batch"],
      quality,
      audit: {
        reason: "verify before suppression",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      },
    });
    await store.catalog.publishCandidate({
      access: store.access(),
      candidateId,
      fence: candidate.fence,
      audit: {
        reason: "publish before suppression",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      },
    });
    const uncertain = new PostgresWarehouseCatalog(
      poolWithLostCommitResponse(),
      descriptor,
      store.resolveAccess,
    );
    const identity = encodeIdentity(descriptor, row("private", "1"), store.access().scope);
    const request = {
      access: store.access(),
      identities: [identity],
      audit: { reason: "erase subject", expectedRevision: 1, idempotencyKey: randomUUID() },
    };
    await expect(uncertain.suppress(request)).rejects.toThrow("WAREHOUSE_COMMIT_INDETERMINATE");
    const reconciled = await store.catalog.suppress(request);
    expect(reconciled.privacyEpoch).toBe(1);
    store.setPrivacyEpoch(reconciled.privacyEpoch);
    const binding = await connection.pool.query<{ table_name: string }>(
      "SELECT table_name FROM warehouse_models WHERE model_version=$1",
      [descriptor.semanticHash],
    );
    const physical = await connection.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "${binding.rows[0].table_name}" WHERE _identity=$1`,
      [identity],
    );
    expect(physical.rows[0].count).toBe("0");
  }, 120_000);
  it("upgrades prior candidate metadata without losing staged work", async () => {
    const store = services(randomUUID());
    const candidate = await store.catalog.createCandidate({
      access: store.access(),
      id: randomUUID(),
      transformHash: "upgrade-check",
      sourceRefs: ["captures"],
      expectedHead: null,
      partitionSelection: null,
      audit: { reason: "stage before upgrade", expectedRevision: 0, idempotencyKey: randomUUID() },
    });
    await connection.pool.query("ALTER TABLE warehouse_candidates DROP COLUMN created_at");
    await installPostgresWarehouseSchema(connection.pool);
    const restored = await connection.pool.query<{ id: string; created_at: Date }>(
      "SELECT id,created_at FROM warehouse_candidates WHERE id=$1",
      [candidate.id],
    );
    expect(restored.rows[0]?.id).toBe(candidate.id);
    expect(restored.rows[0]?.created_at).toBeInstanceOf(Date);
  });

  it("replays explicit runtime installers after artifact-created tables served all fact workflows", async () => {
    await installPostgresWarehouseSchema(connection.pool);
    await installPostgresWarehouseSchema(connection.pool);
    await installPostgresFactSchema(connection.pool, descriptor);
    await installPostgresFactSchema(connection.pool, descriptor);
    await installPostgresFactSchema(connection.pool, searchDescriptor);
  });
});
