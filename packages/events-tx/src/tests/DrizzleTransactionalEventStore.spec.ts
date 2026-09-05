import { drizzle } from "drizzle-orm/pg-proxy";
import { describe, expect, it, vi } from "vitest";
import { DrizzleTransactionalEventStore } from "../index";
import type { DrizzleTransactionalEventStoreDb } from "../index";

describe("DrizzleTransactionalEventStore outbox claims", () => {
  it("claims a batch in one statement with nonblocking locks and an aggregate predecessor guard", async () => {
    const queries: { sql: string; params: unknown[] }[] = [];
    const db = drizzle(async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [] };
    });
    const store = new DrizzleTransactionalEventStore({
      db: db as unknown as DrizzleTransactionalEventStoreDb,
    });

    await expect(
      store.claimOutboxBatch({
        limit: 10,
        now: new Date("2026-01-01T00:00:00.000Z"),
        visibilityTimeoutMs: 1_000,
      }),
    ).resolves.toEqual([]);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toMatch(/^update [\s\S]* returning /);
    expect(queries[0].sql).toContain("for update skip locked");
    expect(queries[0].sql).toContain("not exists");
    expect(queries[0].sql).toMatch(/"id" in\s*\(\s*select/);
    expect(queries[0].sql).toMatch(/not exists\s*\(\s*select/);
    expect(queries[0].sql).toContain('"aggregate_id"');
    expect(queries[0].sql).toContain('"created_at"');
    expect(queries[0].sql).toContain("jsonb_build_array");
    expect(queries[0].params).toContain(10);
    expect(queries[0].params).toContain("retrying");
  });

  it.each(["context", "transaction manager"] as const)(
    "uses the %s client for the entire claim",
    async (source) => {
      const rootQuery = vi.fn(async () => ({ rows: [] }));
      const clientQuery = vi.fn(async () => ({ rows: [] }));
      const db = drizzle(rootQuery) as unknown as DrizzleTransactionalEventStoreDb;
      const client = drizzle(clientQuery) as unknown as DrizzleTransactionalEventStoreDb;
      const store = new DrizzleTransactionalEventStore({
        db,
        ...(source === "transaction manager" ? { txManager: { getClient: () => client } } : {}),
      });

      await store.claimOutboxBatch(
        { limit: 2, now: new Date("2026-01-01T00:00:00.000Z"), visibilityTimeoutMs: 1_000 },
        source === "context" ? { client } : undefined,
      );

      expect(rootQuery).not.toHaveBeenCalled();
      expect(clientQuery).toHaveBeenCalledTimes(1);
    },
  );

  it("propagates a database claim failure", async () => {
    const failure = new Error("database unavailable");
    const db = drizzle(async () => {
      throw failure;
    });
    const store = new DrizzleTransactionalEventStore({
      db: db as unknown as DrizzleTransactionalEventStoreDb,
    });

    await expect(
      store.claimOutboxBatch({
        limit: 1,
        now: new Date("2026-01-01T00:00:00.000Z"),
        visibilityTimeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({ cause: failure });
  });
});
