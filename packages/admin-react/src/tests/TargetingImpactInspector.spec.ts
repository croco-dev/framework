import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TargetingImpactInspector } from "../libs/TargetingImpactInspector";
import type { TargetingImpactInspectorState } from "../libs/TargetingImpactInspector";
import type { TargetingImpactReport } from "@croco/admin-core";

const report: TargetingImpactReport = {
  version: 1,
  definitionHash: "definition-fixed",
  inputHash: "input-fixed",
  input: {
    scope: { appId: "app", environment: "test", tenantId: "tenant", subjectKind: "user" },
    snapshotRef: "historical-snapshot",
    currency: "KRW",
    unit: "won",
    observationWindow: {
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-02-01T00:00:00.000Z",
      completed: true,
    },
    attributionWindowMs: 86400000,
    definition: {
      revision: "preserve-v1",
      unknownPolicy: "preserve",
      scenarios: ["click-only", "post-send-inclusive"],
      changes: ["filter"],
    },
  },
  result: {
    baselineN: 100,
    keptN: 80,
    excludedN: 20,
    unknownN: 0,
    effectiveKeptN: 80,
    effectiveExcludedN: 20,
    observedCostSaved: {
      status: "available",
      amount: 200,
      observedDispatchN: 20,
      totalDispatchN: 20,
      currency: "KRW",
      unit: "won",
    },
    observedVisits: { preSendN: 1, postClickN: 2, postSendNonClickN: 3, postSendUnknownClickN: 0 },
    scenarioValues: [
      {
        scenario: "click-only",
        status: "available",
        excludedVisitSubjectN: 2,
        excludedFinancialEventN: 1,
        excludedObservedRevenue: 100,
      },
      {
        scenario: "post-send-inclusive",
        status: "available",
        excludedVisitSubjectN: 5,
        excludedFinancialEventN: 2,
        excludedObservedRevenue: 200,
      },
    ],
    sourceCoverage: {
      subjectN: 100,
      historicalTraitsN: 100,
      dispatchN: 100,
      observedCostN: 100,
      touchpointsN: 100,
      outcomesN: 100,
    },
    assumptions: ["Constant unit price assumption"],
    limitations: ["No causal effect established"],
  },
};
function render(state: TargetingImpactInspectorState): string {
  return renderToStaticMarkup(
    createElement(TargetingImpactInspector, { state, onReplay: () => {}, onExport: () => {} }),
  );
}
describe("TargetingImpactInspector", () => {
  it("separates observed costs, temporal visits and scenario assumptions with report provenance", () => {
    const html = render({ kind: "ready", report });
    for (const text of [
      "200 KRW",
      "Visits before send",
      "Post-click visits",
      "without a prior click",
      "Click only",
      "Post-send inclusive",
      "not causal estimates",
      "historical-snapshot",
      "definition-fixed",
      "preserve-v1",
      "100 / 100",
      "Export aggregate report",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("eligible");
  });
  it.each(["loading", "empty", "denied"] as const)(
    "renders %s without leaking earlier report data",
    (kind) => {
      const html = render({ kind });
      expect(html).toContain(`data-state="${kind}"`);
      expect(html).not.toContain("historical-snapshot");
      expect(html).not.toContain("Export aggregate report");
      if (kind === "loading" || kind === "denied") expect(html).toContain("disabled");
    },
  );
  it("preserves unavailable evidence and explicit recovery", () => {
    const html = render({ kind: "unavailable", missingHistoryN: 100 });
    expect(html).toContain("unavailable for 100");
    expect(html).toContain("Import decision-time history");
    expect(html).not.toContain("Observed dispatch cost");
  });
  it("shows provider diagnostic codes and retry action", () => {
    const html = render({ kind: "error", code: "SOURCE_FAILED" });
    expect(html).toContain("SOURCE_FAILED");
    expect(html).toContain("Compare filters");
  });
  it("marks partial costs and scenarios unavailable without formatting them as zero", () => {
    const partial = {
      ...report,
      result: {
        ...report.result,
        observedCostSaved: {
          ...report.result.observedCostSaved,
          status: "unavailable" as const,
          amount: null,
        },
        scenarioValues: report.result.scenarioValues.map((value) => ({
          ...value,
          status: "unavailable" as const,
        })),
      },
    };
    const html = render({ kind: "partial", report: partial });
    expect(html).toContain("Partial evidence");
    expect(html).toContain("Unavailable");
    expect(html).not.toContain("200 KRW");
  });
});
