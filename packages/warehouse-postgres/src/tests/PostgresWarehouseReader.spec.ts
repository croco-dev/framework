import { beforeAll, describe, expect, it, vi } from "vitest";
import { c, compileFact, defineFact } from "@croco/warehouse-core";
import type { FactDescriptor } from "@croco/warehouse-core";
import type { WarehouseAccess, WarehouseReadRequest } from "@croco/warehouse-core/runtime";
import { PostgresWarehouseReader } from "../facts/PostgresWarehouseReader";
import type { WarehousePostgresConnection, WarehousePostgresPool } from "../facts/client";

let descriptor: FactDescriptor;
const access: WarehouseAccess = {
  scope: { application: "reader", environment: "test", tenant: "one" },
  actor: "reader",
  roles: ["read"],
  columns: ["id", "at", "note"],
  permissionEpoch: 0,
  privacyEpoch: 0,
};
beforeAll(async () => {
  descriptor = await compileFact(
    defineFact("reader_limits", {
      version: 1,
      kind: "transaction",
      scope: "tenant",
      grain: { description: "event", key: ["id"] },
      columns: { id: c.id(), at: c.instant({ precision: "second" }), note: c.string() },
      time: { event: "at" },
      write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
    }),
  );
});
const request = (): WarehouseReadRequest => ({
  access,
  snapshotId: "snapshot",
  projection: ["note"],
  filters: [],
  order: [{ column: "id", direction: "asc" }],
  maxRows: 1,
  maxBytes: 1024,
  timeoutMs: 1000,
});
const reader = (pool: WarehousePostgresPool) =>
  new PostgresWarehouseReader(pool, descriptor, () => access, "a".repeat(32), {
    query: async <T>() => ({ rows: [] as T[] }),
    connect: async () => ({
      query: async <T>() => ({ rows: [] as T[] }),
      release: () => undefined,
    }),
  });
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture(
  block?: string,
  pages: { _has_more: boolean; _rows: Record<string, string>[] }[] = [],
) {
  const entered = deferred<void>();
  const release = vi.fn();
  const query = vi.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.includes(block ?? "\0")) {
      entered.resolve();
      return await new Promise<{ rows: unknown[] }>(() => undefined);
    }
    if (sql.startsWith("SELECT pg_backend_pid")) return { rows: [{ pid: 42 }] };
    if (sql.startsWith("SELECT permission"))
      return { rows: [{ permission_epoch: 0, privacy_epoch: 0 }] };
    if (sql.startsWith("SELECT data"))
      return {
        rows: [
          {
            data: { id: "snapshot", revision: 1, permissionEpoch: 0, privacyEpoch: 0 },
            expires_at: null,
          },
        ],
      };
    if (sql.startsWith("WITH picked"))
      return {
        rows: [{ _bytes_exceeded: false, ...(pages.shift() ?? { _has_more: false, _rows: [] }) }],
      };
    return { rows: [] };
  });
  const connection: WarehousePostgresConnection = {
    release,
    query: async <T>(sql: string, params?: unknown[]) => ({
      rows: (await query(sql, params)).rows as T[],
    }),
  };
  const pool: WarehousePostgresPool = { query: connection.query, connect: async () => connection };
  return { pool, connection, release, query, entered };
}

describe("warehouse reader bounded lifetime", () => {
  it("continues a pinned cursor with a smaller remaining row budget", async () => {
    const test = fixture(undefined, [
      {
        _has_more: true,
        _rows: [
          { _identity: "one", v_0: "first", v_1: "id-1" },
          { _identity: "two", v_0: "second", v_1: "id-2" },
        ],
      },
      { _has_more: false, _rows: [{ _identity: "three", v_0: "third", v_1: "id-3" }] },
    ]);
    const warehouse = reader(test.pool);
    const first = await warehouse.read({ ...request(), maxRows: 2 });
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await warehouse.read({ ...request(), cursor: first.nextCursor ?? undefined });
    expect(first.rows).toEqual([{ note: "first" }, { note: "second" }]);
    expect(second.rows).toEqual([{ note: "third" }]);
    expect(second.nextCursor).toBeNull();
    const pageCalls = test.query.mock.calls.filter(([sql]) => sql.startsWith("WITH picked"));
    expect(pageCalls).toHaveLength(2);
    expect(pageCalls[1][1]).toEqual([
      ...(pageCalls[0][1]?.slice(0, 3) ?? []),
      "id-2",
      "id-2",
      "two",
      1,
      1024,
      2,
    ]);
  });
  it.each([
    { projection: ["id"] },
    { filters: [{ column: "note", operator: "eq" as const, value: "changed" }] },
    { order: [{ column: "id", direction: "desc" as const }] },
    { snapshotId: "other-snapshot" },
  ])("rejects a cursor when query identity changes: %j", async (change) => {
    const test = fixture(undefined, [
      { _has_more: true, _rows: [{ _identity: "one", v_0: "first", v_1: "id-1" }] },
    ]);
    const warehouse = reader(test.pool);
    const first = await warehouse.read(request());
    expect(first.nextCursor).toEqual(expect.any(String));
    test.query.mockClear();
    await expect(
      warehouse.read({
        ...request(),
        ...change,
        cursor: first.nextCursor ?? undefined,
      }),
    ).rejects.toThrow("WAREHOUSE_CURSOR_STALE");
    expect(test.query).not.toHaveBeenCalled();
  });
  it("times out pool acquisition and destroys a later acquired connection without issuing SQL", async () => {
    const test = fixture();
    const pending = deferred<WarehousePostgresConnection>();
    const pool = { ...test.pool, connect: () => pending.promise };
    await expect(reader(pool).read({ ...request(), timeoutMs: 15 })).rejects.toThrow(
      "WAREHOUSE_READ_TIMEOUT",
    );
    pending.resolve(test.connection);
    await Promise.resolve();
    expect(test.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(test.query).not.toHaveBeenCalled();
  });
  it("aborts pending acquisition and releases its eventual result once", async () => {
    const test = fixture();
    const pending = deferred<WarehousePostgresConnection>();
    const controller = new AbortController();
    const result = reader({ ...test.pool, connect: () => pending.promise }).read({
      ...request(),
      signal: controller.signal,
    });
    controller.abort();
    await expect(result).rejects.toThrow("WAREHOUSE_READ_CANCELLED");
    pending.resolve(test.connection);
    await Promise.resolve();
    expect(test.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it.each(["SELECT permission", "WITH picked"])(
    "destroys active work at %s without issuing delayed PID cancellation",
    async (block) => {
      const test = fixture(block);
      const controller = new AbortController();
      const result = reader(test.pool).read({ ...request(), signal: controller.signal });
      await test.entered.promise;
      controller.abort();
      await expect(result).rejects.toThrow("WAREHOUSE_READ_CANCELLED");
      expect(test.release).toHaveBeenCalledExactlyOnceWith(true);
      expect(
        test.query.mock.calls.some(
          ([sql]) => sql.includes("pg_cancel_backend") || sql === "ROLLBACK",
        ),
      ).toBe(false);
    },
  );
  it("bounds the whole transaction deadline even when a query never settles", async () => {
    const test = fixture("WITH picked");
    await expect(reader(test.pool).read({ ...request(), timeoutMs: 20 })).rejects.toThrow(
      "WAREHOUSE_READ_TIMEOUT",
    );
    expect(test.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it("removes the abort listener before returning a reusable connection", async () => {
    const test = fixture();
    const controller = new AbortController();
    await reader(test.pool).read({ ...request(), signal: controller.signal });
    controller.abort();
    expect(test.release).toHaveBeenCalledExactlyOnceWith();
  });
  it("retains the runtime direction guard", async () => {
    const test = fixture();
    const invalid = {
      ...request(),
      order: [{ column: "id", direction: "ASC;DROP TABLE" }],
    } as unknown as WarehouseReadRequest;
    await expect(reader(test.pool).read(invalid)).rejects.toThrow("WAREHOUSE_INVALID_ORDER");
    expect(test.query).not.toHaveBeenCalled();
  });
  it("holds the target connection until dedicated cancellation finishes", async () => {
    const test = fixture("WITH picked");
    const completion = deferred<{ rows: unknown[] }>();
    const cancelQuery = vi.fn(async (_sql: string, _params?: unknown[]) => completion.promise);
    const cancellation: WarehousePostgresPool = {
      query: async <T>(sql: string, params?: unknown[]) => ({
        rows: (await cancelQuery(sql, params)).rows as T[],
      }),
      connect: async () => ({
        query: async <T>(sql: string, params?: unknown[]) => ({
          rows: (await cancelQuery(sql, params)).rows as T[],
        }),
        release: () => undefined,
      }),
    };
    const controller = new AbortController();
    const result = new PostgresWarehouseReader(
      test.pool,
      descriptor,
      () => access,
      "a".repeat(32),
      cancellation,
    ).read({ ...request(), signal: controller.signal });
    await test.entered.promise;
    controller.abort();
    await Promise.resolve();
    expect(test.release).not.toHaveBeenCalled();
    expect(cancelQuery).toHaveBeenCalledExactlyOnceWith("SELECT pg_cancel_backend($1)", [42]);
    completion.resolve({ rows: [{ pg_cancel_backend: true }] });
    await expect(result).rejects.toThrow("WAREHOUSE_READ_CANCELLED");
    expect(test.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it("rejects sharing the primary pool with cancellation", () => {
    const test = fixture();
    expect(
      () =>
        new PostgresWarehouseReader(test.pool, descriptor, () => access, "a".repeat(32), test.pool),
    ).toThrow("WAREHOUSE_READER_CONFIGURATION");
  });
  it("reports cancellation transport failure and destroys both connections", async () => {
    const test = fixture("WITH picked");
    const release = vi.fn();
    const query = async <T>(): Promise<{ rows: T[] }> => {
      throw new Error("control connection lost");
    };
    const control: WarehousePostgresPool = { query, connect: async () => ({ query, release }) };
    const controller = new AbortController();
    const result = new PostgresWarehouseReader(
      test.pool,
      descriptor,
      () => access,
      "a".repeat(32),
      control,
    ).read({ ...request(), signal: controller.signal });
    await test.entered.promise;
    controller.abort();
    await expect(result).rejects.toThrow("WAREHOUSE_CANCELLATION_FAILED");
    expect(test.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it("rejects oversized filter strings and cursors before acquiring a connection", async () => {
    const test = fixture();
    await expect(
      reader(test.pool).read({
        ...request(),
        filters: [{ column: "note", operator: "eq", value: "x".repeat(8193) }],
      }),
    ).rejects.toThrow("WAREHOUSE_READ_LIMIT");
    await expect(
      reader(test.pool).read({ ...request(), cursor: ".".repeat(8193) }),
    ).rejects.toThrow("WAREHOUSE_INVALID_CURSOR");
    expect(test.query).not.toHaveBeenCalled();
  });
});
