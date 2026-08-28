import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const benchmarkWorkflowPath = resolve(__dirname, "../../.github/workflows/benchmark.yml");
const benchmarkCommentWorkflowPath = resolve(
  __dirname,
  "../../.github/workflows/benchmark-comment.yml",
);

const readBenchmarkWorkflow = () => readFileSync(benchmarkWorkflowPath, "utf-8");
const readBenchmarkCommentWorkflow = () => readFileSync(benchmarkCommentWorkflowPath, "utf-8");

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
    expect(workflow).toContain("filename === 'scripts/benchmark-readiness-report.mts'");
    expect(workflow).toContain("filename.startsWith('ci-reports/benchmark/')");
    expect(workflow).toContain("name: benchmark-readiness-report");
    expect(workflow).toContain("ci-reports/benchmark/latest-five-green-runs.md");
    expect(workflow).toContain(
      "steps.bench.outcome == 'failure' || steps.readiness.outcome == 'failure'",
    );
  });

  it("gates desktop contract compiler time, memory, and fixture changes", () => {
    const workflow = readBenchmarkWorkflow();

    expect(workflow).toContain("filename.startsWith('packages/protocols-desktop/type-fixtures/')");
    expect(workflow).toContain("filename === 'packages/protocols-desktop/tsconfig.json'");
    expect(workflow).toContain("filename.startsWith('tsconfig/')");
    expect(workflow).toContain("- name: Check desktop type fixtures");
    expect(workflow).toContain("run: pnpm desktop-contracts:type-fixtures");
    expect(workflow).toContain("- name: Check desktop contract compiler baseline");
    expect(workflow).toContain(
      "run: pnpm desktop-contracts:bench --output=ci-reports/benchmark/protocols-desktop-types.json",
    );
    expect(workflow).toContain("ci-reports/benchmark/protocols-desktop-types.json");
  });

  it("uses the repository Node version source for benchmark setup", () => {
    const workflow = readBenchmarkWorkflow();

    expect(workflow).toContain('node-version-file: ".nvmrc"');
    expect(workflow).not.toMatch(/^\s*node-version\s*:/m);
  });

  it("keeps PR-revision benchmark execution read-only and cache-isolated", () => {
    const workflow = readBenchmarkWorkflow();
    const benchmark = workflow.slice(
      workflow.indexOf("  benchmark:\n"),
      workflow.indexOf("  benchmark-gate:\n"),
    );

    expect(workflow).toContain("pull_request:");
    expect(workflow).not.toContain("pull_request_target:");
    expect(benchmark).toContain("contents: read");
    expect(benchmark).not.toContain("pull-requests: write");
    expect(benchmark).toContain("ref: ${{ github.event.pull_request.head.sha || github.sha }}");
    expect(benchmark).toContain("persist-credentials: false");
    expect(benchmark).not.toContain("actions/cache@");
    expect(workflow).not.toContain("pull-requests: write");
    expect(workflow).toContain(
      "name: benchmark-readiness-report-${{ github.run_id }}-${{ github.run_attempt }}",
    );
  });

  it("always emits a fixed stale-head-aware benchmark gate", () => {
    const workflow = readBenchmarkWorkflow();
    const trigger = workflow.slice(workflow.indexOf("on:\n"), workflow.indexOf("permissions:\n"));
    const gate = workflow.slice(workflow.indexOf("  benchmark-gate:\n"));

    expect(trigger).not.toContain("paths:");
    expect(workflow).toContain(
      "group: benchmark-${{ github.event.pull_request.number || github.ref }}",
    );
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("  classify:\n    name: classify");
    expect(workflow).toContain("  benchmark:\n    name: benchmark");
    expect(workflow).toContain("  benchmark-gate:\n    name: benchmark-gate");
    expect(gate).toContain("if: ${{ always() }}");
    expect(gate).toContain("if: github.event_name == 'pull_request'");
    expect(gate).toContain("Benchmark evidence targets stale revision");
    expect(gate).toContain(
      "No benchmark-relevant files changed; benchmark gate passes as not applicable.",
    );
    expect(gate).toContain('if [ "$BENCHMARK_RESULT" != "success" ]; then');
  });
});

describe("benchmark comment publisher workflow", () => {
  it("publishes only from a completed source workflow through its immutable trusted revision", () => {
    const workflow = readBenchmarkCommentWorkflow();

    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("      - Performance Benchmark");
    expect(workflow).toContain("      - completed");
    expect(workflow).toContain("actions: read");
    expect(workflow).toContain("pull-requests: write");
    expect(workflow).toContain(
      "if: ${{ github.event.workflow_run.event == 'pull_request' && github.event.workflow_run.pull_requests[0].number }}",
    );
    expect(workflow).toContain("ref: ${{ github.workflow_sha }}");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).not.toContain("pnpm install");
    expect(workflow).not.toContain("ref: ${{ github.event.workflow_run.head_sha }}");
  });

  it("binds the source run, repository, sole PR, live head, and exact artifact", () => {
    const workflow = readBenchmarkCommentWorkflow();

    expect(workflow).toContain("(.pull_requests | length) == 1");
    expect(workflow).toContain(".repository.full_name == $repository");
    expect(workflow).toContain(".head.sha == $source_head_sha");
    expect(workflow).toContain('.state == "open"');
    expect(workflow).toContain('.base.ref == "trunk"');
    expect(workflow).toContain(
      '"/repos/${GITHUB_REPOSITORY}/actions/runs/${SOURCE_RUN_ID}/jobs?filter=latest&per_page=100"',
    );
    expect(workflow).toContain("for job_name in classify benchmark benchmark-gate; do");
    expect(workflow).toContain(
      'if [ "$source_conclusion" != "success" ] && [ "$source_conclusion" != "failure" ]; then',
    );
    expect(workflow).toContain(
      'if [ "$benchmark_conclusion" != "success" ] && [ "$benchmark_conclusion" != "failure" ]; then',
    );
    expect(workflow).toContain('echo "should_comment=false" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain('echo "should_comment=true" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain('if [ "$artifact_total" -ne "$artifact_page_count" ]; then');
    expect(workflow).toContain('if [ "$matching_artifacts" -ne 1 ]; then');
    expect(workflow).toContain(
      "name: benchmark-readiness-report-${{ github.event.workflow_run.id }}-${{ github.event.workflow_run.run_attempt }}",
    );
    expect(workflow).toContain("run-id: ${{ github.event.workflow_run.id }}");
    expect(workflow.match(/if: steps\.source\.outputs\.should_comment == 'true'/g)).toHaveLength(3);
  });

  it("bounds and validates all untrusted comment input before the write step", () => {
    const workflow = readBenchmarkCommentWorkflow();
    const validation = workflow.slice(
      workflow.indexOf("      - name: Validate untrusted benchmark artifact"),
      workflow.indexOf("      - name: Comment PR with benchmark results"),
    );

    expect(validation).toContain("-gt 8192");
    expect(validation).toContain("(.reports | length) <= 50");
    expect(validation).toContain("(.name | length) <= 120");
    expect(validation).toContain("((.gateFailures // []) | length) <= 20");
    expect(validation).toContain("length <= 240");
    expect(validation).toContain('type == "string"');
  });
});
