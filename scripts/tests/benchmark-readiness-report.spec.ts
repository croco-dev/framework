import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluateBenchmarkReadiness,
  renderBenchmarkReadinessReport,
  writeBenchmarkReadinessReport,
} from "../benchmark-readiness-report.mts";

describe("benchmark-readiness-report.mts", () => {
  it("categorizes every benchmark enforce-readiness blocker from benchmark-result.json", () => {
    const evaluation = evaluateBenchmarkReadiness(
      {
        allPassed: false,
        gateFailures: [
          "No benchmark reports were collected.",
          "benchmark runner error: timeout",
          "benchmark module failed: packages/example/src/tests/Example.bench.ts",
          "Missing benchmark: benchmark report was not collected.",
          "Example benchmark: p75 3.0ms exceeds threshold 2.0ms",
        ],
        reports: [
          {
            name: "New benchmark",
            p75: 1,
            thresholdStatus: "skip",
            baselineStatus: "skip",
            thresholdSkipReason: "No threshold defined in benchmarks/thresholds.json.",
            baselineSkipReason: "No baseline defined in benchmarks/baseline.json.",
          },
        ],
      },
      {
        varianceEvidence: { path: "ci-reports/benchmark/latest-five-green-runs.md" },
      },
    );

    expect(evaluation.enforceReady).toBe(false);
    expect(evaluation.runnerFailures).toEqual([
      "benchmark runner error: timeout",
      "benchmark module failed: packages/example/src/tests/Example.bench.ts",
    ]);
    expect(evaluation.missingReports).toEqual([
      "Missing benchmark: benchmark report was not collected.",
    ]);
    expect(evaluation.emptyReports).toEqual(["No benchmark reports were collected."]);
    expect(evaluation.thresholdSkips).toEqual([
      "New benchmark: threshold skipped (No threshold defined in benchmarks/thresholds.json.)",
    ]);
    expect(evaluation.baselineSkips).toEqual([
      "New benchmark: baseline skipped (No baseline defined in benchmarks/baseline.json.)",
    ]);
    expect(evaluation.otherGateFailures).toEqual([
      "Example benchmark: p75 3.0ms exceeds threshold 2.0ms",
    ]);
    expect(evaluation.allRowsHaveThresholdEntries).toBe(false);
    expect(evaluation.allRowsHaveBaselineEntries).toBe(false);
    expect(evaluation.blockingReasons).toContain(
      "Latest five green benchmark variance evidence was not provided at ci-reports/benchmark/latest-five-green-runs.md.",
    );
  });

  it("marks the benchmark gate enforce-ready only when result and variance evidence are complete", () => {
    const evaluation = evaluateBenchmarkReadiness(
      {
        allPassed: true,
        gateFailures: [],
        reports: [
          {
            name: "Passing benchmark",
            p75: 1,
            threshold: 2,
            baseline: 1,
            thresholdStatus: "pass",
            baselineStatus: "pass",
          },
        ],
      },
      {
        varianceEvidence: {
          path: "ci-reports/benchmark/latest-five-green-runs.md",
          content: validVarianceEvidenceContent([
            {
              name: "Passing benchmark",
              min: 0.96,
              median: 1,
              max: 1.04,
              spread: 0.08,
              p75ByRun: {
                "1": 0.96,
                "2": 0.99,
                "3": 1,
                "4": 1.02,
                "5": 1.04,
              },
            },
          ]),
        },
      },
    );

    expect(evaluation.enforceReady).toBe(true);
    expect(evaluation.blockingReasons).toEqual([]);
    expect(evaluation.allRowsHaveThresholdEntries).toBe(true);
    expect(evaluation.allRowsHaveBaselineEntries).toBe(true);
    expect(evaluation.varianceEvidenceValid).toBe(true);
  });

  it("rejects arbitrary non-empty variance evidence prose", () => {
    const evaluation = evaluateBenchmarkReadiness(greenResult(), {
      varianceEvidence: {
        path: "ci-reports/benchmark/latest-five-green-runs.md",
        content: "latest five green runs reviewed; max spread 7%",
      },
    });

    expect(evaluation.enforceReady).toBe(false);
    expect(evaluation.varianceEvidenceProvided).toBe(true);
    expect(evaluation.varianceEvidenceValid).toBe(false);
    expect(evaluation.blockingReasons).toContain(
      "Latest five green benchmark variance evidence is invalid: structured evidence marker <!-- croco-benchmark-variance-evidence:v1 --> was not found.",
    );
  });

  it("rejects variance evidence with row spread above the documented tolerance", () => {
    const evaluation = evaluateBenchmarkReadiness(greenResult(), {
      varianceEvidence: {
        path: "ci-reports/benchmark/latest-five-green-runs.md",
        content: validVarianceEvidenceContent([
          {
            name: "Passing benchmark",
            min: 1,
            median: 1,
            max: 1.2,
            spread: 0.2,
            p75ByRun: {
              "1": 1,
              "2": 1,
              "3": 1,
              "4": 1.1,
              "5": 1.2,
            },
          },
        ]),
      },
    });

    expect(evaluation.enforceReady).toBe(false);
    expect(evaluation.varianceEvidenceValid).toBe(false);
    expect(evaluation.blockingReasons).toContain(
      "Latest five green benchmark variance evidence is invalid: Passing benchmark: spread 20.00% exceeds 15% tolerance.",
    );
  });

  it("rejects variance evidence for runs that do not target trunk", () => {
    const evaluation = evaluateBenchmarkReadiness(greenResult(), {
      varianceEvidence: {
        path: "ci-reports/benchmark/latest-five-green-runs.md",
        content: validVarianceEvidenceContent([
          {
            name: "Passing benchmark",
            min: 0.96,
            median: 1,
            max: 1.04,
            spread: 0.08,
            p75ByRun: {
              "1": 0.96,
              "2": 0.99,
              "3": 1,
              "4": 1.02,
              "5": 1.04,
            },
          },
        ]).replace('"baseBranch": "trunk"', '"baseBranch": "main"'),
      },
    });

    expect(evaluation.enforceReady).toBe(false);
    expect(evaluation.varianceEvidenceValid).toBe(false);
    expect(evaluation.blockingReasons).toContain(
      "Latest five green benchmark variance evidence is invalid: run 1 must target trunk.",
    );
  });

  it("rejects variance evidence with duplicate benchmark row names", () => {
    const evaluation = evaluateBenchmarkReadiness(greenResult(), {
      varianceEvidence: {
        path: "ci-reports/benchmark/latest-five-green-runs.md",
        content: validVarianceEvidenceContent([
          {
            name: "Passing benchmark",
            min: 0.96,
            median: 1,
            max: 1.04,
            spread: 0.08,
            p75ByRun: {
              "1": 0.96,
              "2": 0.99,
              "3": 1,
              "4": 1.02,
              "5": 1.04,
            },
          },
          {
            name: "Passing benchmark",
            min: 0.96,
            median: 1,
            max: 1.04,
            spread: 0.08,
            p75ByRun: {
              "1": 0.96,
              "2": 0.99,
              "3": 1,
              "4": 1.02,
              "5": 1.04,
            },
          },
        ]),
      },
    });

    expect(evaluation.enforceReady).toBe(false);
    expect(evaluation.varianceEvidenceValid).toBe(false);
    expect(evaluation.blockingReasons).toContain(
      "Latest five green benchmark variance evidence is invalid: rows must contain exactly 1 benchmark row(s).",
    );
    expect(evaluation.blockingReasons).toContain(
      "Latest five green benchmark variance evidence is invalid: rows must not contain duplicate benchmark names: Passing benchmark.",
    );
  });

  it("accepts warning-only artifacts that only failed stale pre-promotion baselines", () => {
    const evaluation = evaluateBenchmarkReadiness(greenResult(), {
      varianceEvidence: {
        path: "ci-reports/benchmark/latest-five-green-runs.md",
        content: validVarianceEvidenceContent(
          [
            {
              name: "Passing benchmark",
              min: 0.96,
              median: 1,
              max: 1.04,
              spread: 0.08,
              p75ByRun: {
                "1": 0.96,
                "2": 0.99,
                "3": 1,
                "4": 1.02,
                "5": 1.04,
              },
            },
          ],
          {
            artifactGateFailuresByRun: {
              "1": ["Passing benchmark: p75 1.0ms exceeds baseline 0.5ms by more than 20%"],
              "2": ["Passing benchmark: p75 1.0ms exceeds baseline 0.5ms by more than 20%"],
              "3": ["Passing benchmark: p75 1.0ms exceeds baseline 0.5ms by more than 20%"],
              "4": ["Passing benchmark: p75 1.0ms exceeds baseline 0.5ms by more than 20%"],
              "5": ["Passing benchmark: p75 1.0ms exceeds baseline 0.5ms by more than 20%"],
            },
          },
        ),
      },
    });

    expect(evaluation.enforceReady).toBe(true);
    expect(evaluation.varianceEvidenceValid).toBe(true);
  });

  it("rejects warning-only artifacts with threshold failures", () => {
    const evaluation = evaluateBenchmarkReadiness(greenResult(), {
      varianceEvidence: {
        path: "ci-reports/benchmark/latest-five-green-runs.md",
        content: validVarianceEvidenceContent(
          [
            {
              name: "Passing benchmark",
              min: 0.96,
              median: 1,
              max: 1.04,
              spread: 0.08,
              p75ByRun: {
                "1": 0.96,
                "2": 0.99,
                "3": 1,
                "4": 1.02,
                "5": 1.04,
              },
            },
          ],
          {
            artifactGateFailuresByRun: {
              "1": ["Passing benchmark: p75 3.0ms exceeds threshold 2.0ms"],
            },
          },
        ),
      },
    });

    expect(evaluation.enforceReady).toBe(false);
    expect(evaluation.varianceEvidenceValid).toBe(false);
    expect(evaluation.blockingReasons).toContain(
      "Latest five green benchmark variance evidence is invalid: checks.thresholdFailures must be 0.",
    );
  });

  it("renders an audit-only report with explicit reasons and the variance evidence input path", () => {
    const evaluation = evaluateBenchmarkReadiness(null, {
      resultFilePath: "benchmark-result.json",
      resultReadError: "file does not exist",
      varianceEvidence: { path: "ci-reports/benchmark/latest-five-green-runs.md" },
    });
    const report = renderBenchmarkReadinessReport(evaluation, {
      gateMode: "warning-only",
      benchmarkOutcome: "failure",
      benchmarkConclusion: "success",
    });

    expect(report).toContain("- Verdict: `NOT_READY`");
    expect(report).toContain("benchmark-result.json could not be read: file does not exist");
    expect(report).toContain(
      "Latest five green benchmark variance evidence was not provided at ci-reports/benchmark/latest-five-green-runs.md.",
    );
    expect(report).toContain("this report is audit-only and does not change `BENCHMARK_GATE_MODE`");
    expect(report).toContain(
      "Provide the latest five green benchmark workflow run variance review at `ci-reports/benchmark/latest-five-green-runs.md`",
    );
  });

  it("writes an audit-only summary when benchmark-result.json is missing", () => {
    withTempDir((directory) => {
      const inputPath = join(directory, "benchmark-result.json");
      const outputPath = join(directory, "ci-reports", "benchmark", "summary.md");
      const evaluation = writeBenchmarkReadinessReport({
        inputPath,
        outputPath,
        varianceEvidencePath: join(
          directory,
          "ci-reports",
          "benchmark",
          "latest-five-green-runs.md",
        ),
      });
      const report = readFileSync(outputPath, "utf-8");

      expect(evaluation.enforceReady).toBe(false);
      expect(evaluation.resultReadError).toBe("file does not exist");
      expect(report).toContain(`${inputPath} could not be read: file does not exist`);
      expect(report).toContain("- Scope: this report is audit-only");
    });
  });

  it("writes an audit-only summary when benchmark-result.json is malformed", () => {
    withTempDir((directory) => {
      const inputPath = join(directory, "benchmark-result.json");
      const outputPath = join(directory, "summary.md");
      writeFileSync(inputPath, "{not valid json");

      const evaluation = writeBenchmarkReadinessReport({
        inputPath,
        outputPath,
        varianceEvidencePath: join(directory, "latest-five-green-runs.md"),
      });
      const report = readFileSync(outputPath, "utf-8");

      expect(evaluation.enforceReady).toBe(false);
      expect(evaluation.resultReadError).toEqual(expect.any(String));
      expect(report).toContain(`${inputPath} could not be read:`);
      expect(report).toContain("- Verdict: `NOT_READY`");
    });
  });
});

function withTempDir(run: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "croco-benchmark-readiness-"));

  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function greenResult() {
  return {
    allPassed: true,
    gateFailures: [],
    reports: [
      {
        name: "Passing benchmark",
        p75: 1,
        threshold: 2,
        baseline: 1,
        thresholdStatus: "pass" as const,
        baselineStatus: "pass" as const,
      },
    ],
  };
}

function validVarianceEvidenceContent(
  rows: Array<{
    name: string;
    min: number;
    median: number;
    max: number;
    spread: number;
    p75ByRun: Record<string, number>;
  }>,
  options: {
    artifactGateFailuresByRun?: Record<string, string[]>;
  } = {},
): string {
  const runIds = ["1", "2", "3", "4", "5"];
  const artifactGateFailuresByRun = options.artifactGateFailuresByRun ?? {};
  const prePromotionBaselineFailures = Object.values(artifactGateFailuresByRun)
    .flat()
    .filter((failure) => failure.includes("exceeds baseline")).length;
  const thresholdFailures = Object.values(artifactGateFailuresByRun)
    .flat()
    .filter((failure) => failure.includes("exceeds threshold")).length;

  return [
    "# Latest Five Green Benchmark Variance Evidence",
    "",
    "<!-- croco-benchmark-variance-evidence:v1 -->",
    "```json",
    JSON.stringify(
      {
        version: 1,
        source: "github-actions",
        reviewedAt: "2026-07-01T00:00:00Z",
        tolerance: 0.15,
        runs: [
          {
            id: 1,
            url: "https://github.com/croco-dev/framework/actions/runs/1",
            headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            headBranch: "trunk",
            baseBranch: "trunk",
            createdAt: "2026-06-30T00:00:00Z",
            workflowStatus: "completed",
            workflowConclusion: "success",
            artifact: artifactForRun("1", rows.length, artifactGateFailuresByRun),
          },
          {
            id: 2,
            url: "https://github.com/croco-dev/framework/actions/runs/2",
            headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            headBranch: "trunk",
            baseBranch: "trunk",
            createdAt: "2026-06-30T01:00:00Z",
            workflowStatus: "completed",
            workflowConclusion: "success",
            artifact: artifactForRun("2", rows.length, artifactGateFailuresByRun),
          },
          {
            id: 3,
            url: "https://github.com/croco-dev/framework/actions/runs/3",
            headSha: "cccccccccccccccccccccccccccccccccccccccc",
            headBranch: "trunk",
            baseBranch: "trunk",
            createdAt: "2026-06-30T02:00:00Z",
            workflowStatus: "completed",
            workflowConclusion: "success",
            artifact: artifactForRun("3", rows.length, artifactGateFailuresByRun),
          },
          {
            id: 4,
            url: "https://github.com/croco-dev/framework/actions/runs/4",
            headSha: "dddddddddddddddddddddddddddddddddddddddd",
            headBranch: "trunk",
            baseBranch: "trunk",
            createdAt: "2026-06-30T03:00:00Z",
            workflowStatus: "completed",
            workflowConclusion: "success",
            artifact: artifactForRun("4", rows.length, artifactGateFailuresByRun),
          },
          {
            id: 5,
            url: "https://github.com/croco-dev/framework/actions/runs/5",
            headSha: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            headBranch: "trunk",
            baseBranch: "trunk",
            createdAt: "2026-06-30T04:00:00Z",
            workflowStatus: "completed",
            workflowConclusion: "success",
            artifact: artifactForRun("5", rows.length, artifactGateFailuresByRun),
          },
        ],
        checks: {
          sameRowSet: true,
          runnerFailures: 0,
          moduleFailures: 0,
          emptyReports: 0,
          missingReports: 0,
          thresholdFailures,
          thresholdSkips: 0,
          baselineSkips: 0,
          prePromotionBaselineFailures,
          promotedBaselineFailures: 0,
        },
        rows: rows.map((row) => ({ ...row, status: "pass" })),
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  function artifactForRun(
    runId: string,
    reportCount: number,
    failuresByRun: Record<string, string[]>,
  ) {
    const gateFailures = failuresByRun[runId] ?? [];

    return {
      allPassed: gateFailures.length === 0,
      reportCount,
      gateFailures,
    };
  }
}
