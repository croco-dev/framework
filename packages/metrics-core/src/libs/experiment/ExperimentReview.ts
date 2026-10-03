import { Problem, ProblemCategory } from "@croco/problems-core";

export type ExperimentRandomizationUnit = "unit" | "cluster";
export type ExperimentOutcomeKind = "binary" | "mean";
export type ExperimentMetricRole = "primary" | "guardrail" | "exploratory";
export type QualityResult = "pass_signal" | "warning" | "not_assessed";

export type ExperimentVariantInput = {
  readonly id: string;
  readonly plannedShare: number;
};

export type ExperimentAnalysisPlan = {
  readonly experimentId: string;
  readonly revision: string;
  readonly primaryMetricId: string;
  readonly randomizationUnit: ExperimentRandomizationUnit;
  readonly outcomeKind: ExperimentOutcomeKind;
  readonly observedWindow: { readonly from: string; readonly to: string };
  readonly variants: readonly ExperimentVariantInput[];
  readonly srmWarningThreshold: number;
  readonly preTreatmentAttributes: readonly string[];
  readonly method?: string;
  readonly unit?: string;
};

export type ExperimentAssignment = {
  readonly unitId: string;
  readonly variantId: string;
  readonly clusterId?: string;
  readonly attributes: Readonly<Record<string, string | number | boolean | null>>;
};

export type ExperimentExposure = {
  readonly unitId: string;
  readonly exposed: boolean;
  readonly actionObserved?: boolean;
  readonly outcomeObserved?: boolean;
};

export type ExperimentOutcome = {
  readonly unitId: string;
  readonly value: number | null;
  readonly complete: boolean;
};

export type ExperimentTreatmentReceipt = {
  readonly unitId: string;
  readonly variantId: string;
};

export type ExperimentProviderInterval = {
  readonly lower: number;
  readonly upper: number;
};

export type ExperimentProviderResultInput = {
  readonly estimate: number;
  readonly n: number;
  readonly method: string;
  readonly interval?: ExperimentProviderInterval;
  readonly unit?: string;
};

export type ExperimentDatasetInput = {
  readonly plan: ExperimentAnalysisPlan;
  readonly assignments: readonly ExperimentAssignment[];
  readonly exposures: readonly ExperimentExposure[];
  readonly preTreatmentFacts: Readonly<
    Record<string, Readonly<Record<string, string | number | boolean | null>>>
  >;
  readonly outcomes: readonly ExperimentOutcome[];
  readonly completeThrough: string;
  readonly factsAvailableThrough?: string;
  readonly treatmentReceived?: readonly ExperimentTreatmentReceipt[];
  readonly providerResults?: Readonly<Record<string, ExperimentProviderResultInput>>;
  readonly providerError?: string;
};

export type QualityCheck = {
  readonly kind: string;
  readonly result: QualityResult;
  readonly evidence: string;
  readonly limitations: string;
};

export type ExperimentSrmDetail = {
  readonly chiSquare: number;
  readonly degreesOfFreedom: number;
  readonly pValue: number;
  readonly plannedCounts: Readonly<Record<string, number>>;
  readonly actualCounts: Readonly<Record<string, number>>;
  readonly warningThreshold: number;
  readonly expectedCounts: Readonly<Record<string, number>>;
};

export type ExperimentSrm = {
  readonly status: QualityResult;
  readonly detail?: ExperimentSrmDetail;
  readonly reason: string;
};

export type ExperimentFunnelCounts = {
  readonly assigned: number;
  readonly exposed: number;
  readonly actioned: number;
  readonly outcomeObserved: number;
};

export type ExperimentVariantAggregate = {
  readonly variantId: string;
  readonly assigned: number;
  readonly exposed: number;
  readonly n: number;
  readonly estimate: number;
  readonly method: string;
  readonly observedWindow: { readonly from: string; readonly to: string };
  readonly availability: "complete" | "partial";
  readonly funnel: ExperimentFunnelCounts;
};

export type ExperimentMetricResult = {
  readonly n: number;
  readonly estimate: number;
  readonly method: string;
  readonly observedWindow: { readonly from: string; readonly to: string };
  readonly availability: "complete" | "partial";
  readonly interval?: ExperimentProviderInterval;
  readonly methodId?: string;
  readonly unit?: string;
};

export type ExperimentConditionalAggregate = {
  readonly variantId: string;
  readonly exposed: number;
  readonly nExposed: number;
  readonly estimate: number;
  readonly availability: "complete" | "partial";
};

export type ExperimentSliceCell = {
  readonly variantId: string;
  readonly attribute: string;
  readonly attributeValue: string;
  readonly assigned: number;
  readonly n: number;
  readonly estimate: number;
};

export type ExperimentSliceResult = {
  readonly attribute: string;
  readonly cells: Readonly<Record<string, ExperimentSliceCell>>;
};

export type ExperimentProviderSnapshot = {
  readonly results?: Readonly<Record<string, ExperimentMetricResult>>;
  readonly error?: string;
};

export type StandardizedMeanDifference = {
  readonly smd: number;
  readonly pooledSd: number;
  readonly reason: string;
};

export type ExperimentReviewInput = ExperimentDatasetInput & {
  readonly metricRole?: ExperimentMetricRole;
  readonly sliceAttribute?: string;
};

export type ExperimentReview = {
  readonly plan: ExperimentAnalysisPlan;
  readonly funnel: Readonly<Record<string, ExperimentFunnelCounts>>;
  readonly primary: Readonly<Record<string, ExperimentVariantAggregate>>;
  readonly conditional: Readonly<Record<string, ExperimentConditionalAggregate>>;
  readonly slices?: ExperimentSliceResult;
  readonly provider?: ExperimentProviderSnapshot;
  readonly srm: ExperimentSrm;
  readonly quality: readonly QualityCheck[];
  readonly observedWindow: { readonly from: string; readonly to: string };
  readonly outcomeKind: ExperimentOutcomeKind;
  readonly completeThrough: string;
};

export class ExperimentPlanProblem extends Problem {
  readonly code = "metrics-core/experiment-plan-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(detail: string) {
    super("metrics-core/experiment-plan-invalid", ProblemCategory.ValidationError, detail);
  }
}

export class ExperimentInputProblem extends Problem {
  readonly code = "metrics-core/experiment-input-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(detail: string) {
    super("metrics-core/experiment-input-invalid", ProblemCategory.ValidationError, detail);
  }
}

const SRM_MIN_EXPECTED = 5;
const MISSING_ATTRIBUTE_BUCKET = "__missing__";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failPlan(detail: string): never {
  throw new ExperimentPlanProblem(detail);
}

function failInput(detail: string): never {
  throw new ExperimentInputProblem(detail);
}

function checkPlan(plan: ExperimentAnalysisPlan): void {
  if (!plan.experimentId.trim() || !plan.revision.trim() || !plan.primaryMetricId.trim()) {
    failPlan("Experiment plan requires experimentId, revision, and primaryMetricId");
  }
  if (plan.variants.length !== 2) {
    failPlan("Experiment v1 supports exactly two variants");
  }
  const ids = plan.variants.map((variant) => variant.id);
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length) {
    failPlan("Variant ids must be nonempty and unique");
  }
  const total = plan.variants.reduce((sum, variant) => sum + variant.plannedShare, 0);
  if (
    plan.variants.some(
      (variant) => !Number.isFinite(variant.plannedShare) || variant.plannedShare <= 0,
    ) ||
    Math.abs(total - 1) > 1e-9
  ) {
    failPlan("Variant planned shares must be positive and sum to 1");
  }
  const from = Date.parse(plan.observedWindow.from);
  const to = Date.parse(plan.observedWindow.to);
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from >= to ||
    new Date(from).toISOString() !== plan.observedWindow.from ||
    new Date(to).toISOString() !== plan.observedWindow.to
  ) {
    failPlan("Plan observedWindow must be an ISO [from, to) interval");
  }
  if (
    !Number.isFinite(plan.srmWarningThreshold) ||
    plan.srmWarningThreshold <= 0 ||
    plan.srmWarningThreshold >= 1
  ) {
    failPlan("SRM warning threshold must be within (0, 1)");
  }
  const cutoff = Date.parse(plan.observedWindow.to);
  void cutoff;
}

function checkDataset(input: ExperimentDatasetInput): void {
  checkPlan(input.plan);
  if (input.assignments.length === 0) failInput("At least one assignment is required");
  if (input.assignments.length > 100_000)
    failInput("Assignment count exceeds the bounded review limit");
  const variantIds = new Set(input.plan.variants.map((variant) => variant.id));
  const unitIds = new Set<string>();
  for (const assignment of input.assignments) {
    if (!assignment.unitId.trim()) failInput("Assignment unit ids must be nonempty");
    if (unitIds.has(assignment.unitId))
      failInput(`Duplicate assignment for unit '${assignment.unitId}'`);
    unitIds.add(assignment.unitId);
    if (!variantIds.has(assignment.variantId)) {
      failInput(`Assignment variant '${assignment.variantId}' is not in the analysis plan`);
    }
    if (input.plan.randomizationUnit === "cluster" && !assignment.clusterId?.trim()) {
      failInput("Cluster randomization requires a clusterId per assignment");
    }
    if (!isRecord(assignment.attributes)) failInput("Assignment attributes must be a record");
  }
  const exposureByUnit = new Map(input.exposures.map((exposure) => [exposure.unitId, exposure]));
  if (exposureByUnit.size !== input.exposures.length)
    failInput("Duplicate exposure rows are not allowed");
  for (const unitId of exposureByUnit.keys()) {
    if (!unitIds.has(unitId)) failInput(`Exposure unit '${unitId}' has no assignment`);
  }
  const seenOutcomes = new Set<string>();
  for (const outcome of input.outcomes) {
    if (!unitIds.has(outcome.unitId))
      failInput(`Outcome unit '${outcome.unitId}' has no assignment`);
    if (seenOutcomes.has(outcome.unitId))
      failInput(`Duplicate outcome for unit '${outcome.unitId}'`);
    seenOutcomes.add(outcome.unitId);
    if (outcome.value !== null && !Number.isFinite(outcome.value)) {
      failInput(`Outcome value for unit '${outcome.unitId}' must be finite or null`);
    }
    if (
      input.plan.outcomeKind === "binary" &&
      outcome.value !== null &&
      outcome.value !== 0 &&
      outcome.value !== 1
    ) {
      failInput("Binary outcomes must be 0, 1, or null");
    }
  }
  if (input.treatmentReceived !== undefined) {
    const seenReceipts = new Set<string>();
    for (const receipt of input.treatmentReceived) {
      if (!unitIds.has(receipt.unitId))
        failInput(`Treatment receipt unit '${receipt.unitId}' has no assignment`);
      if (seenReceipts.has(receipt.unitId))
        failInput(`Duplicate treatment receipt for unit '${receipt.unitId}'`);
      seenReceipts.add(receipt.unitId);
      if (!variantIds.has(receipt.variantId)) {
        failInput(`Treatment receipt variant '${receipt.variantId}' is not in the analysis plan`);
      }
    }
  }
  if (input.providerResults !== undefined) {
    if (!isRecord(input.providerResults))
      failInput("Provider results must be a record keyed by variant id");
    for (const [variantId, result] of Object.entries(input.providerResults)) {
      if (!variantIds.has(variantId)) {
        failInput(`Provider result variant '${variantId}' is not in the analysis plan`);
      }
      if (!Number.isFinite(result.estimate))
        failInput(`Provider estimate for variant '${variantId}' must be finite`);
      if (!Number.isSafeInteger(result.n) || result.n < 0) {
        failInput(`Provider n for variant '${variantId}' must be a non-negative integer`);
      }
      if (!result.method.trim())
        failInput(`Provider method for variant '${variantId}' must be nonempty`);
      if (
        result.interval !== undefined &&
        (!Number.isFinite(result.interval.lower) ||
          !Number.isFinite(result.interval.upper) ||
          result.interval.lower > result.interval.upper)
      ) {
        failInput(
          `Provider interval for variant '${variantId}' must be a finite [lower, upper] range`,
        );
      }
    }
  }
  const completeThrough = Date.parse(input.completeThrough);
  if (!Number.isFinite(completeThrough)) failInput("completeThrough must be a valid timestamp");
  if (
    input.factsAvailableThrough !== undefined &&
    !Number.isFinite(Date.parse(input.factsAvailableThrough))
  ) {
    failInput("factsAvailableThrough must be a valid timestamp when provided");
  }
}

/** Chi-square upper-tail probability via the regularized lower gamma complement. */
export function chiSquarePValue(chiSquare: number, degreesOfFreedom: number): number {
  if (!Number.isFinite(chiSquare) || chiSquare < 0)
    failPlan("chiSquare must be a finite non-negative number");
  if (!Number.isInteger(degreesOfFreedom) || degreesOfFreedom < 1) {
    failPlan("degreesOfFreedom must be a positive integer");
  }
  if (chiSquare === 0) return 1;
  return 1 - lowerRegularizedGamma(degreesOfFreedom / 2, chiSquare / 2);
}

function lowerRegularizedGamma(s: number, x: number): number {
  if (x === 0) return 0;
  if (x < s + 1) return gammaSeries(s, x);
  return 1 - gammaContinuedFraction(s, x);
}

function gammaSeries(s: number, x: number): number {
  const EPS = 1e-14;
  let term = 1 / s;
  let sum = term;
  let n = 1;
  while (n < 1000) {
    term *= x / (s + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * EPS) break;
    n += 1;
  }
  return sum * Math.exp(-x + s * Math.log(x) - logGamma(s));
}

function gammaContinuedFraction(s: number, x: number): number {
  const EPS = 1e-14;
  const FPMIN = 1e-300;
  let b = x + 1 - s;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  let i = 1;
  while (i < 1000) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const delta = c * d;
    h *= delta;
    if (Math.abs(delta - 1) < EPS) break;
    i += 1;
  }
  return Math.exp(-x + s * Math.log(x) - logGamma(s)) * h;
}

function logGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let a = c[0] ?? 0;
  for (let i = 1; i < 9; i += 1) a += (c[i] ?? 0) / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

function plannedCounts(
  plan: ExperimentAnalysisPlan,
  total: number,
): {
  readonly planned: Readonly<Record<string, number>>;
  readonly expected: Readonly<Record<string, number>>;
} {
  const planned: Record<string, number> = {};
  for (const variant of plan.variants) planned[variant.id] = total * variant.plannedShare;
  return { planned, expected: { ...planned } };
}

export function checkSampleRatioMismatch(
  plan: ExperimentAnalysisPlan,
  actualCounts: Readonly<Record<string, number>>,
): ExperimentSrm {
  checkPlan(plan);
  const total = Object.values(actualCounts).reduce((sum, count) => sum + count, 0);
  if (!Number.isSafeInteger(total) || total <= 0)
    failInput("Actual assignment counts must total a positive integer");
  const variantIds = plan.variants.map((variant) => variant.id);
  if (
    variantIds.some((id) => !Number.isSafeInteger(actualCounts[id]) || (actualCounts[id] ?? 0) < 0)
  ) {
    failInput("Actual counts must be non-negative integers for every planned variant");
  }
  const { planned, expected } = plannedCounts(plan, total);
  if (Object.values(expected).some((count) => count < SRM_MIN_EXPECTED)) {
    return {
      status: "not_assessed",
      reason: `Expected counts below ${SRM_MIN_EXPECTED}; SRM is not assessed and balanced allocation is not confirmed`,
    };
  }
  let chiSquare = 0;
  for (const id of variantIds) {
    const observed = actualCounts[id] ?? 0;
    const expectedCount = expected[id] ?? 0;
    chiSquare += (observed - expectedCount) ** 2 / expectedCount;
  }
  const degreesOfFreedom = variantIds.length - 1;
  const pValue = chiSquarePValue(chiSquare, degreesOfFreedom);
  const status: QualityResult = pValue < plan.srmWarningThreshold ? "warning" : "pass_signal";
  return {
    status,
    detail: {
      chiSquare,
      degreesOfFreedom,
      pValue,
      plannedCounts: planned,
      actualCounts: { ...actualCounts },
      warningThreshold: plan.srmWarningThreshold,
      expectedCounts: expected,
    },
    reason:
      status === "warning"
        ? `SRM warning: p=${pValue.toFixed(4)} below threshold ${plan.srmWarningThreshold}`
        : `SRM pass signal: p=${pValue.toFixed(4)} at threshold ${plan.srmWarningThreshold}; not proof of no interference`,
  };
}

/**
 * Pooled-SD standardized mean difference between control and treatment samples.
 * Uses sqrt(((n1-1)s1^2 + (n2-1)s2^2) / (n1+n2-2)) with sample variances.
 * A zero pooled SD (identical constants) yields smd 0 with a distinguishing reason.
 */
export function standardizedMeanDifference(
  control: readonly number[],
  treatment: readonly number[],
): StandardizedMeanDifference {
  if (control.length === 0 || treatment.length === 0) {
    failInput("SMD requires non-empty control and treatment samples");
  }
  for (const value of [...control, ...treatment]) {
    if (!Number.isFinite(value)) failInput("SMD inputs must be finite numbers");
  }
  const mean = (values: readonly number[]): number =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const sampleVariance = (values: readonly number[], center: number): number => {
    if (values.length < 2) return 0;
    return values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1);
  };
  const controlMean = mean(control);
  const treatmentMean = mean(treatment);
  const degreesOfFreedom = control.length - 1 + (treatment.length - 1);
  const pooledVariance =
    degreesOfFreedom <= 0
      ? 0
      : ((control.length - 1) * sampleVariance(control, controlMean) +
          (treatment.length - 1) * sampleVariance(treatment, treatmentMean)) /
        degreesOfFreedom;
  const pooledSd = Math.sqrt(Math.max(pooledVariance, 0));
  if (pooledSd === 0) {
    return {
      smd: 0,
      pooledSd: 0,
      reason: "pooled SD is 0; groups are identical constants; SMD set to 0",
    };
  }
  return {
    smd: (treatmentMean - controlMean) / pooledSd,
    pooledSd,
    reason: `SMD computed with pooled SD ${pooledSd}`,
  };
}

type UsableOutcome = {
  readonly included: boolean;
  readonly value: number;
  readonly imputed: boolean;
};

function resolveOutcome(
  outcome: ExperimentOutcome | undefined,
  availability: "complete" | "partial",
  outcomeKind: ExperimentOutcomeKind,
): UsableOutcome {
  if (outcome === undefined) {
    // Missing outcome rows: with complete coverage and a binary outcome, the absent
    // event counts toward the randomized denominator as zero. All other cases
    // (incomplete rows, partial coverage, mean outcomes) stay excluded.
    if (availability === "complete" && outcomeKind === "binary") {
      return { included: true, value: 0, imputed: true };
    }
    return { included: false, value: 0, imputed: false };
  }
  if (!outcome.complete) return { included: false, value: 0, imputed: false };
  if (outcome.value !== null) return { included: true, value: outcome.value, imputed: false };
  // Null rows with complete binary coverage count as zero; otherwise excluded.
  if (availability === "complete" && outcomeKind === "binary") {
    return { included: true, value: 0, imputed: true };
  }
  return { included: false, value: 0, imputed: false };
}

function serializeAttributeValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return MISSING_ATTRIBUTE_BUCKET;
  const text = String(value);
  return text === "" ? MISSING_ATTRIBUTE_BUCKET : text;
}

function toProviderResults(
  plan: ExperimentAnalysisPlan,
  availability: "complete" | "partial",
  results: Readonly<Record<string, ExperimentProviderResultInput>>,
): Readonly<Record<string, ExperimentMetricResult>> {
  const mapped: Record<string, ExperimentMetricResult> = {};
  for (const [variantId, result] of Object.entries(results)) {
    mapped[variantId] = {
      n: result.n,
      estimate: result.estimate,
      method: result.method,
      observedWindow: { ...plan.observedWindow },
      availability,
      ...(result.interval !== undefined ? { interval: { ...result.interval } } : {}),
      methodId: result.method,
      ...(result.unit !== undefined ? { unit: result.unit } : {}),
    };
  }
  return mapped;
}

export function summarizeExperiment(input: ExperimentReviewInput): ExperimentReview {
  checkDataset(input);
  const { plan } = input;
  const isCluster = plan.randomizationUnit === "cluster";
  const localMethod = plan.outcomeKind === "binary" ? "local-binary-rate" : "local-per-unit-mean";
  const aggregateMethod = localMethod;
  const sliceAttribute = input.sliceAttribute;
  if (sliceAttribute !== undefined) {
    if (!sliceAttribute.trim()) failInput("sliceAttribute must be nonempty when provided");
    if (!plan.preTreatmentAttributes.includes(sliceAttribute)) {
      failInput(
        `Slice attribute '${sliceAttribute}' is not a declared pre-treatment attribute; post-treatment attributes are rejected`,
      );
    }
  }
  const exposureByUnit = new Map(input.exposures.map((exposure) => [exposure.unitId, exposure]));
  const outcomeByUnit = new Map(input.outcomes.map((outcome) => [outcome.unitId, outcome]));
  const assignedByUnit = new Map(
    input.assignments.map((assignment) => [assignment.unitId, assignment.variantId]),
  );
  const funnel: Record<string, ExperimentFunnelCounts> = {};
  const primary: Record<string, ExperimentVariantAggregate> = {};
  const conditional: Record<string, ExperimentConditionalAggregate> = {};
  const actualCounts: Record<string, number> = {};
  const coverageEnd = Math.min(
    Date.parse(input.completeThrough),
    input.factsAvailableThrough === undefined
      ? Number.POSITIVE_INFINITY
      : Date.parse(input.factsAvailableThrough),
  );
  const availability: ExperimentVariantAggregate["availability"] =
    coverageEnd < Date.parse(plan.observedWindow.to) ? "partial" : "complete";
  let totalImputed = 0;

  for (const variant of plan.variants) {
    const assigned = input.assignments.filter((row) => row.variantId === variant.id);
    let exposed = 0;
    let actioned = 0;
    let observed = 0;
    let numerator = 0;
    let denominator = 0;
    let conditionalNumerator = 0;
    let conditionalDenominator = 0;
    for (const row of assigned) {
      const exposure = exposureByUnit.get(row.unitId);
      const isExposed = exposure?.exposed === true;
      if (isExposed) exposed += 1;
      if (exposure?.actionObserved === true) actioned += 1;
      const outcome = outcomeByUnit.get(row.unitId);
      const usable = resolveOutcome(outcome, availability, plan.outcomeKind);
      if (usable.included) {
        if (outcome !== undefined) observed += 1;
        numerator += usable.value;
        denominator += 1;
        if (usable.imputed) totalImputed += 1;
        if (isExposed) {
          conditionalNumerator += usable.value;
          conditionalDenominator += 1;
        }
      }
    }
    let n: number;
    let estimate: number;
    if (isCluster) {
      // Cluster randomization: each cluster mean counts once; members never inflate n.
      const byCluster = new Map<string, ExperimentAssignment[]>();
      for (const row of assigned) {
        const clusterId = row.clusterId ?? "";
        const members = byCluster.get(clusterId) ?? [];
        members.push(row);
        byCluster.set(clusterId, members);
      }
      const clusterMeans: number[] = [];
      for (const members of byCluster.values()) {
        let clusterSum = 0;
        let clusterCount = 0;
        for (const member of members) {
          const usable = resolveOutcome(
            outcomeByUnit.get(member.unitId),
            availability,
            plan.outcomeKind,
          );
          if (usable.included) {
            clusterSum += usable.value;
            clusterCount += 1;
          }
        }
        if (clusterCount > 0) clusterMeans.push(clusterSum / clusterCount);
      }
      n = byCluster.size;
      estimate =
        clusterMeans.length === 0
          ? 0
          : clusterMeans.reduce((sum, value) => sum + value, 0) / clusterMeans.length;
      actualCounts[variant.id] = byCluster.size;
    } else {
      n = assigned.length;
      estimate = denominator === 0 ? 0 : numerator / denominator;
      actualCounts[variant.id] = assigned.length;
    }
    const funnelCounts: ExperimentFunnelCounts = {
      assigned: assigned.length,
      exposed,
      actioned,
      outcomeObserved: observed,
    };
    funnel[variant.id] = funnelCounts;
    primary[variant.id] = {
      variantId: variant.id,
      assigned: assigned.length,
      exposed,
      n,
      estimate,
      method: aggregateMethod,
      observedWindow: { ...plan.observedWindow },
      availability,
      funnel: funnelCounts,
    };
    conditional[variant.id] = {
      variantId: variant.id,
      exposed,
      nExposed: exposed,
      estimate: conditionalDenominator === 0 ? 0 : conditionalNumerator / conditionalDenominator,
      availability,
    };
  }

  let slices: ExperimentSliceResult | undefined;
  if (sliceAttribute !== undefined) {
    const cells: Record<string, ExperimentSliceCell> = {};
    for (const variant of plan.variants) {
      const assigned = input.assignments.filter((row) => row.variantId === variant.id);
      const byValue = new Map<string, ExperimentAssignment[]>();
      for (const row of assigned) {
        const key = serializeAttributeValue(row.attributes[sliceAttribute]);
        const members = byValue.get(key) ?? [];
        members.push(row);
        byValue.set(key, members);
      }
      for (const [valueKey, members] of byValue.entries()) {
        let cellNumerator = 0;
        let cellDenominator = 0;
        for (const member of members) {
          const usable = resolveOutcome(
            outcomeByUnit.get(member.unitId),
            availability,
            plan.outcomeKind,
          );
          if (usable.included) {
            cellNumerator += usable.value;
            cellDenominator += 1;
          }
        }
        cells[`${variant.id}::${valueKey}`] = {
          variantId: variant.id,
          attribute: sliceAttribute,
          attributeValue: valueKey,
          assigned: members.length,
          n: members.length,
          estimate: cellDenominator === 0 ? 0 : cellNumerator / cellDenominator,
        };
      }
    }
    slices = { attribute: sliceAttribute, cells };
  }

  const srm = checkSampleRatioMismatch(plan, actualCounts);
  const quality: QualityCheck[] = [
    {
      kind: "denominator",
      result: "pass_signal",
      evidence: isCluster
        ? "Cluster randomization: n counts clusters with each cluster mean counting once; members do not inflate n"
        : "Primary aggregates keep the randomized denominator including unexposed units",
      limitations: isCluster
        ? "Cluster means exclude clusters without usable outcomes; unit-level funnel counts stay descriptive"
        : "Exposure-conditional slices are descriptive and reported separately",
    },
    srm.status === "pass_signal"
      ? {
          kind: "srm",
          result: "pass_signal",
          evidence: srm.reason,
          limitations: "A balanced SRM signal does not prove absence of interference or SUTVA",
        }
      : srm.status === "warning"
        ? {
            kind: "srm",
            result: "warning",
            evidence: srm.reason,
            limitations:
              "Inspect allocation plumbing; do not auto-stop or roll out on this p-value alone",
          }
        : {
            kind: "srm",
            result: "not_assessed",
            evidence: srm.reason,
            limitations: "Collect a larger sample before judging balance",
          },
    {
      kind: "coverage",
      result: availability === "complete" ? "pass_signal" : "warning",
      evidence:
        availability === "complete"
          ? plan.outcomeKind === "binary"
            ? `Observation coverage is complete through the planned window; ${totalImputed} complete binary missing/null outcome(s) imputed as 0`
            : "Observation coverage is complete through the planned window; mean-outcome nulls stay distinct from zero"
          : "Observation coverage is partial; null and incomplete outcomes stay distinct from zero",
      limitations: "Only complete coverage permits interpreting absent outcomes as zero",
    },
  ];

  const receipts = input.treatmentReceived ?? [];
  if (receipts.length === 0) {
    quality.push({
      kind: "leakage",
      result: "not_assessed",
      evidence: "No treatment-receipt logs were provided",
      limitations:
        "Absence of receipt logs does not prove absence of interference (로그 부재를 간섭 없음으로 확정하지 않는다)",
    });
  } else {
    let crossVariant = 0;
    let controlCrossover = 0;
    for (const receipt of receipts) {
      if (receipt.variantId !== assignedByUnit.get(receipt.unitId)) {
        crossVariant += 1;
        if (assignedByUnit.get(receipt.unitId) === plan.variants[0]?.id) controlCrossover += 1;
      }
    }
    quality.push(
      crossVariant > 0
        ? {
            kind: "leakage",
            result: "warning",
            evidence: `${crossVariant} of ${receipts.length} receipt rows cross variant boundaries (control-assigned crossovers: ${controlCrossover})`,
            limitations:
              "Inspect delivery and logging plumbing; do not reinterpret intent-to-treat on receipts alone",
          }
        : {
            kind: "leakage",
            result: "pass_signal",
            evidence: `${receipts.length} receipt rows agree with assignment; no cross-variant receipt observed`,
            limitations:
              "Receipt logs do not prove absence of interference (로그 부재를 간섭 없음으로 확정하지 않는다)",
          },
    );
  }

  if (plan.method !== undefined && plan.method !== localMethod) {
    quality.push({
      kind: "method",
      result: "not_assessed",
      evidence: `Plan declares provider method '${plan.method}'; primary estimates use local computation '${localMethod}' with the provider method id preserved`,
      limitations:
        "Local computation is not the provider method; compare provider numbers via the provider field, never by reinterpretation",
    });
  } else {
    quality.push({
      kind: "method",
      result: "pass_signal",
      evidence: `Local method '${aggregateMethod}' computed over the randomized denominator; no external provider method declared`,
      limitations:
        "Provider-supplied estimates, if any, are surfaced separately without reinterpretation",
    });
  }

  const providerError = (input.providerError ?? "").trim();
  let provider: ExperimentProviderSnapshot | undefined;
  if (input.providerResults !== undefined || providerError !== "") {
    const results =
      input.providerResults === undefined
        ? undefined
        : toProviderResults(plan, availability, input.providerResults);
    provider = {
      ...(results !== undefined ? { results } : {}),
      ...(providerError !== "" ? { error: providerError } : {}),
    };
    quality.push(
      providerError !== ""
        ? {
            kind: "provider",
            result: "not_assessed",
            evidence: `Provider error: ${providerError}`,
            limitations:
              "Provider failures are never zero-filled; local estimates remain the reviewed basis",
          }
        : {
            kind: "provider",
            result: "not_assessed",
            evidence: `Provider results passed through for ${Object.keys(results ?? {}).length} variant(s) without reinterpretation`,
            limitations:
              "Provider estimates are surfaced as-is; local estimates remain the reviewed basis",
          },
    );
  }

  const controlId = plan.variants[0]?.id ?? "";
  const treatmentId = plan.variants[1]?.id ?? "";
  for (const attribute of plan.preTreatmentAttributes) {
    const numericByVariant: Record<string, number[]> = { [controlId]: [], [treatmentId]: [] };
    let skipped = 0;
    for (const row of input.assignments) {
      const raw = row.attributes[attribute];
      const bucket = numericByVariant[row.variantId];
      if (typeof raw === "number" && Number.isFinite(raw) && bucket !== undefined) {
        bucket.push(raw);
      } else {
        skipped += 1;
      }
    }
    const controlValues = numericByVariant[controlId] ?? [];
    const treatmentValues = numericByVariant[treatmentId] ?? [];
    if (controlValues.length === 0 || treatmentValues.length === 0) {
      quality.push({
        kind: `balance:${attribute}`,
        result: "not_assessed",
        evidence: `Insufficient numeric observations (control=${controlValues.length}, treatment=${treatmentValues.length}, non-numeric-or-missing=${skipped}); SMD not computed`,
        limitations:
          "Descriptive balance signal only; no threshold is judged and missingness is reported, not imputed",
      });
    } else {
      const balance = standardizedMeanDifference(controlValues, treatmentValues);
      quality.push({
        kind: `balance:${attribute}`,
        result: "not_assessed",
        evidence: `SMD=${balance.smd.toFixed(4)} pooledSD=${balance.pooledSd.toFixed(4)} (control n=${controlValues.length}, treatment n=${treatmentValues.length}, non-numeric-or-missing=${skipped})`,
        limitations:
          "Descriptive balance signal only; no threshold is judged and missingness is reported, not imputed",
      });
    }
  }

  return {
    plan,
    funnel,
    primary,
    conditional,
    ...(slices !== undefined ? { slices } : {}),
    ...(provider !== undefined ? { provider } : {}),
    srm,
    quality,
    observedWindow: { ...plan.observedWindow },
    outcomeKind: plan.outcomeKind,
    completeThrough: input.completeThrough,
  };
}
