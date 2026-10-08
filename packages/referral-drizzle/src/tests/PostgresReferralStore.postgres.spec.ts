import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { PostgresReferralStore } from "../index";
import type { ReferralPgDatabase, ReferralPgExecutor } from "../index";
import { ReferralService } from "@croco/referral-core";
import { ReferralBudgetExhaustedProblem } from "@croco/referral-core";
import type { ReferralFulfillmentPort, ReferralSubject } from "@croco/referral-core";

const url = process.env.REFERRALS_TEST_DATABASE_URL;
const dialect = new PgDialect();

type Client = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};
type Pool = Client & {
  connect(): Promise<Client & { release(): void }>;
  end(): Promise<void>;
};

function database(pool: Pool): ReferralPgDatabase {
  function executor(client: Client): ReferralPgExecutor {
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

function subject(id: string): ReferralSubject {
  return { appId: "shop", environment: "production", tenantId: "tenant-a", kind: "customer", id };
}

function fulfillmentOk(): ReferralFulfillmentPort {
  return {
    fulfill: async ({ idempotencyKey }) => ({
      outcome: "granted",
      grantRef: `grant:${idempotencyKey}`,
    }),
    check: async () => null,
  };
}

describe.skipIf(!url)("PostgreSQL referral budgets and attribution recovery", () => {
  it("caps concurrent reserves, replays logical keys, and recovers pending attributions", async () => {
    const require = createRequire(import.meta.url);
    const { Pool: PgPool } = require("pg") as {
      Pool: new (options: { connectionString: string; max?: number }) => Pool;
    };
    const poolA = new PgPool({ connectionString: url as string, max: 2 });
    const poolB = new PgPool({ connectionString: url as string, max: 2 });
    const migration = readFileSync(
      new URL("../../migrations/0001_referrals.up.sql", import.meta.url),
      "utf8",
    );
    try {
      await poolA.query(migration);
      const storeA = new PostgresReferralStore(database(poolA));
      const storeB = new PostgresReferralStore(database(poolB));
      const programId = `referral-${randomUUID()}`;
      const serviceFor = (store: PostgresReferralStore): ReferralService =>
        new ReferralService({
          store,
          tokens: {
            generateToken: () => randomUUID().replaceAll("-", ""),
            hashToken: (token: string) => `hash-${token.slice(0, 8)}`.padEnd(64, "0"),
          },
          novelty: () => ({ novelty: "new", reason: "synthetic live evidence" }),
          qualification: () => ({
            qualified: true,
            sourceEventId: "event-live",
            qualifyingAction: "first-purchase",
            eligibleReason: "synthetic live evidence",
          }),
          fulfillment: fulfillmentOk(),
          clock: () => new Date("2026-02-01T00:00:00Z"),
        });
      const serviceA = serviceFor(storeA);
      const serviceB = serviceFor(storeB);
      const now = new Date("2026-02-01T00:00:00Z");
      await serviceA.registerProgram({
        id: programId,
        version: 1,
        benefitCycleId: "cycle-live",
        conversionWindowMs: 30 * 24 * 60 * 60 * 1000,
        qualifyingAction: "first-purchase",
        referrerBenefit: { kind: "trial-credits", creditAmount: "5" },
        recipientBenefit: { kind: "trial-credits", creditAmount: "5" },
        startsAt: new Date("2026-01-01T00:00:00Z"),
        endsAt: new Date("2026-12-31T00:00:00Z"),
        perSubjectLimit: 1,
        budgetTotal: "10",
        budgetPerAttribution: "10",
        actorId: "operator-live",
        reason: "live budget evidence",
        idempotencyKey: `program:${programId}:1`,
      });
      const linkA = await serviceA.createReferralLink({
        programId,
        referrer: subject("referrer-live-a"),
        now,
      });
      const linkB = await serviceB.createReferralLink({
        programId,
        referrer: subject("referrer-live-b"),
        now,
      });
      const winner = await Promise.allSettled([
        serviceA.claimAttribution({
          token: linkA.token,
          recipient: subject("recipient-live"),
          now,
        }),
        serviceB.claimAttribution({
          token: linkB.token,
          recipient: subject("recipient-live"),
          now,
        }),
      ]);
      const fulfilled = winner.filter((entry) => entry.status === "fulfilled");
      expect(fulfilled).toHaveLength(1);
      const attributionId =
        fulfilled[0].status === "fulfilled" ? fulfilled[0].value.attribution.id : "";
      await serviceA.qualifyAttribution({
        attributionId,
        recipient: subject("recipient-live"),
        now,
      });
      const fulfilledAttribution = await serviceA.fulfillBenefits({ attributionId, now });
      expect(fulfilledAttribution.state).toBe("fulfilled");
      const other = await serviceB.createReferralLink({
        programId,
        referrer: subject("referrer-live-a"),
        now,
      });
      await expect(
        serviceB.claimAttribution({
          token: other.token,
          recipient: subject("recipient-other"),
          now,
        }),
      ).rejects.toBeInstanceOf(ReferralBudgetExhaustedProblem);
      const pending = await serviceA.recoverPendingAttributions({});
      expect(pending.map((entry) => entry.id)).not.toContain(attributionId);
    } finally {
      const cleanup = readFileSync(
        new URL("../../migrations/0001_referrals.down.sql", import.meta.url),
        "utf8",
      );
      await poolA.query(cleanup).catch(() => undefined);
      await poolA.end().catch(() => undefined);
      await poolB.end().catch(() => undefined);
    }
  });
});
