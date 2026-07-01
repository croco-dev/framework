import { describe, expect, it } from "vitest";

import {
  applyBenchmarkEnvironmentDefaults,
  collectBenchmarkEntries,
  evaluateBaselineUpdateReadiness,
  evaluateBenchmarkGate,
  getBenchmarkP75,
} from "../bench-threshold-check.mts";

type BenchmarkReports = Parameters<typeof evaluateBenchmarkGate>[0];

describe("bench-threshold-check.mts", () => {
  it("fails when the benchmark runner reports a failed module", () => {
    const result = evaluateBenchmarkGate(passingReports(), [
      "benchmark module failed: packages/example/src/tests/Example.bench.ts",
    ]);

    expect(result.allPassed).toBe(false);
    expect(result.gateFailures).toContain(
      "benchmark module failed: packages/example/src/tests/Example.bench.ts",
    );
  });

  it("fails when no benchmark reports are collected", () => {
    const result = evaluateBenchmarkGate([]);

    expect(result.allPassed).toBe(false);
    expect(result.gateFailures).toContain("No benchmark reports were collected.");
  });

  it("fails threshold and baseline skips instead of treating them as enforce-ready", () => {
    const result = evaluateBenchmarkGate([
      {
        name: "Example benchmark",
        p75: 1,
        thresholdStatus: "skip",
        baselineStatus: "skip",
        thresholdSkipReason: "No threshold defined in benchmarks/thresholds.json.",
        baselineSkipReason: "No baseline defined in benchmarks/baseline.json.",
      },
    ]);

    expect(result.allPassed).toBe(false);
    expect(result.gateFailures).toContain(
      "Example benchmark: threshold skipped (No threshold defined in benchmarks/thresholds.json.)",
    );
    expect(result.gateFailures).toContain(
      "Example benchmark: baseline skipped (No baseline defined in benchmarks/baseline.json.)",
    );
  });

  it("fails when a configured benchmark does not appear in the collected reports", () => {
    const result = evaluateBenchmarkGate(
      passingReports(),
      [],
      ["Passing benchmark", "Missing benchmark"],
    );

    expect(result.allPassed).toBe(false);
    expect(result.gateFailures).toContain("Missing benchmark: benchmark report was not collected.");
  });

  it("keeps baseline-only drift advisory when thresholds still pass", () => {
    const result = evaluateBenchmarkGate([
      {
        name: "Drifted benchmark",
        p75: 1.3,
        threshold: 2,
        baseline: 1,
        thresholdStatus: "pass",
        baselineStatus: "fail",
        thresholdDiff: -0.7,
        baselineDiff: 0.3,
      },
    ]);

    expect(result.allPassed).toBe(true);
    expect(result.gateFailures).toEqual([]);
  });

  it("still blocks threshold failures", () => {
    const result = evaluateBenchmarkGate([
      {
        name: "Regressed benchmark",
        p75: 3,
        threshold: 2,
        baseline: 1,
        thresholdStatus: "fail",
        baselineStatus: "fail",
        thresholdDiff: 1,
        baselineDiff: 2,
      },
    ]);

    expect(result.allPassed).toBe(false);
    expect(result.gateFailures).toContain("Regressed benchmark: p75 3.0ms exceeds threshold 2.0ms");
  });

  it("blocks baseline updates when the runner failed or no reports were collected", () => {
    const result = evaluateBaselineUpdateReadiness(
      [],
      ["benchmark module failed: packages/example/src/tests/Example.bench.ts"],
    );

    expect(result.allPassed).toBe(false);
    expect(result.gateFailures).toContain("No benchmark reports were collected.");
    expect(result.gateFailures).toContain(
      "benchmark module failed: packages/example/src/tests/Example.bench.ts",
    );
  });

  it("allows baseline updates for baseline drift when thresholds still pass", () => {
    const result = evaluateBaselineUpdateReadiness([
      {
        name: "Drifted benchmark",
        p75: 1.3,
        threshold: 2,
        baseline: 1,
        thresholdStatus: "pass",
        baselineStatus: "fail",
        thresholdDiff: -0.7,
        baselineDiff: 0.3,
      },
    ]);

    expect(result.allPassed).toBe(true);
  });

  it("reports leaf benchmark tasks that never produced p75 data", () => {
    const result = collectBenchmarkEntries([
      {
        name: "Parent benchmark suite",
        tasks: [
          {
            name: "completed benchmark",
            result: {
              benchmark: { p75: 1 },
            },
          },
          {
            name: "incomplete benchmark",
            state: "run",
            result: {
              benchmark: {},
            },
          },
        ],
      },
    ]);

    expect(result.entries).toEqual([{ name: "completed benchmark", p75: 1 }]);
    expect(result.failures).toContain(
      "Parent benchmark suite > incomplete benchmark: benchmark p75 was not collected (state: run).",
    );
  });

  it("reads existing numeric p75 threshold entries", () => {
    expect(getBenchmarkP75(10, "threshold fixture")).toBe(10);
    expect(getBenchmarkP75({ p75: 5 }, "threshold fixture")).toBe(5);
  });

  it("defaults telemetry off for deterministic benchmark runs without overriding explicit opt-in", () => {
    const defaultEnv: Record<string, string | undefined> = {};
    applyBenchmarkEnvironmentDefaults(defaultEnv);

    expect(defaultEnv.TELEMETRY_ENABLED).toBe("false");

    const explicitEnv: Record<string, string | undefined> = { TELEMETRY_ENABLED: "true" };
    applyBenchmarkEnvironmentDefaults(explicitEnv);

    expect(explicitEnv.TELEMETRY_ENABLED).toBe("true");
  });
});

function passingReports(): BenchmarkReports {
  return [
    {
      name: "Passing benchmark",
      p75: 1,
      threshold: 2,
      baseline: 1,
      thresholdStatus: "pass",
      baselineStatus: "pass",
      thresholdDiff: -1,
      baselineDiff: 0,
    },
  ];
}
