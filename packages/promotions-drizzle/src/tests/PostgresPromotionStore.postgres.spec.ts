import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { PostgresPromotionStore } from "../index";
import type { PromotionPgDatabase, PromotionPgExecutor } from "../index";
import { OfferService } from "@croco/promotions-core";
import {
  OfferBudgetExhaustedProblem,
  OfferDuplicateClaimProblem,
  OfferStackingConflictProblem,
  OfferSubjectLimitReachedProblem,
} from "@croco/promotions-core";
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

function database(
  pool: Pool,
  afterQuery?: (text: string, client: Client) => Promise<void>,
  repeatableRead = false,
): PromotionPgDatabase {
  function executor(client: Client): PromotionPgExecutor {
    return {
      execute: async (statement) => {
        const query = dialect.sqlToQuery(statement);
        const result = await client.query(query.sql, query.params);
        await afterQuery?.(query.sql, client);
        return result;
      },
    };
  }
  return {
    ...executor(pool),
    transaction: async (work) => {
      const client = await pool.connect();
      try {
        await client.query(repeatableRead ? "BEGIN ISOLATION LEVEL REPEATABLE READ" : "BEGIN");
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

function latch() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe.skipIf(!url)("PostgreSQL concurrent promotion reservations", () => {
  it.each([
    "logical replay",
    "logical replay with repeatable read",
    "logical conflict",
    "family limit",
    "stacking group",
    "allowed stacking",
    "independent subject",
  ] as const)("preserves reservation invariants for %s", async (scenario) => {
    const require = createRequire(import.meta.url);
    const { Pool: PgPool } = require("pg") as {
      Pool: new (options: { connectionString: string; max: number }) => Pool;
    };
    const poolA = new PgPool({ connectionString: url as string, max: 1 });
    const poolB = new PgPool({ connectionString: url as string, max: 1 });
    const observer = new PgPool({ connectionString: url as string, max: 1 });
    const reached = latch();
    const resume = latch();
    let armed = false;
    let secondRead = false;
    let secondPid = 0;
    const storeA = new PostgresPromotionStore(
      database(poolA, async (text) => {
        if (armed && text.includes("COUNT(*)")) {
          armed = false;
          reached.release();
          await resume.promise;
        }
      }),
    );
    const storeB = new PostgresPromotionStore(
      database(
        poolB,
        async (text, client) => {
          // Capture the backend before a reservation can wait on a lock.
          const pid = await client.query("SELECT pg_backend_pid() AS pid");
          secondPid = Number(pid.rows[0]?.pid);
          if (text.includes("COUNT(*)")) secondRead = true;
        },
        scenario.endsWith("repeatable read"),
      ),
    );
    const now = new Date("2026-10-01T00:00:00Z");
    const subject: OfferSubject = {
      appId: "shop",
      environment: "test",
      tenantId: "tenant-a",
      kind: "customer",
      id: "one",
    };
    const port: OfferFulfillmentPort = {
      fulfill: async () => ({ outcome: "granted", grantRef: "unused" }),
      check: async () => null,
    };
    const serviceA = new OfferService({ store: storeA, fulfillment: port, clock: () => now });
    const serviceB = new OfferService({ store: storeB, fulfillment: port, clock: () => now });
    let first: ReturnType<typeof serviceA.reserveClaim> | undefined;
    let second: ReturnType<typeof serviceB.reserveClaim> | undefined;
    await observer.query(
      readFileSync(new URL("../../migrations/0001_promotions.up.sql", import.meta.url), "utf8"),
    );
    try {
      const policy = {
        id: "first",
        familyId: "family",
        version: 1,
        benefitCycleId: "cycle",
        benefit: { kind: "trial-credits" as const, creditAmount: "30", walletKey: "trial" },
        eligibility: { revision: "r1" },
        startsAt: new Date("2026-09-01T00:00:00Z"),
        endsAt: new Date("2026-12-31T00:00:00Z"),
        perSubjectLimit: scenario === "family limit" ? 1 : 10,
        budget: { total: "300", perClaim: "30" },
        stackingGroup: scenario.includes("stacking") ? "welcome" : undefined,
        allowStacking: scenario === "allowed stacking",
        actorId: "operator",
        reason: "reservation race",
        idempotencyKey: "policy-first",
      };
      await serviceA.registerPolicy(policy);
      const separatePolicy = ["family limit", "stacking group", "allowed stacking"].includes(
        scenario,
      );
      if (separatePolicy) {
        await serviceA.registerPolicy({
          ...policy,
          id: "second",
          idempotencyKey: "policy-second",
          familyId: scenario === "family limit" ? "family" : "other-family",
        });
      }
      const otherSubject =
        scenario === "independent subject" ? { ...subject, tenantId: "tenant-b" } : subject;
      const quoteA = await serviceA.quoteOffer({
        policy: { id: "first", version: 1 },
        subject,
        now,
      });
      const quoteB = scenario.startsWith("logical replay")
        ? quoteA
        : await serviceA.quoteOffer({
            policy: { id: separatePolicy ? "second" : "first", version: 1 },
            subject: otherSubject,
            now,
          });
      // Hold A after its actual COUNT has observed absence. B either observes
      // the same absence on the broken adapter or waits on A's database lock.
      armed = true;
      first = serviceA.reserveClaim({ quoteId: quoteA.id, subject, logicalKey: "key-a", now });
      const firstResult = Promise.allSettled([first]);
      await reached.promise;
      secondRead = false;
      secondPid = 0;
      second = serviceB.reserveClaim({
        quoteId: quoteB.id,
        subject: otherSubject,
        logicalKey: scenario.startsWith("logical") ? "key-a" : "key-b",
        now,
      });
      // Observe rejection immediately, while retaining the result for assertions.
      const secondResult = Promise.allSettled([second]);
      if (scenario === "independent subject") {
        await vi.waitFor(async () => {
          expect(
            (await observer.query("SELECT COUNT(*)::int AS count FROM croco_promotion_claims"))
              .rows[0]?.count,
          ).toBe(1);
        });
      } else {
        await vi.waitFor(async () => {
          if (secondRead) return;
          expect(secondPid).toBeGreaterThan(0);
          const blocked = await observer.query(
            "SELECT cardinality(pg_blocking_pids($1)) AS count",
            [secondPid],
          );
          expect(Number(blocked.rows[0]?.count)).toBeGreaterThan(0);
        });
      }
      resume.release();
      const outcomes = [...(await firstResult), ...(await secondResult)];
      const successes = outcomes.filter((result) => result.status === "fulfilled");
      const failures = outcomes.filter((result) => result.status === "rejected");
      if (["logical conflict", "family limit", "stacking group"].includes(scenario)) {
        expect(successes).toHaveLength(1);
        expect(successes[0]?.value.created).toBe(true);
        expect(failures).toHaveLength(1);
        const problem =
          scenario === "logical conflict"
            ? OfferDuplicateClaimProblem
            : scenario === "family limit"
              ? OfferSubjectLimitReachedProblem
              : OfferStackingConflictProblem;
        expect(failures[0]?.reason).toBeInstanceOf(problem);
      } else {
        expect(failures).toHaveLength(0);
        expect(successes).toHaveLength(2);
        expect(successes.filter((result) => result.value.created)).toHaveLength(
          scenario.startsWith("logical replay") ? 1 : 2,
        );
        if (scenario.startsWith("logical replay")) {
          expect(successes[0]?.value.claim.id).toBe(successes[1]?.value.claim.id);
        }
      }
      const expectedCount = ["allowed stacking", "independent subject"].includes(scenario) ? 2 : 1;
      const totals = await observer.query(`SELECT
        (SELECT COUNT(*)::int FROM croco_promotion_claims) AS claims,
        (SELECT SUM(budget_reserved)::text FROM croco_promotion_policies) AS reserved,
        (SELECT SUM((document->'budgetReservation'->>'amount')::numeric)::text FROM croco_promotion_claims) AS claim_total`);
      expect(totals.rows[0]).toEqual({
        claims: expectedCount,
        reserved: String(expectedCount * 30),
        claim_total: String(expectedCount * 30),
      });
      const expired = await serviceA.expireOverdueClaims({
        now: new Date("2026-10-02T00:00:00Z"),
        limit: 10,
      });
      expect(expired).toHaveLength(expectedCount);
      expect(
        (
          await observer.query(
            "SELECT SUM(budget_reserved)::text AS reserved FROM croco_promotion_policies",
          )
        ).rows[0]?.reserved,
      ).toBe("0");
    } finally {
      resume.release();
      await Promise.allSettled([first, second]);
      await observer.query(
        readFileSync(new URL("../../migrations/0001_promotions.down.sql", import.meta.url), "utf8"),
      );
      await Promise.all([poolA.end(), poolB.end(), observer.end()]);
    }
  });
});
