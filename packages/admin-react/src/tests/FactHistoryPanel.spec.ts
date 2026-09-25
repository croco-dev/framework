import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FactHistoryPanel } from "../libs/FactHistoryPanel";
import type {
  FactHistoryComparisonRequest,
  FactHistorySnapshot,
  FactHistoryState,
} from "@croco/admin-core";

const request: FactHistoryComparisonRequest = {
  scope: { app: "app", environment: "test", tenantId: "tenant" },
  subject: { kind: "user", id: "customer" },
  definitionId: "verified",
  definitionVersion: "1",
  materializationRevision: "1",
  effectiveAt: "2026-09-25T09:00:00Z",
  knownAt: "2026-09-25T13:00:00Z",
  compareEffectiveAt: "2026-09-25T11:00:00Z",
  compareKnownAt: "2026-09-25T13:00:00Z",
  limit: 10,
};
const snapshot: FactHistorySnapshot = {
  request,
  revision: 1,
  before: { status: "unknown", provenance: [] },
  after: { status: "known", value: "true", provenance: ["row-1"] },
  rows: [
    {
      id: "row-1",
      value: "true",
      source: "verification",
      sourceEventId: "evt-1",
      validFrom: request.compareEffectiveAt,
      recordedAt: "2026-09-25T12:00:00Z",
      definitionVersion: "1",
      projectionId: "verified",
      projectionRowKey: "verified",
      materializationRevision: "1",
    },
  ],
};
function render(state: FactHistoryState, canCorrect = false) {
  return renderToStaticMarkup(
    createElement(FactHistoryPanel, {
      state,
      request,
      actor: "operator",
      canCorrect,
      onCompare: vi.fn(),
      onCorrect: vi.fn(),
    }),
  );
}
describe("FactHistoryPanel", () => {
  it.each(["loading", "denied", "error", "empty", "partial", "ready"] as const)(
    "renders the explicit %s state",
    (kind) => {
      const state: FactHistoryState =
        kind === "loading"
          ? { kind }
          : kind === "denied" || kind === "error"
            ? { kind, code: "test/problem" }
            : { kind, snapshot: kind === "empty" ? { ...snapshot, rows: [] } : snapshot };
      expect(render(state)).toContain(`data-state="${kind}"`);
    },
  );
  it("shows temporal provenance and only authorized correction actions", () => {
    const html = render({ kind: "ready", snapshot });
    expect(html).toContain("evt-1");
    expect(html).toContain("Recorded: 2026-09-25T12:00:00Z");
    expect(html).toContain("unknown");
    expect(html).not.toContain("Correct row-1");
    expect(render({ kind: "ready", snapshot }, true)).toContain("Correct row-1");
    expect(html).toContain("Read limit: 10 rows");
    expect(html).toContain('aria-label="First effective time"');
    expect(html).toContain('type="submit"');
  });
  it("shows supplied decision snapshot evidence beside the time comparison", () => {
    const html = render({
      kind: "ready",
      snapshot: {
        ...snapshot,
        decisionSnapshot: { id: "campaign-1", evidence: ["verified at 11:00"] },
      },
    });
    expect(html).toContain("Decision snapshot campaign-1");
    expect(html).toContain("verified at 11:00");
  });
});
