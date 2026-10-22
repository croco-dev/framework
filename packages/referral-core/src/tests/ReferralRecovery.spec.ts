import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CreditLedgerService, InMemoryCreditLedgerStore } from "@croco/credits-core";
import { FirstPartyReferralCreditGrantAdapter } from "../credit-grant";
import { InMemoryReferralStore } from "../libs/InMemoryReferralStore";
import { ReferralService } from "../libs/ReferralService";
import type { ReferralFulfillmentPort, ReferralFulfillmentResult } from "../libs/types";

const now = new Date("2026-02-01T00:00:00Z");
const scope = { appId: "shop", environment: "test", tenantId: "tenant", kind: "customer" };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function claimSetup(fulfillment: ReferralFulfillmentPort, unknownNovelty = false) {
  const store = new InMemoryReferralStore();
  const restart = () =>
    new ReferralService({
      store,
      tokens: {
        generateToken: () => "test-token",
        hashToken: (token) => createHash("sha256").update(token).digest("hex"),
      },
      novelty: () => ({ novelty: unknownNovelty ? "unknown" : "new", reason: "signup" }),
      qualification: () => ({
        qualified: true,
        sourceEventId: "purchase",
        qualifyingAction: "purchase",
        eligibleReason: "paid",
      }),
      fulfillment,
      clock: () => now,
    });
  const service = restart();
  await service.registerProgram({
    id: "program",
    version: 1,
    benefitCycleId: "cycle",
    conversionWindowMs: 86400000,
    qualifyingAction: "purchase",
    referrerBenefit: { kind: "trial-credits", creditAmount: "7" },
    recipientBenefit: { kind: "trial-credits", creditAmount: "3" },
    startsAt: new Date("2026-01-01Z"),
    endsAt: new Date("2027-01-01Z"),
    perSubjectLimit: 1,
    budgetTotal: "20",
    budgetPerAttribution: "10",
    actorId: "operator",
    reason: "launch",
    idempotencyKey: "program",
  });
  const recipient = { ...scope, id: "recipient" };
  const { token } = await service.createReferralLink({
    programId: "program",
    referrer: { ...scope, id: "referrer" },
  });
  const { attribution } = await service.claimAttribution({ token, recipient });
  return { service, store, restart, attributionId: attribution.id, recipient };
}

async function setup(fulfillment: ReferralFulfillmentPort) {
  const seeded = await claimSetup(fulfillment);
  const { service, store, attributionId, recipient } = seeded;
  await service.qualifyAttribution({ attributionId, recipient });
  const intents = await service.listBenefitIntents({ attributionId });
  const referrer = intents.find((intent) => intent.side === "referrer")!;
  await store.transact((tx) =>
    tx.compareAndSetBenefitIntent(referrer.id, ["pending"], { status: "granting" }, now),
  );
  return { ...seeded, referrer };
}

function port() {
  const payments = new Map<string, string>();
  const calls: string[] = [];
  const fulfillment: ReferralFulfillmentPort = {
    fulfill: async ({ idempotencyKey }) => {
      calls.push(idempotencyKey);
      const receipt = payments.get(idempotencyKey) ?? `receipt:${idempotencyKey}`;
      payments.set(idempotencyKey, receipt);
      return { outcome: "granted", grantRef: receipt };
    },
    check: async ({ idempotencyKey }) => {
      const grantRef = payments.get(idempotencyKey);
      return grantRef ? { grantRef } : null;
    },
  };
  return { fulfillment, calls, payments };
}

describe("Referral granting recovery", () => {
  it.each([false, true])(
    "does not grant unqualified attributions (unknown novelty: %s)",
    async (unknownNovelty) => {
      const { fulfillment, calls } = port();
      const { restart, store, attributionId } = await claimSetup(fulfillment, unknownNovelty);
      expect((await restart().reconcileBenefits({ attributionId })).state).toBe(
        unknownNovelty ? "held" : "claimed",
      );
      expect(await store.listBenefitIntents({ attributionId })).toEqual([]);
      expect(calls).toEqual([]);
    },
  );

  it("finishes both sides after restart between granting persistence and the external call", async () => {
    const { fulfillment, calls, payments } = port();
    const { restart, attributionId, referrer } = await setup(fulfillment);
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("fulfilled");
    expect(calls).toContain(referrer.idempotencyKey);
    expect(payments.size).toBe(2);
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("fulfilled");
    expect(calls).toHaveLength(2);
  });

  it("uses a durable receipt after response loss without invoking fulfillment for that side", async () => {
    const { fulfillment, calls, payments } = port();
    const { restart, attributionId, referrer } = await setup(fulfillment);
    payments.set(referrer.idempotencyKey, "previous-grant");
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("fulfilled");
    expect(calls).not.toContain(referrer.idempotencyKey);
    expect(payments.size).toBe(2);
  });

  it.each(["unknown", "failed", "skipped", "granted", "throw"] as const)(
    "fences a late %s response after a second recovery completes the same idempotent grant",
    async (late) => {
      const { fulfillment, calls, payments } = port();
      const started = deferred<void>();
      const finish = deferred<ReferralFulfillmentResult>();
      let first = true;
      const original = fulfillment.fulfill;
      fulfillment.fulfill = async (input) => {
        if (input.intent.side === "referrer" && first) {
          first = false;
          // The external system has committed, but its response and check visibility lag.
          const result = await original(input);
          started.resolve();
          await finish.promise;
          if (late === "throw") throw new Error("lost response");
          return late === "granted" ? result : { outcome: late, reason: "late result" };
        }
        return original(input);
      };
      fulfillment.check = async () => null;
      const { restart, store, attributionId, referrer } = await setup(fulfillment);
      const old = restart().reconcileBenefits({ attributionId });
      const settled = old.then(
        () => null,
        (error: unknown) => error,
      );
      await started.promise;
      expect((await restart().reconcileBenefits({ attributionId })).state).toBe("fulfilled");
      finish.resolve({ outcome: "unknown", reason: "release" });
      await settled;
      expect((await store.getBenefitIntent(referrer.id))?.status).toBe("granted");
      expect((await store.getAttribution(attributionId))?.state).toBe("fulfilled");
      expect(payments.size).toBe(2);
      expect(calls.filter((key) => key === referrer.idempotencyKey)).toHaveLength(2);
      expect(await store.readBudgetReserved("program", 1)).toBe("10");
      expect(
        (await store.listAudits()).filter((entry) => entry.action === "benefit.granted"),
      ).toHaveLength(2);
    },
  );

  it("fences a superseded response while the current recovery is still granting", async () => {
    const { fulfillment, payments } = port();
    const firstStarted = deferred<void>();
    const secondStarted = deferred<void>();
    const firstFinish = deferred<ReferralFulfillmentResult>();
    const secondFinish = deferred<ReferralFulfillmentResult>();
    const original = fulfillment.fulfill;
    let attempts = 0;
    fulfillment.fulfill = async (input) => {
      if (input.intent.side !== "referrer") return original(input);
      const attempt = ++attempts;
      const result = await original(input);
      if (attempt === 1) {
        firstStarted.resolve();
        return firstFinish.promise;
      }
      secondStarted.resolve();
      await secondFinish.promise;
      return result;
    };
    fulfillment.check = async () => null;
    const { restart, store, attributionId, referrer } = await setup(fulfillment);
    const old = restart().reconcileBenefits({ attributionId });
    await firstStarted.promise;
    const current = restart().reconcileBenefits({ attributionId });
    await secondStarted.promise;
    firstFinish.resolve({ outcome: "unknown", reason: "superseded timeout" });
    await old;
    expect((await store.getBenefitIntent(referrer.id))?.status).toBe("granting");
    secondFinish.resolve({ outcome: "granted", grantRef: "release" });
    expect((await current).state).toBe("fulfilled");
    expect(payments.size).toBe(2);
    expect(await store.readBudgetReserved("program", 1)).toBe("10");
  });

  it("lets only one of two recoveries claim the same observed granting attempt", async () => {
    const { fulfillment, calls, payments } = port();
    const checksStarted = deferred<void>();
    const releaseChecks = deferred<void>();
    let checks = 0;
    fulfillment.check = async () => {
      if (++checks === 2) checksStarted.resolve();
      await releaseChecks.promise;
      return null;
    };
    const { restart, attributionId, referrer } = await setup(fulfillment);
    const left = restart().reconcileBenefits({ attributionId });
    const right = restart().reconcileBenefits({ attributionId });
    await checksStarted.promise;
    releaseChecks.resolve();
    const results = await Promise.all([left, right]);
    expect(results.some((result) => result.state === "fulfilled")).toBe(true);
    expect(calls.filter((key) => key === referrer.idempotencyKey)).toHaveLength(1);
    expect(payments.size).toBe(2);
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("fulfilled");
  });

  it("posts one real ledger grant per side when a response is lost and recovery overlaps", async () => {
    const ledger = new CreditLedgerService({
      store: new InMemoryCreditLedgerStore(),
      eventDelivery: "development",
      clock: () => now,
    });
    const referrerAccount = (
      await ledger.openAccount({
        tenantId: "tenant",
        idempotencyKey: "open-referrer",
        walletKey: "referrer",
        reference: { type: "test", id: "referrer" },
      })
    ).account.id;
    const recipientAccount = (
      await ledger.openAccount({
        tenantId: "tenant",
        idempotencyKey: "open-recipient",
        walletKey: "recipient",
        reference: { type: "test", id: "recipient" },
      })
    ).account.id;
    const adapter = new FirstPartyReferralCreditGrantAdapter({
      ledger,
      resolveAccount: ({ side }) => (side === "referrer" ? referrerAccount : recipientAccount),
    });
    const started = deferred<void>();
    const release = deferred<void>();
    let first = true;
    const fulfillment: ReferralFulfillmentPort = {
      check: async () => null,
      fulfill: async (input) => {
        const result = await adapter.fulfill(input);
        if (input.intent.side === "referrer" && first) {
          first = false;
          started.resolve();
          await release.promise;
          return { outcome: "unknown", reason: "response lost after commit" };
        }
        return result;
      },
    };
    const { restart, attributionId } = await setup(fulfillment);
    const pending = restart().reconcileBenefits({ attributionId });
    await started.promise;
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("fulfilled");
    release.resolve();
    await pending;
    const referrerHistory = await ledger.getHistory(referrerAccount, { limit: 100 });
    const recipientHistory = await ledger.getHistory(recipientAccount, { limit: 100 });
    expect(
      referrerHistory.transactions.filter((tx) => tx.kind === "grant").map((tx) => tx.amount),
    ).toEqual(["7"]);
    expect(
      recipientHistory.transactions.filter((tx) => tx.kind === "grant").map((tx) => tx.amount),
    ).toEqual(["3"]);
  });

  it("preserves operator fulfillment when a receipt check returns after settlement", async () => {
    const started = deferred<void>();
    const release = deferred<void>();
    const calls: string[] = [];
    const fulfillment: ReferralFulfillmentPort = {
      fulfill: async ({ intent }) => {
        calls.push(intent.side);
        if (intent.side === "referrer") throw new Error("response lost");
        return { outcome: "granted", grantRef: "unexpected-recipient-grant" };
      },
      check: async () => {
        started.resolve();
        await release.promise;
        return { grantRef: "settled-referrer" };
      },
    };
    const { service, restart, store, attributionId, recipient } = await claimSetup(fulfillment);
    await service.qualifyAttribution({ attributionId, recipient });
    await expect(service.fulfillBenefits({ attributionId })).rejects.toThrow("response lost");
    expect((await store.getAttribution(attributionId))?.state).toBe("indeterminate");
    const pending = restart().reconcileBenefits({ attributionId });
    await started.promise;
    await restart().resolveIndeterminateBenefits({
      attributionId,
      decision: "fulfilled",
      grantRefs: { referrer: "settled-referrer", recipient: "settled-recipient" },
      actorId: "operator",
      reason: "verified external settlement of both sides",
    });
    release.resolve();
    expect((await pending).state).toBe("fulfilled");
    expect(calls).toEqual(["referrer"]);
    expect(await store.readBudgetReserved("program", 1)).toBe("10");
  });

  it("preserves an operator rejection and released budget when an older grant completes late", async () => {
    const started = deferred<void>();
    const release = deferred<void>();
    const fulfillment: ReferralFulfillmentPort = {
      check: async () => null,
      fulfill: async () => {
        started.resolve();
        await release.promise;
        return { outcome: "granted", grantRef: "late-grant" };
      },
    };
    const { restart, store, attributionId } = await setup(fulfillment);
    const recipientIntent = (await store.listBenefitIntents({ attributionId })).find(
      (intent) => intent.side === "recipient",
    )!;
    await store.transact((tx) =>
      tx.compareAndSetBenefitIntent(
        recipientIntent.id,
        ["pending"],
        { status: "unknown", reason: "prior uncertain call" },
        now,
      ),
    );
    const pending = restart().reconcileBenefits({ attributionId });
    await started.promise;
    expect((await restart().fulfillBenefits({ attributionId })).state).toBe("indeterminate");
    await restart().resolveIndeterminateBenefits({
      attributionId,
      decision: "rejected",
      actorId: "operator",
      reason: "manual external settlement",
    });
    release.resolve();
    expect((await pending).state).toBe("rejected");
    expect(await store.readBudgetReserved("program", 1)).toBe("0");
    expect(
      (await store.listAudits()).filter(
        (entry) => entry.action === "attribution.rejected-by-operator",
      ),
    ).toHaveLength(1);
  });

  it("keeps unknown outcomes locked until an explicit operator decision", async () => {
    const { fulfillment, calls } = port();
    const { restart, store, attributionId, referrer } = await setup(fulfillment);
    await store.transact((tx) =>
      tx.compareAndSetBenefitIntent(referrer.id, ["granting"], { status: "unknown" }, now),
    );
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("indeterminate");
    expect(calls).not.toContain(referrer.idempotencyKey);
    expect(await store.readBudgetReserved("program", 1)).toBe("10");
    await restart().resolveIndeterminateBenefits({
      attributionId,
      decision: "rejected",
      actorId: "operator",
      reason: "verified absent",
    });
    expect(await store.readBudgetReserved("program", 1)).toBe("0");
    expect((await restart().reconcileBenefits({ attributionId })).state).toBe("rejected");
  });
});
