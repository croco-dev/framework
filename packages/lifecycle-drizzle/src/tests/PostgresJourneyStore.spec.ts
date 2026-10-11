import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { PostgresJourneyStore } from "../index";
import { episode } from "./fixture";

describe("PostgresJourneyStore", () => {
  it("rejects missing tenant and mismatched identity before database access", async () => {
    const execute = vi.fn(async () => ({ rows: [] }));
    const store = new PostgresJourneyStore({ execute });
    const value = episode();
    await expect(store.get({ ...value.scope, tenantId: "" }, value.id)).rejects.toThrow();
    await expect(
      store.compareAndSet(value.scope, value.id, 0, {
        ...value,
        revision: 1,
        scope: { ...value.scope, tenantId: "b" },
      }),
    ).rejects.toThrow();
    await expect(
      store.compareAndSet(value.scope, value.id, 0, { ...value, revision: 2 }),
    ).rejects.toThrow();
    await expect(store.claimDue(value.scope, "invalid", 1, 1)).rejects.toThrow();
    await expect(store.claimDue(value.scope, value.startedAt, 1001, 1)).rejects.toThrow();
    await expect(store.claimDue(value.scope, value.startedAt, 1, 0)).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });

  it("fails explicitly when the scoped listing exceeds its bound", async () => {
    const store = new PostgresJourneyStore({
      execute: async () => ({ rows: Array.from({ length: 1001 }, () => ({ episode: episode() })) }),
    });
    await expect(store.list(episode().scope)).rejects.toThrow("1000 episode");
  });

  it("binds tenant, revision, immutable definition and complete action intent to one atomic statement", async () => {
    const dialect = new PgDialect();
    const queries: ReturnType<PgDialect["sqlToQuery"]>[] = [];
    const store = new PostgresJourneyStore({
      execute: async (sql) => {
        queries.push(dialect.sqlToQuery(sql));
        return { rows: [{ id: "episode-1" }] };
      },
    });
    const value = episode();
    const next = {
      ...value,
      revision: 1,
      intents: [
        {
          episodeId: value.id,
          nodeId: "send",
          attemptIdentity: "attempt",
          idempotencyKey: "logical-action",
          status: "admitted" as const,
          checks: {
            goal: false,
            consent: true,
            resource: true,
            evaluatedAt: value.startedAt,
          },
          executionReference: "execution-1",
        },
      ],
    };
    expect(await store.compareAndSet(value.scope, value.id, 0, next)).toBe(true);
    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toContain("AND revision =");
    expect(queries[0]?.sql).toContain("episode->>'definitionVersion'");
    expect(queries[0]?.sql).toContain("episode->>'definitionSnapshot'");
    expect(queries[0]?.params).toContain(next.definitionSnapshot);
    expect(queries[0]?.params).toContain(JSON.stringify(next));
    expect(queries[0]?.params).toContain('["shop","test","a"]');
  });
});
