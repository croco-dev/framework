import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { MyBenefits, OfferCard } from "../libs/OfferCard";
import type { OfferQuote } from "@croco/promotions-core";

const quote: OfferQuote = {
  id: "quote-1",
  policyId: "welcome-trial",
  policyVersion: 1,
  familyId: "welcome-trial",
  benefitCycleId: "2026-q4",
  subject: {
    appId: "shop",
    environment: "production",
    tenantId: "tenant-a",
    kind: "customer",
    id: "customer-1",
  },
  benefit: { kind: "trial-credits", creditAmount: "30", walletKey: "trial" },
  faceAmount: "30",
  costAmount: "30",
  currency: undefined,
  expiresAt: new Date("2026-09-30T00:00:00Z"),
  eligibilityRevision: "r1",
  quotedAt: new Date("2026-09-29T00:00:00Z"),
};

const discount: OfferQuote = {
  ...quote,
  id: "quote-2",
  benefit: {
    kind: "discount-quote",
    percentBps: 1000,
    maxDiscount: { amount: 500, currency: "USD" },
    currency: "USD",
    supportedProviders: [],
  },
  faceAmount: "500",
  costAmount: "500",
  currency: "USD",
};

describe("OfferCard", () => {
  it("shows real terms, validity, and a decline path", () => {
    const markup = renderToStaticMarkup(
      h(OfferCard, {
        state: { kind: "exposed", quote },
        onAccept: () => undefined,
        onReject: () => undefined,
      }),
    );
    expect(markup).toContain("30 trial credits");
    expect(markup).toContain("2026-09-30");
    expect(markup).toContain("Accept offer");
    expect(markup).toContain("Decline");
  });

  it("keeps grant confirmation distinct from fulfillment", () => {
    const confirming = renderToStaticMarkup(
      h(OfferCard, { state: { kind: "indeterminate", quote } }),
    );
    expect(confirming).toContain("Confirming grant");
    expect(confirming).toContain("budget stays reserved");
    const done = renderToStaticMarkup(
      h(OfferCard, { state: { kind: "fulfilled", quote, grantRef: "grant-1" } }),
    );
    expect(done).toContain("Benefit granted");
    expect(done).toContain("grant-1");
  });

  it("marks unsupported provider discounts as unselectable", () => {
    const markup = renderToStaticMarkup(
      h(OfferCard, {
        state: {
          kind: "unavailable",
          quote: discount,
          reason: "No provider implements this discount yet.",
        },
      }),
    );
    expect(markup).toContain('data-state="unavailable"');
    expect(markup).toContain("cannot be selected");
    expect(markup).not.toContain("Accept offer");
  });
});

describe("MyBenefits", () => {
  it("lists bounded entries with one state each", () => {
    const markup = renderToStaticMarkup(
      h(MyBenefits, {
        entries: [
          { quote, state: "fulfilled", grantRef: "grant-1" },
          { quote: discount, state: "expired", reason: "the quote expired before acceptance" },
          { quote, state: "indeterminate" },
        ],
        visibleLimit: 2,
      }),
    );
    expect(markup).toContain('data-state="fulfilled"');
    expect(markup).toContain('data-state="expired"');
    expect(markup).toContain("1 more benefits are available.");
    expect(markup).not.toContain('data-state="indeterminate"');
  });
});
