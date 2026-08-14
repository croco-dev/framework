#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createVerificationManifest } from "./verification-manifest.mts";
import type { EvidenceCommand } from "./release-spine-evidence.mts";

export const CI_PERFORMANCE_SAMPLE_SCHEMA = "croco.ci-performance-samples/v1" as const;
export const CI_PERFORMANCE_BASELINE_SCHEMA = "croco.ci-performance-baselines/v1" as const;
export const CI_PERFORMANCE_REPORT_SCHEMA = "croco.ci-performance-budget-report/v1" as const;
export const RETENTION_DAYS = 90;
export const PROMOTION_WINDOW_DAYS = 45;
export const MIN_PROMOTION_SAMPLES = 30;
export const MAX_PROMOTION_SAMPLES = 60;
export const MAD_SCALE = 1.4826;
export const MAX_VARIABILITY = 0.2;
export const PR_CI_TARGET_MINUTES = 10;

export const PR_CI_DESIGN_BUDGETS = {
  affectedGraph: 6,
  cachedTaskEvidence: 0.5,
  repositoryContracts: 2,
  setupAndSecurity: 1,
} as const;

export type CacheState = "cold" | "partial" | "warm";
export type CiConclusion = "success" | "failure" | "cancelled";

export type CiPerformancePartition = {
  readonly profile: string;
  readonly lane: string;
  readonly workflowVersion: string;
  readonly workflowSchemaVersion: string;
  readonly runnerOs: string;
  readonly runnerArch: string;
  readonly runnerLabel: string;
  readonly nodeVersion: string;
  readonly pnpmVersion: string;
  readonly cacheState: CacheState;
};

export type CiPerformanceSample = CiPerformancePartition & {
  readonly measurementScope: "validate-job";
  readonly runId: string;
  readonly jobId: string;
  readonly commitSha: string;
  readonly branch: string;
  readonly timestamp: string;
  readonly durationMs: number;
  readonly taskCount: number;
  readonly taskDurationMs: number;
  readonly cacheHitCount: number;
  readonly cacheMissCount: number;
  readonly cacheEvidenceComplete: boolean;
  readonly inventoryDigest: string;
  readonly workflowDigest: string;
  readonly componentConclusion: CiConclusion;
  readonly conclusion: CiConclusion;
  readonly retryAttempt: number;
};

export type CiPerformanceSampleFile = {
  readonly schemaVersion: typeof CI_PERFORMANCE_SAMPLE_SCHEMA;
  readonly samples: readonly CiPerformanceSample[];
  readonly currentSamples?: readonly CiPerformanceSample[];
};

export type CiPerformanceStatistics = {
  readonly sampleCount: number;
  readonly medianMs: number;
  readonly madMs: number;
  readonly scaledMadMs: number;
  readonly p95Ms: number;
  readonly variability: number;
  readonly thresholdMs: number;
};

export type CiPerformanceBaseline = {
  readonly key: string;
  readonly partition: CiPerformancePartition;
  readonly inventoryDigest: string;
  readonly workflowDigest: string;
  readonly reviewed: boolean;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
  readonly promotedAt: string;
  readonly sampleExecutionIds: readonly string[];
  readonly statistics: CiPerformanceStatistics;
};

export type CiPerformanceBaselineFile = {
  readonly schemaVersion: typeof CI_PERFORMANCE_BASELINE_SCHEMA;
  readonly baselines: readonly CiPerformanceBaseline[];
};

export type CiPerformanceDiagnostic = {
  readonly code:
    | "BUDGET_NOT_ENFORCEABLE"
    | "CI_DURATION_BUDGET_EXCEEDED"
    | "CI_DURATION_BUDGET_PASSED"
    | "CI_JOB_NOT_SUCCESSFUL"
    | "CI_MEASUREMENT_INCOMPLETE";
  readonly message: string;
  readonly key?: string;
  readonly runId?: string;
};

export type CiPerformancePartitionReport = {
  readonly key: string;
  readonly partition: CiPerformancePartition;
  readonly retainedSampleCount: number;
  readonly candidateSampleCount: number;
  readonly candidateRunIds: readonly string[];
  readonly excluded: readonly {
    readonly runId: string;
    readonly reason:
      | "outside-retention"
      | "outside-promotion-window"
      | "not-trunk"
      | "not-successful"
      | "retried";
  }[];
  readonly statistics?: CiPerformanceStatistics;
  readonly baseline?: CiPerformanceBaseline;
  readonly currentDurationMs?: number;
  readonly regressionDeltaMs?: number;
  readonly enforceable: boolean;
  readonly diagnostics: readonly CiPerformanceDiagnostic[];
};

export type CiPerformanceReport = {
  readonly schemaVersion: typeof CI_PERFORMANCE_REPORT_SCHEMA;
  readonly asOf: string;
  readonly retentionDays: typeof RETENTION_DAYS;
  readonly promotionWindowDays: typeof PROMOTION_WINDOW_DAYS;
  readonly minPromotionSamples: typeof MIN_PROMOTION_SAMPLES;
  readonly maxPromotionSamples: typeof MAX_PROMOTION_SAMPLES;
  readonly mode: "report" | "enforce" | "promote";
  readonly partitions: readonly CiPerformancePartitionReport[];
  readonly diagnostics: readonly CiPerformanceDiagnostic[];
  readonly failed: boolean;
};

export type CiPerformanceBudgetInput = {
  readonly maintenancePullRequestManifest: readonly EvidenceCommand[];
  readonly ordinaryPullRequestManifest: readonly EvidenceCommand[];
  readonly workflow: string;
};

const HEAVY_ORDINARY_PR_CHECKS = [
  "alpha-release-smoke",
  "cli-packed-e2e",
  "core-coverage",
  "first-success",
  "generated-app-smoke",
  "integration-test-lane",
  "package-bins-smoke",
  "package-entrypoints-smoke",
  "quick-start-lambda-smoke",
] as const;

const BUILD_ARTIFACT_MAINTENANCE_CHECKS = [
  "cli-packed-e2e",
  "first-success",
  "generated-app-smoke",
  "package-bins-smoke",
  "package-entrypoints-smoke",
  "production-ready",
  "quick-start-lambda-smoke",
  "spine-promotion",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function jobSection(workflow: string, job: string, nextJob: string): string {
  const startMarker = `\n  ${job}:\n`;
  const endMarker = `\n  ${nextJob}:\n`;
  const start = workflow.indexOf(startMarker);
  const end = workflow.indexOf(endMarker, start + startMarker.length);
  return start === -1 ? "" : workflow.slice(start + 1, end === -1 ? undefined : end + 1);
}

function turboTasks(command: readonly string[]): readonly string[] {
  const turboIndex = command.findIndex(
    (argument, index) => argument === "turbo" && command[index + 1] === "run",
  );
  if (turboIndex !== -1)
    return command.slice(turboIndex + 2).filter((argument) => !argument.startsWith("-"));
  if (command.includes("scripts/test-lane-runner.mts") && command.includes("fast")) return ["test"];
  return [];
}

export function pullRequestCiDesignBudgetMinutes(): number {
  return Object.values(PR_CI_DESIGN_BUDGETS).reduce((total, value) => total + value, 0);
}

export function createOrdinaryPullRequestManifest(): readonly EvidenceCommand[] {
  return createVerificationManifest("spine", {
    base: "origin/trunk",
    changedFiles: ["packages/customer-health-core/src/libs/CustomerHealthScore.ts"],
    head: "HEAD",
  });
}

export function createMaintenancePullRequestManifest(): readonly EvidenceCommand[] {
  return createVerificationManifest("publish", {
    base: "origin/trunk",
    changedFiles: [
      ".github/workflows/ci.yml",
      "scripts/ci-performance-budget.mts",
      "scripts/tests/ci-workflow.spec.ts",
      "scripts/verification-manifest.mts",
    ],
    head: "HEAD",
  });
}

export function findCiPerformanceBudgetViolations(
  input: CiPerformanceBudgetInput,
): readonly string[] {
  const violations: string[] = [];
  const validate = jobSection(input.workflow, "validate", "changes");
  const changes = jobSection(input.workflow, "changes", "ecosystem-advisory");
  const ecosystemAdvisory = jobSection(input.workflow, "ecosystem-advisory", "real-resource-tests");
  const realResources = jobSection(input.workflow, "real-resource-tests", "windows-scaffold");
  const windowsScaffold = jobSection(input.workflow, "windows-scaffold", "docs-sync-check");
  const docsSync = jobSection(input.workflow, "docs-sync-check", "docs-build");
  const byId = new Map(input.ordinaryPullRequestManifest.map((command) => [command.id, command]));
  const maintenanceById = new Map(
    input.maintenancePullRequestManifest.map((command) => [command.id, command]),
  );
  const affectedFilter = "--filter=...[origin/trunk]";
  const docsExclusion = "--filter=!@croco/docs";

  if (
    !ecosystemAdvisory.includes(
      "if: github.event_name == 'workflow_dispatch' && needs.changes.outputs.profile != 'repo'",
    )
  ) {
    violations.push("ecosystem advisory smoke must stay off automatic change runs");
  }
  if (changes.includes("- 'packages/**'"))
    violations.push("Windows scaffold must not be triggered by every package change");
  if (
    !windowsScaffold.includes(
      "if: github.event_name == 'workflow_dispatch' || needs.changes.outputs.windows-scaffold == 'true'",
    )
  ) {
    violations.push("Windows scaffold must retain targeted change and full manual coverage");
  }
  if (
    !realResources.includes(
      "if: github.event_name == 'workflow_dispatch' || needs.changes.outputs.real-resources == 'true'",
    )
  ) {
    violations.push("real-resource tests must use a targeted automatic-change gate");
  }
  if (
    validate.includes("membership-postgres:") ||
    validate.includes("Verify typed TestKernel resources")
  ) {
    violations.push("real-resource services must not start in the ordinary validate job");
  }
  if (
    !validate.includes('if [ "${{ github.event_name }}" != "workflow_dispatch" ]; then') ||
    !validate.includes('args+=(--base "$VERIFICATION_BASE" --head HEAD)')
  ) {
    violations.push("pull-request and trunk validation must both use the changed-file scope");
  }
  if (
    !docsSync.includes(
      "if: github.event_name != 'pull_request' && needs.changes.outputs.api-source == 'true'",
    )
  ) {
    violations.push("full generated API documentation drift checks must stay off package PRs");
  }
  if (
    !validate.includes("--sample-output ci-reports/ci-performance/raw-sample.json") ||
    !validate.includes("--json-output ci-reports/ci-performance/report.json") ||
    !validate.includes("--markdown-output ci-reports/ci-performance/report.md")
  ) {
    violations.push("CI must materialize raw and rendered observed performance evidence");
  }
  if (
    !validate.includes("--measurement-started-at") ||
    !validate.includes("--measurement-completed-at") ||
    !validate.includes('--conclusion "$CROCO_VALIDATE_JOB_CONCLUSION"') ||
    !validate.includes("CROCO_VALIDATE_JOB_CONCLUSION: ${{ job.status }}")
  ) {
    violations.push(
      "CI performance evidence must cover the explicit validate-job boundary and outcome",
    );
  }
  const performanceRecordIndex = validate.indexOf("- name: Record observed CI performance budget");
  const coverageSummaryIndex = validate.indexOf("- name: Publish core coverage warning summary");
  if (
    performanceRecordIndex === -1 ||
    coverageSummaryIndex === -1 ||
    performanceRecordIndex <= coverageSummaryIndex
  ) {
    violations.push("CI performance evidence must run after post-spine validation work");
  }
  if (!validate.includes("--enforce") || !validate.includes("retention-days: 90")) {
    violations.push("CI performance enforcement must retain its raw evidence for 90 days");
  }

  const build = byId.get("build");
  const buildTasks = turboTasks(build?.command ?? []);
  if (buildTasks.length !== 1 || buildTasks[0] !== "build")
    violations.push("affected validation warm-up must run only build");
  if (!build?.command.includes(affectedFilter))
    violations.push("affected validation warm-up must filter from the pull-request base");
  if (!build?.command.includes(docsExclusion))
    violations.push("affected validation must leave full docs compilation to the docs workflow");
  for (const id of ["typecheck"]) {
    const command = byId.get(id);
    const tasks = turboTasks(command?.command ?? []);
    if (tasks.length !== 1 || tasks[0] !== id)
      violations.push(`${id} evidence must run only ${id}`);
    if (!command?.command.includes(affectedFilter))
      violations.push(`${id} evidence must reuse the affected package graph`);
    if (!command?.command.includes(docsExclusion))
      violations.push(`${id} evidence must leave full docs compilation to the docs workflow`);
  }
  const testCommand = byId.get("test")?.command ?? [];
  if (!testCommand.includes("scripts/test-lane-runner.mts") || !testCommand.includes("fast")) {
    violations.push("test evidence must run only test");
  }
  const buildIndex = input.ordinaryPullRequestManifest.findIndex(({ id }) => id === "build");
  const typecheckIndex = input.ordinaryPullRequestManifest.findIndex(
    ({ id }) => id === "typecheck",
  );
  const testIndex = input.ordinaryPullRequestManifest.findIndex(({ id }) => id === "test");
  if (!(buildIndex < typecheckIndex && typecheckIndex < testIndex)) {
    violations.push("affected validation must run build, typecheck, and test in order");
  }
  for (const id of HEAVY_ORDINARY_PR_CHECKS) {
    if (byId.get(id)?.applicable !== false)
      violations.push(`${id} must be skipped for an unrelated package implementation change`);
  }
  for (const id of BUILD_ARTIFACT_MAINTENANCE_CHECKS) {
    if (maintenanceById.get(id)?.applicable !== false)
      violations.push(`${id} must not require package build artifacts for CI maintenance`);
  }
  const designBudget = pullRequestCiDesignBudgetMinutes();
  if (designBudget > PR_CI_TARGET_MINUTES) {
    violations.push(
      `ordinary PR design budget is ${designBudget} minutes, above ${PR_CI_TARGET_MINUTES}`,
    );
  }
  return violations;
}

export function ciPerformancePartition(sample: CiPerformancePartition): CiPerformancePartition {
  return {
    profile: sample.profile,
    lane: sample.lane,
    workflowVersion: sample.workflowVersion,
    workflowSchemaVersion: sample.workflowSchemaVersion,
    runnerOs: sample.runnerOs,
    runnerArch: sample.runnerArch,
    runnerLabel: sample.runnerLabel,
    nodeVersion: sample.nodeVersion,
    pnpmVersion: sample.pnpmVersion,
    cacheState: sample.cacheState,
  };
}

export function ciPerformancePartitionKey(partition: CiPerformancePartition): string {
  return [
    partition.profile,
    partition.lane,
    partition.workflowVersion,
    partition.workflowSchemaVersion,
    partition.runnerOs,
    partition.runnerArch,
    partition.runnerLabel,
    partition.nodeVersion,
    partition.pnpmVersion,
    partition.cacheState,
  ]
    .map(encodeURIComponent)
    .join("|");
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("median requires at least one value");
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function nearestRankPercentile(values: readonly number[], percentile: number): number {
  if (values.length === 0) throw new Error("nearest-rank percentile requires at least one value");
  if (!(percentile > 0 && percentile <= 1))
    throw new Error("percentile must be greater than 0 and at most 1");
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile * sorted.length) - 1];
}

export function calculateCiPerformanceStatistics(
  samples: readonly Pick<CiPerformanceSample, "durationMs">[],
): CiPerformanceStatistics {
  const durations = samples.map(({ durationMs }) => durationMs);
  const medianMs = median(durations);
  const madMs = median(durations.map((duration) => Math.abs(duration - medianMs)));
  const scaledMadMs = MAD_SCALE * madMs;
  const p95Ms = nearestRankPercentile(durations, 0.95);
  const variability = medianMs === 0 ? Number.POSITIVE_INFINITY : scaledMadMs / medianMs;
  return {
    sampleCount: samples.length,
    medianMs,
    madMs,
    scaledMadMs,
    p95Ms,
    variability,
    thresholdMs: Math.max(1.1 * p95Ms, medianMs + 6 * scaledMadMs),
  };
}

function timestampMs(timestamp: string): number {
  return Date.parse(timestamp);
}

function hasCompleteProvenance(sample: CiPerformanceSample): boolean {
  return (
    sample.measurementScope === "validate-job" &&
    (sample.componentConclusion === "success" ||
      sample.componentConclusion === "failure" ||
      sample.componentConclusion === "cancelled") &&
    (sample.conclusion === "success" ||
      sample.conclusion === "failure" ||
      sample.conclusion === "cancelled") &&
    [
      sample.runId,
      sample.jobId,
      sample.commitSha,
      sample.branch,
      sample.inventoryDigest,
      sample.workflowDigest,
      ...Object.values(ciPerformancePartition(sample)),
    ].every((value) => typeof value === "string" && value.length > 0) &&
    Number.isFinite(timestampMs(sample.timestamp)) &&
    Number.isFinite(sample.durationMs) &&
    sample.durationMs >= 0 &&
    Number.isInteger(sample.taskCount) &&
    sample.taskCount >= 0 &&
    Number.isFinite(sample.taskDurationMs) &&
    sample.taskDurationMs >= 0 &&
    Number.isInteger(sample.cacheHitCount) &&
    sample.cacheHitCount >= 0 &&
    Number.isInteger(sample.cacheMissCount) &&
    sample.cacheMissCount >= 0 &&
    sample.cacheEvidenceComplete === true &&
    Number.isInteger(sample.retryAttempt) &&
    sample.retryAttempt >= 1 &&
    sample.cacheHitCount + sample.cacheMissCount === sample.taskCount
  );
}

export function selectPromotionSamples(
  samples: readonly CiPerformanceSample[],
  partition: CiPerformancePartition,
  asOf: Date,
): readonly CiPerformanceSample[] {
  const key = ciPerformancePartitionKey(partition);
  const oldest = asOf.getTime() - PROMOTION_WINDOW_DAYS * DAY_MS;
  const eligible = samples
    .filter((sample) => ciPerformancePartitionKey(sample) === key)
    .filter(
      (sample) =>
        timestampMs(sample.timestamp) >= oldest && timestampMs(sample.timestamp) <= asOf.getTime(),
    )
    .filter((sample) => isSuccessfulFirstAttemptTrunkSample(sample))
    .sort(
      (left, right) =>
        timestampMs(right.timestamp) - timestampMs(left.timestamp) ||
        right.runId.localeCompare(left.runId) ||
        right.jobId.localeCompare(left.jobId) ||
        right.commitSha.localeCompare(left.commitSha),
    );
  const seenExecutions = new Set<string>();
  return eligible
    .filter((sample) => {
      const execution = `${sample.runId}\0${sample.jobId}`;
      if (seenExecutions.has(execution)) return false;
      seenExecutions.add(execution);
      return true;
    })
    .slice(0, MAX_PROMOTION_SAMPLES);
}

function isSuccessfulFirstAttemptTrunkSample(sample: CiPerformanceSample): boolean {
  return (
    sample.branch === "trunk" &&
    sample.componentConclusion === "success" &&
    sample.conclusion === "success" &&
    sample.retryAttempt === 1
  );
}

export function selectCiPerformanceHistorySamples(
  samples: readonly CiPerformanceSample[],
): readonly CiPerformanceSample[] {
  return samples.filter(
    (sample) =>
      Number.isFinite(timestampMs(sample.timestamp)) && isSuccessfulFirstAttemptTrunkSample(sample),
  );
}

function notEnforceable(key: string, message: string): CiPerformanceDiagnostic {
  return { code: "BUDGET_NOT_ENFORCEABLE", key, message };
}

function candidateDiagnostics(
  key: string,
  samples: readonly CiPerformanceSample[],
  statistics?: CiPerformanceStatistics,
): readonly CiPerformanceDiagnostic[] {
  const diagnostics: CiPerformanceDiagnostic[] = [];
  if (samples.length < MIN_PROMOTION_SAMPLES) {
    diagnostics.push(
      notEnforceable(
        key,
        `partition has ${samples.length} eligible samples; ${MIN_PROMOTION_SAMPLES} are required`,
      ),
    );
  }
  if (samples.some((sample) => !hasCompleteProvenance(sample))) {
    diagnostics.push(notEnforceable(key, "partition contains incomplete sample provenance"));
  }
  const inventoryDigests = new Set(samples.map(({ inventoryDigest }) => inventoryDigest));
  const workflowDigests = new Set(samples.map(({ workflowDigest }) => workflowDigest));
  if (inventoryDigests.size > 1 || workflowDigests.size > 1) {
    diagnostics.push(
      notEnforceable(key, "partition contains mismatched inventory or workflow provenance digests"),
    );
  }
  if (statistics && statistics.variability > MAX_VARIABILITY) {
    diagnostics.push(
      notEnforceable(
        key,
        `partition variability ${statistics.variability} exceeds ${MAX_VARIABILITY}`,
      ),
    );
  }
  return diagnostics;
}

export function createCiPerformanceBaselineCandidate(
  samples: readonly CiPerformanceSample[],
  partition: CiPerformancePartition,
  asOf: Date,
): {
  readonly samples: readonly CiPerformanceSample[];
  readonly statistics?: CiPerformanceStatistics;
  readonly diagnostics: readonly CiPerformanceDiagnostic[];
} {
  const selected = selectPromotionSamples(samples, partition, asOf);
  const statistics = selected.length > 0 ? calculateCiPerformanceStatistics(selected) : undefined;
  return {
    samples: selected,
    statistics,
    diagnostics: candidateDiagnostics(ciPerformancePartitionKey(partition), selected, statistics),
  };
}

function partitionSamples(
  samples: readonly CiPerformanceSample[],
): ReadonlyMap<string, readonly CiPerformanceSample[]> {
  const grouped = new Map<string, CiPerformanceSample[]>();
  for (const sample of samples) {
    const key = ciPerformancePartitionKey(sample);
    const group = grouped.get(key) ?? [];
    group.push(sample);
    grouped.set(key, group);
  }
  return grouped;
}

function exclusionReason(
  sample: CiPerformanceSample,
  asOf: Date,
): CiPerformancePartitionReport["excluded"][number]["reason"] | undefined {
  const age = asOf.getTime() - timestampMs(sample.timestamp);
  if (age > RETENTION_DAYS * DAY_MS || age < 0) return "outside-retention";
  if (age > PROMOTION_WINDOW_DAYS * DAY_MS) return "outside-promotion-window";
  if (sample.branch !== "trunk") return "not-trunk";
  if (sample.conclusion !== "success" || sample.componentConclusion !== "success")
    return "not-successful";
  if (sample.retryAttempt !== 1) return "retried";
  return undefined;
}

function evaluateCurrentSample(
  sample: CiPerformanceSample | undefined,
  baseline: CiPerformanceBaseline | undefined,
  enforce: boolean,
): readonly CiPerformanceDiagnostic[] {
  const key = baseline?.key ?? (sample ? ciPerformancePartitionKey(sample) : undefined);
  if (!sample) return [notEnforceable(key ?? "", "no current sample exists for this partition")];
  if (!hasCompleteProvenance(sample)) {
    return [
      {
        code: "CI_MEASUREMENT_INCOMPLETE",
        key,
        runId: sample.runId,
        message: "current sample does not cover a complete validate-job measurement boundary",
      },
    ];
  }
  if (sample.conclusion !== "success" || sample.componentConclusion !== "success") {
    return [
      {
        code: "CI_JOB_NOT_SUCCESSFUL",
        key,
        runId: sample.runId,
        message: `validate job concluded ${sample.conclusion} with ${sample.componentConclusion} component evidence`,
      },
    ];
  }
  if (!baseline || baseline.reviewed !== true)
    return [notEnforceable(key ?? "", "no matching reviewed baseline exists")];
  const distinctBaselineRuns = new Set(baseline.sampleExecutionIds).size;
  if (distinctBaselineRuns < MIN_PROMOTION_SAMPLES) {
    return [
      notEnforceable(
        key ?? "",
        `reviewed baseline has ${distinctBaselineRuns} distinct samples; ${MIN_PROMOTION_SAMPLES} are required`,
      ),
    ];
  }
  if (baseline.statistics.variability > MAX_VARIABILITY) {
    return [
      notEnforceable(key ?? "", "reviewed baseline variability exceeds the enforcement limit"),
    ];
  }
  if (
    sample.inventoryDigest !== baseline.inventoryDigest ||
    sample.workflowDigest !== baseline.workflowDigest
  ) {
    return [
      notEnforceable(key ?? "", "current sample provenance does not match the reviewed baseline"),
    ];
  }
  if (!enforce) return [];
  if (sample.durationMs > baseline.statistics.thresholdMs) {
    return [
      {
        code: "CI_DURATION_BUDGET_EXCEEDED",
        key,
        runId: sample.runId,
        message: `duration ${sample.durationMs}ms exceeds reviewed threshold ${baseline.statistics.thresholdMs}ms`,
      },
    ];
  }
  return [
    {
      code: "CI_DURATION_BUDGET_PASSED",
      key,
      runId: sample.runId,
      message: `duration ${sample.durationMs}ms is within reviewed threshold ${baseline.statistics.thresholdMs}ms`,
    },
  ];
}

export function createCiPerformanceReport(input: {
  readonly samples: readonly CiPerformanceSample[];
  readonly currentSamples?: readonly CiPerformanceSample[];
  readonly baselines: readonly CiPerformanceBaseline[];
  readonly asOf: Date;
  readonly enforce?: boolean;
  readonly mode?: CiPerformanceReport["mode"];
}): CiPerformanceReport {
  const retainedOldest = input.asOf.getTime() - RETENTION_DAYS * DAY_MS;
  const retained = input.samples.filter(
    (sample) =>
      timestampMs(sample.timestamp) >= retainedOldest &&
      timestampMs(sample.timestamp) <= input.asOf.getTime(),
  );
  const current = input.currentSamples ?? [];
  const keys = new Set([
    ...input.samples.map(ciPerformancePartitionKey),
    ...current.map(ciPerformancePartitionKey),
    ...input.baselines.map(({ key }) => key),
  ]);
  const grouped = partitionSamples(input.samples);
  const currentByKey = partitionSamples(current);
  const baselineByKey = new Map(input.baselines.map((baseline) => [baseline.key, baseline]));
  const partitions = [...keys].sort().map((key): CiPerformancePartitionReport => {
    const all = grouped.get(key) ?? [];
    const representative =
      all[0] ?? currentByKey.get(key)?.[0] ?? baselineByKey.get(key)?.partition;
    if (!representative) throw new Error(`partition ${key} has no representative provenance`);
    const partition = ciPerformancePartition(representative);
    const candidate = createCiPerformanceBaselineCandidate(input.samples, partition, input.asOf);
    const baseline = baselineByKey.get(key);
    const currentSample = [...(currentByKey.get(key) ?? [])].sort(
      (left, right) => timestampMs(right.timestamp) - timestampMs(left.timestamp),
    )[0];
    const evaluation = evaluateCurrentSample(currentSample, baseline, input.enforce === true);
    const diagnostics = baseline ? [...evaluation] : [...candidate.diagnostics, ...evaluation];
    return {
      key,
      partition,
      retainedSampleCount: retained.filter((sample) => ciPerformancePartitionKey(sample) === key)
        .length,
      candidateSampleCount: candidate.samples.length,
      candidateRunIds: candidate.samples.map(({ runId }) => runId),
      excluded: all
        .map((sample) => ({ runId: sample.runId, reason: exclusionReason(sample, input.asOf) }))
        .filter(
          (entry): entry is { runId: string; reason: NonNullable<typeof entry.reason> } =>
            entry.reason !== undefined,
        )
        .sort((left, right) => left.runId.localeCompare(right.runId)),
      ...(candidate.statistics ? { statistics: candidate.statistics } : {}),
      ...(baseline ? { baseline } : {}),
      ...(currentSample
        ? {
            currentDurationMs: currentSample.durationMs,
            regressionDeltaMs:
              currentSample.durationMs -
              (baseline?.statistics.medianMs ??
                candidate.statistics?.medianMs ??
                currentSample.durationMs),
          }
        : {}),
      enforceable: diagnostics.every(({ code }) => code !== "BUDGET_NOT_ENFORCEABLE"),
      diagnostics,
    };
  });
  const diagnostics = partitions.flatMap(({ diagnostics: items }) => items);
  if (partitions.length === 0)
    diagnostics.push(
      notEnforceable("", "no CI performance samples or reviewed baselines are available"),
    );
  return {
    schemaVersion: CI_PERFORMANCE_REPORT_SCHEMA,
    asOf: input.asOf.toISOString(),
    retentionDays: RETENTION_DAYS,
    promotionWindowDays: PROMOTION_WINDOW_DAYS,
    minPromotionSamples: MIN_PROMOTION_SAMPLES,
    maxPromotionSamples: MAX_PROMOTION_SAMPLES,
    mode: input.mode ?? (input.enforce ? "enforce" : "report"),
    partitions,
    diagnostics,
    failed: diagnostics.some(
      ({ code }) =>
        code === "CI_DURATION_BUDGET_EXCEEDED" ||
        code === "CI_JOB_NOT_SUCCESSFUL" ||
        code === "CI_MEASUREMENT_INCOMPLETE",
    ),
  };
}

export function promoteCiPerformanceBaselines(input: {
  readonly samples: readonly CiPerformanceSample[];
  readonly existing: readonly CiPerformanceBaseline[];
  readonly asOf: Date;
  readonly reviewedBy: string;
  readonly reviewed: boolean;
}): CiPerformanceBaselineFile {
  if (!input.reviewed || input.reviewedBy.trim().length === 0) {
    throw new Error("baseline promotion requires --reviewed-by with explicit --reviewed approval");
  }
  const byKey = new Map(input.existing.map((baseline) => [baseline.key, baseline]));
  for (const [key, samples] of partitionSamples(input.samples)) {
    const partition = ciPerformancePartition(samples[0]);
    const candidate = createCiPerformanceBaselineCandidate(input.samples, partition, input.asOf);
    if (
      !candidate.statistics ||
      candidate.diagnostics.some(({ code }) => code === "BUDGET_NOT_ENFORCEABLE")
    )
      continue;
    byKey.set(key, {
      key,
      partition,
      inventoryDigest: candidate.samples[0].inventoryDigest,
      workflowDigest: candidate.samples[0].workflowDigest,
      reviewed: true,
      reviewedBy: input.reviewedBy,
      reviewedAt: input.asOf.toISOString(),
      promotedAt: input.asOf.toISOString(),
      sampleExecutionIds: candidate.samples.map(({ runId, jobId }) => `${runId}/${jobId}`),
      statistics: candidate.statistics,
    });
  }
  return {
    schemaVersion: CI_PERFORMANCE_BASELINE_SCHEMA,
    baselines: [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key)),
  };
}

export function renderCiPerformanceMarkdown(report: CiPerformanceReport): string {
  const lines = [
    "# CI performance budget",
    "",
    `- Schema: \`${report.schemaVersion}\``,
    `- As of: ${report.asOf}`,
    `- Mode: ${report.mode}`,
    `- Result: ${report.failed ? "failed" : report.diagnostics.some(({ code }) => code === "BUDGET_NOT_ENFORCEABLE") ? "report-only" : "passed"}`,
    "",
    "| Partition | Samples | p50 | p95 | Threshold | Current | Variability | State |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const partition of report.partitions) {
    const statistics = partition.statistics ?? partition.baseline?.statistics;
    const state =
      partition.diagnostics.find(({ code }) => code === "CI_DURATION_BUDGET_EXCEEDED")?.code ??
      partition.diagnostics.find(({ code }) => code === "CI_JOB_NOT_SUCCESSFUL")?.code ??
      partition.diagnostics.find(({ code }) => code === "CI_MEASUREMENT_INCOMPLETE")?.code ??
      partition.diagnostics.find(({ code }) => code === "BUDGET_NOT_ENFORCEABLE")?.code ??
      "CI_DURATION_BUDGET_PASSED";
    lines.push(
      `| ${partition.key} | ${partition.candidateSampleCount} | ${statistics?.medianMs ?? "-"} | ${statistics?.p95Ms ?? "-"} | ${partition.baseline?.statistics.thresholdMs ?? statistics?.thresholdMs ?? "-"} | ${partition.currentDurationMs ?? "-"} | ${statistics?.variability ?? "-"} | ${state} |`,
    );
  }
  if (report.diagnostics.length > 0) {
    lines.push("", "## Diagnostics", "");
    for (const diagnostic of report.diagnostics)
      lines.push(`- \`${diagnostic.code}\`: ${diagnostic.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function parseSampleFile(value: unknown): CiPerformanceSampleFile {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== CI_PERFORMANCE_SAMPLE_SCHEMA ||
    !("samples" in value) ||
    !Array.isArray(value.samples)
  ) {
    throw new Error(
      `sample input must use ${CI_PERFORMANCE_SAMPLE_SCHEMA} and contain a samples array`,
    );
  }
  return value as CiPerformanceSampleFile;
}

function parseBaselineFile(value: unknown): CiPerformanceBaselineFile {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== CI_PERFORMANCE_BASELINE_SCHEMA ||
    !("baselines" in value) ||
    !Array.isArray(value.baselines)
  ) {
    throw new Error(
      `baseline input must use ${CI_PERFORMANCE_BASELINE_SCHEMA} and contain a baselines array`,
    );
  }
  return value as CiPerformanceBaselineFile;
}

function optionValue(arguments_: readonly string[], name: string): string | undefined {
  const index = arguments_.indexOf(name);
  return index === -1 ? undefined : arguments_[index + 1];
}

function writeArtifact(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

type VerificationEvidenceInput = {
  readonly schemaVersion: number | string;
  readonly profile: string;
  readonly generatedAt: string;
  readonly completedAt: string | null;
  readonly status: string;
  readonly provenance: {
    readonly commitSha: string;
    readonly runAttempt: string;
    readonly runId: string;
  };
  readonly checks: readonly {
    readonly command?: readonly string[];
    readonly durationMs: number | null;
    readonly stdoutExcerpt?: string;
  }[];
};

function digestFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function integerOption(arguments_: readonly string[], name: string, fallback: number): number {
  const raw = optionValue(arguments_, name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function cacheState(hitCount: number, missCount: number, explicit?: string): CacheState {
  if (explicit !== undefined) {
    if (explicit !== "cold" && explicit !== "partial" && explicit !== "warm") {
      throw new Error("--cache-state must be cold, partial, or warm");
    }
    return explicit;
  }
  if (hitCount === 0) return "cold";
  if (missCount === 0) return "warm";
  return "partial";
}

function ciConclusion(value: string | undefined): CiConclusion {
  if (value === "success" || value === "failure" || value === "cancelled") return value;
  throw new Error("--conclusion must be success, failure, or cancelled");
}

export function turboCacheCounts(evidence: VerificationEvidenceInput): {
  readonly hitCount: number;
  readonly missCount: number;
  readonly taskCount: number;
  readonly complete: boolean;
} {
  let hitCount = 0;
  let taskCount = 0;
  let complete = false;
  let consistent = true;
  for (const check of evidence.checks) {
    const output = check.stdoutExcerpt ?? "";
    const tasks = /Tasks:\s+\d+ successful,\s+(\d+) total/.exec(output);
    const cached = /Cached:\s+(\d+) cached,\s+(\d+) total/.exec(output);
    if (!tasks && !cached) {
      if (check.command?.includes("turbo")) consistent = false;
      continue;
    }
    complete = true;
    if (!tasks || !cached) {
      consistent = false;
      continue;
    }
    const observedTasks = Number(tasks[1]);
    const observedHits = Number(cached[1]);
    const cachedTotal = Number(cached[2]);
    taskCount += observedTasks;
    hitCount += observedHits;
    if (cachedTotal !== observedTasks || observedHits > observedTasks) consistent = false;
  }
  return {
    hitCount,
    missCount: Math.max(0, taskCount - hitCount),
    taskCount,
    complete: complete && consistent && taskCount > 0,
  };
}

export function resolveCacheProvenance(
  observed: ReturnType<typeof turboCacheCounts>,
  hitCount: number,
  missCount: number,
): { readonly taskCount: number; readonly complete: boolean } {
  const taskCount = observed.taskCount > 0 ? observed.taskCount : hitCount + missCount;
  return {
    taskCount,
    complete: observed.complete && hitCount + missCount === taskCount,
  };
}

export function createCiPerformanceSampleFromEvidence(input: {
  readonly evidence: VerificationEvidenceInput;
  readonly conclusion: CiConclusion;
  readonly measurementStartedAt: string;
  readonly measurementCompletedAt: string;
  readonly branch: string;
  readonly jobId: string;
  readonly runnerOs: string;
  readonly runnerArch: string;
  readonly runnerLabel: string;
  readonly nodeVersion: string;
  readonly pnpmVersion: string;
  readonly inventoryDigest: string;
  readonly workflowDigest: string;
  readonly workflowVersion: string;
  readonly cacheHitCount: number;
  readonly cacheMissCount: number;
  readonly taskCount?: number;
  readonly cacheState: CacheState;
  readonly cacheEvidenceComplete?: boolean;
}): CiPerformanceSample {
  const measurementStartedMs = Date.parse(input.measurementStartedAt);
  const measurementCompletedMs = Date.parse(input.measurementCompletedAt);
  const evidenceStartedMs = Date.parse(input.evidence.generatedAt);
  const evidenceCompletedMs = Date.parse(input.evidence.completedAt ?? "");
  if (
    !Number.isFinite(measurementStartedMs) ||
    !Number.isFinite(measurementCompletedMs) ||
    measurementCompletedMs < measurementStartedMs
  ) {
    throw new Error("validate-job measurement requires an ordered ISO-8601 boundary");
  }
  if (
    !Number.isFinite(evidenceStartedMs) ||
    !Number.isFinite(evidenceCompletedMs) ||
    measurementStartedMs > evidenceStartedMs ||
    measurementCompletedMs < evidenceCompletedMs
  ) {
    throw new Error(
      "validate-job measurement boundary must contain the completed verification evidence interval",
    );
  }
  const taskDurationMs = input.evidence.checks.reduce(
    (total, check) => total + (check.durationMs ?? 0),
    0,
  );
  return {
    measurementScope: "validate-job",
    profile: input.evidence.profile,
    lane: "verification-profile",
    workflowVersion: input.workflowVersion,
    workflowSchemaVersion: String(input.evidence.schemaVersion),
    runnerOs: input.runnerOs,
    runnerArch: input.runnerArch,
    runnerLabel: input.runnerLabel,
    nodeVersion: input.nodeVersion,
    pnpmVersion: input.pnpmVersion,
    cacheState: input.cacheState,
    runId: input.evidence.provenance.runId,
    jobId: input.jobId,
    commitSha: input.evidence.provenance.commitSha,
    branch: input.branch,
    timestamp: input.measurementCompletedAt,
    durationMs: measurementCompletedMs - measurementStartedMs,
    taskCount: input.taskCount ?? input.cacheHitCount + input.cacheMissCount,
    taskDurationMs,
    cacheHitCount: input.cacheHitCount,
    cacheMissCount: input.cacheMissCount,
    cacheEvidenceComplete: input.cacheEvidenceComplete ?? true,
    inventoryDigest: input.inventoryDigest,
    workflowDigest: input.workflowDigest,
    componentConclusion:
      input.evidence.status === "passed"
        ? "success"
        : input.evidence.status === "interrupted"
          ? "cancelled"
          : "failure",
    conclusion: input.conclusion,
    retryAttempt: Number(input.evidence.provenance.runAttempt),
  };
}

function main(): void {
  const root = resolve(import.meta.dirname, "..");
  const arguments_ = process.argv.slice(2);
  const workflowPath = resolve(root, ".github/workflows/ci.yml");
  const workflow = readFileSync(workflowPath, "utf8");
  const designViolations = findCiPerformanceBudgetViolations({
    maintenancePullRequestManifest: createMaintenancePullRequestManifest(),
    ordinaryPullRequestManifest: createOrdinaryPullRequestManifest(),
    workflow,
  });
  if (designViolations.length > 0) {
    for (const violation of designViolations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  const inputPath = optionValue(arguments_, "--input");
  const baselinePath = resolve(
    root,
    optionValue(arguments_, "--baseline") ?? "config/ci-performance-baselines.json",
  );
  const sampleFile = inputPath
    ? parseSampleFile(readJson(resolve(inputPath)))
    : { schemaVersion: CI_PERFORMANCE_SAMPLE_SCHEMA, samples: [] };
  const baselineFile = parseBaselineFile(readJson(baselinePath));
  const evidencePath = optionValue(arguments_, "--evidence");
  let generatedSample: CiPerformanceSample | undefined;
  if (evidencePath) {
    const evidence = readJson(resolve(evidencePath)) as VerificationEvidenceInput;
    const observedCache = turboCacheCounts(evidence);
    const cacheHitCount = integerOption(arguments_, "--cache-hits", observedCache.hitCount);
    const cacheMissCount = integerOption(arguments_, "--cache-misses", observedCache.missCount);
    const cacheProvenance = resolveCacheProvenance(observedCache, cacheHitCount, cacheMissCount);
    const workflowDigest = digestFile(workflowPath);
    const measurementStartedAt = optionValue(arguments_, "--measurement-started-at");
    const measurementCompletedAt = optionValue(arguments_, "--measurement-completed-at");
    if (!measurementStartedAt || !measurementCompletedAt) {
      throw new Error(
        "--evidence requires --measurement-started-at and --measurement-completed-at for the validate-job boundary",
      );
    }
    generatedSample = createCiPerformanceSampleFromEvidence({
      evidence,
      conclusion: ciConclusion(optionValue(arguments_, "--conclusion")),
      measurementStartedAt,
      measurementCompletedAt,
      branch: optionValue(arguments_, "--branch") ?? process.env.GITHUB_REF_NAME ?? "",
      jobId: optionValue(arguments_, "--job-id") ?? process.env.GITHUB_JOB ?? "",
      runnerOs: optionValue(arguments_, "--runner-os") ?? process.env.RUNNER_OS ?? "",
      runnerArch: optionValue(arguments_, "--runner-arch") ?? process.env.RUNNER_ARCH ?? "",
      runnerLabel: optionValue(arguments_, "--runner-label") ?? process.env.RUNNER_NAME ?? "",
      nodeVersion: optionValue(arguments_, "--node-version") ?? process.version,
      pnpmVersion: optionValue(arguments_, "--pnpm-version") ?? "",
      inventoryDigest:
        optionValue(arguments_, "--inventory-digest") ??
        digestFile(resolve(root, "test-inventory.json")),
      workflowDigest,
      workflowVersion: optionValue(arguments_, "--workflow-version") ?? workflowDigest,
      cacheHitCount,
      cacheMissCount,
      taskCount: cacheProvenance.taskCount,
      cacheState: cacheState(
        cacheHitCount,
        cacheMissCount,
        optionValue(arguments_, "--cache-state"),
      ),
      cacheEvidenceComplete: cacheProvenance.complete,
    });
    const sampleOutput = optionValue(arguments_, "--sample-output");
    if (sampleOutput) {
      const raw: CiPerformanceSampleFile = {
        schemaVersion: CI_PERFORMANCE_SAMPLE_SCHEMA,
        samples: isSuccessfulFirstAttemptTrunkSample(generatedSample) ? [generatedSample] : [],
        currentSamples: [generatedSample],
      };
      writeArtifact(resolve(sampleOutput), `${JSON.stringify(raw, null, 2)}\n`);
    }
  }
  const samples = [
    ...selectCiPerformanceHistorySamples(sampleFile.samples),
    ...(generatedSample && isSuccessfulFirstAttemptTrunkSample(generatedSample)
      ? [generatedSample]
      : []),
  ];
  const currentSamples = generatedSample ? [generatedSample] : sampleFile.currentSamples;
  const historyOutput = optionValue(arguments_, "--history-output");
  if (historyOutput) {
    const newestTimestamp = Math.max(...samples.map(({ timestamp }) => timestampMs(timestamp)));
    const retainedOldest = newestTimestamp - RETENTION_DAYS * DAY_MS;
    const byExecution = new Map<string, CiPerformanceSample>();
    for (const sample of samples) {
      if (timestampMs(sample.timestamp) >= retainedOldest) {
        byExecution.set(`${sample.runId}\0${sample.jobId}`, sample);
      }
    }
    writeArtifact(
      resolve(historyOutput),
      `${JSON.stringify(
        {
          schemaVersion: CI_PERFORMANCE_SAMPLE_SCHEMA,
          samples: [...byExecution.values()].sort(
            (left, right) =>
              timestampMs(left.timestamp) - timestampMs(right.timestamp) ||
              left.runId.localeCompare(right.runId) ||
              left.jobId.localeCompare(right.jobId),
          ),
        },
        null,
        2,
      )}\n`,
    );
  }
  const timestamps = [...samples, ...(currentSamples ?? [])]
    .map(({ timestamp }) => timestampMs(timestamp))
    .filter(Number.isFinite);
  const explicitAsOf = optionValue(arguments_, "--as-of");
  const asOf = new Date(explicitAsOf ?? (timestamps.length > 0 ? Math.max(...timestamps) : 0));
  if (!Number.isFinite(asOf.getTime()))
    throw new Error("--as-of must be a valid ISO-8601 timestamp");

  const promote = arguments_.includes("--promote");
  let baselines = baselineFile.baselines;
  if (promote) {
    const promoted = promoteCiPerformanceBaselines({
      samples,
      existing: baselines,
      asOf,
      reviewed: arguments_.includes("--reviewed"),
      reviewedBy: optionValue(arguments_, "--reviewed-by") ?? "",
    });
    writeArtifact(baselinePath, `${JSON.stringify(promoted, null, 2)}\n`);
    baselines = promoted.baselines;
  }
  const report = createCiPerformanceReport({
    samples,
    currentSamples,
    baselines,
    asOf,
    enforce: arguments_.includes("--enforce"),
    mode: promote ? "promote" : arguments_.includes("--enforce") ? "enforce" : "report",
  });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const jsonOutput = optionValue(arguments_, "--json-output");
  const markdownOutput = optionValue(arguments_, "--markdown-output");
  if (jsonOutput) writeArtifact(resolve(jsonOutput), json);
  if (markdownOutput) writeArtifact(resolve(markdownOutput), renderCiPerformanceMarkdown(report));
  if (!jsonOutput && !markdownOutput) process.stdout.write(json);
  if (report.failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
