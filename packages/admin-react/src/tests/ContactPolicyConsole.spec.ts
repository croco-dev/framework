import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ContactPolicyConsole } from "../libs/ContactPolicyConsole";
import type { ContactPolicyConsoleState } from "@croco/admin-core";
const registration = {
  config: {
    version: "v1",
    rules: [{ id: "daily", limit: 3, windowMs: 86400000 }],
    reservationTtlMs: 60000,
  },
  topics: [{ id: "news", kind: "marketing" as const, priority: 1, messageIds: ["newsletter"] }],
  limits: { daily: { min: 1, max: 10 } },
  quietHours: true,
  priorities: {},
};
const view = {
  policy: { revision: 1, config: registration.config, topics: registration.topics },
  historyComplete: true,
  recentSuppressions: [
    {
      logicalSendId: "send",
      campaignId: "other-campaign",
      occurredAt: new Date("2026-09-29T00:00:00Z"),
      decision: {
        allowed: false,
        reason: "limit" as const,
        blockingRuleId: "daily",
        blockingCampaignIds: ["earlier-campaign"],
      },
    },
  ],
};
function render(state: ContactPolicyConsoleState, canWrite = true) {
  return renderToStaticMarkup(
    createElement(ContactPolicyConsole, {
      target: {
        scope: { app: "app", environment: "test", tenantId: "tenant" },
        subject: "subject",
      },
      registration,
      state,
      canWrite,
      onSave: vi.fn(),
      onDryRun: vi.fn(),
    }),
  );
}
describe("ContactPolicyConsole", () => {
  it("keeps persisted quiet hours disabled when code defaults enable them", () => {
    const html = renderToStaticMarkup(
      createElement(ContactPolicyConsole, {
        target: {
          scope: { app: "app", environment: "test", tenantId: "tenant" },
          subject: "subject",
        },
        registration: {
          ...registration,
          config: {
            ...registration.config,
            quietHours: { startMinute: 1320, endMinute: 480, timezone: "UTC" },
          },
        },
        state: { kind: "ready", view },
        canWrite: true,
        onSave: vi.fn(),
        onDryRun: vi.fn(),
      }),
    );
    expect(html).not.toContain('checked=""');
    expect(html).not.toContain('aria-label="Start minute"');
  });
  it.each(["loading", "empty", "partial", "denied", "error", "ready"] as const)(
    "renders explicit %s state",
    (kind) => {
      const state: ContactPolicyConsoleState =
        kind === "ready" || kind === "partial"
          ? { kind, view }
          : kind === "error" || kind === "denied"
            ? { kind, code: "POLICY_ERROR" }
            : { kind };
      const html = render(state);
      expect(html).toContain("Contact policy");
      if (kind === "partial") expect(html).toContain("incomplete");
      if (kind === "denied" || kind === "error") expect(html).toContain('role="alert"');
    },
  );
  it("shows code-permitted accessible inputs, read-only permissions, and cross-campaign reasons", () => {
    const html = render({ kind: "ready", view }, false);
    expect(html).toContain('aria-label="Limit: daily"');
    expect(html).not.toContain("Priority: news");
    expect(html).toContain('<fieldset disabled="">');
    expect(html).toContain("other-campaign: limit");
    expect(html).toContain("blocking campaigns: earlier-campaign");
    expect(html).toContain("external sends are outside this budget");
    expect(html).not.toContain("payloadFingerprint");
  });
});
