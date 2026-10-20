import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { postgresResource } from "@croco/testing-resources";
import { c, compileFact, defineFact, validateRow } from "@croco/warehouse-core";
import { PageExperienceCollection } from "@croco/analytics-core";
import type { PageExperienceRow } from "@croco/metrics-core";
import { calculatePageExperience } from "@croco/metrics-core";
import { PAGE_EXPERIENCE_FIELDS, readPageExperienceWarehouse } from "@croco/metrics-core/runtime";
import type { WarehouseAccess, WarehouseQuality } from "@croco/warehouse-core/runtime";
import {
  installPostgresFactSchema,
  installPostgresWarehouseSchema,
  PostgresWarehouseCatalog,
  PostgresWarehouseReader,
  PostgresWarehouseWriter,
} from "../facts";
import { fixture } from "../../../../examples/page-experience/src/fixture";

describe.skipIf(process.env.CROCO_TEST_REAL_RESOURCES !== "1")(
  "Page experience through PostgreSQL snapshot",
  () => {
    it("matches standalone results through bounded native reads and rejects changed privacy and tenant", async () => {
      const resource = await postgresResource({ id: "page-experience", mode: "commit" }).start({
        register: () => undefined,
        testId: "page-experience",
        workerId: "page-experience",
      });
      const pool = resource.connection.pool;
      const cancellationPool = new Pool({
        connectionString: resource.connection.connectionString,
        max: 1,
      });
      try {
        await pool.query(
          "CREATE TABLE domain_receipts (id text PRIMARY KEY, tenant text NOT NULL, subject text NOT NULL, session text NOT NULL)",
        );
        const context = {
          scope: fixture.scope,
          subject: "one",
          session: "one",
          origin: "https://shop.test",
          consent: true,
          collectionAllowed: true,
        };
        const confirmed: PageExperienceRow[] = [];
        let sourceFailed = false;
        let receivedAt = new Date("2026-01-01T00:00:05.000Z");
        const bridge = new PageExperienceCollection({
          definition: fixture.definition,
          allowedOrigins: ["https://shop.test"],
          clock: () => receivedAt,
          authorize: async (current) =>
            current.scope.app === "shop" &&
            current.scope.environment === "test" &&
            current.scope.tenant === "tenant" &&
            current.subject === "one" &&
            current.session === "one",
          append: async (row) => {
            if (sourceFailed) throw new Error("synthetic observation source failure");
            const prior = confirmed.find(
              (value) => value.source === row.source && value.id === row.id,
            );
            if (!prior) confirmed.push(row);
            else if (
              Object.entries(row).some(
                ([key, value]) =>
                  key !== "receivedAt" && prior[key as keyof PageExperienceRow] !== value,
              )
            )
              throw new Error("conflicting receipt identity");
          },
          verifyReceipt: async (ref, current) => {
            const result = await pool.query(
              "SELECT id FROM domain_receipts WHERE id=$1 AND tenant=$2 AND subject=$3 AND session=$4",
              [ref, current.scope.tenant, current.subject, current.session],
            );
            return result.rows.length
              ? {
                  id: ref,
                  source: "billing",
                  occurredAt: "2026-01-01T00:00:05.000Z",
                  action: "purchase",
                  pageInstance: "p-one",
                  page: "product",
                }
              : null;
          },
        });
        const domain = await pool.connect();
        try {
          await domain.query("BEGIN");
          await domain.query(
            "INSERT INTO domain_receipts VALUES ('rolled-back','tenant','one','one')",
          );
          await domain.query("ROLLBACK");
          expect(await bridge.committed("rolled-back", context)).toBe("unavailable");
          expect(confirmed).toEqual([]);
          await domain.query("BEGIN");
          await domain.query(
            "INSERT INTO domain_receipts VALUES ('one-committed','tenant','one','one')",
          );
          await domain.query("COMMIT");
        } finally {
          domain.release();
        }
        expect(await bridge.committed("one-committed", context)).toBe("recorded");
        receivedAt = new Date("2026-01-01T00:00:06.000Z");
        expect(await bridge.committed("one-committed", context)).toBe("recorded");
        expect(confirmed[0]?.receivedAt).toBe("2026-01-01T00:00:05.000Z");
        expect(confirmed).toHaveLength(1);
        expect(
          await bridge.committed("one-committed", {
            ...context,
            scope: { ...fixture.scope, tenant: "other" },
          }),
        ).toBe("unavailable");
        sourceFailed = true;
        expect(await bridge.committed("one-committed", context)).toBe("unavailable");
        expect(
          (
            await pool.query(
              "SELECT count(*)::int AS count FROM domain_receipts WHERE id='one-committed'",
            )
          ).rows[0].count,
        ).toBe(1);
        const factRows = [...fixture.rows.filter((row) => row.kind !== "committed"), ...confirmed];
        const descriptor = await compileFact(
          defineFact("page_experience", {
            version: 1,
            kind: "transaction",
            scope: "tenant",
            grain: { description: "One source event", key: ["source", "id"] },
            columns: Object.fromEntries(
              PAGE_EXPERIENCE_FIELDS.map((name) => [
                name,
                name === "occurredAt" || name === "receivedAt"
                  ? c.instant({ precision: "millisecond" })
                  : c.string(),
              ]),
            ),
            time: { event: "occurredAt" },
            write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
          }),
        );
        await installPostgresWarehouseSchema(pool);
        await installPostgresFactSchema(pool, descriptor);
        let access: WarehouseAccess = {
          scope: { application: "shop", environment: "test", tenant: "tenant" },
          actor: "operator",
          roles: ["read", "import", "publish", "drop"],
          columns: PAGE_EXPERIENCE_FIELDS,
          permissionEpoch: 0,
          privacyEpoch: 0,
        };
        const catalog = new PostgresWarehouseCatalog(pool, descriptor, () => access);
        const writer = new PostgresWarehouseWriter(pool, descriptor, () => access);
        const reader = new PostgresWarehouseReader(
          pool,
          descriptor,
          () => access,
          "page-experience-cursor-secret-32bytes",
          cancellationPool,
        );
        const candidate = await catalog.createCandidate({
          access,
          id: randomUUID(),
          transformHash: "page-v1",
          sourceRefs: ["browser", "billing"],
          expectedHead: null,
          partitionSelection: null,
          audit: { reason: "synthetic test", expectedRevision: 0, idempotencyKey: randomUUID() },
        });
        await writer.write({
          access,
          candidateId: candidate.id,
          fence: candidate.fence,
          batchId: "events",
          attempt: 1,
          rows: factRows.map((row) => validateRow(descriptor, row)),
        });
        const quality: WarehouseQuality = {
          freshness: { observedAt: fixture.cutoff, newestEventAt: fixture.cutoff },
          temporalCompleteness: "complete",
          populationCoverage: "complete",
          validity: "valid",
          reproducibility: "reproducible",
          sourceCoverage: ["browser", "billing"].map((sourceRef) => ({
            sourceRef,
            from: fixture.window.from,
            through: fixture.cutoff,
            state: "complete",
            gaps: [],
            late: false,
          })),
        };
        await catalog.sealCandidate({
          access,
          candidateId: candidate.id,
          fence: candidate.fence,
          expectedBatchIds: ["events"],
          quality,
          audit: {
            reason: "known fixture coverage",
            expectedRevision: 0,
            idempotencyKey: randomUUID(),
          },
        });
        const snapshot = await catalog.publishCandidate({
          access,
          candidateId: candidate.id,
          fence: candidate.fence,
          audit: {
            reason: "known fixture publication",
            expectedRevision: 0,
            idempotencyKey: randomUUID(),
          },
        });
        const request = {
          access,
          snapshotId: snapshot.id,
          projection: PAGE_EXPERIENCE_FIELDS,
          filters: [],
          order: [
            { column: "source", direction: "asc" as const },
            { column: "id", direction: "asc" as const },
          ],
          maxRows: 2,
          maxBytes: 10000,
          timeoutMs: 30000,
        };
        const rows = await readPageExperienceWarehouse(reader, request, {
          maxRows: 100,
          maxBytes: 100000,
          maxPages: 20,
        });
        const nativeInput = {
          ...fixture,
          snapshotRef: snapshot.id,
          sourceRevision: String(snapshot.revision),
        };
        const expected = await calculatePageExperience({
          ...nativeInput,
          rows: [...fixture.rows].sort(
            (a, b) => a.source.localeCompare(b.source) || a.id.localeCompare(b.id),
          ),
        });
        expect(await calculatePageExperience({ ...nativeInput, rows })).toEqual(expected);
        await expect(
          readPageExperienceWarehouse(
            reader,
            { ...request, access: { ...access, scope: { ...access.scope, tenant: "other" } } },
            { maxRows: 100, maxBytes: 100000, maxPages: 20 },
          ),
        ).rejects.toThrow();
        access = { ...access, privacyEpoch: 1 };
        await expect(
          readPageExperienceWarehouse(reader, request, {
            maxRows: 100,
            maxBytes: 100000,
            maxPages: 20,
          }),
        ).rejects.toThrow();
      } finally {
        await cancellationPool.end();
        await resource.dispose?.();
      }
    }, 180000);
  },
);
