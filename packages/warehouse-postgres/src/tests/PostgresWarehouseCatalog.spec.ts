import { beforeEach, describe, expect, it, vi } from "vitest";
import { c, compileFact, defineFact } from "@croco/warehouse-core";
import type { FactDescriptor } from "@croco/warehouse-core";
import type {
  WarehouseAccess,
  WarehouseCandidate,
  WarehouseQuality,
} from "@croco/warehouse-core/runtime";
import { PostgresWarehouseCatalog } from "../facts/PostgresWarehouseCatalog";
import type { WarehousePostgresPool } from "../facts/client";

const access: WarehouseAccess = {
  scope: { application: "test", environment: "test", tenant: "one" },
  actor: "operator",
  roles: ["import", "publish", "read", "drop"],
  columns: ["id", "at"],
  permissionEpoch: 0,
  privacyEpoch: 0,
};
const audit = { reason: "verified source", expectedRevision: 0, idempotencyKey: "key" };
const quality: WarehouseQuality = {
  freshness: { observedAt: "2026-01-01T00:00:00Z", newestEventAt: null },
  temporalCompleteness: "complete",
  populationCoverage: "complete",
  validity: "valid",
  reproducibility: "reproducible",
  sourceCoverage: [
    {
      sourceRef: "source",
      from: "2026-01-01",
      through: "2026-01-02",
      state: "complete",
      gaps: [],
      late: false,
    },
  ],
};
let descriptor: FactDescriptor;
let candidate: WarehouseCandidate;
let receipts: { batch_id: string; receipt: { state: string } }[];
let head: {
  snapshot_id: string | null;
  revision: number;
  permission_epoch: number;
  privacy_epoch: number;
};
let query: ReturnType<
  typeof vi.fn<(sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>>
>;
let release: ReturnType<typeof vi.fn>;
let catalog: PostgresWarehouseCatalog;

beforeEach(async () => {
  descriptor = await compileFact(
    defineFact("catalog_test", {
      version: 1,
      kind: "transaction",
      scope: "tenant",
      grain: { description: "event", key: ["id"] },
      columns: { id: c.id(), at: c.instant({ precision: "millisecond" }) },
      time: { event: "at" },
      write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
    }),
  );
  candidate = {
    id: "candidate",
    scope: access.scope,
    modelVersion: descriptor.semanticHash,
    transformHash: "transform",
    sourceRefs: ["source"],
    expectedHead: null,
    fence: 1,
    state: "open",
    quality: null,
    partitionSelection: null,
    permissionEpoch: 0,
    privacyEpoch: 0,
  };
  receipts = [{ batch_id: "batch", receipt: { state: "durable" } }];
  head = { snapshot_id: null, revision: 0, permission_epoch: 0, privacy_epoch: 0 };
  query = vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT * FROM warehouse_heads")) return { rows: [head] };
    if (sql.startsWith("SELECT data FROM warehouse_candidates"))
      return { rows: [{ data: candidate }] };
    if (sql.startsWith("SELECT batch_id")) return { rows: receipts };
    return { rows: [] };
  });
  release = vi.fn();
  const pool = { query, connect: async () => ({ query, release }) } as WarehousePostgresPool;
  catalog = new PostgresWarehouseCatalog(pool, descriptor, () => access);
});

describe("PostgresWarehouseCatalog", () => {
  it("requires all expected durable receipts before sealing", async () => {
    receipts = [];
    await expect(
      catalog.sealCandidate({
        access,
        candidateId: candidate.id,
        fence: 1,
        expectedBatchIds: ["batch"],
        quality,
        audit,
      }),
    ).rejects.toThrow("WAREHOUSE_RECEIPTS_INCOMPLETE");
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalled();
  });
  it("rejects incomplete coverage despite a durable receipt", async () => {
    await expect(
      catalog.sealCandidate({
        access,
        candidateId: candidate.id,
        fence: 1,
        expectedBatchIds: ["batch"],
        quality: {
          ...quality,
          sourceCoverage: [{ ...quality.sourceCoverage[0], state: "partial" }],
        },
        audit,
      }),
    ).rejects.toThrow("WAREHOUSE_COVERAGE_INCOMPLETE");
  });
  it("seals complete validated coverage and durable receipts", async () => {
    const result = await catalog.sealCandidate({
      access,
      candidateId: candidate.id,
      fence: 1,
      expectedBatchIds: ["batch"],
      quality,
      audit,
    });
    expect(result.state).toBe("sealed");
    expect(query).toHaveBeenCalledWith("COMMIT");
  });
  it("rejects publication against a changed head before physical visibility changes", async () => {
    candidate = { ...candidate, state: "sealed", quality };
    head.snapshot_id = "competitor";
    await expect(
      catalog.publishCandidate({ access, candidateId: candidate.id, fence: 1, audit }),
    ).rejects.toThrow("WAREHOUSE_HEAD_CONFLICT");
    expect(query.mock.calls.some(([sql]) => sql.includes("SET _visible_from"))).toBe(false);
  });
  it("physically deletes suppressed identities and advances the privacy epoch", async () => {
    expect(await catalog.suppress({ access, identities: ["identity"], audit })).toEqual({
      privacyEpoch: 1,
    });
    expect(
      query.mock.calls.some(
        ([sql, params]) =>
          sql.startsWith('DELETE FROM "wh_fact_') &&
          Array.isArray(params?.[1]) &&
          params[1][0] === "identity",
      ),
    ).toBe(true);
  });
  it("authorizes from the server resolver instead of caller roles", async () => {
    catalog = new PostgresWarehouseCatalog(
      { query, connect: async () => ({ query, release }) } as WarehousePostgresPool,
      descriptor,
      () => ({ ...access, roles: [] }),
    );
    await expect(catalog.suppress({ access, identities: ["identity"], audit })).rejects.toThrow(
      "WAREHOUSE_ACCESS_DENIED",
    );
    expect(query).not.toHaveBeenCalled();
  });
  it("rejects stale privacy epochs", async () => {
    head.privacy_epoch = 1;
    await expect(catalog.pinSnapshot({ access, snapshotId: "old" })).rejects.toThrow(
      "WAREHOUSE_EPOCH_CHANGED",
    );
  });
  it("destroys a connection when commit outcome is indeterminate", async () => {
    const original = query.getMockImplementation();
    query.mockImplementation(async (sql: string) => {
      if (sql === "COMMIT") throw new Error("connection lost");
      if (!original) throw new Error("Missing query mock");
      return original(sql);
    });
    await expect(
      catalog.sealCandidate({
        access,
        candidateId: candidate.id,
        fence: 1,
        expectedBatchIds: ["batch"],
        quality,
        audit,
      }),
    ).rejects.toThrow("WAREHOUSE_COMMIT_INDETERMINATE");
    expect(release).toHaveBeenCalledWith(true);
    expect(query).not.toHaveBeenCalledWith("ROLLBACK");
  });
  it("rejects conflicting live append payloads before staged row deletion", async () => {
    candidate = { ...candidate, state: "sealed", quality };
    const original = query.getMockImplementation();
    query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT staged._identity")) return { rows: [{ _identity: "conflict" }] };
      if (!original) throw new Error("Missing query mock");
      return original(sql);
    });
    await expect(
      catalog.publishCandidate({ access, candidateId: candidate.id, fence: 1, audit }),
    ).rejects.toThrow("WAREHOUSE_FACT_CONFLICT");
    expect(query.mock.calls.some(([sql]) => sql.startsWith("DELETE FROM"))).toBe(false);
  });
  it("prunes closed versions only against surviving snapshot revisions", async () => {
    await catalog.expireSnapshots({ access, before: "2020-01-01T00:00:00Z", audit });
    expect(
      query.mock.calls.some(
        ([sql]) =>
          sql.includes("_visible_to <= COALESCE((SELECT MIN") && sql.includes("expires_at>now()"),
      ),
    ).toBe(true);
  });
});
