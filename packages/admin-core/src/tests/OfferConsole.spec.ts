import { describe, expect, it } from "vitest";
import {
  createOfferConsoleActions,
  createOfferConsoleClaimView,
  createOfferConsolePolicyView,
  maskOfferSubjectId,
  resolveOfferConsoleSubject,
  validateOfferPolicyEditor,
} from "../index";
import type { OfferClaim, RegisteredOfferPolicy } from "@croco/promotions-core";

const policy: RegisteredOfferPolicy = {
  id: "welcome-trial",
  version: 1,
  familyId: "welcome-trial",
  benefitCycleId: "2026-q4",
  benefit: { kind: "trial-credits", creditAmount: "30", walletKey: "trial" },
  eligibility: { revision: "r1" },
  startsAt: new Date("2026-09-01T00:00:00Z"),
  endsAt: new Date("2026-12-31T00:00:00Z"),
  perSubjectLimit: 1,
  budget: { total: "100", perClaim: "30" },
  stackingGroup: undefined,
  allowStacking: false,
  actorId: "operator-1",
  reason: "trial campaign",
  idempotencyKey: "policy-v1",
  registeredAt: new Date("2026-09-29T00:00:00Z"),
};

const claim: OfferClaim = {
  id: "claim-1",
  quoteId: "quote-1",
  logicalKey: "logical-1",
  policyId: "welcome-trial",
  policyVersion: 1,
  familyId: "welcome-trial",
  benefitCycleId: "2026-q4",
  subject: {
    appId: "shop",
    environment: "production",
    tenantId: "tenant-a",
    kind: "customer",
    id: "customer-12345",
  },
  benefit: { kind: "trial-credits", creditAmount: "30", walletKey: "trial" },
  faceAmount: "30",
  costAmount: "30",
  currency: undefined,
  state: "indeterminate",
  grantRef: undefined,
  budgetReservation: { amount: "30" },
  stackingGroup: undefined,
  createdAt: new Date("2026-09-29T00:00:00Z"),
  updatedAt: new Date("2026-09-29T00:00:00Z"),
};

describe("OfferConsole", () => {
  it("masks subject identities without the PII permission", () => {
    expect(maskOfferSubjectId("customer-12345")).toBe("cu***45");
    expect(maskOfferSubjectId("ab")).toBe("***");
    const masked = resolveOfferConsoleSubject(claim.subject, ["promotions:read"]);
    expect(masked.id).toBe("cu***45");
    expect(masked.maskedId).toBe("cu***45");
    const disclosed = resolveOfferConsoleSubject(claim.subject, [
      "promotions:read",
      "promotions:read:pii",
    ]);
    expect(disclosed.id).toBe("customer-12345");
  });

  it("derives policy windows and claim views for the console", () => {
    const active = createOfferConsolePolicyView(policy, "30", new Date("2026-10-01T00:00:00Z"));
    expect(active.status).toBe("active");
    expect(active.face).toBe("30");
    const scheduled = createOfferConsolePolicyView(policy, "0", new Date("2026-08-01T00:00:00Z"));
    expect(scheduled.status).toBe("scheduled");
    const view = createOfferConsoleClaimView(claim, ["promotions:read"]);
    expect(view.state).toBe("indeterminate");
    expect(view.subject.id).toBe("cu***45");
  });

  it("offers resolve actions only for indeterminate claims", () => {
    const actions = createOfferConsoleActions(
      {
        scope: { appId: "shop", environment: "production" },
        generatedAt: new Date("2026-09-29T00:00:00Z"),
        policies: [],
        claims: [createOfferConsoleClaimView(claim, ["promotions:read"])],
        pendingBudget: "30",
      },
      ["promotions:read", "promotions:write", "promotions:resolve"],
    );
    expect(actions.map((action) => action.kind)).toEqual([
      "register-policy",
      "expire-claims",
      "resolve-claim",
    ]);
    const denied = createOfferConsoleActions(
      {
        scope: { appId: "shop", environment: "production" },
        generatedAt: new Date("2026-09-29T00:00:00Z"),
        policies: [],
        claims: [createOfferConsoleClaimView(claim, ["promotions:read"])],
        pendingBudget: "30",
      },
      ["promotions:read"],
    );
    expect(denied.filter((action) => action.kind === "resolve-claim")[0]?.allowed).toBe(false);
  });

  it("validates size, period, caps, exclusions, and cost caps per field", () => {
    const valid = validateOfferPolicyEditor(
      {
        id: "welcome-trial",
        versionText: "1",
        familyId: "",
        benefitCycleId: "2026-q4",
        benefitKind: "trial-credits",
        creditAmount: "30",
        walletKey: "trial",
        percentBpsText: "",
        maxDiscountAmountText: "",
        currency: "",
        supportedProvidersText: "",
        startsAtText: "2026-09-01T00:00:00.000Z",
        endsAtText: "2026-12-31T00:00:00.000Z",
        perSubjectLimitText: "1",
        budgetTotal: "100",
        budgetPerClaim: "30",
        stackingGroup: "",
        allowStacking: false,
        eligibilityRevision: "r1",
        actorId: "operator-1",
        reason: "trial campaign",
        idempotencyKey: "policy-v1",
      },
      new Date("2026-09-29T00:00:00Z"),
    );
    expect(valid.ok).toBe(true);
    const invalid = validateOfferPolicyEditor(
      {
        id: "",
        versionText: "0",
        familyId: "",
        benefitCycleId: "",
        benefitKind: "discount-quote",
        creditAmount: "",
        walletKey: "",
        percentBpsText: "0",
        maxDiscountAmountText: "-5",
        currency: "",
        supportedProvidersText: "",
        startsAtText: "not-a-date",
        endsAtText: "",
        perSubjectLimitText: "0",
        budgetTotal: "",
        budgetPerClaim: "",
        stackingGroup: "",
        allowStacking: false,
        eligibilityRevision: "",
        actorId: "",
        reason: "",
        idempotencyKey: "",
      },
      new Date("2026-09-29T00:00:00Z"),
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.fieldErrors.versionText).toBeDefined();
      expect(invalid.fieldErrors.perSubjectLimitText).toBeDefined();
      expect(invalid.fieldErrors.percentBpsText).toBeDefined();
      expect(invalid.fieldErrors.actorId).toBeDefined();
    }
  });

  it("routes cross-field budget violations to the general error", () => {
    const result = validateOfferPolicyEditor(
      {
        id: "welcome-trial",
        versionText: "1",
        familyId: "",
        benefitCycleId: "2026-q4",
        benefitKind: "trial-credits",
        creditAmount: "300",
        walletKey: "trial",
        percentBpsText: "",
        maxDiscountAmountText: "",
        currency: "",
        supportedProvidersText: "",
        startsAtText: "2026-09-01T00:00:00.000Z",
        endsAtText: "2026-12-31T00:00:00.000Z",
        perSubjectLimitText: "1",
        budgetTotal: "100",
        budgetPerClaim: "30",
        stackingGroup: "",
        allowStacking: false,
        eligibilityRevision: "r1",
        actorId: "operator-1",
        reason: "trial campaign",
        idempotencyKey: "policy-v1",
      },
      new Date("2026-09-29T00:00:00Z"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.general).toMatch(/perClaim/);
  });
});
