import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExperienceSlot } from "../libs/ExperienceSlot";
import type { ExperienceDecision } from "@croco/experience-core";

const decision: ExperienceDecision = {
  decisionId: "decision-1",
  placementId: "checkout.assurance",
  configId: "tip",
  policyVersion: 1,
  scope: { appId: "shop", environment: "test", tenantId: "tenant-1" },
  subject: { kind: "customer", id: "customer-1" },
  renderer: "banner",
  content: { locale: "en", title: "Protected checkout", body: "Your order is protected." },
  selectedAt: "2026-09-28T00:00:00Z",
  expiresAt: "2026-09-28T00:01:00Z",
  reason: "matched",
};

describe("ExperienceSlot", () => {
  it("renders the supplied decision during SSR without recording mount as an exposure", () => {
    const exposure = vi.fn();
    const html = renderToString(
      h(ExperienceSlot, {
        decision,
        handle: {
          decisionId: decision.decisionId,
          exposureId: "exposure-1",
          surfaceInstanceId: "surface-1",
          token: "secret",
        },
        renderers: { banner: (content) => h("p", null, content.body) },
        onExposure: exposure,
      }),
    );
    expect(html).toContain("Your order is protected.");
    expect(html).toContain("Dismiss");
    expect(exposure).not.toHaveBeenCalled();
  });

  it("renders preview through the registered renderer without receipt controls", () => {
    const html = renderToString(
      h(ExperienceSlot, {
        decision,
        preview: true,
        renderers: { banner: (content) => h("strong", null, content.title) },
      }),
    );
    expect(html).toContain("<strong>Protected checkout</strong>");
    expect(html).not.toContain("Dismiss");
  });
});
