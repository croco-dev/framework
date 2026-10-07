import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RetentionOfferConsole } from "../libs/RetentionOfferConsole";
import type { RetentionOfferConsoleState } from "@croco/admin-core";
const state: RetentionOfferConsoleState = {
  kind: "ready",
  view: {
    policy: {
      appId: "app",
      environment: "test",
      tenantId: "tenant",
      version: 2,
      entries: [
        {
          choiceId: "lower",
          label: "Lower plan",
          order: 0,
          enabled: true,
          billingPeriods: ["renewal"],
          refundKinds: ["partial"],
        },
      ],
    },
    registration: [
      {
        id: "lower",
        action: "change-plan",
        label: "Lower plan",
        consequence: "Next renewal costs less.",
      },
    ],
    reports: [],
  },
};
describe("RetentionOfferConsole", () => {
  it("can configure registered choices before the first optional policy is saved", () => {
    if (!("view" in state)) throw new Error("Fixture view missing");
    const markup = renderToStaticMarkup(
      h(RetentionOfferConsole, {
        state: {
          kind: "ready",
          view: { ...state.view, policy: { ...state.view.policy, version: 0, entries: [] } },
        },
        canWrite: true,
        onSave: async () => {},
        onRefresh: async () => {},
      }),
    );
    expect(markup).toContain("Lower plan");
    expect(markup).toContain("revision 0");
    expect(markup).toContain("Audit reason");
  });
  it("renders only registered presentation and targeting fields with audit reason", () => {
    const markup = renderToStaticMarkup(
      h(RetentionOfferConsole, {
        state,
        canWrite: true,
        onSave: async () => {},
        onRefresh: async () => {},
      }),
    );
    expect(markup).toContain("Audit reason");
    expect(markup).toContain("Billing periods");
    expect(markup).toContain("Refund quote groups");
    expect(markup).not.toContain('name="amount"');
    expect(markup).toContain("revision 2");
  });
  it("disables editing without write access and distinguishes incomplete reporting", () => {
    const markup = renderToStaticMarkup(
      h(RetentionOfferConsole, {
        state: { ...state, kind: "partial" },
        canWrite: false,
        onSave: async () => {},
        onRefresh: async () => {},
      }),
    );
    expect(markup).toContain('<fieldset disabled="">');
    expect(markup).toContain("Read-only access");
    expect(markup).toContain("Results are incomplete");
  });
});
