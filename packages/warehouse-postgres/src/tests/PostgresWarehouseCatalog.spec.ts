import { beforeEach, describe, expect, it, vi } from "vitest";
import { c, compileFact, defineFact } from "@croco/warehouse-core";
import {
  appendWarehouseReceiptManifest,
  createWarehouseReceiptManifest,
} from "@croco/warehouse-core/runtime";
import { PostgresWarehouseCatalog } from "../facts/PostgresWarehouseCatalog";
import type { FactDescriptor } from "@croco/warehouse-core";
import type {
  WarehouseAccess,
  WarehouseCandidate,
  WarehouseQuality,
  WarehouseSnapshot,
  WriteReceipt,
} from "@croco/warehouse-core/runtime";
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
  async function manifestFixture(count = 2) {
    let manifest = createWarehouseReceiptManifest("a".repeat(64));
    const rows: {
      batch_id: string;
      attempt: number;
      payload_hash: string;
      receipt: WriteReceipt;
    }[] = [];
    for (let i = 0; i < count; i++) {
      const batchId = `batch-${i}`;
      const payloadHash = "b".repeat(64);
      const next = await appendWarehouseReceiptManifest(manifest, {
        batchId,
        payloadHash,
        sourceId: "source",
        from: i + 1,
        through: i + 1,
        rejected: 0,
        filtered: 0,
        rejections: [],
      });
      manifest = next.manifest;
      rows.push({
        batch_id: batchId,
        attempt: 1,
        payload_hash: payloadHash,
        receipt: {
          batchId,
          attempt: 1,
          state: "durable",
          providerRef: JSON.stringify([candidate.id, batchId]),
          inserted: 1,
          identical: 0,
          evidence: next.evidence,
        },
      });
    }
    let offset = 0;
    const original = query.getMockImplementation();
    query.mockImplementation(async (sql) => {
      if (sql.startsWith("FETCH FORWARD")) {
        const page = rows.slice(offset, offset + 16);
        offset += page.length;
        return { rows: page };
      }
      if (!original) throw new Error("Missing query mock");
      return original(sql);
    });
    return {
      rows,
      request: {
        access,
        candidateId: candidate.id,
        fence: 1,
        expectedManifest: manifest,
        attempt: 2,
        quality,
        audit,
      },
    };
  }

  it("verifies multiple bounded receipt pages without materializing an ID inventory", async () => {
    const f = await manifestFixture(35);
    expect((await catalog.sealCandidate(f.request)).state).toBe("sealed");
    expect(query.mock.calls.filter(([sql]) => sql.startsWith("FETCH FORWARD 16"))).toHaveLength(4);
    expect(query).toHaveBeenCalledWith("SET LOCAL work_mem = '1MB'");
    expect(query).toHaveBeenCalledWith("CLOSE warehouse_receipt_manifest");
    expect(query.mock.calls.some(([sql]) => sql.startsWith("SELECT batch_id,receipt"))).toBe(false);
  });

  it.each([
    "missing",
    "extra",
    "duplicate-sequence",
    "payload",
    "binding",
    "future-attempt",
    "other-candidate",
    "state",
    "root",
    "rejected",
  ] as const)("refuses to seal %s receipt evidence", async (corruption) => {
    const f = await manifestFixture();
    const first = f.rows[0];
    const evidence = first.receipt.evidence;
    if (!evidence) throw new Error("Missing evidence");
    if (corruption === "missing") f.rows.pop();
    if (corruption === "extra") f.rows.push({ ...first, batch_id: "extra" });
    if (corruption === "duplicate-sequence") f.rows[1] = first;
    if (corruption === "payload") first.payload_hash = "d".repeat(64);
    if (corruption === "binding")
      first.receipt = { ...first.receipt, evidence: { ...evidence, bindingHash: "d".repeat(64) } };
    if (corruption === "future-attempt") {
      first.attempt = 3;
      first.receipt = { ...first.receipt, attempt: 3 };
    }
    if (corruption === "other-candidate")
      first.receipt = {
        ...first.receipt,
        providerRef: JSON.stringify(["foreign", first.batch_id]),
      };
    if (corruption === "state") first.receipt = { ...first.receipt, state: "indeterminate" };
    if (corruption === "root")
      f.request.expectedManifest = { ...f.request.expectedManifest, hash: "d".repeat(64) };
    if (corruption === "rejected")
      first.receipt = { ...first.receipt, evidence: { ...evidence, rejected: 1 } };
    await expect(catalog.sealCandidate(f.request)).rejects.toThrow("WAREHOUSE_RECEIPTS_INCOMPLETE");
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(query.mock.calls.some(([sql]) => sql.startsWith("UPDATE warehouse_candidates"))).toBe(
      false,
    );
  });

  it("rejects ambiguous legacy and manifest inventories", async () => {
    const f = await manifestFixture();
    await expect(
      catalog.sealCandidate({ ...f.request, expectedBatchIds: [] } as never),
    ).rejects.toThrow("WAREHOUSE_RECEIPTS_INCOMPLETE");
    expect(query).not.toHaveBeenCalled();
  });

  it("seals an empty root only when no durable receipts exist", async () => {
    const f = await manifestFixture(0);
    expect((await catalog.sealCandidate(f.request)).state).toBe("sealed");
  });

  it("pages diagnostic receipts under current read authority without catalog mutations", async () => {
    const original = query.getMockImplementation();
    query.mockImplementation(async (sql) => {
      if (sql.startsWith("SELECT receipt FROM warehouse_receipts"))
        return { rows: [{ receipt: { batchId: "next" } }] };
      if (!original) throw new Error("Missing query mock");
      return original(sql);
    });
    expect(
      await catalog.readReceipts({
        access,
        candidateId: candidate.id,
        afterBatchId: "last",
        limit: 16,
      }),
    ).toEqual([{ batchId: "next" }]);
    expect(query).toHaveBeenCalledWith(
      "SELECT receipt FROM warehouse_receipts WHERE candidate_id=$1 AND ($2::text IS NULL OR batch_id>$2) ORDER BY batch_id LIMIT $3",
      [candidate.id, "last", 16],
    );
    expect(query.mock.calls.some(([sql]) => /INSERT|UPDATE|DELETE|FOR UPDATE/.test(sql))).toBe(
      false,
    );
    await expect(
      catalog.readReceipts({ access, candidateId: candidate.id, limit: 17 }),
    ).rejects.toThrow("WAREHOUSE_RECEIPTS_INCOMPLETE");
    catalog = new PostgresWarehouseCatalog(
      { query, connect: async () => ({ query, release }) } as WarehousePostgresPool,
      descriptor,
      () => ({ ...access, roles: ["import"] }),
    );
    await expect(
      catalog.readReceipts({ access, candidateId: candidate.id, limit: 16 }),
    ).rejects.toThrow("WAREHOUSE_ACCESS_DENIED");
  });

  it.each(["describeDataset", "pinSnapshot", "getCandidate"] as const)(
    "%s does not write or lock catalog rows",
    async (operation) => {
      if (operation === "describeDataset") await catalog.describeDataset({ access });
      if (operation === "pinSnapshot")
        await expect(catalog.pinSnapshot({ access })).rejects.toThrow(
          "WAREHOUSE_SNAPSHOT_UNAVAILABLE",
        );
      if (operation === "getCandidate")
        expect(await catalog.getCandidate({ access, candidateId: candidate.id })).toEqual(
          candidate,
        );
      expect(query.mock.calls.some(([sql]) => /INSERT|UPDATE|DELETE|FOR UPDATE/.test(sql))).toBe(
        false,
      );
    },
  );
  it("describes an absent head without creating it", async () => {
    const original = query.getMockImplementation();
    query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT * FROM warehouse_heads")) return { rows: [] };
      if (!original) throw new Error("Missing query mock");
      return original(sql);
    });
    expect(await catalog.describeDataset({ access })).toMatchObject({
      headId: null,
      headStatus: "empty",
      revision: 0,
      permissionEpoch: 0,
      privacyEpoch: 0,
    });
    await expect(catalog.pinSnapshot({ access })).rejects.toThrow("WAREHOUSE_SNAPSHOT_UNAVAILABLE");
    expect(query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
  });
  it.each(["describeDataset", "pinSnapshot", "getCandidate"] as const)(
    "%s rejects an epoch change during its metadata query",
    async (operation) => {
      head.snapshot_id = "snapshot";
      const snapshot: WarehouseSnapshot = {
        id: "snapshot",
        revision: 1,
        modelVersion: descriptor.semanticHash,
        segmentRefs: ["table"],
        partitionSelection: [],
        quality,
        createdAt: "2026-01-01T00:00:00Z",
        permissionEpoch: 0,
        privacyEpoch: 0,
      };
      const original = query.getMockImplementation();
      query.mockImplementation(async (sql: string) => {
        if (sql.startsWith("SELECT data FROM warehouse_snapshots")) {
          head.privacy_epoch = 1;
          return { rows: [{ data: snapshot }] };
        }
        if (sql.startsWith("SELECT data FROM warehouse_candidates")) head.privacy_epoch = 1;
        if (!original) throw new Error("Missing query mock");
        return original(sql);
      });
      const result =
        operation === "getCandidate"
          ? catalog.getCandidate({ access, candidateId: candidate.id })
          : operation === "pinSnapshot"
            ? catalog.pinSnapshot({ access })
            : catalog.describeDataset({ access });
      await expect(result).rejects.toThrow("WAREHOUSE_EPOCH_CHANGED");
    },
  );
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
    await expect(catalog.describeDataset({ access })).rejects.toThrow("WAREHOUSE_ACCESS_DENIED");
    await expect(catalog.pinSnapshot({ access })).rejects.toThrow("WAREHOUSE_ACCESS_DENIED");
    await expect(catalog.getCandidate({ access, candidateId: candidate.id })).rejects.toThrow(
      "WAREHOUSE_ACCESS_DENIED",
    );
    expect(query).not.toHaveBeenCalled();
  });
  it("rejects stale privacy epochs", async () => {
    head.privacy_epoch = 1;
    await expect(catalog.describeDataset({ access })).rejects.toThrow("WAREHOUSE_EPOCH_CHANGED");
    await expect(catalog.pinSnapshot({ access, snapshotId: "old" })).rejects.toThrow(
      "WAREHOUSE_EPOCH_CHANGED",
    );
    await expect(catalog.getCandidate({ access, candidateId: candidate.id })).rejects.toThrow(
      "WAREHOUSE_EPOCH_CHANGED",
    );
  });
  it.each(["privacy", "permission"] as const)(
    "describes a %s-stale head without permitting snapshot pinning",
    async (epoch) => {
      const current = { ...access, [epoch === "privacy" ? "privacyEpoch" : "permissionEpoch"]: 5 };
      head = {
        snapshot_id: "old-head",
        revision: 9,
        permission_epoch: current.permissionEpoch,
        privacy_epoch: current.privacyEpoch,
      };
      const snapshot: WarehouseSnapshot = {
        id: "old-head",
        revision: 8,
        modelVersion: descriptor.semanticHash,
        segmentRefs: ["table"],
        partitionSelection: [],
        quality,
        createdAt: "2026-01-01T00:00:00Z",
        permissionEpoch: 0,
        privacyEpoch: 0,
      };
      const original = query.getMockImplementation();
      query.mockImplementation(async (sql: string) => {
        if (sql.startsWith("SELECT data FROM warehouse_snapshots"))
          return { rows: [{ data: snapshot }] };
        if (!original) throw new Error("Missing query mock");
        return original(sql);
      });
      catalog = new PostgresWarehouseCatalog(
        { query, connect: async () => ({ query, release }) } as WarehousePostgresPool,
        descriptor,
        () => current,
      );
      expect(await catalog.describeDataset({ access })).toMatchObject({
        headId: "old-head",
        headStatus: "stale",
        head: snapshot,
        revision: 9,
        permissionEpoch: current.permissionEpoch,
        privacyEpoch: current.privacyEpoch,
      });
      await expect(catalog.pinSnapshot({ access })).rejects.toThrow("WAREHOUSE_EPOCH_CHANGED");
    },
  );
  it("preserves the CAS identity when head snapshot metadata is unavailable", async () => {
    head = { ...head, snapshot_id: "missing-head", revision: 12 };
    expect(await catalog.describeDataset({ access })).toMatchObject({
      headId: "missing-head",
      headStatus: "unavailable",
      head: null,
      revision: 12,
    });
    await expect(catalog.pinSnapshot({ access })).rejects.toThrow("WAREHOUSE_SNAPSHOT_UNAVAILABLE");
  });
  it("describes an unpublished dataset with an empty head", async () => {
    expect(await catalog.describeDataset({ access })).toMatchObject({
      headId: null,
      head: null,
      headStatus: "empty",
      revision: 0,
    });
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
