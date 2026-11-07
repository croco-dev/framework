import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  c,
  canonicalPayload,
  compileFact,
  defineFact,
  encodeIdentity,
} from "@croco/warehouse-core";
import {
  appendWarehouseReceiptManifest,
  createWarehouseReceiptManifest,
} from "@croco/warehouse-core/runtime";
import type { FactDescriptor } from "@croco/warehouse-core";
import type {
  WarehouseAccess,
  WarehouseCandidate,
  WriteReceipt,
} from "@croco/warehouse-core/runtime";
import { PostgresWarehouseWriter } from "../facts/PostgresWarehouseWriter";
import {
  generatePostgresFactSchema,
  generatePostgresWarehouseSchema,
  factColumnName,
  factTableName,
  installPostgresFactSchema,
  quoteIdentifier,
  scopeKey,
} from "../facts/schema";
import type { WarehousePostgresPool } from "../facts/client";

let descriptor: FactDescriptor;
const scope = { application: "shop", environment: "test", tenant: "one" };
const access: WarehouseAccess = {
  scope,
  actor: "importer",
  roles: ["import"],
  columns: ["id", "amount", "at"],
  permissionEpoch: 0,
  privacyEpoch: 0,
};
const row = { id: "capture", amount: "9007199254740993", at: "2026-09-27T00:00:00.000Z" };
beforeAll(async () => {
  descriptor = await compileFact(
    defineFact("captures", {
      version: 1,
      kind: "transaction",
      scope: "tenant",
      grain: { description: "one capture", key: ["id"] },
      columns: { id: c.id(), amount: c.int64(), at: c.instant({ precision: "millisecond" }) },
      time: { event: "at" },
      write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
    }),
  );
});

function fixture(
  options: {
    state?: string;
    fence?: number;
    privacyEpoch?: number;
    existing?: string;
    suppressed?: boolean;
    lostCommit?: boolean;
    failInsert?: boolean;
  } = {},
) {
  const candidate: WarehouseCandidate = {
    id: "candidate",
    scope,
    modelVersion: descriptor.semanticHash,
    transformHash: "transform",
    sourceRefs: [],
    expectedHead: null,
    fence: 1,
    state: "open",
    partitionSelection: null,
    permissionEpoch: 0,
    privacyEpoch: 0,
    quality: null,
  };
  const stored = new Map<string, { receipt: WriteReceipt; payload_hash: string }>();
  let loseCommit = options.lostCommit;
  const release = vi.fn();
  const query = vi.fn(async (sql: string, values?: unknown[]): Promise<{ rows: unknown[] }> => {
    if (sql.startsWith("SELECT * FROM warehouse_candidates"))
      return {
        rows: [
          {
            data: candidate,
            state: options.state ?? "open",
            fence: options.fence ?? 1,
            scope_key: scopeKey(scope),
            model_version: descriptor.semanticHash,
          },
        ],
      };
    if (sql.startsWith("SELECT permission_epoch"))
      return { rows: [{ permission_epoch: 0, privacy_epoch: options.privacyEpoch ?? 0 }] };
    if (sql.startsWith("SELECT descriptor")) return { rows: [{ descriptor }] };
    if (sql.startsWith("SELECT receipt")) {
      const receipt = stored.get(String(values?.[1]));
      return { rows: receipt ? [receipt] : [] };
    }
    if (sql.startsWith("SELECT identity FROM warehouse_suppressions"))
      return { rows: options.suppressed ? [{ identity: "capture" }] : [] };
    if (sql.startsWith("SELECT _identity,_payload"))
      return {
        rows: options.existing
          ? [{ _identity: encodeIdentity(descriptor, row, scope), _payload: options.existing }]
          : [],
      };
    if (sql.startsWith('INSERT INTO "wh_fact_') && options.failInsert)
      throw new Error("storage failure");
    if (sql.startsWith("INSERT INTO warehouse_receipts"))
      stored.set(String(values?.[1]), {
        payload_hash: String(values?.[3]),
        receipt: values?.[4] as WriteReceipt,
      });
    if (sql === "COMMIT" && loseCommit) {
      loseCommit = false;
      throw new Error("connection lost after commit");
    }
    return { rows: [] };
  });
  const pool: WarehousePostgresPool = {
    query: async <T>(sql: string, values?: unknown[]) => ({
      rows: (await query(sql, values)).rows as T[],
    }),
    connect: async () => ({ query: pool.query, release }),
  };
  const request = {
    access,
    candidateId: candidate.id,
    fence: 1,
    batchId: "batch",
    attempt: 1,
    rows: [row],
  };
  return {
    pool,
    query,
    release,
    request,
    writer: new PostgresWarehouseWriter(pool, descriptor, () => access),
  };
}

describe("PostgresWarehouseWriter", () => {
  it("persists verifiable range evidence and replays it across JSONB key ordering", async () => {
    const test = fixture();
    const payloadHash = createHash("sha256")
      .update(JSON.stringify([canonicalPayload(descriptor, row)]))
      .digest("hex");
    const { evidence } = await appendWarehouseReceiptManifest(
      createWarehouseReceiptManifest("a".repeat(64)),
      {
        batchId: "batch",
        payloadHash,
        sourceId: "payments",
        from: 1,
        through: 2,
        rejected: 0,
        filtered: 1,
        rejections: [],
      },
    );
    const receipt = await test.writer.write({ ...test.request, evidence });
    expect(receipt.evidence).toEqual(evidence);
    const reordered = Object.fromEntries(Object.entries(evidence).reverse()) as typeof evidence;
    const original = test.query.getMockImplementation();
    test.query.mockImplementation(async (sql, values) => {
      if (sql.startsWith("SELECT receipt,payload_hash"))
        return {
          rows: [{ receipt: { ...receipt, evidence: reordered }, payload_hash: payloadHash }],
        };
      if (!original) throw new Error("Missing query mock");
      return original(sql, values);
    });
    expect(await test.writer.write({ ...test.request, attempt: 2, evidence })).toEqual(receipt);
    expect(
      test.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO "wh_fact_')),
    ).toHaveLength(1);
    const changed = await appendWarehouseReceiptManifest(
      createWarehouseReceiptManifest("b".repeat(64)),
      {
        ...evidence,
        batchId: "batch",
        payloadHash,
      },
    );
    await expect(
      test.writer.write({ ...test.request, evidence: changed.evidence }),
    ).rejects.toThrow("WAREHOUSE_BATCH_CONFLICT");
  });

  it("rejects a manifest hash or output-count mismatch before writing facts or receipts", async () => {
    const test = fixture();
    const payloadHash = createHash("sha256")
      .update(JSON.stringify([canonicalPayload(descriptor, row)]))
      .digest("hex");
    const { evidence } = await appendWarehouseReceiptManifest(
      createWarehouseReceiptManifest("a".repeat(64)),
      {
        batchId: "batch",
        payloadHash,
        sourceId: "payments",
        from: 1,
        through: 1,
        rejected: 0,
        filtered: 0,
        rejections: [],
      },
    );
    await expect(
      test.writer.write({ ...test.request, evidence: { ...evidence, hash: "f".repeat(64) } }),
    ).rejects.toThrow("WAREHOUSE_BATCH_CONFLICT");
    const wrongCount = await appendWarehouseReceiptManifest(
      createWarehouseReceiptManifest("a".repeat(64)),
      {
        ...evidence,
        batchId: "batch",
        payloadHash,
        through: 2,
      },
    );
    await expect(
      test.writer.write({ ...test.request, evidence: wrongCount.evidence }),
    ).rejects.toThrow("WAREHOUSE_BATCH_CONFLICT");
    expect(test.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
  });

  it("durably records a fully filtered range without inserting facts", async () => {
    const test = fixture();
    const payloadHash = createHash("sha256").update("[]").digest("hex");
    const { evidence } = await appendWarehouseReceiptManifest(
      createWarehouseReceiptManifest("a".repeat(64)),
      {
        batchId: "batch",
        payloadHash,
        sourceId: "payments",
        from: 1,
        through: 3,
        rejected: 0,
        filtered: 3,
        rejections: [],
      },
    );
    expect(await test.writer.write({ ...test.request, rows: [], evidence })).toMatchObject({
      inserted: 0,
      identical: 0,
      evidence,
    });
    expect(test.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO "wh_fact_'))).toBe(
      false,
    );
    expect(
      test.query.mock.calls.some(([sql]) => sql.startsWith("INSERT INTO warehouse_receipts")),
    ).toBe(true);
  });

  it("counts identical rows within a batch once and rejects an intra-batch conflict atomically", async () => {
    const test = fixture();
    expect(
      await test.writer.write({ ...test.request, rows: [row, row, { ...row, id: "other" }] }),
    ).toMatchObject({ inserted: 2, identical: 1 });
    const conflict = fixture();
    await expect(
      conflict.writer.write({ ...conflict.request, rows: [row, { ...row, amount: "7" }] }),
    ).rejects.toThrow("WAREHOUSE_FACT_CONFLICT");
    expect(conflict.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
    expect(await conflict.writer.reconcileReceipt(conflict.request)).toBeNull();
  });

  it("bounds row count, serialized bytes and native query parameters", async () => {
    const test = fixture();
    await expect(
      test.writer.write({ ...test.request, rows: Array(10_001).fill(row) }),
    ).rejects.toThrow("WAREHOUSE_BATCH_LIMIT");
    expect(test.query).not.toHaveBeenCalled();
    await expect(
      test.writer.write({
        ...test.request,
        rows: Array(10_000).fill({ ...row, id: "x".repeat(1000) }),
      }),
    ).rejects.toThrow("WAREHOUSE_BATCH_LIMIT");
    expect(test.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
    test.query.mockClear();
    const rows = Array.from({ length: 10_000 }, (_, index) => ({ ...row, id: `row-${index}` }));
    expect(await test.writer.write({ ...test.request, rows })).toMatchObject({ inserted: 10_000 });
    const inserts = test.query.mock.calls.filter(([sql]) =>
      sql.startsWith('INSERT INTO "wh_fact_'),
    );
    expect(inserts).toHaveLength(2);
    expect(inserts.map(([, values]) => values?.length)).toEqual([59_997, 10_003]);
  });

  it.each([1000, 10_000, 100_000])(
    "keeps SQL and transactions proportional to batches for %i synthetic rows",
    async (count) => {
      const test = fixture();
      const started = performance.now();
      const heapBefore = process.memoryUsage().heapUsed;
      for (let start = 0; start < count; start += 100) {
        const rows = Array.from({ length: 100 }, (_, index) => ({
          ...row,
          id: `row-${start + index}`,
        }));
        expect(
          await test.writer.write({ ...test.request, batchId: `range-${start}`, rows }),
        ).toMatchObject({ inserted: 100 });
      }
      expect(test.query.mock.calls).toHaveLength(count / 10);
      expect(test.query.mock.calls.filter(([sql]) => sql === "BEGIN")).toHaveLength(count / 100);
      expect(test.query.mock.calls.filter(([sql]) => sql === "COMMIT")).toHaveLength(count / 100);
      console.info(
        JSON.stringify({
          workload: "synthetic-writer",
          rows: count,
          writerCalls: count / 100,
          transactions: count / 100,
          sqlCalls: test.query.mock.calls.length,
          elapsedMs: performance.now() - started,
          heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
          note: "Mock transport; heap includes retained spy calls, not a live database benchmark.",
        }),
      );
    },
    120_000,
  );

  it("uses set reads and a bounded multi-row insert for a batch", async () => {
    const test = fixture();
    const rows = Array.from({ length: 1000 }, (_, index) => ({ ...row, id: `row-${index}` }));
    expect(await test.writer.write({ ...test.request, rows })).toMatchObject({
      state: "durable",
      inserted: 1000,
      identical: 0,
    });
    expect(test.query.mock.calls.filter(([sql]) => sql === "BEGIN")).toHaveLength(1);
    expect(test.query.mock.calls.filter(([sql]) => sql === "COMMIT")).toHaveLength(1);
    expect(test.query.mock.calls).toHaveLength(10);
    const inserts = test.query.mock.calls.filter(([sql]) =>
      sql.startsWith('INSERT INTO "wh_fact_'),
    );
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.[1]).toHaveLength(7000);
  });

  it("stores typed values without rounding and locks head before candidate and writes", async () => {
    const test = fixture();
    expect(test.query).not.toHaveBeenCalled();
    expect(await test.writer.write(test.request)).toMatchObject({
      state: "durable",
      inserted: 1,
      identical: 0,
    });
    const sql = test.query.mock.calls.map((call) => call[0]);
    expect(sql[1]).toContain("warehouse_heads");
    expect(sql[2]).toContain("warehouse_candidates");
    const insertion = test.query.mock.calls.find((call) =>
      call[0].startsWith('INSERT INTO "wh_fact_'),
    );
    expect(insertion?.[1]).toContain("9007199254740993");
    expect(sql.at(-1)).toBe("COMMIT");
  });
  it("replays a batch receipt without writing facts again and rejects changed payload", async () => {
    const test = fixture();
    const first = await test.writer.write(test.request);
    expect(await test.writer.write({ ...test.request, attempt: 2 })).toEqual(first);
    expect(
      test.query.mock.calls.filter((call) => call[0].startsWith('INSERT INTO "wh_fact_')),
    ).toHaveLength(1);
    await expect(
      test.writer.write({ ...test.request, rows: [{ ...row, amount: "1" }] }),
    ).rejects.toThrow("WAREHOUSE_BATCH_CONFLICT");
  });
  it("counts identical logical facts from another batch and rejects conflicting facts", async () => {
    const replay = fixture({ existing: canonicalPayload(descriptor, row) });
    expect(await replay.writer.write(replay.request)).toMatchObject({ inserted: 0, identical: 1 });
    const conflict = fixture({ existing: canonicalPayload(descriptor, { ...row, amount: "1" }) });
    await expect(conflict.writer.write(conflict.request)).rejects.toThrow(
      "WAREHOUSE_FACT_CONFLICT",
    );
    expect(conflict.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(
      conflict.query.mock.calls.some((call) =>
        call[0].startsWith("INSERT INTO warehouse_receipts"),
      ),
    ).toBe(false);
  });
  it.each([
    [{ state: "sealed" }, "WAREHOUSE_CANDIDATE_CLOSED"],
    [{ fence: 2 }, "WAREHOUSE_CANDIDATE_FENCE"],
    [{ privacyEpoch: 1 }, "WAREHOUSE_EPOCH_CHANGED"],
    [{ suppressed: true }, "WAREHOUSE_IDENTITY_SUPPRESSED"],
  ] as const)("rejects stale or suppressed writes %j", async (options, code) => {
    const test = fixture(options);
    await expect(test.writer.write(test.request)).rejects.toThrow(code);
    expect(test.query.mock.calls.some((call) => call[0].startsWith('INSERT INTO "wh_fact_'))).toBe(
      false,
    );
  });
  it("rejects a different tenant and missing field authorization", async () => {
    const test = fixture();
    await expect(
      test.writer.write({
        ...test.request,
        access: { ...access, scope: { ...scope, tenant: "two" } },
      }),
    ).rejects.toThrow("WAREHOUSE_ACCESS_CHANGED");
    await expect(
      test.writer.write({ ...test.request, access: { ...access, columns: ["id"] } }),
    ).rejects.toThrow("WAREHOUSE_ACCESS_CHANGED");
  });
  it("destroys an uncertain connection and reconciles with a new writer before retry", async () => {
    const test = fixture({ lostCommit: true });
    expect(await test.writer.write(test.request)).toMatchObject({ state: "indeterminate" });
    expect(test.release).toHaveBeenCalledWith(true);
    const restarted = new PostgresWarehouseWriter(test.pool, descriptor, () => access);
    expect(await restarted.reconcileReceipt(test.request)).toMatchObject({
      state: "durable",
      inserted: 1,
    });
    expect(await restarted.write({ ...test.request, attempt: 2 })).toMatchObject({
      state: "durable",
      attempt: 1,
    });
    expect(
      test.query.mock.calls.filter((call) => call[0].startsWith('INSERT INTO "wh_fact_')),
    ).toHaveLength(1);
  });
  it("rolls back a failed insert and never reports a receipt", async () => {
    const test = fixture({ failInsert: true });
    await expect(test.writer.write(test.request)).rejects.toThrow("storage failure");
    expect(test.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(await test.writer.reconcileReceipt(test.request)).toBeNull();
  });
  it("generates deterministic native DDL and the runtime column mapping without a database", async () => {
    const generated = await generatePostgresFactSchema(descriptor);
    const reordered = {
      ...descriptor,
      columns: Object.fromEntries(Object.entries(descriptor.columns).reverse()),
    };
    expect(await generatePostgresFactSchema(reordered)).toEqual(generated);
    expect(generated.tableName).toBe(factTableName(descriptor));
    expect(generated.columns).toEqual([
      { key: "amount", name: "c_0", sqlType: "BIGINT", nullable: false },
      { key: "at", name: "c_1", sqlType: "TIMESTAMPTZ(3)", nullable: false },
      { key: "id", name: "c_2", sqlType: "TEXT", nullable: false },
    ]);
    expect(generated.sql).toContain("WAREHOUSE_BINDING_CONFLICT");
    expect(generated.sql).toContain("INSERT INTO public.warehouse_models");
    expect(generatePostgresWarehouseSchema()).toContain(
      'CREATE TABLE IF NOT EXISTS "public"."warehouse_models"',
    );
    await expect(
      generatePostgresFactSchema({ ...descriptor, semanticHash: "0".repeat(64) }),
    ).rejects.toThrow("WAREHOUSE_SEMANTIC_HASH_MISMATCH");
  });

  it("quotes descriptor text and chooses a non-conflicting SQL block delimiter", async () => {
    const quoted = await compileFact({
      ...descriptor,
      grain: { ...descriptor.grain, description: "it's \\ $warehouse_binding$" },
    });
    const generated = await generatePostgresFactSchema(quoted);
    expect(generated.sql).toContain("it''s");
    expect(generated.sql).toMatch(/^DO \$warehouse_binding_\$/);
  });

  it("derives bounded SQL identifiers and explicit typed DDL", async () => {
    const statements: string[] = [];
    await installPostgresFactSchema(
      {
        query: async <T>(sql: string) => {
          statements.push(sql);
          return {
            rows: (sql.startsWith("SELECT")
              ? [{ table_name: factTableName(descriptor), descriptor }]
              : []) as T[],
          };
        },
      },
      descriptor,
    );
    expect(statements.join("\n")).toContain("BIGINT NOT NULL");
    expect(statements.join("\n")).toContain("TIMESTAMPTZ(3) NOT NULL");
    expect(statements.join("\n")).toContain("_visible_from BIGINT");
    expect(factColumnName(descriptor, "amount")).toBe("c_0");
    expect(factTableName(descriptor).length).toBeLessThan(60);
    expect(quoteIdentifier('a"b')).toBe('"a""b"');
    expect(() => quoteIdentifier("x".repeat(64))).toThrow("WAREHOUSE_SQL_IDENTIFIER");
  });
});
