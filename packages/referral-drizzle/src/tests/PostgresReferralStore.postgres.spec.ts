import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { PostgresReferralStore, ReferralPersistenceProblem } from "../index";
import type { ReferralPgDatabase, ReferralPgExecutor } from "../index";
import { ReferralService } from "@croco/referral-core";
import {
  ReferralAttributionStateConflictProblem,
  ReferralDuplicateClaimProblem,
  ReferralQualificationRejectedProblem,
  ReferralBudgetExhaustedProblem,
  ReferralSubjectLimitReachedProblem,
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
  fulfillment: ReferralFulfillmentPort = fulfillmentOk(),
): ReferralService {
  return new ReferralService({
    store,
    tokens: {
      generateToken: () => randomUUID(),
      hashToken: (token) => createHash("sha256").update(token).digest("hex"),
    },
    novelty: () => ({ novelty: "new", reason: "new signup" }),
    qualification,
    fulfillment,
    clock: () => new Date("2026-02-01T00:00:00Z"),
  });
}

async function seed(
  service: ReferralService,
  perSubjectLimit = 10,
): Promise<{ programId: string; token: string }> {
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
    perSubjectLimit,
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
  it("claims one return across independent stores and recovers its durable receipt after restart", async () => {
    await withStores(async (pool, a, b) => {
      let entered!: () => void;
      let release!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const proceed = new Promise<void>((resolve) => {
        release = resolve;
      });
      let visible = false;
      const keys: string[] = [];
      const checks: string[] = [];
      const fulfillment: ReferralFulfillmentPort = {
        ...fulfillmentOk(),
        reverse: async ({ returnIdempotencyKey }) => {
          keys.push(returnIdempotencyKey);
          entered();
          await proceed;
          throw new Error("connection lost after durable debit");
        },
        checkReturn: async ({ returnIdempotencyKey }) => {
          checks.push(returnIdempotencyKey);
          return visible ? { returnRef: "durable-debit" } : null;
        },
      };
      const qualify: ReferralQualificationHook = () => ({
        qualified: true,
        sourceEventId: "purchase",
        qualifyingAction: "purchase",
        eligibleReason: "paid",
      });
      const service = serviceFor(a, qualify, fulfillment);
      const { token, programId } = await seed(service);
      const { attribution } = await service.claimAttribution({
        token,
        recipient: subject("recipient"),
      });
      await service.qualifyAttribution({
        attributionId: attribution.id,
        recipient: subject("recipient"),
      });
      await service.fulfillBenefits({ attributionId: attribution.id });
      const request = {
        attributionId: attribution.id,
        side: "referrer" as const,
        policy: "duplicate",
        actorId: "operator",
        reason: "return reward",
        returnIdempotencyKey: "return-a",
      };
      const first = service.returnBenefitSide(request);
      const firstSettled = Promise.allSettled([first]);
      await started;
      const restarted = serviceFor(b, qualify, fulfillment);
      try {
        await expect(
          restarted.returnBenefitSide({ ...request, returnIdempotencyKey: "return-b" }),
        ).rejects.toThrow(/pending or uncertain/);
      } finally {
        release();
      }
      expect((await firstSettled)[0].status).toBe("rejected");
      const pending = await pool.query(
        "SELECT document FROM croco_referral_benefit_intents WHERE attribution_id=$1 AND side='referrer'",
        [attribution.id],
      );
      expect(pending.rows[0]?.document).toMatchObject({
        status: "granted",
        returnOperation: { status: "unknown", idempotencyKey: "return-a" },
      });
      visible = true;
      await restarted.returnBenefitSide({
        ...request,
        returnIdempotencyKey: "return-c",
        actorId: "retry-actor",
      });
      await expect(
        service.returnBenefitSide({ ...request, returnIdempotencyKey: "return-d" }),
      ).rejects.toBeInstanceOf(ReferralAttributionStateConflictProblem);
      expect(keys).toEqual(["return-a"]);
      expect(checks).toEqual(["return-a", "return-a"]);
      const completed = await b.listBenefitIntents({ attributionId: attribution.id });
      expect(completed.find((intent) => intent.side === "referrer")).toMatchObject({
        status: "returned",
        returnOperation: { status: "returned", receipt: "durable-debit" },
      });
      expect(completed.find((intent) => intent.side === "recipient")?.status).toBe("granted");
      const audits = await pool.query(
        "SELECT document FROM croco_referral_audit WHERE action='benefit.returned'",
      );
      expect(audits.rows).toHaveLength(1);
      expect(audits.rows[0]?.document).toMatchObject({
        actorId: "operator",
        idempotencyKey: "return-a",
      });
      expect(await a.transact((tx) => tx.readBudgetReserved(programId, 1))).toBe("10");
    });
  });

  it("serializes competing qualifications across program revisions with repeatable-read defaults", async () => {
    await withStores(async (pool, storeA) => {
      const base = database(pool);
      const repeatable: ReferralPgDatabase = {
        ...base,
        transaction: (work) =>
          base.transaction(async (tx) => {
            await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);
            return work(tx);
          }),
      };
      const storeB = new PostgresReferralStore(repeatable);
      let arrived = 0;
      let release!: () => void;
      const both = new Promise<void>((resolve) => {
        release = resolve;
      });
      const qualify: ReferralQualificationHook = async () => {
        arrived += 1;
        if (arrived === 2) release();
        await both;
        return {
          qualified: true,
          sourceEventId: "purchase",
          qualifyingAction: "purchase",
          eligibleReason: "paid",
        };
      };
      const a = serviceFor(storeA, qualify);
      const b = serviceFor(storeB, qualify);
      const seeded = await seed(a);
      const firstProgram = await storeA.getProgram(seeded.programId, 1);
      expect(firstProgram).not.toBeNull();
      await a.registerProgram({
        ...firstProgram!,
        version: 2,
        perSubjectLimit: 1,
        idempotencyKey: "revision-two",
      });
      await a.registerProgram({
        ...firstProgram!,
        id: "same-family",
        familyId: firstProgram!.familyId,
        perSubjectLimit: 1,
        idempotencyKey: "other-program",
      });
      const firstLink = await a.createReferralLink({
        programId: seeded.programId,
        programVersion: 2,
        referrer: subject("shared"),
      });
      const secondLink = await b.createReferralLink({
        programId: "same-family",
        referrer: subject("shared"),
      });
      const first = await a.claimAttribution({ token: firstLink.token, recipient: subject("one") });
      const second = await b.claimAttribution({
        token: secondLink.token,
        recipient: subject("two"),
      });
      const inputs = [
        { attributionId: first.attribution.id, recipient: subject("one") },
        { attributionId: second.attribution.id, recipient: subject("two") },
      ];
      const outcomes = await Promise.allSettled([
        a.qualifyAttribution(inputs[0]),
        b.qualifyAttribution(inputs[1]),
      ]);
      const winners = outcomes.flatMap((result, index) =>
        result.status === "fulfilled" ? [index] : [],
      );
      expect(winners).toHaveLength(1);
      const winner = winners[0];
      const loser = 1 - winner;
      expect(outcomes[loser]).toMatchObject({
        status: "rejected",
        reason: expect.any(ReferralSubjectLimitReachedProblem),
      });
      expect((await storeB.getAttribution(inputs[loser].attributionId))?.state).toBe("claimed");
      expect(await b.listBenefitIntents({ attributionId: inputs[loser].attributionId })).toEqual(
        [],
      );
      expect((await a.qualifyAttribution(inputs[winner])).state).toBe("benefits-pending");
      const fulfilled = await a.fulfillBenefits({ attributionId: inputs[winner].attributionId });
      expect(fulfilled.state).toBe("fulfilled");
      expect(await b.fulfillBenefits({ attributionId: fulfilled.id })).toEqual(fulfilled);
      const rows = await pool.query(
        "SELECT state, COUNT(*)::int AS count FROM croco_referral_attributions GROUP BY state",
      );
      expect(rows.rows).toEqual(
        expect.arrayContaining([
          { state: "claimed", count: 1 },
          { state: "fulfilled", count: 1 },
        ]),
      );
    });
  });

  it.each([
    ["referrer", "stored"],
    ["referrer", "queried"],
    ["recipient", "stored"],
    ["recipient", "queried"],
  ] as const)("counts %s receipts when additional metadata is %s", async (side, metadataOn) => {
    await withStores(async (_pool, store) => {
      const service = serviceFor(store, () => ({
        qualified: true,
        sourceEventId: "purchase",
        qualifyingAction: "purchase",
        eligibleReason: "paid",
      }));
      const seeded = await seed(service, 1);
      const decorated = { ...subject("shared"), alias: "extra metadata" };
      const firstShared = metadataOn === "stored" ? decorated : subject("shared");
      const nextShared = metadataOn === "queried" ? decorated : subject("shared");
      const firstReferrer = side === "referrer" ? firstShared : subject("other-referrer");
      const firstRecipient = side === "recipient" ? firstShared : subject("one");
      const firstLink = await service.createReferralLink({
        programId: seeded.programId,
        referrer: firstReferrer,
      });
      const nextLink = await service.createReferralLink({
        programId: seeded.programId,
        referrer: nextShared,
      });
      const first = await service.claimAttribution({
        token: firstLink.token,
        recipient: firstRecipient,
      });
      const second = await service.claimAttribution({
        token: nextLink.token,
        recipient: subject("two"),
      });
      await service.qualifyAttribution({
        attributionId: first.attribution.id,
        recipient: firstRecipient,
      });
      await service.fulfillBenefits({ attributionId: first.attribution.id });
      await expect(
        service.qualifyAttribution({
          attributionId: second.attribution.id,
          recipient: subject("two"),
        }),
      ).rejects.toBeInstanceOf(ReferralSubjectLimitReachedProblem);
      expect((await store.getAttribution(second.attribution.id))?.state).toBe("claimed");
      expect(await service.listBenefitIntents({ attributionId: second.attribution.id })).toEqual(
        [],
      );
    });
  });

  it("completes competing opposite-role qualifications with additional subject metadata", async () => {
    await withStores(async (_pool, storeA, storeB) => {
      let arrived = 0;
      let release!: () => void;
      const both = new Promise<void>((resolve) => {
        release = resolve;
      });
      const qualify: ReferralQualificationHook = async () => {
        arrived += 1;
        if (arrived === 2) release();
        await both;
        return {
          qualified: true,
          sourceEventId: "purchase",
          qualifyingAction: "purchase",
          eligibleReason: "paid",
        };
      };
      const a = serviceFor(storeA, qualify);
      const b = serviceFor(storeB, qualify);
      const { programId } = await seed(a, 2);
      const decoratedA = { ...subject("a"), alias: "shown-a" };
      const decoratedB = { ...subject("b"), alias: "shown-b" };
      const firstLink = await a.createReferralLink({ programId, referrer: decoratedA });
      const secondLink = await b.createReferralLink({ programId, referrer: decoratedB });
      const first = await a.claimAttribution({ token: firstLink.token, recipient: subject("b") });
      const second = await b.claimAttribution({ token: secondLink.token, recipient: subject("a") });
      const outcomes = await Promise.all([
        a.qualifyAttribution({ attributionId: first.attribution.id, recipient: subject("b") }),
        b.qualifyAttribution({ attributionId: second.attribution.id, recipient: subject("a") }),
      ]);
      expect(outcomes.map((value) => value.state)).toEqual([
        "benefits-pending",
        "benefits-pending",
      ]);
      const intents = await a.listBenefitIntents({});
      expect(intents).toHaveLength(4);
      expect(intents.every((intent) => intent.status === "pending")).toBe(true);
    });
  });

  it("counts a qualification committed after an earlier lifecycle read under repeatable-read defaults", async () => {
    await withStores(async (pool, storeA) => {
      const verdict = {
        qualified: true as const,
        sourceEventId: "purchase",
        qualifyingAction: "purchase",
        eligibleReason: "paid",
      };
      const a = serviceFor(storeA, () => verdict);
      const { token } = await seed(a, 1);
      const first = await a.claimAttribution({ token, recipient: subject("one") });
      const second = await a.claimAttribution({ token, recipient: subject("two") });
      const base = database(pool);
      const storeB = new PostgresReferralStore({
        ...base,
        transaction: (work) =>
          base.transaction(async (tx) => {
            await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);
            return work(tx);
          }),
      });
      const b = serviceFor(storeB, async () => {
        // B has already read its attribution. A commits after that read but
        // before B counts; an unchanged repeatable-read snapshot would miss A.
        await a.qualifyAttribution({
          attributionId: first.attribution.id,
          recipient: subject("one"),
        });
        return verdict;
      });
      await expect(
        b.qualifyAttribution({ attributionId: second.attribution.id, recipient: subject("two") }),
      ).rejects.toBeInstanceOf(ReferralSubjectLimitReachedProblem);
      expect((await storeB.getAttribution(second.attribution.id))?.state).toBe("claimed");
      expect(await b.listBenefitIntents({ attributionId: second.attribution.id })).toEqual([]);
    });
  });

  it("holds subject admission through transaction end even with reordered subject properties", async () => {
    await withStores(async (pool, a) => {
      let locked!: () => void;
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const finish = new Promise<void>((resolve) => {
        release = resolve;
      });
      const work = a.transact(async (tx) => {
        expect(
          await tx.countSubjectReceipts("family", "cycle", subject("shared"), ["fulfilled"]),
        ).toBe(0);
        locked();
        await finish;
      });
      const base = database(pool);
      const contender = new PostgresReferralStore({
        ...base,
        transaction: (callback) =>
          base.transaction(async (tx) => {
            await tx.execute(sql`SET LOCAL lock_timeout = '100ms'`);
            return callback(tx);
          }),
      });
      try {
        await held;
        const who = subject("shared");
        const reordered = {
          id: who.id,
          kind: who.kind,
          tenantId: who.tenantId,
          environment: who.environment,
          appId: who.appId,
        };
        await expect(
          contender.transact((tx) =>
            tx.countSubjectReceipts("family", "cycle", reordered, ["qualified"]),
          ),
        ).rejects.toMatchObject({ cause: { code: "55P03" } });
        expect(
          await contender.transact((tx) =>
            tx.countSubjectReceipts("family", "other-cycle", who, ["fulfilled"]),
          ),
        ).toBe(0);
      } finally {
        release();
        await work;
      }
      expect(
        await contender.transact((tx) =>
          tx.countSubjectReceipts("family", "cycle", subject("shared"), ["fulfilled"]),
        ),
      ).toBe(0);
    });
  });

  it("serializes recovery ownership with an operator decision that releases the budget", async () => {
    await withStores(async (pool, a, b) => {
      const service = serviceFor(a, () => ({
        qualified: true,
        sourceEventId: "purchase",
        qualifyingAction: "purchase",
        eligibleReason: "paid",
      }));
      const { token, programId } = await seed(service);
      const { attribution } = await service.claimAttribution({
        token,
        recipient: subject("recipient"),
      });
      const qualified = await service.qualifyAttribution({
        attributionId: attribution.id,
        recipient: subject("recipient"),
      });
      const intents = await service.listBenefitIntents({ attributionId: attribution.id });
      const referrer = intents.find((intent) => intent.side === "referrer")!;
      const recipient = intents.find((intent) => intent.side === "recipient")!;
      const now = new Date("2026-02-01T00:00:00Z");
      await a.transact(async (tx) => {
        await tx.compareAndSetBenefitIntent(referrer.id, ["pending"], { status: "granting" }, now);
        await tx.compareAndSetBenefitIntent(recipient.id, ["pending"], { status: "unknown" }, now);
        await tx.compareAndSetAttribution(attribution.id, [qualified.state], {
          ...qualified,
          state: "indeterminate",
        });
      });
      let read!: () => void;
      let release!: () => void;
      const readBarrier = new Promise<void>((resolve) => {
        read = resolve;
      });
      const writeBarrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const claim = a.transact(async (tx) => {
        await tx.getAttribution(attribution.id);
        read();
        await writeBarrier;
        return tx.compareAndSetBenefitIntent(
          referrer.id,
          ["granting"],
          { status: "granting", fulfillmentAttempt: 1 },
          now,
          0,
        );
      });
      await readBarrier;
      const db = database(pool);
      const timedStore = new PostgresReferralStore({
        ...db,
        transaction: (work) =>
          db.transaction(async (tx) => {
            // A native lock deadline proves contention while the recovery read remains held.
            await tx.execute(sql`SET LOCAL lock_timeout = '100ms'`);
            return work(tx);
          }),
      });
      const decision = {
        attributionId: attribution.id,
        decision: "rejected" as const,
        actorId: "operator",
        reason: "verified no external grant",
      };
      try {
        await expect(
          serviceFor(timedStore).resolveIndeterminateBenefits(decision),
        ).rejects.toMatchObject({
          code: "referral-drizzle/persistence-failure",
          cause: { code: "55P03" },
        });
        expect((await b.getAttribution(attribution.id))?.state).toBe("indeterminate");
        expect(await b.transact((tx) => tx.readBudgetReserved(programId, 1))).toBe("10");
      } finally {
        release();
        await claim;
      }
      expect((await b.getBenefitIntent(referrer.id))?.fulfillmentAttempt).toBe(1);
      expect((await serviceFor(b).resolveIndeterminateBenefits(decision)).state).toBe("rejected");
      expect(await b.transact((tx) => tx.readBudgetReserved(programId, 1))).toBe("0");
    });
  });

  it("checks attempt ownership atomically when two SQL writers read the same granting status", async () => {
    await withStores(async (pool, a) => {
      const service = serviceFor(a, () => ({
        qualified: true,
        sourceEventId: "purchase",
        qualifyingAction: "purchase",
        eligibleReason: "paid",
      }));
      const { token } = await seed(service);
      const { attribution } = await service.claimAttribution({
        token,
        recipient: subject("recipient"),
      });
      await service.qualifyAttribution({
        attributionId: attribution.id,
        recipient: subject("recipient"),
      });
      const intent = (await service.listBenefitIntents({ attributionId: attribution.id })).find(
        (entry) => entry.side === "referrer",
      )!;
      const now = new Date("2026-02-01T00:00:00Z");
      await a.transact((tx) =>
        tx.compareAndSetBenefitIntent(intent.id, ["pending"], { status: "granting" }, now),
      );
      let bothRead!: () => void;
      let release!: () => void;
      const readBarrier = new Promise<void>((resolve) => {
        bothRead = resolve;
      });
      const writeBarrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      let reads = 0;
      const db = database(pool);
      const racing = new PostgresReferralStore({
        ...db,
        transaction: (work) =>
          db.transaction((tx) =>
            work({
              execute: async (statement) => {
                const query = dialect.sqlToQuery(statement);
                const result = await tx.execute(statement);
                if (
                  query.sql.includes(
                    "SELECT document FROM croco_referral_benefit_intents WHERE intent_id",
                  )
                ) {
                  if (++reads === 2) bothRead();
                  if (reads <= 2) await writeBarrier;
                }
                return result;
              },
            }),
          ),
      });
      const writes = [1, 2].map((attempt) =>
        racing
          .transact((tx) =>
            tx.compareAndSetBenefitIntent(
              intent.id,
              ["granting"],
              { status: "granting", fulfillmentAttempt: attempt },
              now,
              0,
            ),
          )
          .catch((error: unknown) => {
            bothRead();
            release();
            throw error;
          }),
      );
      const resultsPromise = Promise.allSettled(writes);
      await readBarrier;
      release();
      const results = await resultsPromise;
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected").map((result) => result.reason),
      ).toEqual([expect.any(ReferralAttributionStateConflictProblem)]);
      const winner = results.find((result) => result.status === "fulfilled");
      expect((await a.getBenefitIntent(intent.id))?.fulfillmentAttempt).toBe(
        winner?.status === "fulfilled" ? winner.value.fulfillmentAttempt : undefined,
      );
    });
  });

  it("fences overlapping recovery and stale completions across PostgreSQL connections", async () => {
    await withStores(async (_pool, a, b) => {
      let start!: () => void;
      let finish!: () => void;
      const started = new Promise<void>((resolve) => {
        start = resolve;
      });
      const release = new Promise<void>((resolve) => {
        finish = resolve;
      });
      let first = true;
      const calls: string[] = [];
      const payments = new Map<string, string>();
      const fulfillment: ReferralFulfillmentPort = {
        check: async () => null,
        fulfill: async ({ idempotencyKey, intent }) => {
          calls.push(idempotencyKey);
          const grantRef = payments.get(idempotencyKey) ?? `grant:${idempotencyKey}`;
          payments.set(idempotencyKey, grantRef);
          if (intent.side === "referrer" && first) {
            first = false;
            start();
            await release;
            return { outcome: "unknown", reason: "late lost response" };
          }
          return { outcome: "granted", grantRef };
        },
      };
      const recover = (store: PostgresReferralStore) =>
        new ReferralService({
          store,
          tokens: {
            generateToken: () => randomUUID(),
            hashToken: (token) => createHash("sha256").update(token).digest("hex"),
          },
          novelty: () => ({ novelty: "new", reason: "signup" }),
          qualification: () => ({
            qualified: true,
            sourceEventId: "purchase",
            qualifyingAction: "purchase",
            eligibleReason: "paid",
          }),
          fulfillment,
          clock: () => new Date("2026-02-01T00:00:00Z"),
        });
      const service = recover(a);
      const { token, programId } = await seed(service);
      const { attribution } = await service.claimAttribution({
        token,
        recipient: subject("recipient"),
      });
      await service.qualifyAttribution({
        attributionId: attribution.id,
        recipient: subject("recipient"),
      });
      const intents = await service.listBenefitIntents({ attributionId: attribution.id });
      const referrer = intents.find((intent) => intent.side === "referrer")!;
      await a.transact((tx) =>
        tx.compareAndSetBenefitIntent(
          referrer.id,
          ["pending"],
          { status: "granting" },
          new Date("2026-02-01Z"),
        ),
      );
      const old = recover(a).reconcileBenefits({ attributionId: attribution.id });
      await started;
      try {
        expect((await recover(b).reconcileBenefits({ attributionId: attribution.id })).state).toBe(
          "fulfilled",
        );
      } finally {
        finish();
        await old;
      }
      expect((await b.getBenefitIntent(referrer.id))?.status).toBe("granted");
      expect((await b.getAttribution(attribution.id))?.state).toBe("fulfilled");
      expect(payments.size).toBe(2);
      expect(calls.filter((key) => key === referrer.idempotencyKey)).toHaveLength(2);
      expect(await b.transact((tx) => tx.readBudgetReserved(programId, 1))).toBe("10");
      const recipient = intents.find((intent) => intent.side === "recipient")!;
      await expect(
        b.transact((tx) =>
          tx.compareAndSetBenefitIntent(
            recipient.id,
            ["granted"],
            { status: "unknown" },
            new Date("2026-02-01Z"),
            0,
          ),
        ),
      ).rejects.toBeInstanceOf(ReferralAttributionStateConflictProblem);
      expect((await b.getBenefitIntent(recipient.id))?.status).toBe("granted");
    });
  });

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
