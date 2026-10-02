import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NetOutcomePanel } from "../libs/NetOutcomePanel";
import type { NetOutcomeState, NetOutcomeSnapshot } from "@croco/admin-core";
const request = {
  cutoff: { effectiveAt: "2026-09-30T00:00:00Z", knownAt: "2026-10-01T00:00:00Z" },
  revision: "1",
};
describe("NetOutcomePanel", () => {
  it.each(["loading", "empty", "denied", "error"] as const)(
    "renders %s with native cutoff refresh controls",
    (kind) => {
      const state: NetOutcomeState =
        kind === "denied" || kind === "error" ? { kind, code: "test/problem" } : { kind };
      const html = renderToStaticMarkup(
        createElement(NetOutcomePanel, { state, request, onRefresh: vi.fn() }),
      );
      expect(html).toContain(`data-state="${kind}"`);
      expect(html).toContain("Effective cutoff");
      expect(html).toContain("Known cutoff");
      expect(html).toContain('type="submit"');
      expect(html).toContain("does not establish causal uplift");
    },
  );
  it("renders authoritative rational totals, separate noncash and partial evidence", () => {
    const snapshot: NetOutcomeSnapshot = {
      assignmentSnapshot: { id: "snapshot", unit: "person", arms: ["treatment"] },
      cutoff: request.cutoff,
      revision: "1",
      metricDefinitionVersion: "assigned-net-v1",
      definitionHash: "definition",
      inputHash: "input",
      sources: ["ledger"],
      costCompleteness: [
        {
          arm: "treatment",
          source: "ledger",
          kind: "direct_contact_cost",
          currency: "USD",
          status: "pending",
          pendingCount: 2,
        },
      ],
      byCurrency: [
        {
          currency: "USD",
          arms: [
            {
              arm: "treatment",
              assignedUnits: 100,
              components: {
                payment: "110000",
                refund: "15000",
                cashback: "20000",
                direct_contact_cost: "1000",
                noncash_grant: "500",
              },
              netMinor: "74000",
              complete: false,
              perUnit: null,
              refundRate: { numerator: "1", denominator: "100" },
              refundRateDenominator: "paying_assigned_subjects",
              retentionRate: { numerator: "4", denominator: "5" },
              retentionRateDenominator: "assigned_units",
            },
          ],
          delta: [{ arm: "treatment", baselineArm: "control", value: null }],
        },
      ],
      diagnostics: [{ code: "incomplete_cost" }],
      counts: {
        received: 0,
        duplicates: 0,
        excludedByCutoff: 0,
        superseded: 0,
        accepted: 0,
        rejected: 0,
      },
      quality: "partial",
    };
    const html = renderToStaticMarkup(
      createElement(NetOutcomePanel, {
        state: { kind: "partial", snapshot },
        request,
        onRefresh: vi.fn(),
        onDrilldown: vi.fn(),
      }),
    );
    expect(html).toContain("Assigned denominator: 100");
    expect(html).toContain("Net: 74000");
    expect(html).toContain("Noncash face value (separate): 500");
    expect(html).toContain("Retention rate: 4 / 5");
    expect(html).toContain("pending (2 pending)");
    expect(html).toContain("Unavailable (see completeness and diagnostics)");
    expect(html).toContain("Inspect treatment / USD / ledger");
  });
});
