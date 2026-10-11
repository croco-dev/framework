import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { PostgresPromotionStore } from "../index";
import type { PromotionPgDatabase, PromotionPgExecutor } from "../index";
import { OfferService } from "@croco/promotions-core";
import { OfferBudgetExhaustedProblem } from "@croco/promotions-core";
import type { OfferFulfillmentPort, OfferSubject } from "@croco/promotions-core";

const url = process.env.PROMOTIONS_TEST_DATABASE_URL;
const dialect = new PgDialect();

type Client = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};
type Pool = Client & {
  connect(): Promise<Client & { release(): void }>;
  end(): Promise<void>;
};

function database(pool: Pool): PromotionPgDatabase {
  function executor(client: Client): PromotionPgExecutor {
    return {
      execute: (statement) => {
        const query = dialect.sqlToQuery(statement);
        return client.query(query.sql, query.params);
      },
    };
  }
  return {
    ...executor(pool),
    transaction: async (work) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(executor(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

describe.skipIf(!url)("PostgreSQL promotion budgets and claim recovery", () => {
  it("caps concurrent reserves, replays logical keys, and recovers pending claims", async () => {
    const require = createRequire(import.meta.url);
    const { Pool: PgPool } = require("pg") as {
      Pool: new (options: { connectionString: string; max?: number }) => Pool;
    };
    const poolA = new PgPool({ connectionString: url as string, max: 2 });
    const poolB = new PgPool({ connectionString: url as string, max: 2 });
    const migration = readFileSync(
      new URL("../../migrations/0001_promotions.up.sql", import.meta.url),
      "utf8",
    );
    const down = readFileSync(
      new URL("../../migrations/0001_promotions.down.sql", import.meta.url),
      "utf8",
    );
    await poolA.query(migration);
    const now = new Date("2026-09-29T00:00:00Z");
    const subject: OfferSubject = {
      appId: "shop",
      environment: "test",
      tenantId: "tenant-a",
      kind: "customer",
      id: "customer-1",
    };
    const grants: string[] = [];
    const port: OfferFulfillmentPort = {
      fulfill: async ({ idempotencyKey, claim }) => {
        grants.push(idempotencyKey);
        return { outcome: "granted", grantRef: `grant:${claim.id}` };
      },
      check: async () => null,
    };
    const serviceA = new OfferService({
      store: new PostgresPromotionStore(database(poolA)),
      fulfillment: port,
      clock: () => new Date(now.getTime()),
    });
    try {
      const policyId = `trial-${randomUUID()}`;
      await serviceA.registerPolicy({
        id: policyId,
        version: 1,
        benefitCycleId: "2026-q4",
        benefit: { kind: "trial-credits", creditAmount: "30", walletKey: "trial" },
        eligibility: { revision: "r1" },
        startsAt: new Date("2026-09-01T00:00:00Z"),
        endsAt: new Date("2026-12-31T00:00:00Z"),
        perSubjectLimit: 10,
        budget: { total: "100", perClaim: "30" },
        actorId: "operator-1",
        reason: "postgres budget proof",
        idempotencyKey: `policy-${policyId}`,
      });
      const quote = await serviceA.quoteOffer({
        policy: { id: policyId, version: 1 },
        subject,
        now,
      });
      const serviceB = new OfferService({
        store: new PostgresPromotionStore(database(poolB)),
        fulfillment: port,
        clock: () => new Date(now.getTime()),
      });
      const attempts = await Promise.allSettled(
        ["a", "b", "c", "d"].map((key, index) =>
          (index % 2 === 0 ? serviceA : serviceB).reserveClaim({
            quoteId: quote.id,
            subject,
            logicalKey: `${policyId}:${key}`,
            now,
          }),
        ),
      );
      expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(3);
      const exhausted = attempts.filter((result) => result.status === "rejected");
      expect(exhausted).toHaveLength(1);
      if (exhausted[0]?.status === "rejected") {
        expect(exhausted[0].reason).toBeInstanceOf(OfferBudgetExhaustedProblem);
      }
      const replayed = await serviceB.reserveClaim({
        quoteId: quote.id,
        subject,
        logicalKey: `${policyId}:a`,
        now,
      });
      expect(replayed.created).toBe(false);
      const pending = await serviceA.recoverPendingClaims({ limit: 10 });
      expect(pending.length).toBeGreaterThanOrEqual(3);
      const fulfilled = await serviceA.fulfillClaim({ claimId: pending[0]?.id ?? "", now });
      expect(fulfilled.state).toBe("fulfilled");
      expect(grants).toHaveLength(1);
      const reread = await serviceB.getClaim(pending[0]?.id ?? "");
      expect(reread?.state).toBe("fulfilled");
      expect(reread?.grantRef).toBe(`grant:${pending[0]?.id ?? ""}`);
    } finally {
      await poolA.query(down);
      await poolA.end();
      await poolB.end();
    }
  });
});
