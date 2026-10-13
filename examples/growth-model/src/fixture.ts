import { importGrowthCounts } from "@croco/metrics-core";
import type { GrowthWorkbenchRequest } from "@croco/admin-core";
export const scope = { appId: "growth-demo", environment: "synthetic", tenantId: "demo-tenant" };
export const request: GrowthWorkbenchRequest = {
  scope,
  sourceRevision: "synthetic-counts-v1",
  model: {
    id: "adoption",
    version: "v1",
    unit: "users",
    period: "week",
    stateDefinitions: [
      {
        id: "new",
        label: "Not activated",
        evidence: "Has not completed the declared value action",
      },
      { id: "active", label: "Activated", evidence: "Completed the declared value action" },
    ],
    definitionCutoff: 0,
    transitionEstimationWindow: { from: 0, to: 2 },
    purpose: "Compare finite adoption scenarios against historical evidence",
    assumptions: [
      "Synthetic data — does not establish real predictive power",
      "First-order Markov; fixed cadence and state definitions",
    ],
  },
  scenario: {
    horizon: 3,
    initialPopulation: [100, 0],
    inflows: {
      unit: "users",
      label: "assumption",
      rationale: "No incoming population during this comparison",
      values: [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    },
    matrixOverrides: [],
  },
  backtest: {
    trainEnd: 2,
    testWindow: { from: 3, to: 3 },
    errorMetric: "MAE",
    inflows: {
      unit: "users",
      label: "assumption",
      rationale: "Zero incoming population declared before cutoff",
      values: [[0, 0]],
    },
  },
};
export function dataset(mode = "ready") {
  return importGrowthCounts(request.model, {
    scope,
    sourceRevision: request.sourceRevision,
    unit: "users",
    period: "week",
    stateIds: ["new", "active"],
    populations: [
      { period: 0, values: [10, 10], complete: true },
      { period: 1, values: [9, 11], complete: true },
      { period: 2, values: [10, 10], complete: mode !== "partial" },
      { period: 3, values: [0, 20], complete: true },
    ],
    transitions:
      mode === "empty"
        ? []
        : [
            {
              from: 0,
              counts: [
                [8, 2],
                [1, 9],
              ],
              inflows: [0, 0],
              complete: true,
            },
            {
              from: 1,
              counts: [
                [8, 1],
                [2, 9],
              ],
              inflows: [0, 0],
              complete: mode !== "partial",
            },
          ],
  });
}
