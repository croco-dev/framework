import { describe, expect, it } from "vitest";

import {
  collectBenchmarkEntries,
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
