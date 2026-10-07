import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import type { CancellationSession, CancellationCommandReceipt } from "@croco/billing-core";
import { CancellationFlow } from "../libs/CancellationFlow";
const identity = {
  appId: "app",
  environment: "test",
  tenantId: "tenant",
  subject: "subject",
  subscriptionRef: "sub",
};
const session: CancellationSession = {
  evidence: [],
  ...identity,
  id: "session",
  revision: 0,
  subscriptionRevision: "r1",
  quoteRef: "quote",
  policyVersion: 1,
  state: "open",
  keepAvailable: true,
  createdAt: "2026-01-01T00:00:00Z",
  snapshot: {
    subscriptionStartedAt: "2025-12-01T00:00:00Z",
    ...identity,
    revision: "r1",
    status: "active",
    billingPeriod: "renewal",
    quote: {
      ref: "quote",
      expiresAt: "2099-01-01T00:00:00Z",
      refund: "partial",
      amount: "1250",
      currency: "USD",
    },
  },
  choices: [
    {
      id: "cancel",
      action: "cancel",
      label: "Cancel",
      consequence: "Access remains until period end.",
      available: true,
    },
    {
      id: "lower",
      action: "change-plan",
      label: "Lower plan",
      consequence: "Lower monthly charge.",
      available: false,
    },
  ],
};
const render = (value: CancellationSession) =>
  renderToStaticMarkup(
    h(CancellationFlow, {
      state: { kind: "ready", session: value },
      onDecide: async () => {},
      onRefresh: async () => {},
    }),
  );
describe("CancellationFlow", () => {
  it("explains partial choice availability while preserving supported direct cancellation", () => {
    const markup = renderToStaticMarkup(
      h(CancellationFlow, {
        state: { kind: "partial", session },
        onDecide: async () => {},
        onRefresh: async () => {},
      }),
    );
    expect(markup).toContain(
      "Some choices are unavailable. The current subscription and quote are shown below.",
    );
    expect(markup).toContain('<button type="button">Confirm cancellation</button>');
    expect(markup).toContain('disabled="">Lower plan unavailable');
  });

  it("blocks decisions on the first render while recording an optional display receipt", () => {
    const markup = renderToStaticMarkup(
      h(CancellationFlow, {
        state: { kind: "ready", session },
        onDecide: async () => {},
        onRefresh: async () => {},
        onDisplayed: async () => {},
      }),
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled="">Confirm cancellation');
    expect(markup).toContain('disabled="">Keep subscription');
    expect(markup).toContain("Recording offer display");
  });
  it("does not block initial decisions when display evidence is already recorded", () => {
    const markup = renderToStaticMarkup(
      h(CancellationFlow, {
        state: { kind: "ready", session: { ...session, displayedAt: session.createdAt } },
        onDecide: async () => {},
        onRefresh: async () => {},
        onDisplayed: async () => {},
      }),
    );
    expect(markup).toContain('<button type="button">Confirm cancellation</button>');
    expect(markup).toContain('aria-busy="false"');
  });
  it("does not wait for display bookkeeping when no optional offers are rendered", () => {
    const markup = renderToStaticMarkup(
      h(CancellationFlow, {
        state: {
          kind: "ready",
          session: {
            ...session,
            choices: session.choices.filter((choice) => choice.action === "cancel"),
          },
        },
        onDecide: async () => {},
        onRefresh: async () => {},
        onDisplayed: async () => {},
      }),
    );
    expect(markup).toContain('<button type="button">Confirm cancellation</button>');
    expect(markup).toContain('aria-busy="false"');
    expect(markup).not.toContain("Recording offer display");
  });
  it("does not block standalone decisions without display bookkeeping", () => {
    expect(render(session)).toContain('<button type="button">Confirm cancellation</button>');
  });

  it("exposes direct confirmation before optional reasons and disables unsupported offers", () => {
    const markup = render(session);
    expect(markup.indexOf("Confirm cancellation")).toBeLessThan(
      markup.indexOf("Reason (optional)"),
    );
    expect(markup).toContain("Skip reason");
    expect(markup).toContain('disabled="">Lower plan unavailable');
    expect(markup).toContain("1250 USD");
    expect(markup).toContain("does not waive");
  });
  it("distinguishes accepted scheduling from actual end and refund", () => {
    const markup = render({
      ...session,
      state: "decided",
      commandReceipt: {
        commandId: "cmd",
        providerOutcome: "confirmed",
        effect: "cancellation_scheduled",
        refundOutcome: "pending",
      },
    });
    expect(markup).toContain("Cancellation is scheduled. Your subscription has not ended.");
    expect(markup).toContain("Your refund is being processed; it is not yet confirmed.");
    expect(markup).not.toContain("Your subscription has ended.");
  });
  it("blocks expired terms and keeps direct cancellation visible", () => {
    const markup = render({
      ...session,
      snapshot: {
        ...session.snapshot,
        quote: { ...session.snapshot.quote, expiresAt: "2000-01-01T00:00:00Z" },
      },
    });
    expect(markup).toContain('disabled="">Confirm cancellation');
    expect(markup).toContain("Quote expired");
    expect(markup).toContain("Refresh current state");
  });
  it.each(["confirmed", "pending", "indeterminate"] as const)(
    "preserves %s receipts and reconciliation after the accepted quote expires",
    (providerOutcome) => {
      const markup = render({
        ...session,
        state: "decided",
        snapshot: {
          ...session.snapshot,
          quote: { ...session.snapshot.quote, expiresAt: "2000-01-01T00:00:00Z" },
        },
        commandReceipt: {
          commandId: "cmd",
          providerOutcome,
          effect: providerOutcome === "confirmed" ? "cancellation_scheduled" : "none",
          refundOutcome: "pending",
        },
      });
      expect(markup).not.toContain("Command ");
      expect(markup).toContain("Your refund is being processed; it is not yet confirmed.");
      expect(markup).not.toContain("Quote expired");
      expect(markup).toContain('disabled="">Confirm cancellation');
      expect(markup).toContain('<button type="button">Refresh current state</button>');
      if (providerOutcome === "confirmed") {
        expect(markup).toContain("Cancellation is scheduled. Your subscription has not ended.");
      } else {
        expect(markup).toContain("Refresh to check the existing request.");
      }
    },
  );
  it("never represents unknown provider outcomes as subscription changes", () => {
    const markup = render({
      ...session,
      state: "decided",
      commandReceipt: {
        commandId: "cmd",
        providerOutcome: "indeterminate",
        effect: "none",
        refundOutcome: "indeterminate",
      },
    });
    expect(markup).toContain("The result of your request is not yet known.");
    expect(markup).toContain("A subscription change is not confirmed");
  });
  it.each([
    ["none", "Your request is confirmed. No subscription change was made."],
    ["cancellation_scheduled", "Cancellation is scheduled. Your subscription has not ended."],
    ["ended", "Your subscription has ended."],
    ["resumed", "Your subscription has resumed."],
    ["plan_changed", "Your subscription plan has changed."],
  ] satisfies readonly (readonly [CancellationCommandReceipt["effect"], string])[])(
    "explains the confirmed %s outcome without internal labels",
    (effect, message) => {
      const markup = render({
        ...session,
        state: "decided",
        commandReceipt: {
          commandId: "cmd",
          providerOutcome: "confirmed",
          effect,
          refundOutcome: "not_requested",
        },
      });
      expect(markup).toContain(message);
      expect(markup).toContain("No refund has been requested.");
      expect(markup).toContain("Subscription at decision: active");
      expect(markup).toContain("Refund quote at decision:");
      expect(markup).not.toContain("Current refund quote:");
      expect(markup).not.toContain("Subscription effect:");
    },
  );
  it.each([
    ["not_requested", "No refund has been requested."],
    ["pending", "Your refund is being processed; it is not yet confirmed."],
    ["confirmed", "Your refund is confirmed."],
    ["failed", "Your refund failed."],
    ["indeterminate", "The result of your refund request is not yet known."],
  ] satisfies readonly (readonly [CancellationCommandReceipt["refundOutcome"], string])[])(
    "describes the actual %s refund receipt independently",
    (refundOutcome, message) => {
      const markup = render({
        ...session,
        state: "decided",
        commandReceipt: {
          commandId: "cmd",
          providerOutcome: "confirmed",
          effect: "ended",
          refundOutcome,
        },
      });
      expect(markup).toContain(message);
      if (refundOutcome !== "confirmed") expect(markup).not.toContain("Your refund is confirmed.");
    },
  );
  it.each([
    ["pending", "Your request is being processed."],
    ["failed", "Your request failed."],
    ["indeterminate", "The result of your request is not yet known."],
  ] satisfies readonly (readonly [CancellationCommandReceipt["providerOutcome"], string])[])(
    "does not claim a subscription change for a %s request",
    (providerOutcome, message) => {
      const markup = render({
        ...session,
        state: "decided",
        commandReceipt: {
          commandId: "cmd",
          providerOutcome,
          effect: "ended",
          refundOutcome: "pending",
        },
      });
      expect(markup).toContain(message);
      expect(markup).toContain("Refresh to check the existing request.");
      expect(markup).not.toContain("Your subscription has ended.");
    },
  );
});
