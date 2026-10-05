import { describe, expect, it } from "vitest";

import {
  checkSampleRatioMismatch,
  chiSquarePValue,
  ExperimentInputProblem,
  standardizedMeanDifference,
  summarizeExperiment,
} from "../libs/experiment/ExperimentReview";
import type {
  ExperimentDatasetInput,
  ExperimentReviewInput,
} from "../libs/experiment/ExperimentReview";

function makeDataset(overrides: Partial<ExperimentDatasetInput> = {}): ExperimentDatasetInput {
  const assignments = [];
  for (let i = 0; i < 100; i += 1) {
    assignments.push({
      unitId: `control-${i}`,
      variantId: "control",
      attributes: { tier: "free" },
    });
  }
  for (let i = 0; i < 100; i += 1) {
    assignments.push({
      unitId: `treatment-${i}`,
      variantId: "treatment",
      attributes: { tier: "free" },
    });
  }
  const exposures = [
    ...assignments.slice(0, 80).map((row) => ({
      unitId: row.unitId,
      exposed: true,
      actionObserved: true,
      outcomeObserved: true,
    })),
    ...assignments.slice(100, 160).map((row) => ({
      unitId: row.unitId,
      exposed: true,
      actionObserved: true,
      outcomeObserved: true,
    })),
  ];
  const outcomes = [
    ...assignments.slice(0, 80).map((row, index) => ({
      unitId: row.unitId,
      value: index % 4 === 0 ? 1 : 0,
      complete: true,
    })),
    ...assignments.slice(100, 160).map((row, index) => ({
      unitId: row.unitId,
      value: index % 2 === 0 ? 1 : 0,
      complete: true,
    })),
  ];
  return {
    plan: {
      experimentId: "exp-1",
      revision: "r1",
      primaryMetricId: "signup",
      randomizationUnit: "unit",
      outcomeKind: "binary",
      observedWindow: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-08T00:00:00.000Z" },
      variants: [
        { id: "control", plannedShare: 0.5 },
        { id: "treatment", plannedShare: 0.5 },
      ],
      srmWarningThreshold: 0.001,
      preTreatmentAttributes: ["tier"],
    },
    assignments,
    exposures,
    preTreatmentFacts: {},
    outcomes,
    completeThrough: "2026-09-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("ExperimentReview", () => {
  it("keeps the randomized denominator while exposure is partial", () => {
    const review = summarizeExperiment(makeDataset());
    expect(review.primary.control?.n).toBe(100);
    expect(review.primary.treatment?.n).toBe(100);
    expect(review.funnel.control).toMatchObject({ assigned: 100, exposed: 80 });
    expect(review.funnel.treatment).toMatchObject({ assigned: 100, exposed: 60 });
    expect(review.quality.some((check) => check.kind === "denominator")).toBe(true);
  });

  it("warns on a skewed 90:10 split and skips SRM below expected counts", () => {
    const skewed = checkSampleRatioMismatch(makeDataset().plan, { control: 180, treatment: 20 });
    expect(skewed.status).toBe("warning");
    expect(skewed.detail?.degreesOfFreedom).toBe(1);
    expect(skewed.detail?.pValue).toBeLessThan(0.001);

    const small = checkSampleRatioMismatch(makeDataset().plan, { control: 7, treatment: 1 });
    expect(small.status).toBe("not_assessed");
    expect(small.detail).toBeUndefined();
  });

  it("matches the chi-square golden fixture", () => {
    // Textbook boundaries: chi2 = 3.841 (df=1) -> p = 0.05; chi2 = 6.635 (df=1) -> p = 0.01.
    expect(chiSquarePValue(3.841458820694124, 1)).toBeCloseTo(0.05, 4);
    expect(chiSquarePValue(6.634896601725987, 1)).toBeCloseTo(0.01, 4);
    // 90:10 against 50:50 over n=200 (chi2 = 128) underflows double precision: report as ~0.
    expect(chiSquarePValue(128, 1)).toBeLessThan(1e-12);
    // Balanced 100:100 against 50:50: chi2 = 0, p = 1.
    expect(chiSquarePValue(0, 1)).toBe(1);
  });

  it("rejects binary outcomes outside {0, 1, null}", () => {
    const dataset = makeDataset();
    expect(() =>
      summarizeExperiment({
        ...dataset,
        outcomes: [{ unitId: "control-0", value: 0.5, complete: true }],
      }),
    ).toThrow("Binary outcomes must be 0, 1, or null");
  });

  it("counts clusters, not members, under cluster randomization", () => {
    const input = makeDataset({
      plan: {
        ...makeDataset().plan,
        randomizationUnit: "cluster",
      },
      assignments: [
        { unitId: "c0-u0", variantId: "control", clusterId: "c0", attributes: { tier: "free" } },
        { unitId: "c0-u1", variantId: "control", clusterId: "c0", attributes: { tier: "free" } },
        { unitId: "c1-u0", variantId: "control", clusterId: "c1", attributes: { tier: "free" } },
        { unitId: "t0-u0", variantId: "treatment", clusterId: "t0", attributes: { tier: "free" } },
        { unitId: "t0-u1", variantId: "treatment", clusterId: "t0", attributes: { tier: "free" } },
        { unitId: "t1-u0", variantId: "treatment", clusterId: "t1", attributes: { tier: "free" } },
      ],
      exposures: [],
      outcomes: [
        { unitId: "c0-u0", value: 1, complete: true },
        { unitId: "c0-u1", value: 1, complete: true },
        { unitId: "c1-u0", value: 0, complete: true },
        { unitId: "t0-u0", value: 1, complete: true },
        { unitId: "t0-u1", value: 0, complete: true },
        { unitId: "t1-u0", value: 0, complete: true },
      ],
    });
    const review = summarizeExperiment(input);
    expect(review.primary.control?.n).toBe(2);
    expect(review.primary.treatment?.n).toBe(2);
    // Control cluster means: [1, 0] -> 0.5; treatment means: [0.5, 0] -> 0.25.
    expect(review.primary.control?.estimate).toBeCloseTo(0.5, 10);
    expect(review.primary.treatment?.estimate).toBeCloseTo(0.25, 10);
    expect(review.primary.control?.funnel.assigned).toBe(3);
    expect(review.srm.status).toBe("not_assessed");
  });

  it("reports exposed-only conditional aggregates apart from the randomized denominator", () => {
    const review = summarizeExperiment(makeDataset());
    expect(review.primary.control?.n).toBe(100);
    expect(review.conditional.control?.nExposed).toBe(80);
    expect(review.conditional.treatment?.nExposed).toBe(60);
    // Control exposed values: 20/80 = 0.25; treatment exposed values: 30/60 = 0.5.
    expect(review.conditional.control?.estimate).toBeCloseTo(0.25, 10);
    expect(review.conditional.treatment?.estimate).toBeCloseTo(0.5, 10);
    // Complete binary coverage imputes the 20/40 missing rows as 0 over the
    // randomized denominator: control 20/100 = 0.2, treatment 30/100 = 0.3.
    expect(review.primary.control?.estimate).toBeCloseTo(0.2, 10);
    expect(review.primary.treatment?.estimate).toBeCloseTo(0.3, 10);
    expect(review.primary.control?.funnel.outcomeObserved).toBe(80);
  });

  it("rejects a post-treatment slice attribute", () => {
    const dataset = makeDataset() as ExperimentReviewInput;
    expect(() => summarizeExperiment({ ...dataset, sliceAttribute: "clicked_after" })).toThrow(
      ExperimentInputProblem,
    );
  });

  it("slices by a pre-treatment attribute with randomized-denominator semantics", () => {
    const dataset = makeDataset() as ExperimentReviewInput;
    const review = summarizeExperiment({ ...dataset, sliceAttribute: "tier" });
    expect(review.slices?.attribute).toBe("tier");
    const cell = review.slices?.cells["treatment::free"];
    expect(cell?.assigned).toBe(100);
    expect(cell?.n).toBe(100);
    expect(cell?.estimate).toBeCloseTo(0.3, 10);
  });

  it("returns smd 0 with a distinguishing reason when the pooled SD is 0", () => {
    const result = standardizedMeanDifference([1, 1, 1], [1, 1]);
    expect(result.smd).toBe(0);
    expect(result.pooledSd).toBe(0);
    expect(result.reason).toContain("pooled SD is 0");
  });

  it("computes the textbook pooled-SD smd", () => {
    // control [0, 2] mean 1, treatment [1, 3] mean 2; sample variance 2 each,
    // pooled SD sqrt(2) -> smd 1/sqrt(2).
    const result = standardizedMeanDifference([0, 2], [1, 3]);
    expect(result.pooledSd).toBeCloseTo(Math.SQRT2, 10);
    expect(result.smd).toBeCloseTo(1 / Math.SQRT2, 10);
  });

  it("emits descriptive balance checks without judging a threshold", () => {
    const base = makeDataset();
    const review = summarizeExperiment({
      ...base,
      plan: { ...base.plan, preTreatmentAttributes: ["age"] },
      assignments: [
        ...base.assignments.slice(0, 100).map((row, index) => ({
          ...row,
          attributes: { age: 20 + (index % 10) },
        })),
        ...base.assignments.slice(100).map((row, index) => ({
          ...row,
          attributes: { age: 21 + (index % 10) },
        })),
      ],
    });
    const balance = review.quality.filter((check) => check.kind === "balance:age");
    expect(balance).toHaveLength(1);
    expect(balance[0]?.result).toBe("not_assessed");
    expect(balance[0]?.evidence ?? "").toContain("SMD=");
  });

  it("warns on cross-variant treatment receipts", () => {
    const dataset = makeDataset();
    const review = summarizeExperiment({
      ...dataset,
      treatmentReceived: [
        { unitId: "control-0", variantId: "treatment" },
        { unitId: "control-1", variantId: "control" },
      ],
    });
    const leakage = review.quality.find((check) => check.kind === "leakage");
    expect(leakage?.result).toBe("warning");
    expect(leakage?.evidence ?? "").toContain("1 of 2");
  });

  it("marks leakage not_assessed when no receipt logs exist", () => {
    const review = summarizeExperiment(makeDataset());
    const leakage = review.quality.find((check) => check.kind === "leakage");
    expect(leakage?.result).toBe("not_assessed");
    expect(leakage?.limitations ?? "").toContain("로그 부재");
  });

  it("zero-imputes complete binary nulls but skips them under partial coverage", () => {
    const missing = (id: string) => ({ unitId: id, value: null as number | null, complete: true });
    const small = (coverage: "complete" | "partial"): ExperimentDatasetInput => ({
      plan: {
        experimentId: "exp-null",
        revision: "r1",
        primaryMetricId: "signup",
        randomizationUnit: "unit",
        outcomeKind: "binary",
        observedWindow: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-08T00:00:00.000Z" },
        variants: [
          { id: "control", plannedShare: 0.5 },
          { id: "treatment", plannedShare: 0.5 },
        ],
        srmWarningThreshold: 0.001,
        preTreatmentAttributes: [],
      },
      assignments: [
        { unitId: "c0", variantId: "control", attributes: {} },
        { unitId: "t0", variantId: "treatment", attributes: {} },
      ],
      exposures: [],
      preTreatmentFacts: {},
      outcomes: [missing("c0"), missing("t0")],
      completeThrough: "2026-09-08T00:00:00.000Z",
      ...(coverage === "partial" ? { factsAvailableThrough: "2026-09-04T00:00:00.000Z" } : {}),
    });
    const complete = summarizeExperiment(small("complete"));
    expect(complete.primary.control?.n).toBe(1);
    expect(complete.primary.control?.estimate).toBe(0);
    expect(complete.primary.control?.funnel.outcomeObserved).toBe(1);
    expect(complete.quality.find((check) => check.kind === "coverage")?.result).toBe("pass_signal");

    const partial = summarizeExperiment(small("partial"));
    expect(partial.primary.control?.estimate).toBe(0);
    expect(partial.primary.control?.funnel.outcomeObserved).toBe(0);
    expect(partial.quality.find((check) => check.kind === "coverage")?.result).toBe("warning");
  });

  it("preserves provider results without reinterpretation and surfaces provider errors", () => {
    const dataset = makeDataset();
    const withProvider = summarizeExperiment({
      ...dataset,
      plan: { ...dataset.plan, method: "provider-cuped" },
      providerResults: {
        control: {
          estimate: 0.3,
          n: 100,
          method: "provider-cuped",
          interval: { lower: 0.2, upper: 0.4 },
        },
        treatment: { estimate: 0.4, n: 100, method: "provider-cuped" },
      },
    });
    expect(withProvider.provider?.results?.control?.estimate).toBe(0.3);
    expect(withProvider.provider?.results?.control?.methodId).toBe("provider-cuped");
    expect(withProvider.provider?.results?.control?.interval).toMatchObject({
      lower: 0.2,
      upper: 0.4,
    });
    const method = withProvider.quality.find((check) => check.kind === "method");
    expect(method?.result).toBe("not_assessed");
    expect(withProvider.primary.control?.method).toBe("local-binary-rate");

    const withError = summarizeExperiment({ ...dataset, providerError: "PROVIDER_TIMEOUT" });
    expect(withError.provider?.error).toBe("PROVIDER_TIMEOUT");
    const providerCheck = withError.quality.find((check) => check.kind === "provider");
    expect(providerCheck?.result).toBe("not_assessed");
    expect(providerCheck?.evidence ?? "").toContain("PROVIDER_TIMEOUT");
  });
});
