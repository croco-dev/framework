import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const benchmarkWorkflowPath = resolve(__dirname, "../../.github/workflows/benchmark.yml");

const readBenchmarkWorkflow = () => readFileSync(benchmarkWorkflowPath, "utf-8");

describe("benchmark workflow", () => {
  it("publishes the enforce-readiness report after benchmark execution and before artifact upload", () => {
    const workflow = readBenchmarkWorkflow();
    const orderedMarkers = [
      "- name: Run benchmarks with threshold check",
      "run: pnpm bench:check --output-json=benchmark-result.json",
      "- name: Publish benchmark enforce-readiness report",
      "pnpm bench:readiness --input=benchmark-result.json --output=ci-reports/benchmark/summary.md --variance-evidence=ci-reports/benchmark/latest-five-green-runs.md",
      'cat ci-reports/benchmark/summary.md >> "$GITHUB_STEP_SUMMARY"',
      "- name: Upload benchmark warning report",
    ];

    let previousIndex = -1;
    for (const marker of orderedMarkers) {
      const index = workflow.indexOf(marker);
      expect(index, `${marker} should be present`).toBeGreaterThan(-1);
      expect(index, `${marker} should stay in benchmark report order`).toBeGreaterThan(
        previousIndex,
      );
      previousIndex = index;
    }
  });

  it("keeps benchmark gate mode warning-only while tracking readiness report changes", () => {
    const workflow = readBenchmarkWorkflow();

    expect(workflow).toContain("BENCHMARK_GATE_MODE: warning-only");
    expect(workflow).toContain('"scripts/benchmark-readiness-report.mts"');
  });
});
