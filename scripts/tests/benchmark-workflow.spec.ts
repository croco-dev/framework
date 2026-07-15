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
      "run: pnpm tracked-files:guard --recovery 'pnpm bench:update' -- pnpm bench:check --output-json=benchmark-result.json",
      "- name: Publish benchmark enforce-readiness report",
      "continue-on-error: true",
      "set +e",
      "pnpm bench:readiness --input=benchmark-result.json --output=ci-reports/benchmark/summary.md --variance-evidence=ci-reports/benchmark/latest-five-green-runs.md",
      "readiness_exit=$?",
      'cat ci-reports/benchmark/summary.md >> "$GITHUB_STEP_SUMMARY" || true',
      'exit "$readiness_exit"',
      "- name: Upload benchmark readiness report",
    ];

    let previousIndex = -1;
    for (const marker of orderedMarkers) {
      const index = workflow.indexOf(marker, previousIndex + 1);
      expect(index, `${marker} should be present`).toBeGreaterThan(-1);
      expect(index, `${marker} should stay in benchmark report order`).toBeGreaterThan(
        previousIndex,
      );
      previousIndex = index;
    }
  });

  it("enforces benchmark gate mode after latest-five-green evidence is committed", () => {
    const workflow = readBenchmarkWorkflow();

    expect(workflow).toContain("BENCHMARK_GATE_MODE: enforce");
    expect(workflow).toContain('"scripts/benchmark-readiness-report.mts"');
    expect(workflow).toContain('"ci-reports/benchmark/**"');
    expect(workflow).toContain("name: benchmark-readiness-report");
    expect(workflow).toContain("ci-reports/benchmark/latest-five-green-runs.md");
    expect(workflow).toContain(
      "steps.bench.outcome == 'failure' || steps.readiness.outcome == 'failure'",
    );
  });

  it("uses the repository Node version source for benchmark setup", () => {
    const workflow = readBenchmarkWorkflow();

    expect(workflow).toContain('node-version-file: ".nvmrc"');
    expect(workflow).not.toMatch(/^\s*node-version\s*:/m);
  });
});
