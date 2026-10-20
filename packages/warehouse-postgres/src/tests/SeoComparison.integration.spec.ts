import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { postgresResource } from "@croco/testing-resources";
import { c, compileFact, defineFact, validateRow } from "@croco/warehouse-core";
import { compareSeo } from "@croco/metrics-core";
import { collectSeoSource, readSeoWarehouse } from "@croco/metrics-core/runtime";
import type { WarehouseAccess, WarehouseQuality } from "@croco/warehouse-core/runtime";
import {
  installPostgresFactSchema,
  installPostgresWarehouseSchema,
  PostgresWarehouseCatalog,
  PostgresWarehouseReader,
  PostgresWarehouseWriter,
} from "../facts";
import { seoFixtureInput } from "../../../../examples/seo-workbench/src/input";

const enabled = process.env.CROCO_TEST_REAL_RESOURCES === "1";
describe.skipIf(!enabled)("SEO comparison through real PostgreSQL facts", () => {
  it("preserves normalized values and quality through real bounded pages and rejects privacy revocation", async () => {
    console.info("seo-native: starting isolated resource");
    const started = await postgresResource({ id: "seo-comparison", mode: "commit" }).start({
      register: () => undefined,
      testId: randomUUID(),
      workerId: "seo-comparison",
    });
    console.info("seo-native: isolated resource ready");
    const pool = started.connection.pool;
    const cancellationPool = new Pool({
      connectionString: started.connection.connectionString,
      max: 1,
    });
    try {
      const descriptor = await compileFact(
        defineFact("seo_search", {
          version: 1,
          kind: "transaction",
          scope: "tenant",
          grain: {
            description: "One page-device aggregate per source window",
            key: ["page", "device"],
          },
          columns: {
            page: c.string(),
            device: c.string(),
            at: c.instant({ precision: "millisecond" }),
            impressions: c.int64({ min: BigInt(0) }),
            clicks: c.int64({ min: BigInt(0) }),
            position: c.nullable(c.decimal({ precision: 8, scale: 2 })),
          },
          time: { event: "at" },
          write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
        }),
      );
      await installPostgresWarehouseSchema(pool);
      await installPostgresFactSchema(pool, descriptor);
      console.info("seo-native: schema ready");
      let access: WarehouseAccess = {
        scope: { application: "synthetic-seo", environment: "test", tenant: "tenant-a" },
        actor: "operator",
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
      const input = seoFixtureInput();
      const candidate = await catalog.createCandidate({
        access,
        id: randomUUID(),
        transformHash: "seo-normalized-v1",
        sourceRefs: ["search"],
        expectedHead: null,
        partitionSelection: null,
        audit: audit("Import synthetic search rows"),
      });
      await writer.write({
        access,
        candidateId: candidate.id,
        fence: candidate.fence,
        batchId: "search",
        attempt: 1,
        rows: input.current.search.rows.map((row) =>
          validateRow(descriptor, {
            ...row,
            at: "2026-10-02T07:00:00.000Z",
            impressions: String(row.impressions),
            clicks: String(row.clicks),
            position: String(row.position),
          }),
        ),
      });
      console.info("seo-native: source written");
      const quality: WarehouseQuality = {
        freshness: {
          observedAt: "2026-10-03T07:00:00.000Z",
          newestEventAt: "2026-10-02T07:00:00.000Z",
        },
        temporalCompleteness: "complete",
        populationCoverage: "complete",
        validity: "valid",
        reproducibility: "reproducible",
        sourceCoverage: [
          {
            sourceRef: "search",
            from: "2026-10-02T07:00:00.000Z",
            through: "2026-10-03T07:00:00.000Z",
            state: "complete",
            gaps: [],
            late: false,
          },
        ],
      };
      await catalog.sealCandidate({
        access,
        candidateId: candidate.id,
        fence: candidate.fence,
        expectedBatchIds: ["search"],
        quality,
        audit: audit("Verify synthetic source"),
      });
      const snapshot = await catalog.publishCandidate({
        access,
        candidateId: candidate.id,
        fence: candidate.fence,
        audit: audit("Publish synthetic source"),
      });
      console.info("seo-native: snapshot published");
      input.current.search.metadata.sourceRevision = snapshot.id;
      const expected = await compareSeo(input);
      const request = {
        access,
        snapshotId: snapshot.id,
        projection: Object.keys(descriptor.columns),
        filters: [],
        order: [
          { column: "page", direction: "asc" as const },
          { column: "device", direction: "asc" as const },
        ],
        maxRows: 1,
        maxBytes: 8192,
        timeoutMs: 5000,
      };
      const limits = { maxRows: 10, maxBytes: 32768, maxPages: 5 };
      input.current.search.rows = await collectSeoSource(
        readSeoWarehouse(reader, request, limits),
        "search",
        {},
        10,
      );
      // Ordering is irrelevant to numeric/quality results; the input hash intentionally identifies the exact snapshot order.
      const actual = await compareSeo(input);
      console.info("seo-native: bounded read complete");
      expect(actual.rows).toEqual(expected.rows);
      expect(actual.state).toBe(expected.state);
      expect(actual.diagnostics).toEqual(expected.diagnostics);
      expect(actual.sources).toEqual(expected.sources);
      await expect(
        collectSeoSource(
          readSeoWarehouse(reader, request, { ...limits, maxPages: 1 }),
          "search",
          {},
          10,
        ),
      ).rejects.toThrow();
      access = { ...access, privacyEpoch: 1 };
      await expect(
        collectSeoSource(readSeoWarehouse(reader, request, limits), "search", {}, 10),
      ).rejects.toThrow();
    } finally {
      console.info("seo-native: disposing isolated resource");
      await cancellationPool.end();
      await started.dispose?.();
    }
  }, 180000);
});
