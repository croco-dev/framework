import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContinueCard, SavedItems } from "../libs/SavedItems";
import type { ResolvedCandidate } from "@croco/experience-core";

const candidate: ResolvedCandidate = {
  intent: {
    id: "intent-1",
    scope: { appId: "app", environment: "test", tenantId: "tenant" },
    subject: { kind: "customer", id: "one" },
    resourceType: "report",
    resourceId: "one",
    sourceKind: "explicit",
    state: "saved",
    revision: 2,
    savedAt: "2026-10-01T00:00:00Z",
    lastUsedAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  },
  availability: "available",
  label: "Quarterly report",
  safeUrl: "javascript:alert(1)",
  rankReason: "recent",
};
const actions = {
  onContinue: async () => {},
  onRemove: async () => {},
  onComplete: async () => {},
  onPin: async () => {},
  onReload: async () => {},
  onNextPage: async () => {},
};

describe("SavedItems", () => {
  it("never renders a cached URL as a navigation link", () => {
    const html = renderToStaticMarkup(h(ContinueCard, { ...actions, candidate }));
    expect(html).toContain("Quarterly report");
    expect(html).toContain("Continue");
    expect(html).not.toContain("href");
    expect(html).not.toContain("javascript:");
  });
  it.each(["denied", "deleted", "expired"] as const)(
    "masks unavailable %s labels and disables navigation",
    (availability) => {
      const html = renderToStaticMarkup(
        h(ContinueCard, { ...actions, candidate: { ...candidate, availability } }),
      );
      expect(html).not.toContain("Quarterly report");
      expect(html).toContain('disabled="">Continue');
      expect(html).toContain(`Unavailable: ${availability}`);
    },
  );
  it("preserves service ordering and exposes bounded continuation", () => {
    const html = renderToStaticMarkup(
      h(SavedItems, {
        ...actions,
        state: {
          kind: "partial",
          page: { candidates: [candidate], exclusions: [], nextOffset: 20 },
        },
      }),
    );
    expect(html).toContain("Some items are unavailable");
    expect(html).toContain("Next page");
  });
  it.each(["loading", "empty", "denied", "error"] as const)("makes %s explicit", (kind) => {
    const html = renderToStaticMarkup(
      h(SavedItems, { ...actions, state: { kind, message: "Access failed" } }),
    );
    expect(html).toContain(`data-state="${kind}"`);
    expect(html).not.toContain("Quarterly report");
    if (kind === "error" || kind === "denied") expect(html).toContain("Reload saved items");
  });
});
