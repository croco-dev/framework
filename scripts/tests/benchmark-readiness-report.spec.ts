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
          content: "latest five green runs reviewed; max spread 7%",
        },
      },
    );

    expect(evaluation.enforceReady).toBe(true);
    expect(evaluation.blockingReasons).toEqual([]);
    expect(evaluation.allRowsHaveThresholdEntries).toBe(true);
    expect(evaluation.allRowsHaveBaselineEntries).toBe(true);
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
