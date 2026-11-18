import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { PostgresReferralStore } from "../index";
import type { ReferralPgDatabase } from "../index";
import { ReferralProgramConflictProblem } from "@croco/referral-core";
import type { ReferralProgramDefinition } from "@croco/referral-core";

const dialect = new PgDialect();

function program(): ReferralProgramDefinition {
  return {
    id: "referral-welcome",
    version: 1,
    familyId: "referral-welcome",
    benefitCycleId: "cycle-1",
    attributionPolicy: "first-valid",
    conversionWindowMs: 30 * 24 * 60 * 60 * 1000,
    qualifyingAction: "first-purchase",
    referrerBenefit: { kind: "trial-credits", creditAmount: "10" },
    recipientBenefit: { kind: "trial-credits", creditAmount: "5" },
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: new Date("2026-12-31T00:00:00Z"),
    perSubjectLimit: 1,
    budgetTotal: "1000",
    budgetPerAttribution: "20",
    actorId: "operator-1",
    reason: "launch referral program",
    idempotencyKey: "program:referral-welcome:1",
    registeredAt: new Date("2026-01-01T00:00:00Z"),
  };
}

function database(
  rows: Record<string, unknown>[] = [],
  seen: { sql: string; params: unknown[] }[] = [],
): ReferralPgDatabase {
  return {
    execute: async (statement) => {
      const query = dialect.sqlToQuery(statement);
      seen.push({ sql: query.sql, params: query.params });
      return { rows };
    },
    transaction: async (work) => {
      throw new Error(`Unexpected transaction: ${typeof work}`);
    },
  };
}

describe("PostgresReferralStore", () => {
  it("reads programs with revived timestamps", async () => {
    const candidate = program();
    const store = new PostgresReferralStore(
      database([{ document: JSON.parse(JSON.stringify(candidate)) }]),
    );
    const loaded = await store.getProgram("referral-welcome", 1);
    expect(loaded?.startsAt).toBeInstanceOf(Date);
    expect(loaded?.registeredAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(loaded?.budgetTotal).toBe("1000");
  });

  it("reports a program conflict when fingerprints diverge", async () => {
    let calls = 0;
    const db: ReferralPgDatabase = {
      execute: async (statement) => {
        if (dialect.sqlToQuery(statement).sql.includes("SET TRANSACTION")) return { rows: [] };
        calls += 1;
        return calls === 1 ? { rows: [] } : { rows: [{ fingerprint: "other" }] };
      },
      transaction: async (work) =>
        work({
          execute: db.execute,
        }),
    };
    const store = new PostgresReferralStore(db);
    await expect(store.transact((tx) => tx.saveProgram(program()))).rejects.toThrow(
      ReferralProgramConflictProblem,
    );
  });

  it("rejects unbounded list queries without touching PostgreSQL", async () => {
    const seen: { sql: string; params: unknown[] }[] = [];
    const store = new PostgresReferralStore(database([], seen));
    await expect(store.listAttributions({ limit: 0 })).rejects.toThrow(/limit/);
    expect(seen).toHaveLength(0);
  });

  it("binds a recovery request before waiting for a pooled connection", async () => {
    const seen: { sql: string; params: unknown[] }[] = [];
    const delegate = database([], seen);
    const store = new PostgresReferralStore({
      ...delegate,
      transaction: async (work) => {
        await Promise.resolve();
        return work({
          execute: (query) =>
            dialect.sqlToQuery(query).sql.includes("pg_client_encoding()")
              ? Promise.resolve({
                  rows: [{ server_encoding: "UTF8", client_encoding: "UTF8" }],
                })
              : delegate.execute(query),
        });
      },
    });
    const scope = { appId: "shop", environment: "production", tenantId: "tenant-first" };
    const filter = {
      scope,
      referrer: { ...scope, kind: "customer", id: "referrer-first" },
      after: "cursor-first",
    };
    const pending = store.listAttributionsPage(filter);
    scope.tenantId = "tenant-second";
    filter.referrer.id = "referrer-second";
    filter.after = "cursor-second";

    await expect(pending).resolves.toEqual({ attributions: [], nextCursor: null });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.params).toContain(JSON.stringify({ ...scope, tenantId: "tenant-first" }));
    expect(seen[0]?.params).toContain(
      JSON.stringify({
        ...scope,
        tenantId: "tenant-first",
        kind: "customer",
        id: "referrer-first",
      }),
    );
    expect(seen[0]?.params).toContain("cursor-first");
    expect(JSON.stringify(seen[0]?.params)).not.toContain("-second");
  });

  it("counts subject receipts against the family cycle with a bounded query", async () => {
    const seen: { sql: string; params: unknown[] }[] = [];
    const db: ReferralPgDatabase = {
      execute: async (statement) => {
        const query = dialect.sqlToQuery(statement);
        seen.push({ sql: query.sql, params: query.params });
        return { rows: [{ total: "2" }] };
      },
      transaction: async (work) => work({ execute: db.execute }),
    };
    const store = new PostgresReferralStore(db);
    const total = await store.transact((tx) =>
      tx.countSubjectReceipts(
        "referral-welcome",
        "cycle-1",
        {
          appId: "shop",
          environment: "production",
          tenantId: "tenant-a",
          kind: "customer",
          id: "customer-1",
        },
        ["claimed", "fulfilled"],
      ),
    );
    expect(total).toBe(2);
    expect(seen.at(-1)?.sql).toContain("croco_referral_attributions");
    expect(seen.at(-1)?.sql).toContain("COUNT(*)");
  });

  it("resolves link lookups by token hash without leaking the raw token", async () => {
    const seen: { sql: string; params: unknown[] }[] = [];
    const link = {
      id: "link-1",
      tokenHash: "a".repeat(64),
      programId: "referral-welcome",
      programVersion: 1,
      familyId: "referral-welcome",
      benefitCycleId: "cycle-1",
      referrer: {
        appId: "shop",
        environment: "production",
        tenantId: "tenant-a",
        kind: "customer",
        id: "referrer-1",
      },
      createdAt: new Date("2026-02-01T00:00:00Z"),
      expiresAt: new Date("2026-05-01T00:00:00Z"),
    };
    const store = new PostgresReferralStore(
      database([{ document: JSON.parse(JSON.stringify(link)) }], seen),
    );
    const loaded = await store.getLinkByTokenHash(link.tokenHash);
    expect(loaded?.id).toBe("link-1");
    expect(seen[0]?.sql).toContain("token_hash");
  });
});
