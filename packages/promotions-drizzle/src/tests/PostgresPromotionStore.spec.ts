import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { PostgresPromotionStore } from "../index";
import type { PromotionPgDatabase } from "../index";
import { OfferPolicyConflictProblem } from "@croco/promotions-core";
import type { RegisteredOfferPolicy } from "@croco/promotions-core";

const dialect = new PgDialect();

function policy(): RegisteredOfferPolicy {
  return {
    id: "welcome-trial",
    version: 1,
    familyId: "welcome-trial",
    benefitCycleId: "2026-q4",
    benefit: { kind: "trial-credits", creditAmount: "30", walletKey: "trial" },
    eligibility: { revision: "r1" },
    startsAt: new Date("2026-09-01T00:00:00Z"),
    endsAt: new Date("2026-12-31T00:00:00Z"),
    perSubjectLimit: 1,
    budget: { total: "100", perClaim: "30" },
    stackingGroup: undefined,
    allowStacking: false,
    actorId: "operator-1",
    reason: "trial campaign",
    idempotencyKey: "policy-v1",
    registeredAt: new Date("2026-09-29T00:00:00Z"),
  };
}

function database(
  rows: Record<string, unknown>[] = [],
  seen: { sql: string; params: unknown[] }[] = [],
): PromotionPgDatabase {
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

describe("PostgresPromotionStore", () => {
  it("reads policies with revived timestamps", async () => {
    const candidate = policy();
    const store = new PostgresPromotionStore(
      database([{ document: JSON.parse(JSON.stringify(candidate)) }]),
    );
    const loaded = await store.getPolicy("welcome-trial", 1);
    expect(loaded?.startsAt).toBeInstanceOf(Date);
    expect(loaded?.registeredAt.toISOString()).toBe("2026-09-29T00:00:00.000Z");
    expect(loaded?.budget.total).toBe("100");
  });

  it("reports a policy conflict when fingerprints diverge", async () => {
    let calls = 0;
    const db: PromotionPgDatabase = {
      execute: async () => {
        calls += 1;
        return calls === 1 ? { rows: [] } : { rows: [{ fingerprint: "other" }] };
      },
      transaction: async (work) =>
        work({
          execute: db.execute,
        }),
    };
    const store = new PostgresPromotionStore(db);
    await expect(store.transact((tx) => tx.savePolicy(policy()))).rejects.toThrow(
      OfferPolicyConflictProblem,
    );
  });

  it("rejects unbounded list queries without touching PostgreSQL", async () => {
    const seen: { sql: string; params: unknown[] }[] = [];
    const store = new PostgresPromotionStore(database([], seen));
    await expect(store.listClaims({ limit: 0 })).rejects.toThrow(/limit/);
    expect(seen).toHaveLength(0);
  });

  it("counts subject claims against the family cycle with a bounded query", async () => {
    const seen: { sql: string; params: unknown[] }[] = [];
    const db: PromotionPgDatabase = {
      execute: async (statement) => {
        const query = dialect.sqlToQuery(statement);
        seen.push({ sql: query.sql, params: query.params });
        return { rows: [{ total: "2" }] };
      },
      transaction: async (work) => work({ execute: db.execute }),
    };
    const store = new PostgresPromotionStore(db);
    const total = await store.transact((tx) =>
      tx.countSubjectClaims(
        "welcome-trial",
        "2026-q4",
        {
          appId: "shop",
          environment: "production",
          tenantId: "tenant-a",
          kind: "customer",
          id: "customer-1",
        },
        ["reserved", "fulfilled"],
      ),
    );
    expect(total).toBe(2);
    expect(seen[0]?.sql).toContain("croco_promotion_claims");
    expect(seen[0]?.sql).toContain("COUNT(*)");
  });
});
