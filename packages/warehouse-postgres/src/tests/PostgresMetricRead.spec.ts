import { beforeAll, describe, expect, it, vi } from "vitest";
import { c, compileFact, defineFact } from "@croco/warehouse-core";
import { defineMetric, project, sum } from "@croco/metrics-core";
import type { FactDescriptor } from "@croco/warehouse-core";
import type { WarehouseAccess } from "@croco/warehouse-core/runtime";
import type { WarehousePostgresPool } from "../facts/client";
import { PostgresWarehouseReader } from "../facts/PostgresWarehouseReader";

let descriptor: FactDescriptor;
beforeAll(async () => {
  descriptor = await compileFact(
    defineFact("metric_security", {
      version: 1,
      kind: "transaction",
      scope: "tenant",
      grain: { description: "event", key: ["id"] },
      columns: { id: c.id(), at: c.instant({ precision: "second" }), value: c.int64() },
      time: { event: "at" },
      write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
    }),
  );
});
const access: WarehouseAccess = {
  scope: { application: "metrics", environment: "test", tenant: "one" },
  actor: "operator",
  roles: ["read"],
  columns: ["at", "value"],
  permissionEpoch: 0,
  privacyEpoch: 0,
};
function fixture() {
  let current = access;
  let epoch = 0;
  const release = vi.fn();
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT pg_backend_pid")) return { rows: [{ pid: 42 }] };
    if (sql.startsWith("SELECT permission"))
      return { rows: [{ permission_epoch: epoch, privacy_epoch: 0 }] };
    if (sql.startsWith("SELECT data"))
      return {
        rows: [
          {
            data: { id: "pinned", revision: 1, permissionEpoch: 0, privacyEpoch: 0 },
            expires_at: null,
          },
        ],
      };
    if (sql.startsWith("WITH bounded"))
      return { rows: [{ exceeded: false, results: [{ group: {}, value: "9007199254740993" }] }] };
    return { rows: [] };
  });
  const pool: WarehousePostgresPool = {
    query: async <T>(sql: string) => ({ rows: (await query(sql)).rows as T[] }),
    connect: async () => ({ release, query: pool.query }),
  };
  const cancellation: WarehousePostgresPool = {
    query: async <T>() => ({ rows: [] as T[] }),
    connect: async () => ({ release: () => undefined, query: cancellation.query }),
  };
  const reader = new PostgresWarehouseReader(
    pool,
    descriptor,
    () => current,
    "x".repeat(32),
    cancellation,
    1,
  );
  const definition = defineMetric("total", {
    version: 1,
    from: descriptor,
    measure: sum(project(descriptor, "value")),
    time: project(descriptor, "at"),
    population: "events",
    unit: "count",
  });
  return {
    reader,
    query,
    release,
    setAccess: (value: WarehouseAccess) => {
      current = value;
    },
    advanceEpoch: () => {
      epoch++;
    },
    request: {
      access,
      snapshotId: "pinned",
      definition,
      window: { from: "2026-10-01T00:00:00Z", to: "2026-10-02T00:00:00Z" },
      maxRows: 10,
      maxBytes: 4096,
      timeoutMs: 1000,
    },
  };
}

describe("native metric read boundary", () => {
  it("uses a read-only transaction and returns only exact aggregate strings without grain access", async () => {
    const test = fixture();
    const result = await test.reader.readMetric(test.request);
    expect(result.data).toEqual([{ group: {}, value: "9007199254740993" }]);
    expect(result.snapshot.id).toBe("pinned");
    expect(test.query.mock.calls.map(([sql]) => sql)).toContain("BEGIN READ ONLY");
    expect(
      test.query.mock.calls.filter(([sql]) => sql.startsWith("SELECT permission")),
    ).toHaveLength(2);
    expect(test.release).toHaveBeenCalledOnce();
  });
  it("denies an unauthorized measure before connecting", async () => {
    const test = fixture();
    const denied = { ...access, columns: ["at"] };
    test.setAccess(denied);
    await expect(test.reader.readMetric({ ...test.request, access: denied })).rejects.toThrow(
      "WAREHOUSE_COLUMN_DENIED",
    );
    expect(test.query).not.toHaveBeenCalled();
  });
  it("rejects a database epoch change before returning aggregates", async () => {
    const test = fixture();
    const original = test.query.getMockImplementation();
    test.query.mockImplementation(async (sql) => {
      const result = await original?.(sql);
      if (sql.startsWith("WITH bounded")) test.advanceEpoch();
      return result ?? { rows: [] };
    });
    await expect(test.reader.readMetric(test.request)).rejects.toThrow("WAREHOUSE_EPOCH_CHANGED");
  });
  it("rechecks server field permissions after query completion", async () => {
    const test = fixture();
    const original = test.query.getMockImplementation();
    test.query.mockImplementation(async (sql) => {
      const result = await original?.(sql);
      if (sql.startsWith("WITH bounded")) test.setAccess({ ...access, columns: ["at"] });
      return result ?? { rows: [] };
    });
    await expect(test.reader.readMetric(test.request)).rejects.toThrow("WAREHOUSE_ACCESS_CHANGED");
  });
  it("captures server access even when the resolver mutates its existing object", async () => {
    const test = fixture();
    const mutable = { ...access, columns: [...access.columns] };
    test.setAccess(mutable);
    const original = test.query.getMockImplementation();
    test.query.mockImplementation(async (sql) => {
      const result = await original?.(sql);
      if (sql.startsWith("WITH bounded")) mutable.columns.splice(1, 1);
      return result ?? { rows: [] };
    });
    await expect(test.reader.readMetric({ ...test.request, access: mutable })).rejects.toThrow(
      "WAREHOUSE_ACCESS_CHANGED",
    );
  });
  it("shares concurrency and cancellation with ordinary snapshot reads", async () => {
    const test = fixture();
    let entered: () => void = () => undefined;
    const executing = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const original = test.query.getMockImplementation();
    test.query.mockImplementation(async (sql) => {
      if (sql.startsWith("WITH bounded")) {
        entered();
        return new Promise(() => undefined);
      }
      return (await original?.(sql)) ?? { rows: [] };
    });
    const controller = new AbortController();
    const result = test.reader.readMetric({ ...test.request, signal: controller.signal });
    await executing;
    await expect(test.reader.readMetric(test.request)).rejects.toThrow(
      "WAREHOUSE_READ_CONCURRENCY",
    );
    controller.abort();
    await expect(result).rejects.toThrow("WAREHOUSE_READ_CANCELLED");
    expect(test.release).toHaveBeenCalledExactlyOnceWith(true);
  });
});
