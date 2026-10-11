import { Pool } from "pg";
import { postgresResource, type PostgresTestConnection } from "@croco/testing-resources";
import { c, compileFact, defineFact } from "@croco/warehouse-core";
import type { FactDescriptor } from "@croco/warehouse-core";
import type { WarehouseAccess, WarehouseReadRequest } from "@croco/warehouse-core/runtime";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PostgresWarehouseReader } from "../facts/PostgresWarehouseReader";
import {
  factColumnName,
  factTableName,
  installPostgresFactSchema,
  installPostgresWarehouseSchema,
  quoteIdentifier,
  scopeKey,
} from "../facts/schema";
import type { WarehousePostgresConnection, WarehousePostgresPool } from "../facts/client";

const enabled = process.env.CROCO_TEST_REAL_RESOURCES === "1";
describe.skipIf(!enabled)("PostgreSQL reader transfer and cancellation", () => {
  let connection: PostgresTestConnection;
  let dispose: (() => Promise<void> | void) | undefined;
  let descriptor: FactDescriptor;
  let cancellationPool: Pool;
  let readPool: Pool;
  const access: WarehouseAccess = {
    scope: { application: "reader", environment: "test", tenant: "one" },
    actor: "reader",
    roles: ["read"],
    columns: ["id", "at", "note"],
    permissionEpoch: 0,
    privacyEpoch: 0,
  };
  const request = (): WarehouseReadRequest => ({
    access,
    snapshotId: "snapshot",
    projection: ["note"],
    filters: [],
    order: [{ column: "id", direction: "asc" }],
    maxRows: 1,
    maxBytes: 4096,
    timeoutMs: 5000,
  });
  const reader = (pool: WarehousePostgresPool = readPool) =>
    new PostgresWarehouseReader(pool, descriptor, () => access, "a".repeat(32), cancellationPool);
  beforeAll(async () => {
    const started = await postgresResource({ id: "reader-limits", mode: "commit" }).start({
      register: () => undefined,
      testId: "reader-limits",
      workerId: "reader-limits",
    });
    connection = started.connection;
    cancellationPool = new Pool({ connectionString: connection.connectionString, max: 1 });
    readPool = new Pool({ connectionString: connection.connectionString, max: 1 });
    dispose = started.dispose;
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
    await installPostgresWarehouseSchema(connection.pool);
    await installPostgresFactSchema(connection.pool, descriptor);
    const scope = scopeKey(access.scope);
    await connection.query("INSERT INTO warehouse_heads(scope_key,model_version) VALUES($1,$2)", [
      scope,
      descriptor.semanticHash,
    ]);
    await connection.query(
      "INSERT INTO warehouse_candidates(id,scope_key,model_version,fence,state,data) VALUES('candidate',$1,$2,1,'published','{}')",
      [scope, descriptor.semanticHash],
    );
    await connection.query(
      "INSERT INTO warehouse_snapshots(id,scope_key,model_version,data) VALUES('snapshot',$1,$2,$3)",
      [
        scope,
        descriptor.semanticHash,
        { id: "snapshot", revision: 1, permissionEpoch: 0, privacyEpoch: 0 },
      ],
    );
    const table = quoteIdentifier(factTableName(descriptor));
    const col = (key: string) => quoteIdentifier(factColumnName(descriptor, key));
    await connection.query(
      `INSERT INTO ${table}(_scope,_identity,_candidate,_payload,_visible_from,${col("id")},${col("at")},${col("note")}) VALUES($1,'first','candidate','{}',1,'a','2026-09-27T00:00:00Z','small'),($1,'second','candidate','{}',1,'b','2026-09-27T00:00:00Z',repeat('x',8000000))`,
      [scope],
    );
  }, 180000);
  afterAll(async () => {
    await readPool?.end();
    await cancellationPool?.end();
    await dispose?.();
  });

  it("does not transfer a huge lookahead row and rejects an oversized projected row before transfer", async () => {
    const pages: unknown[] = [];
    const pool: WarehousePostgresPool = {
      query: connection.pool.query.bind(connection.pool),
      connect: async () => {
        const db = await readPool.connect();
        return {
          release: db.release.bind(db),
          query: async <T>(sql: string, params?: unknown[]) => {
            const result = await db.query(sql, params);
            if (sql.startsWith("WITH picked")) pages.push(result.rows);
            return { rows: result.rows as T[] };
          },
        };
      },
    };
    const first = await reader(pool).read(request());
    expect(first.rows).toEqual([{ note: "small" }]);
    expect(first.nextCursor).toBeTruthy();
    expect(Buffer.byteLength(JSON.stringify(pages[0]))).toBeLessThan(4096);
    await expect(
      reader(pool).read({ ...request(), cursor: first.nextCursor ?? undefined }),
    ).rejects.toThrow("WAREHOUSE_READ_BYTES");
    expect(Buffer.byteLength(JSON.stringify(pages[1]))).toBeLessThan(200);
    expect(pages[1]).toEqual([{ _bytes_exceeded: true, _has_more: false, _rows: [] }]);
  });

  it("destroys the running PostgreSQL connection on abort without touching a reused backend", async () => {
    let pid = 0;
    let entered: () => void = () => undefined;
    const executing = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const released = vi.fn();
    const pool: WarehousePostgresPool = {
      query: connection.pool.query.bind(connection.pool),
      connect: async () => {
        const db = await readPool.connect();
        pid = Number((await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
        return {
          release: (error) => {
            released(error);
            db.release(error);
          },
          query: async <T>(sql: string, params?: unknown[]) => {
            if (sql.startsWith("WITH picked")) {
              const waiting = db.query("SELECT pg_sleep(20)");
              entered();
              await waiting;
            }
            return { rows: (await db.query(sql, params)).rows as T[] };
          },
        };
      },
    };
    const controller = new AbortController();
    const result = reader(pool).read({ ...request(), signal: controller.signal });
    await executing;
    controller.abort();
    await expect(result).rejects.toThrow("WAREHOUSE_READ_CANCELLED");
    expect(released).toHaveBeenCalledExactlyOnceWith(true);
    await expect
      .poll(
        async () =>
          Number(
            (
              await connection.query(
                "SELECT count(*) AS count FROM pg_stat_activity WHERE pid=$1",
                [pid],
              )
            ).rows[0].count,
          ),
        { timeout: 3000 },
      )
      .toBe(0);
    expect((await connection.query("SELECT 42 AS value")).rows[0].value).toBe(42);
  });

  it("times out acquisition and destroys the real connection when it eventually arrives", async () => {
    let deliver: (db: WarehousePostgresConnection) => void = () => undefined;
    const waiting = new Promise<WarehousePostgresConnection>((resolve) => {
      deliver = resolve;
    });
    const pool: WarehousePostgresPool = {
      query: connection.pool.query.bind(connection.pool),
      connect: () => waiting,
    };
    await expect(reader(pool).read({ ...request(), timeoutMs: 20 })).rejects.toThrow(
      "WAREHOUSE_READ_TIMEOUT",
    );
    const db = await readPool.connect();
    const pid = Number((await db.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
    const released = vi.fn();
    deliver({
      query: db.query.bind(db),
      release: (error) => {
        released(error);
        db.release(error);
      },
    });
    await Promise.resolve();
    expect(released).toHaveBeenCalledExactlyOnceWith(true);
    await expect
      .poll(
        async () =>
          Number(
            (
              await connection.query(
                "SELECT count(*) AS count FROM pg_stat_activity WHERE pid=$1",
                [pid],
              )
            ).rows[0].count,
          ),
        { timeout: 3000 },
      )
      .toBe(0);
  });
});
