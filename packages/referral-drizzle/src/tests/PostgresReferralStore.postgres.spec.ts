import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { PostgresReferralStore, ReferralPersistenceProblem } from "../index";
import type { ReferralPgDatabase, ReferralPgExecutor } from "../index";
import { ReferralService } from "@croco/referral-core";
import {
  ReferralAttributionStateConflictProblem,
  ReferralDuplicateClaimProblem,
  ReferralQualificationRejectedProblem,
  ReferralBudgetExhaustedProblem,
} from "@croco/referral-core";
import type {
  ReferralFulfillmentPort,
  ReferralSubject,
  ReferralQualificationHook,
} from "@croco/referral-core";

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

async function withStores(
  work: (pool: Pool, a: PostgresReferralStore, b: PostgresReferralStore) => Promise<void>,
): Promise<void> {
  const require = createRequire(import.meta.url);
  const { Pool: PgPool } = require("pg") as {
    Pool: new (options: { connectionString: string; max: number }) => Pool;
  };
  const pool = new PgPool({ connectionString: url as string, max: 4 });
  try {
    await pool.query(
      readFileSync(new URL("../../migrations/0001_referrals.up.sql", import.meta.url), "utf8"),
    );
    await work(
      pool,
      new PostgresReferralStore(database(pool)),
      new PostgresReferralStore(database(pool)),
    );
  } finally {
    await pool.query(
      readFileSync(new URL("../../migrations/0001_referrals.down.sql", import.meta.url), "utf8"),
    );
    await pool.end();
  }
}

function serviceFor(
  store: PostgresReferralStore,
  qualification: ReferralQualificationHook = () => ({ qualified: false, reason: "no purchase" }),
): ReferralService {
  return new ReferralService({
    store,
    tokens: {
      generateToken: () => randomUUID(),
      hashToken: (token) => createHash("sha256").update(token).digest("hex"),
    },
    novelty: () => ({ novelty: "new", reason: "new signup" }),
    qualification,
    fulfillment: fulfillmentOk(),
    clock: () => new Date("2026-02-01T00:00:00Z"),
  });
}

async function seed(service: ReferralService): Promise<{ programId: string; token: string }> {
  const programId = `referral-${randomUUID()}`;
  await service.registerProgram({
    id: programId,
    version: 1,
    benefitCycleId: "cycle",
    conversionWindowMs: 86400000,
    qualifyingAction: "purchase",
    referrerBenefit: { kind: "trial-credits", creditAmount: "7" },
    recipientBenefit: { kind: "trial-credits", creditAmount: "3" },
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: new Date("2026-12-31T00:00:00Z"),
    perSubjectLimit: 10,
    budgetTotal: "100",
    budgetPerAttribution: "10",
    actorId: "operator",
    reason: "regression evidence",
    idempotencyKey: programId,
  });
  const { token } = await service.createReferralLink({ programId, referrer: subject("referrer") });
  return { programId, token };
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
            hashToken: (token: string) => createHash("sha256").update(token).digest("hex"),
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
        referrer: subject("referrer-live-c"),
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
  it("commits rejected state, releases only its budget, and records one audit across retries", async () => {
    await withStores(async (pool, store) => {
      const service = serviceFor(store);
      const { programId, token } = await seed(service);
      const claim = await service.claimAttribution({
        token,
        recipient: subject("rejected"),
        attributionId: "rejected",
      });
      await service.claimAttribution({ token, recipient: subject("still-reserved") });
      await expect(
        service.qualifyAttribution({
          attributionId: claim.attribution.id,
          recipient: subject("rejected"),
        }),
      ).rejects.toBeInstanceOf(ReferralQualificationRejectedProblem);
      expect(await store.getAttribution("rejected")).toMatchObject({ state: "rejected" });
      expect(await store.transact((tx) => tx.readBudgetReserved(programId, 1))).toBe("10");
      await expect(
        service.qualifyAttribution({ attributionId: "rejected", recipient: subject("rejected") }),
      ).rejects.toBeInstanceOf(ReferralAttributionStateConflictProblem);
      expect(await store.transact((tx) => tx.readBudgetReserved(programId, 1))).toBe("10");
      const audits = await pool.query(
        "SELECT action FROM croco_referral_audit WHERE target_id = $1 AND action = 'attribution.rejected'",
        ["rejected"],
      );
      expect(audits.rows).toHaveLength(1);
    });
  });

  it("persists the competing held claim and replays it without replacing the first winner", async () => {
    await withStores(async (pool, storeA, storeB) => {
      // Both callers must see no first claim before either inserts.
      let arrivals = 0;
      let release: () => void = () => undefined;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const racingService = (store: PostgresReferralStore) =>
        new ReferralService({
          store,
          tokens: {
            generateToken: () => randomUUID(),
            hashToken: (token) => createHash("sha256").update(token).digest("hex"),
          },
          novelty: async () => {
            arrivals += 1;
            if (arrivals === 2) release();
            await barrier;
            return { novelty: "new", reason: "new signup" };
          },
          fulfillment: fulfillmentOk(),
          clock: () => new Date("2026-02-01T00:00:00Z"),
        });
      const serviceA = racingService(storeA);
      const serviceB = racingService(storeB);
      const { programId, token } = await seed(serviceA);
      const second = await serviceB.createReferralLink({
        programId,
        referrer: subject("other-referrer"),
      });
      const inputs = [
        { token, recipient: subject("race"), attributionId: "race-a" },
        { token: second.token, recipient: subject("race"), attributionId: "race-b" },
      ];
      const results = await Promise.allSettled([
        serviceA.claimAttribution(inputs[0]),
        serviceB.claimAttribution(inputs[1]),
      ]);
      expect(results.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
      const loser = results[0].status === "rejected" ? 0 : 1;
      expect(results[loser]).toMatchObject({
        status: "rejected",
        reason: expect.any(ReferralDuplicateClaimProblem),
      });
      expect(await storeA.getAttribution(inputs[loser].attributionId)).toMatchObject({
        state: "held",
        holdReason: "duplicate-claim",
      });
      const winner = await storeA.getAttribution(inputs[1 - loser].attributionId);
      expect(winner).toMatchObject({
        state: "claimed",
        referrer: { id: loser === 0 ? "other-referrer" : "referrer" },
      });
      await expect(
        serviceFor(storeB).qualifyAttribution({
          attributionId: inputs[loser].attributionId,
          recipient: subject("race"),
        }),
      ).rejects.toBeInstanceOf(ReferralDuplicateClaimProblem);
      const replay = await serviceFor(storeB).claimAttribution(inputs[loser]);
      expect(replay).toMatchObject({
        created: false,
        firstValid: false,
        attribution: { state: "held" },
      });
      expect(
        await storeA.transact((tx) =>
          tx.getFirstAttributionForRecipient(programId, subject("race")),
        ),
      ).toEqual(winner);
      expect(await storeA.transact((tx) => tx.readBudgetReserved(programId, 1))).toBe("10");
      const audits = await pool.query(
        "SELECT action FROM croco_referral_audit WHERE target_id = $1 AND action = 'attribution.held-duplicate'",
        [inputs[loser].attributionId],
      );
      expect(audits.rows).toHaveLength(1);
    });
  });

  it("rolls back rejected state and budget release when its SQL audit write fails", async () => {
    await withStores(async (pool, store) => {
      const service = serviceFor(store);
      const { programId, token } = await seed(service);
      await service.claimAttribution({
        token,
        recipient: subject("sql-failure"),
        attributionId: "sql-failure",
      });
      // A real SQL constraint failure after the state and budget writes.
      await pool.query(
        "ALTER TABLE croco_referral_audit ADD CONSTRAINT reject_test_audit CHECK (action <> 'attribution.rejected')",
      );
      await expect(
        service.qualifyAttribution({
          attributionId: "sql-failure",
          recipient: subject("sql-failure"),
        }),
      ).rejects.toBeInstanceOf(ReferralPersistenceProblem);
      expect(await store.getAttribution("sql-failure")).toMatchObject({ state: "claimed" });
      expect(await store.transact((tx) => tx.readBudgetReserved(programId, 1))).toBe("10");
      const audits = await pool.query(
        "SELECT action FROM croco_referral_audit WHERE target_id = $1 AND action = 'attribution.rejected'",
        ["sql-failure"],
      );
      expect(audits.rows).toHaveLength(0);
    });
  });
});
