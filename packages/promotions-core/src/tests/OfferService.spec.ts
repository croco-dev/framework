import { describe, expect, it, vi } from "vitest";
import { CreditLedgerService, InMemoryCreditLedgerStore } from "@croco/credits-core";
import { InMemoryPromotionStore, OfferService } from "../index";
import { FirstPartyCreditGrantAdapter } from "../credit-grant";
import {
  OfferBudgetExhaustedProblem,
  OfferDuplicateClaimProblem,
  OfferExpiredProblem,
  OfferFulfillmentFailedProblem,
  OfferNotEligibleProblem,
  OfferQuoteMismatchProblem,
  OfferStackingConflictProblem,
  OfferSubjectLimitReachedProblem,
  OfferUnsupportedBenefitProblem,
} from "../index";
import type {
  EligibilityVerdict,
  OfferEligibilityHook,
  OfferFulfillmentPort,
  OfferSubject,
  RegisterOfferPolicyInput,
} from "../index";

const scope = { appId: "shop", environment: "production", tenantId: "tenant-a" };
const subject: OfferSubject = { ...scope, kind: "customer", id: "customer-1" };
const other: OfferSubject = { ...scope, kind: "customer", id: "customer-2" };
const now = new Date("2026-09-29T00:00:00Z");

function trialPolicy(overrides: Partial<RegisterOfferPolicyInput> = {}): RegisterOfferPolicyInput {
  return {
    id: "welcome-trial",
    version: 1,
    benefitCycleId: "2026-q4",
    benefit: { kind: "trial-credits", creditAmount: "30", walletKey: "trial" },
    eligibility: { revision: "r1" },
    startsAt: new Date("2026-09-01T00:00:00Z"),
    endsAt: new Date("2026-12-31T00:00:00Z"),
    perSubjectLimit: 10,
    budget: { total: "100", perClaim: "30" },
    actorId: "operator-1",
    reason: "trial campaign",
    idempotencyKey: "policy-v1",
    ...overrides,
  };
}

function stubPort(outcome: "granted" | "unknown" | "failed" = "granted"): {
  port: OfferFulfillmentPort;
  calls: string[];
} {
  const calls: string[] = [];
  const port: OfferFulfillmentPort = {
    fulfill: async ({ idempotencyKey, claim }) => {
      calls.push(idempotencyKey);
      if (outcome === "granted") return { outcome: "granted", grantRef: `grant:${claim.id}` };
      return { outcome, reason: `${outcome} by stub` };
    },
    check: async () => null,
  };
  return { port, calls };
}

function serviceWith(
  options: {
    eligibility?: OfferEligibilityHook;
    port?: OfferFulfillmentPort;
  } = {},
) {
  const store = new InMemoryPromotionStore();
  const { port } = options.port ? { port: options.port } : stubPort();
  const service = new OfferService({
    store,
    fulfillment: port,
    eligibility: options.eligibility,
    clock: () => new Date(now.getTime()),
  });
  return { store, service };
}

describe("OfferService", () => {
  it("reserves at most three concurrent claims against a 100 budget with 30 per claim", async () => {
    const { service } = serviceWith();
    await service.registerPolicy(trialPolicy());
    const quote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    const attempts = await Promise.allSettled(
      ["a", "b", "c", "d"].map((key) =>
        service.reserveClaim({ quoteId: quote.id, subject, logicalKey: `claim-${key}`, now }),
      ),
    );
    const created = attempts.filter((result) => result.status === "fulfilled");
    const rejected = attempts.filter((result) => result.status === "rejected");
    expect(created).toHaveLength(3);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ status: "rejected" });
    if (rejected[0]?.status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(OfferBudgetExhaustedProblem);
    }
  });

  it("replays the same logical claim as the same receipt", async () => {
    const { service } = serviceWith();
    await service.registerPolicy(trialPolicy());
    const quote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    const first = await service.reserveClaim({
      quoteId: quote.id,
      subject,
      logicalKey: "claim-same",
      now,
    });
    const second = await service.reserveClaim({
      quoteId: quote.id,
      subject,
      logicalKey: "claim-same",
      now,
    });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.claim.id).toBe(first.claim.id);
  });

  it("conflicts when a logical key is reused for a different payload", async () => {
    const { service } = serviceWith();
    await service.registerPolicy(trialPolicy());
    const first = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    const second = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    await service.reserveClaim({ quoteId: first.id, subject, logicalKey: "claim-x", now });
    await expect(
      service.reserveClaim({ quoteId: second.id, subject, logicalKey: "claim-x", now }),
    ).rejects.toThrow(OfferDuplicateClaimProblem);
  });

  it("rejects acceptance when eligibility lapses after exposure", async () => {
    let eligible = true;
    const store = new InMemoryPromotionStore();
    const { port } = stubPort();
    const service = new OfferService({
      store,
      fulfillment: port,
      eligibility: (): EligibilityVerdict =>
        eligible ? { eligible: true } : { eligible: false, reason: "purchase completed" },
      clock: () => new Date(now.getTime()),
    });
    await service.registerPolicy(trialPolicy());
    const quote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    eligible = false;
    await expect(
      service.reserveClaim({ quoteId: quote.id, subject, logicalKey: "claim-late", now }),
    ).rejects.toThrow(OfferNotEligibleProblem);
  });

  it("keeps confirmed claim terms pinned when a new policy revision lands", async () => {
    const { service } = serviceWith();
    await service.registerPolicy(trialPolicy());
    const quote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    await service.registerPolicy(
      trialPolicy({
        version: 2,
        benefit: { kind: "trial-credits", creditAmount: "10", walletKey: "trial" },
        idempotencyKey: "policy-v2",
      }),
    );
    const reserved = await service.reserveClaim({
      quoteId: quote.id,
      subject,
      logicalKey: "claim-pinned",
      now,
    });
    expect(reserved.claim.policyVersion).toBe(1);
    expect(reserved.claim.faceAmount).toBe("30");
    expect(reserved.claim.costAmount).toBe("30");
    const fulfilled = await service.fulfillClaim({ claimId: reserved.claim.id, now });
    expect(fulfilled.state).toBe("fulfilled");
    expect(fulfilled.faceAmount).toBe("30");
  });

  it("holds the per-subject limit across revisions and resets only on a new cycle", async () => {
    const { service } = serviceWith();
    await service.registerPolicy(trialPolicy({ perSubjectLimit: 1 }));
    const quote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    await service.reserveClaim({ quoteId: quote.id, subject, logicalKey: "claim-one", now });
    const retry = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    await expect(
      service.reserveClaim({ quoteId: retry.id, subject, logicalKey: "claim-two", now }),
    ).rejects.toThrow(OfferSubjectLimitReachedProblem);
    await service.registerPolicy(
      trialPolicy({ version: 2, perSubjectLimit: 1, idempotencyKey: "policy-v2" }),
    );
    const revised = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 2 },
      subject,
      now,
    });
    await expect(
      service.reserveClaim({ quoteId: revised.id, subject, logicalKey: "claim-three", now }),
    ).rejects.toThrow(OfferSubjectLimitReachedProblem);
    await service.registerPolicy(
      trialPolicy({
        version: 3,
        perSubjectLimit: 1,
        benefitCycleId: "2027-q1",
        idempotencyKey: "policy-v3",
      }),
    );
    const fresh = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 3 },
      subject,
      now,
    });
    const allowed = await service.reserveClaim({
      quoteId: fresh.id,
      subject,
      logicalKey: "claim-four",
      now,
    });
    expect(allowed.created).toBe(true);
  });

  it("rejects forged and cross-customer quotes without trusting client amounts", async () => {
    const { service } = serviceWith();
    await service.registerPolicy(trialPolicy());
    const quote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    await expect(
      service.reserveClaim({ quoteId: quote.id, subject: other, logicalKey: "claim-forge", now }),
    ).rejects.toThrow(OfferQuoteMismatchProblem);
    const reserved = await service.reserveClaim({
      quoteId: quote.id,
      subject,
      logicalKey: "claim-honest",
      now,
    });
    expect(reserved.claim.faceAmount).toBe("30");
    expect(reserved.claim.subject).toMatchObject({ id: "customer-1", tenantId: "tenant-a" });
  });

  it("treats quote expiry as a boundary that refreshes never extend", async () => {
    const { service } = serviceWith();
    await service.registerPolicy(trialPolicy());
    const quote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
      quoteTtlMs: 60_000,
    });
    const reread = await service.getQuote(quote.id);
    expect(reread?.expiresAt.toISOString()).toBe(quote.expiresAt.toISOString());
    await expect(
      service.reserveClaim({
        quoteId: quote.id,
        subject,
        logicalKey: "claim-boundary",
        now: quote.expiresAt,
      }),
    ).rejects.toThrow(OfferExpiredProblem);
  });

  it("rejects reservations outside the policy window", async () => {
    const { service } = serviceWith();
    await service.registerPolicy(trialPolicy());
    await expect(
      service.quoteOffer({
        policy: { id: "welcome-trial", version: 1 },
        subject,
        now: new Date("2027-01-01T00:00:00Z"),
      }),
    ).rejects.toThrow(OfferExpiredProblem);
  });

  it("conflicts on stacking and allows combinable groups", async () => {
    const { service } = serviceWith();
    await service.registerPolicy(
      trialPolicy({ id: "offer-a", stackingGroup: "launch", idempotencyKey: "a-v1" }),
    );
    await service.registerPolicy(
      trialPolicy({
        id: "offer-b",
        stackingGroup: "launch",
        allowStacking: true,
        budget: { total: "100", perClaim: "30" },
        idempotencyKey: "b-v1",
      }),
    );
    const quoteA = await service.quoteOffer({
      policy: { id: "offer-a", version: 1 },
      subject,
      now,
    });
    await service.reserveClaim({ quoteId: quoteA.id, subject, logicalKey: "stack-a", now });
    const quoteA2 = await service.quoteOffer({
      policy: { id: "offer-a", version: 1 },
      subject,
      now,
    });
    await expect(
      service.reserveClaim({ quoteId: quoteA2.id, subject, logicalKey: "stack-a2", now }),
    ).rejects.toThrow(OfferStackingConflictProblem);
    const quoteB = await service.quoteOffer({
      policy: { id: "offer-b", version: 1 },
      subject,
      now,
    });
    const combinable = await service.reserveClaim({
      quoteId: quoteB.id,
      subject,
      logicalKey: "stack-b",
      now,
    });
    expect(combinable.created).toBe(true);
  });

  it("keeps indeterminate budget locked with query and operator adjustment paths", async () => {
    const { service, store } = serviceWith({ port: stubPort("unknown").port });
    await service.registerPolicy(trialPolicy());
    const quote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    const reserved = await service.reserveClaim({
      quoteId: quote.id,
      subject,
      logicalKey: "claim-murky",
      now,
    });
    const murky = await service.fulfillClaim({ claimId: reserved.claim.id, now });
    expect(murky.state).toBe("indeterminate");
    const locked = await store.transact((tx) => tx.readBudgetReserved("welcome-trial", 1));
    expect(locked).toBe("30");
    const visible = await service.getClaim(reserved.claim.id);
    expect(visible?.state).toBe("indeterminate");
    const again = await service.reconcileClaim({ claimId: reserved.claim.id, now });
    expect(again.state).toBe("indeterminate");
    await expect(
      service.resolveIndeterminateClaim({
        claimId: reserved.claim.id,
        decision: "fulfilled",
        actorId: "operator-1",
        reason: "manual review",
        now,
      }),
    ).rejects.toThrow(/grantRef/);
    const rejected = await service.resolveIndeterminateClaim({
      claimId: reserved.claim.id,
      decision: "rejected",
      actorId: "operator-1",
      reason: "duplicate award",
      idempotencyKey: "op-1",
      now,
    });
    expect(rejected.state).toBe("rejected");
    const released = await store.transact((tx) => tx.readBudgetReserved("welcome-trial", 1));
    expect(released).toBe("0");
  });

  it("does not double-pay when a grant succeeds but its response is lost", async () => {
    const ledger = new CreditLedgerService({
      store: new InMemoryCreditLedgerStore(),
      eventDelivery: "development",
      clock: () => new Date(now.getTime()),
    });
    const adapter = new FirstPartyCreditGrantAdapter({
      ledger,
      resolveAccount: async ({ subject: candidate, benefit }) => {
        const opened = await ledger.openAccount({
          idempotencyKey: `test:${candidate.tenantId}:${benefit.walletKey ?? "default"}`,
          reference: { type: "test-account", id: candidate.id },
          tenantId: candidate.tenantId,
          walletKey: benefit.walletKey,
        });
        return opened.account.id;
      },
    });
    let calls = 0;
    const lossy: OfferFulfillmentPort = {
      fulfill: async (input) => {
        calls += 1;
        const result = await adapter.fulfill(input);
        if (calls === 1) throw new Error("response lost after grant");
        return result;
      },
      check: (input) => adapter.check(input),
    };
    const store = new InMemoryPromotionStore();
    const service = new OfferService({
      store,
      fulfillment: lossy,
      clock: () => new Date(now.getTime()),
    });
    await service.registerPolicy(trialPolicy());
    const quote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    const reserved = await service.reserveClaim({
      quoteId: quote.id,
      subject,
      logicalKey: "claim-lossy",
      now,
    });
    await expect(service.fulfillClaim({ claimId: reserved.claim.id, now })).rejects.toThrow(
      "response lost after grant",
    );
    const pending = await service.getClaim(reserved.claim.id);
    expect(pending?.state).toBe("indeterminate");
    const restarted = new OfferService({
      store,
      fulfillment: lossy,
      clock: () => new Date(now.getTime()),
    });
    const recovered = await restarted.recoverPendingClaims({});
    expect(recovered.map((claim) => claim.id)).toContain(reserved.claim.id);
    const reconciled = await restarted.reconcileClaim({ claimId: reserved.claim.id, now });
    expect(reconciled.state).toBe("fulfilled");
    expect(reconciled.grantRef).toBeDefined();
    expect(calls).toBe(1);
    const accountId = (
      await ledger.openAccount({
        idempotencyKey: "test:tenant-a:trial:read",
        reference: { type: "test-account", id: "customer-1" },
        tenantId: "tenant-a",
        walletKey: "trial",
      })
    ).account.id;
    const balance = await ledger.getBalance(accountId);
    expect(balance.available).toBe("30");
    expect(balance.lifetimeGranted).toBe("30");
  });

  it("rejects failed grants and releases the budget", async () => {
    const { service, store } = serviceWith({ port: stubPort("failed").port });
    await service.registerPolicy(trialPolicy());
    const quote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    const reserved = await service.reserveClaim({
      quoteId: quote.id,
      subject,
      logicalKey: "claim-fail",
      now,
    });
    await expect(service.fulfillClaim({ claimId: reserved.claim.id, now })).rejects.toThrow(
      OfferFulfillmentFailedProblem,
    );
    const done = await service.getClaim(reserved.claim.id);
    expect(done?.state).toBe("rejected");
    const released = await store.transact((tx) => tx.readBudgetReserved("welcome-trial", 1));
    expect(released).toBe("0");
  });

  it("expires reserved claims whose quotes lapsed and keeps unclear grants locked", async () => {
    const { service, store } = serviceWith({ port: stubPort("unknown").port });
    await service.registerPolicy(trialPolicy());
    const quote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
      quoteTtlMs: 60_000,
    });
    const reserved = await service.reserveClaim({
      quoteId: quote.id,
      subject,
      logicalKey: "claim-lapse",
      now,
    });
    const murkyQuote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
      quoteTtlMs: 60_000,
    });
    const murky = await service.reserveClaim({
      quoteId: murkyQuote.id,
      subject,
      logicalKey: "claim-murky-2",
      now,
    });
    await service.fulfillClaim({ claimId: murky.claim.id, now });
    const later = new Date(quote.expiresAt.getTime() + 1000);
    const expired = await service.expireOverdueClaims({ now: later });
    expect(expired.map((claim) => claim.id)).toContain(reserved.claim.id);
    expect(expired.map((claim) => claim.id)).not.toContain(murky.claim.id);
    const kept = await service.getClaim(murky.claim.id);
    expect(kept?.state).toBe("indeterminate");
    const reservedLeft = await store.transact((tx) => tx.readBudgetReserved("welcome-trial", 1));
    expect(reservedLeft).toBe("30");
  });

  it("fulfills supported discount providers without ledger movement", async () => {
    const { service } = serviceWith();
    await service.registerPolicy(
      trialPolicy({
        id: "launch-discount",
        benefit: {
          kind: "discount-quote",
          percentBps: 1000,
          maxDiscount: { amount: 500, currency: "USD" },
          currency: "USD",
          supportedProviders: ["polar"],
        },
        budget: { total: "1000", perClaim: "500" },
        idempotencyKey: "discount-v1",
      }),
    );
    const quote = await service.quoteOffer({
      policy: { id: "launch-discount", version: 1 },
      subject,
      now,
    });
    expect(quote.currency).toBe("USD");
    await expect(
      service.reserveClaim({
        quoteId: quote.id,
        subject,
        logicalKey: "discount-bad-provider",
        provider: "stripe",
        now,
      }),
    ).rejects.toThrow(OfferUnsupportedBenefitProblem);
    const reserved = await service.reserveClaim({
      quoteId: quote.id,
      subject,
      logicalKey: "discount-good",
      provider: "polar",
      now,
    });
    const fulfilled = await service.fulfillClaim({
      claimId: reserved.claim.id,
      provider: "polar",
      now,
    });
    expect(fulfilled.state).toBe("fulfilled");
    expect(fulfilled.grantRef).toBe(`discount-quote:polar:${reserved.claim.id}`);
  });

  it("reports fulfillment progress through spies instead of timing", async () => {
    const { port, calls } = stubPort();
    const fulfill = vi.spyOn(port, "fulfill");
    const store = new InMemoryPromotionStore();
    const service = new OfferService({
      store,
      fulfillment: port,
      clock: () => new Date(now.getTime()),
    });
    await service.registerPolicy(trialPolicy());
    const quote = await service.quoteOffer({
      policy: { id: "welcome-trial", version: 1 },
      subject,
      now,
    });
    const reserved = await service.reserveClaim({
      quoteId: quote.id,
      subject,
      logicalKey: "claim-spy",
      now,
    });
    await service.fulfillClaim({ claimId: reserved.claim.id, now });
    expect(fulfill).toHaveBeenCalledTimes(1);
    expect(calls[0]).toBe(`promotion-claim:${reserved.claim.id}`);
  });
});
