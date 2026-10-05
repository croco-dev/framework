import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActivationCandidateExplorer } from "../libs/ActivationCandidateExplorer";
import type { ActivationExplorerState } from "@croco/admin-core";
import type { ActivationReport } from "@croco/metrics-core";
const report: ActivationReport = {
  definition: {
    id: "activation",
    version: 1,
    subjectKind: "user",
    cohortPolicy: "new",
    timezone: "UTC",
    unit: "subjects",
    sourceRevisions: { events: "v1" },
    sourceRunRef: "run-1",
    minSupport: 0,
    maxRows: 1000,
    maxCandidates: 10,
    windows: [{ id: "first", fromMs: 0, toMs: 1000 }],
    outcomeWindow: { fromMs: 1000, toMs: 2000 },
    candidates: [
      {
        id: "publish",
        actionId: "publish",
        windowId: "first",
        threshold: 1,
        countMode: "frequency",
      },
    ],
  },
  rowCount: 100,
  candidates: [
    {
      candidate: {
        id: "publish",
        actionId: "publish",
        windowId: "first",
        threshold: 1,
        countMode: "frequency",
      },
      cohort: "new",
      eligibleN: 100,
      DO: 40,
      RE: 30,
      NO: 20,
      support: { value: 0.4, zeroDenominatorReason: null },
      passesMinSupport: true,
      precision: { value: 0.75, zeroDenominatorReason: null },
      coverage: { value: 0.6, zeroDenominatorReason: null },
      noRedo: { value: 0.5, zeroDenominatorReason: null },
      excluded: { cohort: 0, missingOutcome: 2, incompleteObservation: 1, missingCount: 3 },
      achievementCurve: { status: "unsupported", reason: "missingVerifiedAchievementTimes" },
    },
  ],
};
function render(state: ActivationExplorerState, canWrite = true): string {
  return renderToStaticMarkup(
    createElement(ActivationCandidateExplorer, {
      state,
      canWrite,
      load: vi.fn(),
      save: vi.fn(),
      exportSaved: vi.fn(),
    }),
  );
}
describe("ActivationCandidateExplorer", () => {
  it("shows all counts, independently labelled ratios, metadata and exclusions without automatic selection", () => {
    const html = render({ kind: "ready", report });
    for (const value of [
      "75.0%",
      "60.0%",
      "50.0%",
      "40.0%",
      "NOREDO",
      "Precision",
      "Coverage",
      "run-1",
      "UTC",
      "missingOutcome",
      "incompleteObservation",
      "missingCount",
    ])
      expect(html).toContain(value);
    expect(html).toContain("RE / (NO + DO)");
    expect(html).toContain("do not establish causation");
    expect(html).toContain("overflow-x:auto");
    expect(html).not.toContain('checked=""');
    expect(html).toContain('disabled="">Save selected candidate');
  });
  it.each(["loading", "empty", "denied", "error", "partial"] as const)(
    "renders %s explicitly",
    (kind) => {
      const state: ActivationExplorerState =
        kind === "partial"
          ? { kind, report }
          : kind === "denied" || kind === "error"
            ? { kind, code: "source-failed" }
            : { kind };
      const html = render(state);
      expect(html).toContain(
        {
          loading: "Loading activation candidates",
          empty: "No activation candidates",
          denied: "Access denied",
          error: "Could not load",
          partial: "Partial evidence",
        }[kind],
      );
    },
  );
  it("shows zero-denominator reasons and disables writing without permission", () => {
    const first = report.candidates[0]!;
    const html = render(
      {
        kind: "ready",
        report: {
          ...report,
          candidates: [
            {
              ...first,
              support: { value: null, zeroDenominatorReason: "noEligibleSubjects" },
              precision: { value: null, zeroDenominatorReason: "noAchievedSubjects" },
            },
          ],
        },
      },
      false,
    );
    expect(html).toContain("Unavailable: noEligibleSubjects");
    expect(html).toContain("Unavailable: noAchievedSubjects");
    expect(html).toContain("Report write permission is required");
  });
});
