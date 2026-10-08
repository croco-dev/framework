import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { ReferralClaimLanding, ReferralProgress, ReferralShareCard } from "../libs/ReferralCards";
import type { ReferralAttribution } from "@croco/referral-core";

function attribution(state: ReferralAttribution["state"]): ReferralAttribution {
  return {
    id: "attr-1",
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
      id: "recipient-1",
    },
    claimedAt: new Date("2026-02-01T00:00:00Z"),
    expiresAt: new Date("2026-03-01T00:00:00Z"),
    state,
    cycleIndex: 1,
    createdAt: new Date("2026-02-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
  };
}

describe("Referral cards", () => {
  it("shares a landing href without tokens or contact prompts", () => {
    const markup = renderToStaticMarkup(
      h(ReferralShareCard, {
        programName: "Refer friends",
        state: {
          kind: "ready",
          expiresAt: new Date("2026-05-01T00:00:00Z"),
          link: {
            id: "link-1",
            tokenHash: "a".repeat(64),
            programId: "referral-welcome",
            programVersion: 1,
            familyId: "referral-welcome",
            benefitCycleId: "cycle-1",
            referrer: {
              appId: "shop",
              environment: "production",
              tenantId: "tenant-a",
              kind: "customer",
              id: "referrer-1",
            },
            createdAt: new Date("2026-02-01T00:00:00Z"),
            expiresAt: new Date("2026-05-01T00:00:00Z"),
          },
          shareHref: "https://shop.example/r/abc123",
        },
      }),
    );
    expect(markup).toContain("https://shop.example/r/abc123");
    expect(markup).not.toContain("token");
    expect(markup).not.toContain("contact");
  });

  it("shows each attribution state without recipient identity", () => {
    const ready = {
      kind: "ready" as const,
      attribution: attribution("benefits-partial"),
      referrerBenefit: { kind: "trial-credits", creditAmount: "10" } as const,
      recipientBenefit: { kind: "trial-credits", creditAmount: "5" } as const,
      funnel: { clicks: 2, claims: 1, signups: 1, qualified: 1, fulfilled: 0 },
    };
    const markup = renderToStaticMarkup(h(ReferralProgress, { role: "referrer", state: ready }));
    expect(markup).toContain("One benefit granted");
    expect(markup).not.toContain("recipient-1");
  });

  it("keeps held and rejected reasons distinct on the progress card", () => {
    const base = {
      kind: "ready" as const,
      referrerBenefit: { kind: "trial-credits", creditAmount: "10" } as const,
      recipientBenefit: { kind: "trial-credits", creditAmount: "5" } as const,
      funnel: { clicks: 2, claims: 2, signups: 1, qualified: 1, fulfilled: 0 },
    };
    const held = renderToStaticMarkup(
      h(ReferralProgress, {
        role: "recipient",
        state: { ...base, attribution: { ...attribution("held"), holdReason: "duplicate-claim" } },
      }),
    );
    const rejected = renderToStaticMarkup(
      h(ReferralProgress, {
        role: "recipient",
        state: {
          ...base,
          attribution: { ...attribution("rejected"), rejectReason: "existing-customer" },
        },
      }),
    );
    expect(held).toContain("Held: duplicate-claim");
    expect(rejected).toContain("Not eligible: existing-customer");
  });

  it("presents qualifying action and deadline on the claim landing", () => {
    const markup = renderToStaticMarkup(
      h(ReferralClaimLanding, {
        state: {
          kind: "ready",
          conversionDeadline: new Date("2026-03-01T00:00:00Z"),
          inviterLabel: "A friend",
          programEnded: false,
          qualifyingAction: "first-purchase",
          recipientBenefit: { kind: "trial-credits", creditAmount: "5" },
        },
      }),
    );
    expect(markup).toContain("first-purchase");
    expect(markup).toContain("2026-03-01");
    expect(markup).not.toContain("referrer-1");
  });

  it("supports progress-only programs without ledger language", () => {
    const markup = renderToStaticMarkup(
      h(ReferralClaimLanding, {
        state: {
          kind: "ready",
          conversionDeadline: new Date("2026-03-01T00:00:00Z"),
          inviterLabel: "A friend",
          programEnded: false,
          qualifyingAction: "first-purchase",
          recipientBenefit: { kind: "none" },
        },
      }),
    );
    expect(markup).toContain("Progress tracking only");
  });
});
