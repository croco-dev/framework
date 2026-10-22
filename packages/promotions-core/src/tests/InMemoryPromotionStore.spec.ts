import { describe, expect, it } from "vitest";
import { atomicStoreConformance } from "../../../../test-support/atomicStoreConformance";
import { InMemoryPromotionStore } from "../libs/InMemoryPromotionStore";
import { claimFingerprint } from "../libs/PromotionStore";
import { OfferService } from "../libs/OfferService";
import { OfferDuplicateClaimProblem } from "../libs/problems";
import type { PromotionTx } from "../libs/PromotionStore";
import type { OfferClaim, OfferQuote, RegisteredOfferPolicy } from "../libs/types";

const now = new Date("2026-10-01T00:00:00Z");
const subject = { appId: "shop", environment: "test", tenantId: "a", kind: "customer", id: "one" };
const policy: RegisteredOfferPolicy = {
  id: "welcome",
  version: 1,
  familyId: "welcome",
  benefitCycleId: "q4",
  benefit: {
    kind: "discount-quote",
    percentBps: 1500,
    maxDiscount: { amount: 30, currency: "USD" },
    currency: "USD",
    supportedProviders: ["polar"],
  },
  eligibility: { revision: "r1", allowedSubjectIds: ["one", "two"] },
  startsAt: now,
  endsAt: new Date("2027-01-01T00:00:00Z"),
  perSubjectLimit: 5,
  budget: { total: "100", perClaim: "30" },
  allowStacking: true,
  actorId: "operator",
  reason: "test",
  idempotencyKey: "policy",
  registeredAt: now,
};
const quote: OfferQuote = {
  id: "quote",
  policyId: policy.id,
  policyVersion: 1,
  familyId: "welcome",
  benefitCycleId: "q4",
  subject,
  benefit: policy.benefit,
  faceAmount: "30",
  costAmount: "30",
  currency: "USD",
  expiresAt: policy.endsAt,
  eligibilityRevision: "r1",
  quotedAt: now,
};
const claim: OfferClaim = {
  ...quote,
  id: "claim",
  quoteId: quote.id,
  logicalKey: "logical",
  state: "reserved",
  budgetReservation: { amount: "30" },
  createdAt: now,
  updatedAt: now,
};
const audit = {
  auditId: "audit",
  targetKind: "claim" as const,
  targetId: "claim",
  action: "reserved",
  actorId: "operator",
  reason: "test",
  revision: "1",
  idempotencyKey: "audit",
  recordedAt: now,
};

atomicStoreConformance<PromotionTx>(
  "InMemoryPromotionStore",
  [
    "savePolicy",
    "saveQuote",
    "saveClaim and logical index",
    "compareAndSetClaimState",
    "addBudgetReservation",
    "releaseBudgetReservation",
    "recordAudit",
  ],
  async () => {
    const store = new InMemoryPromotionStore();
    await store.transact(async (tx) => {
      await tx.savePolicy(policy);
      await tx.saveQuote(quote);
      await tx.saveClaim(claim, claimFingerprint(claim));
      await tx.addBudgetReservation(policy.id, 1, "30");
      await tx.recordAudit(audit);
    });
    const added = { ...claim, id: "new-claim", logicalKey: "new-logical" };
    return {
      transact: (work) => store.transact(work),
      writes: [
        (tx) => tx.savePolicy({ ...policy, version: 2 }),
        (tx) => tx.saveQuote({ ...quote, id: "new-quote" }),
        (tx) => tx.saveClaim(added, claimFingerprint(added)),
        (tx) =>
          tx.compareAndSetClaimState(
            claim.id,
            ["reserved"],
            "fulfilling",
            { grantRef: "grant" },
            policy.endsAt,
          ),
        (tx) => tx.addBudgetReservation(policy.id, 1, "17"),
        (tx) => tx.releaseBudgetReservation(policy.id, 1, "4"),
        (tx) => tx.recordAudit({ ...audit, auditId: "new-audit" }),
      ],
      read: async (tx = store) => ({
        policies: await Promise.all([1, 2].map((version) => tx.getPolicy(policy.id, version))),
        latest: await tx.latestPolicyVersion(policy.id),
        quotes: await Promise.all(["quote", "new-quote"].map((id) => tx.getQuote(id))),
        claims: await tx.listClaims({}),
        logical: await tx.getClaimByLogicalKey("new-logical"),
        count: await tx.countSubjectClaims("welcome", "q4", subject, ["reserved"]),
        budget: await tx.readBudgetReserved(policy.id, 1),
        audits: await (tx instanceof InMemoryPromotionStore ? tx : store).listAudits(),
      }),
      mutateCopies: async (tx) => {
        const loaded = await tx.getPolicy(policy.id, 1);
        loaded?.startsAt.setTime(0);
        if (loaded?.benefit.kind === "discount-quote") {
          (loaded.benefit.maxDiscount as { amount: number }).amount = 999;
          (loaded.benefit.supportedProviders as string[]).push("other");
        }
        if (loaded?.eligibility.allowedSubjectIds)
          (loaded.eligibility.allowedSubjectIds as string[]).push("other");
        const savedClaim = await tx.getClaim(claim.id);
        savedClaim?.updatedAt.setTime(0);
        if (savedClaim) (savedClaim.budgetReservation as { amount: string }).amount = "999";
        const savedQuote = await tx.getQuote(quote.id);
        savedQuote?.expiresAt.setTime(0);
      },
    };
  },
);

describe("InMemoryPromotionStore service atomicity", () => {
  it("does not spend budget on a duplicate claim ID and commits a normal retry once", async () => {
    const store = new InMemoryPromotionStore();
    const service = new OfferService({
      store,
      clock: () => new Date(now),
      fulfillment: {
        fulfill: async () => ({ outcome: "granted", grantRef: "grant" }),
        check: async () => null,
      },
    });
    await service.registerPolicy({
      ...policy,
      benefit: { kind: "trial-credits", creditAmount: "30" },
    });
    const offered = await service.quoteOffer({ policy: { id: policy.id }, subject, now });
    await service.reserveClaim({
      quoteId: offered.id,
      subject,
      logicalKey: "first",
      claimId: "same-id",
      now,
    });
    const before = await store.listAudits();
    await expect(
      service.reserveClaim({
        quoteId: offered.id,
        subject,
        logicalKey: "second",
        claimId: "same-id",
        now,
      }),
    ).rejects.toThrow(OfferDuplicateClaimProblem);
    expect(await store.readBudgetReserved(policy.id, 1)).toBe("30");
    expect(await store.getClaimByLogicalKey("second")).toBeNull();
    expect(await store.listAudits()).toEqual(before);
    expect(
      (
        await service.reserveClaim({
          quoteId: offered.id,
          subject,
          logicalKey: "second",
          claimId: "retry-id",
          now,
        })
      ).created,
    ).toBe(true);
    expect(
      (
        await service.reserveClaim({
          quoteId: offered.id,
          subject,
          logicalKey: "second",
          claimId: "retry-id",
          now,
        })
      ).created,
    ).toBe(false);
    expect(await store.readBudgetReserved(policy.id, 1)).toBe("60");
  });
});
