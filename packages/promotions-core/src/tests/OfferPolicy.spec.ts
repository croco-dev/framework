import { describe, expect, it } from "vitest";
import { registerOfferPolicy } from "../index";
import { InvalidOfferPolicyProblem } from "../index";
import type { RegisterOfferPolicyInput } from "../index";

const base: RegisterOfferPolicyInput = {
  id: "welcome-trial",
  version: 1,
  benefitCycleId: "2026-q4",
  benefit: { kind: "trial-credits", creditAmount: "30", walletKey: "trial" },
  eligibility: { revision: "r1" },
  startsAt: new Date("2026-09-01T00:00:00Z"),
  endsAt: new Date("2026-12-31T00:00:00Z"),
  perSubjectLimit: 1,
  budget: { total: "100", perClaim: "30" },
  actorId: "operator-1",
  reason: "q4 trial campaign",
  idempotencyKey: "policy-welcome-v1",
};

describe("registerOfferPolicy", () => {
  it("registers a policy with defaulted family and stacking", () => {
    const policy = registerOfferPolicy(base);
    expect(policy.familyId).toBe("welcome-trial");
    expect(policy.allowStacking).toBe(false);
    expect(policy.benefit).toEqual({
      kind: "trial-credits",
      creditAmount: "30",
      walletKey: "trial",
    });
  });

  it("requires explicit limits and never implies unlimited", () => {
    expect(() => registerOfferPolicy({ ...base, perSubjectLimit: 0 })).toThrow(
      InvalidOfferPolicyProblem,
    );
    expect(() => registerOfferPolicy({ ...base, benefitCycleId: "  " })).toThrow(
      InvalidOfferPolicyProblem,
    );
  });

  it("rejects a benefit that exceeds the per-claim budget cap", () => {
    expect(() =>
      registerOfferPolicy({
        ...base,
        benefit: { kind: "trial-credits", creditAmount: "31" },
      }),
    ).toThrow(/budget\.perClaim/);
  });

  it("rejects discount budgets that are not whole minor units", () => {
    expect(() =>
      registerOfferPolicy({
        ...base,
        benefit: {
          kind: "discount-quote",
          percentBps: 1000,
          maxDiscount: { amount: 500, currency: "USD" },
          currency: "USD",
          supportedProviders: ["polar"],
        },
        budget: { total: "100.5", perClaim: "30" },
      }),
    ).toThrow(/minor units/);
  });

  it("rejects mismatched discount currencies and bad basis points", () => {
    expect(() =>
      registerOfferPolicy({
        ...base,
        benefit: {
          kind: "discount-quote",
          percentBps: 1000,
          maxDiscount: { amount: 500, currency: "EUR" },
          currency: "USD",
          supportedProviders: [],
        },
      }),
    ).toThrow(/currency/);
    expect(() =>
      registerOfferPolicy({
        ...base,
        benefit: {
          kind: "discount-quote",
          percentBps: 10001,
          maxDiscount: { amount: 500, currency: "USD" },
          currency: "USD",
          supportedProviders: [],
        },
      }),
    ).toThrow(/percentBps/);
  });

  it("rejects inverted windows and blank audit evidence", () => {
    expect(() =>
      registerOfferPolicy({ ...base, startsAt: base.endsAt, endsAt: base.startsAt }),
    ).toThrow(/startsAt/);
    expect(() => registerOfferPolicy({ ...base, actorId: "" })).toThrow(InvalidOfferPolicyProblem);
    expect(() => registerOfferPolicy({ ...base, version: 0 })).toThrow(/version/);
  });
});
