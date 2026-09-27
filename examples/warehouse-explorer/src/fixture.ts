import { randomUUID } from "node:crypto";
import { postgresResource } from "@croco/testing-resources";
import { c, compileFact, defineFact, validateRow } from "@croco/warehouse-core";
import { Pool } from "pg";
import {
  installPostgresFactSchema,
  installPostgresWarehouseSchema,
  PostgresWarehouseCatalog,
  PostgresWarehouseReader,
  PostgresWarehouseWriter,
} from "@croco/warehouse-postgres/facts";
import type { WarehouseAccess, WarehouseQuality } from "@croco/warehouse-core/runtime";

const captures = defineFact("example_captures", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One confirmed capture", key: ["captureId"] },
  columns: {
    captureId: c.id(),
    amount: c.moneyMinor({ currency: "currency", min: BigInt(0) }),
    currency: c.currencyCode(),
    capturedAt: c.instant({ precision: "millisecond" }),
  },
  time: { event: "capturedAt" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});
const searches = defineFact("example_search_daily", {
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

export async function createExample() {
  const resource = postgresResource({ id: "warehouse-explorer", mode: "commit" });
  const started = await resource.start({
    register: () => undefined,
    testId: randomUUID(),
    workerId: "warehouse-explorer",
  });
  const cancellationPool = new Pool({
    connectionString: started.connection.connectionString,
    max: 1,
  });
  try {
    const pool = started.connection.pool;
    await installPostgresWarehouseSchema(pool);
    async function seed(model: typeof captures | typeof searches, rows: Record<string, unknown>[]) {
      const descriptor = await compileFact(model);
      await installPostgresFactSchema(pool, descriptor);
      let access: WarehouseAccess = {
        scope: { application: "warehouse-explorer", environment: "demo", tenant: "synthetic-shop" },
        actor: "demo-operator",
        roles: ["read", "import", "publish", "drop"],
        columns: Object.keys(descriptor.columns),
        permissionEpoch: 0,
        privacyEpoch: 0,
      };
      const catalog = new PostgresWarehouseCatalog(pool, descriptor, () => access);
      const writer = new PostgresWarehouseWriter(pool, descriptor, () => access);
      const reader = new PostgresWarehouseReader(
        pool,
        descriptor,
        () => access,
        randomUUID(),
        cancellationPool,
      );
      const audit = (reason: string) => ({
        reason,
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      });
      const id = randomUUID();
      const candidate = await catalog.createCandidate({
        access,
        id,
        transformHash: "example-v1",
        sourceRefs: ["synthetic"],
        expectedHead: null,
        partitionSelection:
          descriptor.kind === "aggregate"
            ? { from: "2026-09-27", through: "2026-09-27", series: { indexId: "products" } }
            : null,
        audit: audit("Import synthetic facts"),
      });
      await writer.write({
        access,
        candidateId: id,
        fence: candidate.fence,
        batchId: "seed",
        attempt: 1,
        rows: rows.map((row) => validateRow(descriptor, row)),
      });
      const quality: WarehouseQuality = {
        freshness: {
          observedAt: "2026-09-27T12:00:00.000Z",
          newestEventAt: "2026-09-27T10:00:00.000Z",
        },
        temporalCompleteness: "complete",
        populationCoverage: "complete",
        validity: "valid",
        reproducibility: "reproducible",
        sourceCoverage: [
          {
            sourceRef: "synthetic",
            from: "2026-09-27",
            through: "2026-09-27",
            state: "complete",
            gaps: [],
            late: false,
          },
        ],
      };
      await catalog.sealCandidate({
        access,
        candidateId: id,
        fence: candidate.fence,
        expectedBatchIds: ["seed"],
        quality,
        audit: audit("Verify seed coverage"),
      });
      await catalog.publishCandidate({
        access,
        candidateId: id,
        fence: candidate.fence,
        audit: audit("Publish verified seed"),
      });
      const failedId = randomUUID();
      const failed = await catalog.createCandidate({
        access,
        id: failedId,
        transformHash: "example-v1",
        sourceRefs: ["synthetic"],
        expectedHead: (await catalog.pinSnapshot({ access })).id,
        partitionSelection:
          descriptor.kind === "aggregate"
            ? { from: "2026-09-27", through: "2026-09-27", series: { indexId: "products" } }
            : null,
        audit: { ...audit("Stage failed import fixture"), expectedRevision: 1 },
      });
      await catalog.failCandidate({
        access,
        candidateId: failedId,
        fence: failed.fence,
        audit: { ...audit("Synthetic source import failed"), expectedRevision: 1 },
      });
      const replacementId = randomUUID();
      const replacement = await catalog.createCandidate({
        access,
        id: replacementId,
        transformHash: "example-v1",
        sourceRefs: ["synthetic"],
        expectedHead: (await catalog.pinSnapshot({ access })).id,
        partitionSelection:
          descriptor.kind === "aggregate"
            ? { from: "2026-09-27", through: "2026-09-27", series: { indexId: "products" } }
            : null,
        audit: { ...audit("Stage replacement"), expectedRevision: 1 },
      });
      await writer.write({
        access,
        candidateId: replacementId,
        fence: replacement.fence,
        batchId: "replacement",
        attempt: 1,
        rows: rows.map((row) => validateRow(descriptor, row)),
      });
      await catalog.sealCandidate({
        access,
        candidateId: replacementId,
        fence: replacement.fence,
        expectedBatchIds: ["replacement"],
        quality,
        audit: { ...audit("Verify replacement"), expectedRevision: 1 },
      });
      return {
        get access() {
          return access;
        },
        setPrivacyEpoch(privacyEpoch: number) {
          access = { ...access, privacyEpoch };
        },
        catalog,
        reader,
        descriptor,
      };
    }
    const capture = await seed(captures, [
      {
        captureId: "capture-1",
        amount: "9223372036854775807",
        currency: "USD",
        capturedAt: "2026-09-27T10:00:00.000Z",
      },
      {
        captureId: "capture-2",
        amount: "2500",
        currency: "USD",
        capturedAt: "2026-09-27T10:00:00.000Z",
      },
    ]);
    const search = await seed(searches, [
      { day: "2026-09-27", indexId: "products", queryId: "coats", searches: "42", rate: "12.30" },
    ]);
    async function state(name: "captures" | "search") {
      const service = name === "captures" ? capture : search;
      const dataset = await service.catalog.describeDataset({ access: service.access });
      const sample = dataset.head
        ? await service.reader.read({
            access: service.access,
            snapshotId: dataset.head.id,
            projection: Object.keys(service.descriptor.columns),
            filters: [],
            order: service.descriptor.grain.key.map((column) => ({
              column,
              direction: "asc" as const,
            })),
            maxRows: 10,
            maxBytes: 16384,
            timeoutMs: 5000,
          })
        : null;
      return { kind: "ready" as const, dataset, sample, sampleLimit: 10 };
    }
    return {
      state,
      capture,
      search,
      dispose: async () => {
        await cancellationPool.end();
        await started.dispose();
      },
    };
  } catch (error) {
    await cancellationPool.end();
    await started.dispose();
    throw error;
  }
}
