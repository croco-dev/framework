import { Problem, ProblemCategory } from "@croco/problems-core";

export type GrowthScope = { appId: string; environment: string; tenantId: string };
export type GrowthStateDefinition = { id: string; label: string; evidence: string };
/** Periods are ordered integer indices in the declared cadence, not elapsed milliseconds. */
export type GrowthModel = {
  id: string;
  version: string;
  unit: string;
  period: string;
  stateDefinitions: readonly GrowthStateDefinition[];
  transitionEstimationWindow: { from: number; to: number };
  definitionCutoff: number;
  purpose: string;
  assumptions: readonly string[];
};
export type GrowthLimits = { maxStates: number; maxHorizon: number; maxRows: number };
export const DEFAULT_GROWTH_LIMITS: GrowthLimits = Object.freeze({
  maxStates: 32,
  maxHorizon: 104,
  maxRows: 100_000,
});
export type GrowthPopulation = { period: number; values: readonly number[]; complete: boolean };
export type GrowthTransition = {
  from: number;
  counts: readonly (readonly number[])[];
  inflows: readonly number[];
  complete: boolean;
};
export type GrowthDataset = {
  scope: GrowthScope;
  unit: string;
  period: string;
  stateIds: readonly string[];
  sourceRevision: string;
  populations: readonly GrowthPopulation[];
  transitions: readonly GrowthTransition[];
  partitionValidation: "subject-history" | "aggregate-only";
  diagnostics: readonly {
    period: number;
    reason: "missing-state" | "incomplete-period";
    count: number;
  }[];
};
export type GrowthScenario = {
  horizon: number;
  initialPopulation: readonly number[];
  inflows: {
    unit: string;
    values: readonly (readonly number[])[];
    label: "assumption";
    rationale: string;
  };
  matrixOverrides: readonly {
    stateId: string;
    row: readonly number[];
    method: "replace-row";
    rationale: string;
  }[];
};
export type GrowthEstimate = {
  matrix: readonly (readonly number[])[];
  method: "pooled-transition-counts";
  window: { from: number; to: number };
  includedPeriods: readonly number[];
  excludedPeriods: readonly number[];
  rowDenominators: readonly number[];
};
export type GrowthProjection = {
  method: "first-order-markov";
  convention: "row-vector";
  label: "calculated-expectation";
  scenarioLabel: "assumption";
  unit: string;
  period: string;
  matrix: readonly (readonly number[])[];
  populations: readonly (readonly number[])[];
};
export type GrowthBacktest = {
  trainEnd: number;
  testWindow: { from: number; to: number };
  baselineMethod: "last-value";
  errorMetric: "MAE" | "MAPE";
  errorUnit: string;
  meanModelError: number | null;
  meanBaselineError: number | null;
  summaryReason: "undefined-cell-errors" | null;
  results: readonly {
    period: number;
    stateId: string;
    actual: number | null;
    projected: number;
    baseline: number;
    modelError: number | null;
    baselineError: number | null;
    reason: "incomplete-period" | "actual-zero" | null;
  }[];
};
export class GrowthModelProblem extends Problem {
  constructor(readonly field: string) {
    super(
      "metrics-core/invalid-growth-model",
      ProblemCategory.ValidationError,
      `Invalid growth model: ${field}`,
    );
  }
}
function requireValue(condition: boolean, field: string): asserts condition {
  if (!condition) throw new GrowthModelProblem(field);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 2000;
}
function index(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
function amount(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}
function vector(values: readonly number[], n: number, field: string) {
  requireValue(
    Array.isArray(values) && values.length === n && Array.from(values).every(amount),
    field,
  );
}
function limits(input: GrowthLimits) {
  requireValue(
    input != null &&
      [input.maxStates, input.maxHorizon, input.maxRows].every((v) => index(v) && v > 0),
    "limits",
  );
}
export function validateGrowthScope(scope: GrowthScope): void {
  requireValue(
    scope != null && [scope.appId, scope.environment, scope.tenantId].every(text),
    "scope",
  );
}
/** Does not infer a partition from aggregate counts or impose business state names. */
export function validateStatePartition(
  model: GrowthModel,
  bounds: GrowthLimits = DEFAULT_GROWTH_LIMITS,
): void {
  limits(bounds);
  requireValue(
    model != null && [model.id, model.version, model.unit, model.period, model.purpose].every(text),
    "model",
  );
  requireValue(
    Array.isArray(model.stateDefinitions) &&
      model.stateDefinitions.length > 0 &&
      model.stateDefinitions.length <= bounds.maxStates &&
      Array.from(model.stateDefinitions).every(
        (s) => s != null && [s.id, s.label, s.evidence].every(text),
      ),
    "stateDefinitions",
  );
  requireValue(
    new Set(model.stateDefinitions.map((s) => s.id)).size === model.stateDefinitions.length,
    "duplicate-state",
  );
  requireValue(
    Array.isArray(model.assumptions) &&
      model.assumptions.length <= 100 &&
      Array.from(model.assumptions).every(text),
    "assumptions",
  );
  const window = model.transitionEstimationWindow;
  requireValue(
    window != null &&
      index(window.from) &&
      index(window.to) &&
      window.from < window.to &&
      index(model.definitionCutoff) &&
      model.definitionCutoff <= window.to,
    "estimation-window",
  );
}
export function validateGrowthMatrix(matrix: readonly (readonly number[])[], states: number): void {
  requireValue(Array.isArray(matrix) && matrix.length === states, "matrix-dimension");
  for (const row of matrix) {
    vector(row, states, "matrix-row");
    requireValue(
      row.every((v: number) => v <= 1) &&
        Math.abs(row.reduce((a: number, b: number) => a + b, 0) - 1) <= 1e-9,
      "matrix-probability",
    );
  }
}
export function validateGrowthDataset(
  model: GrowthModel,
  data: GrowthDataset,
  bounds: GrowthLimits = DEFAULT_GROWTH_LIMITS,
): void {
  validateStatePartition(model, bounds);
  requireValue(data != null, "dataset");
  validateGrowthScope(data.scope);
  const n = model.stateDefinitions.length;
  requireValue(
    data.unit === model.unit && data.period === model.period && text(data.sourceRevision),
    "dataset-unit",
  );
  requireValue(
    Array.isArray(data.stateIds) &&
      JSON.stringify(data.stateIds) === JSON.stringify(model.stateDefinitions.map((s) => s.id)),
    "dataset-states",
  );
  requireValue(
    ["subject-history", "aggregate-only"].includes(data.partitionValidation),
    "partition-validation",
  );
  requireValue(
    Array.isArray(data.populations) &&
      Array.isArray(data.transitions) &&
      data.populations.length + data.transitions.length <= bounds.maxRows &&
      data.populations.length > 0,
    "dataset-budget",
  );
  const populations = new Map<number, GrowthPopulation>();
  for (const population of data.populations) {
    requireValue(
      population != null &&
        index(population.period) &&
        !populations.has(population.period) &&
        typeof population.complete === "boolean",
      "population-period",
    );
    vector(population.values, n, "population");
    populations.set(population.period, population);
  }
  const seen = new Set<number>();
  for (const transition of data.transitions) {
    requireValue(
      transition != null &&
        index(transition.from) &&
        !seen.has(transition.from) &&
        typeof transition.complete === "boolean",
      "transition-period",
    );
    seen.add(transition.from);
    requireValue(
      Array.isArray(transition.counts) && transition.counts.length === n,
      "counts-dimension",
    );
    for (const row of transition.counts) {
      vector(row, n, "counts");
      requireValue(row.every(Number.isSafeInteger), "integer-counts");
    }
    vector(transition.inflows, n, "inflows");
    const start = populations.get(transition.from),
      end = populations.get(transition.from + 1);
    requireValue(start !== undefined && end !== undefined, "transition-populations");
    if (transition.complete) {
      requireValue(start.complete && end.complete, "transition-completeness");
      requireValue(
        transition.counts.every(
          (row: readonly number[], i: number) =>
            row.reduce((a: number, b: number) => a + b, 0) === start.values[i],
        ),
        "origin-counts",
      );
      requireValue(
        end.values.every(
          (v, j) =>
            v ===
            transition.counts.reduce(
              (sum: number, row: readonly number[]) => sum + (row[j] ?? 0),
              0,
            ) +
              (transition.inflows[j] ?? 0),
        ),
        "destination-counts",
      );
    }
  }
  requireValue(
    Array.isArray(data.diagnostics) &&
      data.diagnostics.length <= bounds.maxRows &&
      Array.from(data.diagnostics).every(
        (d) =>
          d != null &&
          index(d.period) &&
          index(d.count) &&
          ["missing-state", "incomplete-period"].includes(d.reason),
      ),
    "diagnostics",
  );
}
/** Never fills an unobserved row with a self loop. The to index is the training population cutoff. */
export function estimateTransitionMatrix(
  model: GrowthModel,
  data: GrowthDataset,
  bounds: GrowthLimits = DEFAULT_GROWTH_LIMITS,
): GrowthEstimate {
  validateGrowthDataset(model, data, bounds);
  const { from, to } = model.transitionEstimationWindow;
  const n = model.stateDefinitions.length;
  const counts = Array.from({ length: n }, () => Array<number>(n).fill(0));
  const includedPeriods: number[] = [],
    excludedPeriods: number[] = [];
  requireValue(to - from <= bounds.maxRows, "estimation-budget");
  const transitions = new Map(data.transitions.map((t) => [t.from, t]));
  for (let p = from; p < to; p++) {
    const transition = transitions.get(p);
    if (!transition?.complete) {
      excludedPeriods.push(p);
      continue;
    }
    includedPeriods.push(p);
    transition.counts.forEach((row, i) =>
      row.forEach((v, j) => {
        const target = counts[i];
        requireValue(target !== undefined, "count-row");
        target[j] = (target[j] ?? 0) + v;
        requireValue(amount(target[j]), "count-overflow");
      }),
    );
  }
  const rowDenominators = counts.map((row) => row.reduce((a: number, b: number) => a + b, 0));
  requireValue(
    rowDenominators.every((v) => amount(v) && v > 0),
    "unobserved-row",
  );
  const matrix = counts.map((row, i) => row.map((v) => v / (rowDenominators[i] ?? 0)));
  validateGrowthMatrix(matrix, n);
  return {
    matrix,
    method: "pooled-transition-counts",
    window: { from, to },
    includedPeriods,
    excludedPeriods,
    rowDenominators,
  };
}
export function projectGrowthModel(
  model: GrowthModel,
  matrix: readonly (readonly number[])[],
  scenario: GrowthScenario,
  bounds: GrowthLimits = DEFAULT_GROWTH_LIMITS,
): GrowthProjection {
  validateStatePartition(model, bounds);
  const n = model.stateDefinitions.length;
  validateGrowthMatrix(matrix, n);
  requireValue(
    scenario != null &&
      index(scenario.horizon) &&
      scenario.horizon > 0 &&
      scenario.horizon <= bounds.maxHorizon,
    "horizon",
  );
  vector(scenario.initialPopulation, n, "initial-population");
  requireValue(
    scenario.inflows != null &&
      scenario.inflows.unit === model.unit &&
      scenario.inflows.label === "assumption" &&
      text(scenario.inflows.rationale) &&
      Array.isArray(scenario.inflows.values) &&
      scenario.inflows.values.length === scenario.horizon,
    "inflow-unit-or-horizon",
  );
  for (const values of scenario.inflows.values) vector(values, n, "inflow");
  const effective = matrix.map((row) => [...row]);
  requireValue(
    Array.isArray(scenario.matrixOverrides) &&
      scenario.matrixOverrides.length <= n &&
      Array.from(scenario.matrixOverrides).every((o) => o != null) &&
      new Set(scenario.matrixOverrides.map((o) => o.stateId)).size ===
        scenario.matrixOverrides.length,
    "overrides",
  );
  for (const override of scenario.matrixOverrides) {
    const i = model.stateDefinitions.findIndex((s) => s.id === override.stateId);
    requireValue(
      i >= 0 && override.method === "replace-row" && text(override.rationale),
      "override-method",
    );
    vector(override.row, n, "override-row");
    effective[i] = [...override.row];
  }
  validateGrowthMatrix(effective, n);
  const populations = [[...scenario.initialPopulation]];
  for (const inflow of scenario.inflows.values) {
    const previous = populations[populations.length - 1];
    requireValue(previous !== undefined, "initial-population");
    const next = inflow.map((v: number, j: number) =>
      previous.reduce((sum, count, i) => sum + count * (effective[i]?.[j] ?? 0), v),
    );
    vector(next, n, "projection-overflow");
    populations.push(next);
  }
  return {
    method: "first-order-markov",
    convention: "row-vector",
    label: "calculated-expectation",
    scenarioLabel: "assumption",
    unit: model.unit,
    period: model.period,
    matrix: effective,
    populations,
  };
}
export function backtestGrowthModel(
  model: GrowthModel,
  data: GrowthDataset,
  options: {
    trainEnd: number;
    testWindow: { from: number; to: number };
    errorMetric: "MAE" | "MAPE";
    inflows: GrowthScenario["inflows"];
  },
  bounds: GrowthLimits = DEFAULT_GROWTH_LIMITS,
): GrowthBacktest {
  validateGrowthDataset(model, data, bounds);
  requireValue(
    options != null &&
      options.testWindow != null &&
      index(options.trainEnd) &&
      model.definitionCutoff <= options.trainEnd &&
      options.trainEnd === model.transitionEstimationWindow.to &&
      options.testWindow.from === options.trainEnd + 1 &&
      index(options.testWindow.to) &&
      options.testWindow.to >= options.testWindow.from &&
      ["MAE", "MAPE"].includes(options.errorMetric),
    "backtest-cutoff",
  );
  const observedPopulations = new Map(data.populations.map((p) => [p.period, p]));
  const initial = observedPopulations.get(options.trainEnd);
  requireValue(initial?.complete === true, "backtest-initial");
  const estimate = estimateTransitionMatrix(model, data, bounds);
  const projection = projectGrowthModel(
    model,
    estimate.matrix,
    {
      horizon: options.testWindow.to - options.trainEnd,
      initialPopulation: initial.values,
      inflows: options.inflows,
      matrixOverrides: [],
    },
    bounds,
  );
  const results: GrowthBacktest["results"][number][] = [];
  for (let p = options.testWindow.from; p <= options.testWindow.to; p++) {
    const actual = observedPopulations.get(p);
    model.stateDefinitions.forEach((state, i) => {
      const observed = actual?.complete ? (actual.values[i] ?? null) : null;
      const projected = projection.populations[p - options.trainEnd]?.[i] ?? 0;
      const baseline = initial.values[i] ?? 0;
      const reason =
        observed === null
          ? "incomplete-period"
          : options.errorMetric === "MAPE" && observed === 0
            ? "actual-zero"
            : null;
      const error = (expected: number) => {
        if (reason !== null || observed === null) return null;
        const value =
          options.errorMetric === "MAE"
            ? Math.abs(expected - observed)
            : Math.abs(expected - observed) / observed;
        requireValue(Number.isFinite(value), "backtest-overflow");
        return value;
      };
      results.push({
        period: p,
        stateId: state.id,
        actual: observed,
        projected,
        baseline,
        modelError: error(projected),
        baselineError: error(baseline),
        reason,
      });
    });
  }
  const unavailable = results.some((r) => r.reason !== null);
  const mean = (key: "modelError" | "baselineError") =>
    unavailable ? null : results.reduce((sum, r) => sum + (r[key] ?? 0) / results.length, 0);
  const meanModelError = mean("modelError");
  const meanBaselineError = mean("baselineError");
  requireValue(
    (meanModelError === null || Number.isFinite(meanModelError)) &&
      (meanBaselineError === null || Number.isFinite(meanBaselineError)),
    "backtest-overflow",
  );
  return {
    trainEnd: options.trainEnd,
    testWindow: { from: options.testWindow.from, to: options.testWindow.to },
    baselineMethod: "last-value",
    errorMetric: options.errorMetric,
    errorUnit: options.errorMetric === "MAE" ? model.unit : "fraction",
    meanModelError,
    meanBaselineError,
    summaryReason: unavailable ? "undefined-cell-errors" : null,
    results,
  };
}
