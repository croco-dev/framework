import { beforeAll, describe, expect, it, vi } from "vitest";
import { c, canonicalPayload, compileFact, defineFact } from "@croco/warehouse-core";
import type { FactDescriptor } from "@croco/warehouse-core";
import type {
  WarehouseAccess,
  WarehouseCandidate,
  WriteReceipt,
} from "@croco/warehouse-core/runtime";
import { PostgresWarehouseWriter } from "../facts/PostgresWarehouseWriter";
import {
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
  let stored: { receipt: WriteReceipt; payload_hash: string } | undefined;
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
    if (sql.startsWith("SELECT receipt")) return { rows: stored ? [stored] : [] };
    if (sql.startsWith("SELECT identity FROM warehouse_suppressions"))
      return { rows: options.suppressed ? [{ identity: "capture" }] : [] };
    if (sql.startsWith("SELECT _payload"))
      return { rows: options.existing ? [{ _payload: options.existing }] : [] };
    if (sql.startsWith('INSERT INTO "wh_fact_') && options.failInsert)
      throw new Error("storage failure");
    if (sql.startsWith("INSERT INTO warehouse_receipts"))
      stored = { payload_hash: String(values?.[3]), receipt: values?.[4] as WriteReceipt };
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
