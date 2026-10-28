import { describe, expect, it, vi } from "vitest";
import { CreditLedgerService, InMemoryCreditLedgerStore } from "@croco/credits-core";
import { InMemoryPromotionStore, OfferClaimStateConflictProblem, OfferService } from "../index";
import { FirstPartyCreditGrantAdapter } from "../credit-grant";
import type { OfferFulfillmentPort, RegisterOfferPolicyInput } from "../index";

const start = new Date("2026-10-01T00:00:00Z");
const subject = {
  appId: "shop",
  environment: "test",
  tenantId: "tenant-a",
  kind: "customer",
  id: "one",
};

function latch() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function fixture(kind: "trial-credits" | "discount-quote" = "trial-credits") {
  let time = start;
  const ledger = new CreditLedgerService({
    store: new InMemoryCreditLedgerStore(),
    eventDelivery: "development",
    clock: () => time,
  });
  const { account } = await ledger.openAccount({
    tenantId: subject.tenantId,
    walletKey: "trial",
    idempotencyKey: "account",
    reference: { type: "test-account", id: subject.id },
  });
  const adapter = new FirstPartyCreditGrantAdapter({
    ledger,
    resolveAccount: async () => account.id,
  });
  const fulfill = vi.fn<OfferFulfillmentPort["fulfill"]>((input) => adapter.fulfill(input));
  const store = new InMemoryPromotionStore();
  const service = new OfferService({
    store,
    fulfillment: { fulfill, check: (input) => adapter.check(input) },
    clock: () => time,
  });
  const policy: RegisterOfferPolicyInput = {
    id: "offer",
    version: 1,
    benefitCycleId: "cycle",
    benefit:
      kind === "trial-credits"
        ? { kind, creditAmount: "30", walletKey: "trial" }
        : {
            kind,
            percentBps: 1000,
            maxDiscount: { amount: 500, currency: "USD" },
            currency: "USD",
            supportedProviders: ["polar"],
          },
    eligibility: { revision: "r1" },
    startsAt: start,
    endsAt: new Date("2026-12-31T00:00:00Z"),
    perSubjectLimit: 10,
    budget: { total: "2000", perClaim: kind === "trial-credits" ? "30" : "500" },
    actorId: "operator",
    reason: "expiry boundary",
    idempotencyKey: "policy",
  };
  await service.registerPolicy(policy);
  const quote = await service.quoteOffer({
    policy: { id: "offer", version: 1 },
    subject,
    quoteTtlMs: 60_000,
  });
  const { claim } = await service.reserveClaim({
    quoteId: quote.id,
    subject,
    logicalKey: "claim",
    provider: "polar",
  });
  return {
    service,
    store,
    ledger,
    account,
    adapter,
    fulfill,
    quote,
    claim,
    setTime: (value: Date) => {
      time = value;
    },
  };
}

describe("Offer expiry admission", () => {
  it.each([
    ["trial-credits", -1],
    ["trial-credits", 0],
    ["trial-credits", 1],
    ["discount-quote", -1],
    ["discount-quote", 0],
    ["discount-quote", 1],
  ] as const)("handles %s fulfillment at expiry offset %i", async (kind, offset) => {
    const f = await fixture(kind);
    // Receipt replay before expiry remains independent of fulfillment admission.
    expect(
      (
        await f.service.reserveClaim({
          quoteId: f.quote.id,
          subject,
          logicalKey: "claim",
          provider: "polar",
        })
      ).created,
    ).toBe(false);
    f.setTime(new Date(f.quote.expiresAt.getTime() + offset));
    const result = await f.service.fulfillClaim({ claimId: f.claim.id, provider: "polar" });
    expect(result.state).toBe(offset < 0 ? "fulfilled" : "expired");
    expect((await f.service.getClaim(f.claim.id))?.state).toBe(result.state);
    expect(f.fulfill).toHaveBeenCalledTimes(kind === "trial-credits" && offset < 0 ? 1 : 0);
    expect((await f.ledger.getBalance(f.account.id)).available).toBe(
      kind === "trial-credits" && offset < 0 ? "30" : "0",
    );
    expect(await f.store.transact((tx) => tx.readBudgetReserved("offer", 1))).toBe(
      offset < 0 ? f.claim.faceAmount : "0",
    );
    const audits = await f.store.listAudits();
    expect(audits.filter((entry) => entry.action === "claim.expired")).toHaveLength(
      offset < 0 ? 0 : 1,
    );
    expect(audits.filter((entry) => entry.action === "claim.fulfilled")).toHaveLength(
      offset < 0 ? 1 : 0,
    );
    expect(
      await f.service.expireOverdueClaims({ now: new Date(f.quote.expiresAt.getTime() + 1) }),
    ).toEqual([]);
  });

  it("never grants when the sweep expires the reservation first", async () => {
    const f = await fixture();
    f.setTime(f.quote.expiresAt);
    expect(await f.service.expireOverdueClaims({})).toMatchObject([
      { id: f.claim.id, state: "expired" },
    ]);
    await expect(f.service.fulfillClaim({ claimId: f.claim.id })).rejects.toThrow(
      OfferClaimStateConflictProblem,
    );
    expect(f.fulfill).not.toHaveBeenCalled();
    expect((await f.ledger.getBalance(f.account.id)).available).toBe("0");
    expect(
      (await f.store.listAudits()).filter((entry) => entry.action === "claim.expired"),
    ).toHaveLength(1);
    expect(await f.store.transact((tx) => tx.readBudgetReserved("offer", 1))).toBe("0");
  });

  it.each(["granted", "unknown"] as const)(
    "keeps an admitted %s grant across expiry and receipt replay",
    async (outcome) => {
      const f = await fixture();
      const reached = latch();
      const resume = latch();
      f.fulfill.mockImplementation(async (input) => {
        reached.release();
        await resume.promise;
        const result = await f.adapter.fulfill(input);
        return outcome === "unknown" ? { outcome, reason: "response lost" } : result;
      });
      f.setTime(new Date(f.quote.expiresAt.getTime() - 1));
      const pending = f.service.fulfillClaim({ claimId: f.claim.id });
      try {
        await reached.promise;
        f.setTime(new Date(f.quote.expiresAt.getTime() + 1));
        expect(await f.service.expireOverdueClaims({})).toEqual([]);
        expect((await f.service.getClaim(f.claim.id))?.state).toBe("fulfilling");
      } finally {
        resume.release();
      }
      expect((await pending).state).toBe(outcome === "unknown" ? "indeterminate" : "fulfilled");
      expect(await f.service.expireOverdueClaims({})).toEqual([]);
      const done = await f.service.fulfillClaim({ claimId: f.claim.id });
      expect(done.state).toBe("fulfilled");
      expect(await f.service.fulfillClaim({ claimId: f.claim.id })).toEqual(done);
      expect(f.fulfill).toHaveBeenCalledTimes(1);
      expect((await f.ledger.getBalance(f.account.id)).available).toBe("30");
      expect(await f.store.transact((tx) => tx.readBudgetReserved("offer", 1))).toBe("30");
      expect((await f.store.listAudits()).some((entry) => entry.action === "claim.expired")).toBe(
        false,
      );
    },
  );

  it("resumes a persisted fulfilling claim after expiry", async () => {
    const f = await fixture();
    await f.store.transact((tx) =>
      tx.compareAndSetClaimState(f.claim.id, ["reserved"], "fulfilling", {}, start),
    );
    f.setTime(new Date(f.quote.expiresAt.getTime() + 1));
    expect((await f.service.fulfillClaim({ claimId: f.claim.id })).state).toBe("fulfilled");
    expect(f.fulfill).toHaveBeenCalledTimes(1);
    expect((await f.ledger.getBalance(f.account.id)).available).toBe("30");
    expect(await f.store.transact((tx) => tx.readBudgetReserved("offer", 1))).toBe("30");
  });
});
