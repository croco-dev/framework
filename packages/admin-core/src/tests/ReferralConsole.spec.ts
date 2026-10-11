import { describe, expect, it } from "vitest";
import {
  assertReferralConsoleActionRequest,
  createReferralConsoleActions,
  createReferralConsoleProgramView,
  maskReferralSubjectId,
  summarizeReferralConsoleQualifiedRecipients,
  validateReferralProgramEditor,
} from "../libs/ReferralConsole";
import type { ReferralAttribution, ReferralProgramDefinition } from "@croco/referral-core";

function program(): ReferralProgramDefinition {
  return {
    id: "referral-welcome",
    version: 1,
    familyId: "referral-welcome",
    benefitCycleId: "cycle-1",
    attributionPolicy: "first-valid",
    conversionWindowMs: 30 * 24 * 60 * 60 * 1000,
    qualifyingAction: "first-purchase",
    referrerBenefit: { kind: "trial-credits", creditAmount: "10" },
    recipientBenefit: { kind: "trial-credits", creditAmount: "5" },
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: new Date("2026-12-31T00:00:00Z"),
    perSubjectLimit: 1,
    budgetTotal: "1000",
    budgetPerAttribution: "20",
    actorId: "operator-1",
    reason: "launch",
    idempotencyKey: "program:referral-welcome:1",
    registeredAt: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("Referral console", () => {
  it("masks subject ids without the PII permission while keeping the masked id stable", () => {
    expect(maskReferralSubjectId("customer-12345")).toBe("cu***45");
    expect(maskReferralSubjectId("abc")).toBe("***");
  });

  it("derives status and faces from the registered program snapshot", () => {
    const view = createReferralConsoleProgramView(
      program(),
      "40",
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(view.status).toBe("active");
    expect(view.referrerFace).toBe("10");
    expect(view.recipientFace).toBe("5");
  });

  it("requires resolve permission for indeterminate attributions only", () => {
    const snapshot = {
      scope: { appId: "shop", environment: "production" },
      generatedAt: new Date("2026-02-01T00:00:00Z"),
      programs: [],
      links: [],
      attributions: [
        {
          id: "attr-1",
          linkId: "link-1",
          programId: "referral-welcome",
          programVersion: 1,
          referrer: {
            kind: "customer",
            id: "***",
            maskedId: "re***r1",
            tenantId: "tenant-a",
            appId: "shop",
            environment: "production",
          },
          recipient: null,
          state: "indeterminate" as const,
          cycleIndex: 1,
          claimedAt: new Date("2026-02-01T00:00:00Z"),
          updatedAt: new Date("2026-02-01T00:00:00Z"),
        },
      ],
      funnel: { clicks: 1, claims: 1, signups: 0, qualified: 0, fulfilled: 0 },
      nextShareCycle: "cycle-2",
    };
    const without = createReferralConsoleActions(snapshot, ["referrals:read", "referrals:write"]);
    const withResolve = createReferralConsoleActions(snapshot, [
      "referrals:read",
      "referrals:write",
      "referrals:resolve",
    ]);
    expect(without.find((action) => action.kind === "resolve-attribution")?.allowed).toBe(false);
    expect(withResolve.find((action) => action.kind === "resolve-attribution")?.allowed).toBe(true);
  });

  it("requires verified grant refs for both sides when fulfilling", () => {
    expect(() =>
      assertReferralConsoleActionRequest({
        action: "resolve-attribution",
        targetId: "attr-1",
        scope: { appId: "shop", environment: "production", tenantId: "tenant-a" },
        actorId: "operator-1",
        reason: "verified with provider",
        idempotencyKey: "operator:attr-1:1",
        expectedGeneratedAt: new Date("2026-02-01T00:00:00Z"),
        decision: "fulfilled",
        grantRefs: { referrer: "grant-a" },
      }),
    ).toThrow(/recipient/);
  });

  it("rejects program drafts without an explicit benefit cycle", () => {
    const result = validateReferralProgramEditor({
      id: "referral-welcome",
      versionText: "2",
      familyId: "referral-welcome",
      benefitCycleId: "",
      qualifyingAction: "first-purchase",
      conversionWindowDaysText: "30",
      referrerKind: "trial-credits",
      referrerCreditAmount: "10",
      referrerWalletKey: "referral",
      recipientKind: "trial-credits",
      recipientCreditAmount: "5",
      recipientWalletKey: "welcome",
      startsAtText: "2026-01-01T00:00:00Z",
      endsAtText: "2026-12-31T00:00:00Z",
      perSubjectLimitText: "1",
      budgetTotal: "1000",
      budgetPerAttribution: "20",
      actorId: "operator-1",
      reason: "next version",
      idempotencyKey: "program:referral-welcome:2",
    });
    expect(result.kind).toBe("errors");
  });

  it("summarizes qualified recipients with masked ids and the next share cycle", () => {
    const attribution: ReferralAttribution = {
      id: "attr-2",
      linkId: "link-1",
      programId: "referral-welcome",
      programVersion: 1,
      familyId: "referral-welcome",
      benefitCycleId: "cycle-1",
      scope: { appId: "shop", environment: "production", tenantId: "tenant-a" },
      referrer: {
        appId: "shop",
        environment: "production",
        tenantId: "tenant-a",
        kind: "customer",
        id: "referrer-1",
      },
      recipient: {
        appId: "shop",
        environment: "production",
        tenantId: "tenant-a",
        kind: "customer",
        id: "recipient-9999",
      },
      claimedAt: new Date("2026-02-01T00:00:00Z"),
      expiresAt: new Date("2026-03-01T00:00:00Z"),
      state: "fulfilled",
      qualification: {
        sourceEventId: "event-1",
        qualifyingAction: "first-purchase",
        qualifiedAt: new Date("2026-02-02T00:00:00Z"),
        eligibleReason: "server event",
      },
      cycleIndex: 1,
      createdAt: new Date("2026-02-01T00:00:00Z"),
      updatedAt: new Date("2026-02-02T00:00:00Z"),
    };
    const summary = summarizeReferralConsoleQualifiedRecipients({
      attributions: [attribution],
      grantedPermissions: ["referrals:read"],
      nextShareCycle: "cycle-2",
    });
    expect(summary.nextShareCycle).toBe("cycle-2");
    expect(summary.qualified[0]?.recipientMaskedId).toBe("re***99");
    expect(summary.qualified[0]?.recipientMaskedId).not.toContain("recipient-9999");
  });
});
