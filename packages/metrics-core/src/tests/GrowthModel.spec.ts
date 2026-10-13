import { describe, expect, it } from "vitest";
import {
  validateStatePartition,
  validateGrowthMatrix,
  estimateTransitionMatrix,
  projectGrowthModel,
  backtestGrowthModel,
  GrowthModelProblem,
} from "../libs/growth/GrowthModel";
import {
  collectGrowthHistory,
  importGrowthHistory,
  importGrowthCounts,
} from "../libs/growth/GrowthSources";
import type { GrowthModel, GrowthDataset, GrowthScenario } from "../libs/growth/GrowthModel";

const model: GrowthModel = {
  id: "adoption",
  version: "v1",
  unit: "users",
  period: "week",
  stateDefinitions: [
    { id: "new", label: "New", evidence: "Not yet active" },
    { id: "active", label: "Active", evidence: "Used feature" },
  ],
  transitionEstimationWindow: { from: 0, to: 2 },
  definitionCutoff: 0,
  purpose: "Compare adoption assumptions",
  assumptions: ["First order only"],
};
const scope = { appId: "app", environment: "test", tenantId: "tenant" };
const dataset: GrowthDataset = {
  scope,
  unit: "users",
  period: "week",
  stateIds: ["new", "active"],
  sourceRevision: "run-1",
  partitionValidation: "aggregate-only",
  diagnostics: [],
  populations: [
    { period: 0, values: [10, 10], complete: true },
    { period: 1, values: [9, 11], complete: true },
    { period: 2, values: [10, 10], complete: true },
    { period: 3, values: [0, 20], complete: true },
  ],
  transitions: [
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
      complete: true,
    },
    {
      from: 2,
      counts: [
        [0, 10],
        [0, 10],
      ],
      inflows: [0, 0],
      complete: true,
    },
  ],
};
const scenario: GrowthScenario = {
  horizon: 2,
  initialPopulation: [100, 0],
  inflows: {
    unit: "users",
    values: [
      [0, 0],
      [0, 0],
    ],
    label: "assumption",
    rationale: "No new users",
  },
  matrixOverrides: [],
};
async function* rows(values: readonly Record<string, unknown>[]) {
  yield* values;
}

describe("GrowthModel", () => {
  it("decodes actual CSV and JSONL with the shared parser and explicit numeric periods", async () => {
    const metadata = {
      scope,
      unit: "users",
      period: "week",
      sourceRevision: "import-1",
      periods: [
        { index: 0, complete: true },
        { index: 1, complete: true },
      ],
    };
    const binding = { subjectId: "subject", stateId: "state", period: "period" };
    const fields = [
      { name: "subject", type: "string" as const },
      { name: "state", type: "string" as const },
      { name: "period", type: "number" as const },
    ];
    const limits = { maxBytes: 2000, maxRecords: 10, maxRowBytes: 1000 };
    async function* bytes(text: string) {
      yield new TextEncoder().encode(text);
    }
    const jsonl =
      '{"subject":"u1","state":"new","period":0}\n{"subject":"u1","state":"active","period":1}\n';
    const csv = "subject,state,period\nu1,new,0\nu1,active,1\n";
    const a = await importGrowthHistory(
      bytes(jsonl),
      { format: "jsonl", encoding: "utf-8", fields, limits },
      model,
      metadata,
      binding,
    );
    const b = await importGrowthHistory(
      bytes(csv),
      { format: "csv", header: true, encoding: "utf-8", fields, limits },
      model,
      metadata,
      binding,
    );
    expect(a).toEqual(b);
    expect(a.transitions[0]?.counts).toEqual([
      [0, 1],
      [0, 0],
    ]);
  });

  it("uses row vectors, preserves mass, adds only the declared inflows and never rounds internally", () => {
    const result = projectGrowthModel(
      model,
      [
        [0.8, 0.2],
        [0.1, 0.9],
      ],
      scenario,
    );
    expect(result.populations).toEqual([
      [100, 0],
      [80, 20],
      [66, 34],
    ]);
    const withInflows = projectGrowthModel(
      model,
      [
        [0.8, 0.2],
        [0.1, 0.9],
      ],
      {
        ...scenario,
        inflows: {
          ...scenario.inflows,
          values: [
            [3.25, 1.5],
            [0, 0],
          ],
        },
      },
    );
    expect(withInflows.populations[1]).toEqual([83.25, 21.5]);
    expect(withInflows.populations[2]?.reduce((a, b) => a + b, 0)).toBeCloseTo(104.75);
    expect(withInflows.scenarioLabel).toBe("assumption");
  });
  it("requires an explicit complete replacement row for an assumed intervention", () => {
    expect(
      projectGrowthModel(
        model,
        [
          [0.8, 0.2],
          [0.1, 0.9],
        ],
        {
          ...scenario,
          matrixOverrides: [
            {
              stateId: "new",
              row: [0.7, 0.3],
              method: "replace-row",
              rationale: "Transfer 0.1 from persistence to activation",
            },
          ],
        },
      ).populations[1],
    ).toEqual([70, 30]);
    expect(() =>
      projectGrowthModel(
        model,
        [
          [0.8, 0.2],
          [0.1, 0.9],
        ],
        {
          ...scenario,
          matrixOverrides: [
            { stateId: "new", row: [0.8, 0.3], method: "replace-row", rationale: "Bad row" },
          ],
        },
      ),
    ).toThrow(GrowthModelProblem);
  });
  it.each(
    [
      [
        [0.8, 0.3],
        [0.1, 0.9],
      ],
      [
        [-0.1, 1.1],
        [0.1, 0.9],
      ],
      [
        [NaN, 1],
        [0.1, 0.9],
      ],
      [
        [Infinity, 0],
        [0.1, 0.9],
      ],
      [
        [0, 0],
        [0.1, 0.9],
      ],
      [[1], [0.1, 0.9]],
    ].map((matrix) => ({ matrix })),
  )("rejects invalid matrix $matrix", ({ matrix }) => {
    expect(() => validateGrowthMatrix(matrix, 2)).toThrow(GrowthModelProblem);
  });
  it("rejects duplicate states, mismatched units and an exceeded finite horizon", () => {
    expect(() =>
      validateStatePartition({
        ...model,
        stateDefinitions: [model.stateDefinitions[0], model.stateDefinitions[0]],
      } as GrowthModel),
    ).toThrow(GrowthModelProblem);
    expect(() =>
      projectGrowthModel(
        model,
        [
          [0.8, 0.2],
          [0.1, 0.9],
        ],
        { ...scenario, inflows: { ...scenario.inflows, unit: "accounts" } },
      ),
    ).toThrow(GrowthModelProblem);
    expect(() =>
      projectGrowthModel(
        model,
        [
          [0.8, 0.2],
          [0.1, 0.9],
        ],
        { ...scenario, horizon: 105 },
      ),
    ).toThrow(GrowthModelProblem);
  });
  it("pools only fully observed training transitions with an independent count oracle", () => {
    const result = estimateTransitionMatrix(model, dataset);
    expect(result.rowDenominators).toEqual([19, 21]);
    expect(result.matrix).toEqual([
      [16 / 19, 3 / 19],
      [3 / 21, 18 / 21],
    ]);
    expect(result.includedPeriods).toEqual([0, 1]);
    const changedFuture = {
      ...structuredClone(dataset),
      transitions: [...dataset.transitions],
      populations: [...dataset.populations],
    };
    changedFuture.transitions[2] = {
      from: 2,
      counts: [
        [10, 0],
        [10, 0],
      ],
      inflows: [0, 0],
      complete: true,
    };
    changedFuture.populations[3] = { period: 3, values: [20, 0], complete: true };
    expect(estimateTransitionMatrix(model, changedFuture)).toEqual(result);
  });
  it("never invents a self loop for an unobserved row and retains excluded periods", () => {
    const unknown = {
      ...dataset,
      transitions: dataset.transitions.map((t) => ({ ...t, complete: false })),
    };
    expect(() => estimateTransitionMatrix(model, unknown)).toThrowError(/unobserved-row/);
    const partial = {
      ...dataset,
      transitions: dataset.transitions.map((t) => (t.from === 1 ? { ...t, complete: false } : t)),
    };
    expect(estimateTransitionMatrix(model, partial).excludedPeriods).toEqual([1]);
  });
  it("keeps a fixed training cutoff, compares last-value, and represents undefined MAPE", () => {
    const options = {
      trainEnd: 2,
      testWindow: { from: 3, to: 3 },
      errorMetric: "MAE" as const,
      inflows: { ...scenario.inflows, values: [[0, 0]] },
    };
    const report = backtestGrowthModel(model, dataset, options);
    expect(report.results[0]?.projected).toBeCloseTo(160 / 19 + 30 / 21);
    expect(report.results[0]?.baseline).toBe(10);
    expect(report.results[0]?.baselineError).toBe(10);
    expect(report.meanBaselineError).toBe(10);
    expect(report.results[1]?.baselineError).toBe(10);
    const mape = backtestGrowthModel(model, dataset, { ...options, errorMetric: "MAPE" });
    expect(mape.meanModelError).toBeNull();
    expect(mape.summaryReason).toBe("undefined-cell-errors");
    expect(mape.results[0]).toMatchObject({
      actual: 0,
      modelError: null,
      baselineError: null,
      reason: "actual-zero",
    });
    const missing = {
      ...dataset,
      populations: dataset.populations.map((p) => (p.period === 3 ? { ...p, complete: false } : p)),
      transitions: dataset.transitions.filter((t) => t.from < 2),
    };
    expect(
      backtestGrowthModel(model, missing, options).results.every(
        (r) => r.actual === null && r.reason === "incomplete-period",
      ),
    ).toBe(true);
    expect(() => backtestGrowthModel({ ...model, definitionCutoff: 3 }, dataset, options)).toThrow(
      GrowthModelProblem,
    );
  });
  it("imports real normalized history, detects duplicates and preserves missing memberships", async () => {
    const metadata = {
      scope,
      unit: "users",
      period: "week",
      sourceRevision: "rows-1",
      periods: [
        { index: 0, complete: true },
        { index: 1, complete: true },
      ],
    };
    const binding = { subjectId: "subject", stateId: "state", period: "period" };
    const input = [
      { subject: "u1", state: "new", period: 0 },
      { subject: "u2", state: "active", period: 0 },
      { subject: "u1", state: "active", period: 1 },
      { subject: "u2", state: "active", period: 1 },
    ];
    const result = await collectGrowthHistory(rows(input), model, metadata, binding);
    expect(result.transitions[0]).toEqual({
      from: 0,
      counts: [
        [0, 1],
        [0, 1],
      ],
      inflows: [0, 0],
      complete: true,
    });
    expect(result.partitionValidation).toBe("subject-history");
    await expect(
      collectGrowthHistory(
        rows([...input, { subject: "u1", state: "new", period: 1 }]),
        model,
        metadata,
        binding,
      ),
    ).rejects.toThrowError(/duplicate-subject-period/);
    const missing = await collectGrowthHistory(rows(input.slice(0, 3)), model, metadata, binding);
    expect(missing.diagnostics).toContainEqual({ period: 1, reason: "missing-state", count: 1 });
    expect(missing.transitions[0]?.complete).toBe(false);
    await expect(
      collectGrowthHistory(rows(input), model, metadata, binding, {
        maxStates: 2,
        maxHorizon: 2,
        maxRows: 3,
      }),
    ).rejects.toThrowError(/history-row-budget/);
  });
  it("imports counts with an explicit partition limitation and rejects inconsistent populations", () => {
    expect(importGrowthCounts(model, dataset).partitionValidation).toBe("aggregate-only");
    expect(() =>
      importGrowthCounts(model, {
        ...dataset,
        populations: dataset.populations.map((p) =>
          p.period === 0 ? { ...p, values: [11, 10] } : p,
        ),
      }),
    ).toThrowError(/origin-counts/);
  });
});
