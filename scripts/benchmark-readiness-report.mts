import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  BENCHMARK_EMPTY_REPORT_FAILURE,
  BENCHMARK_MISSING_REPORT_SUFFIX,
  BENCHMARK_MODULE_FAILED_PREFIX,
  BENCHMARK_RUNNER_ERROR_PREFIX,
} from "./bench-threshold-check.mts";
import type { BenchmarkCheckResult, BenchmarkReport } from "./bench-threshold-check.mts";

export type BenchmarkReportStatus = NonNullable<BenchmarkReport["thresholdStatus"]>;

export type BenchmarkReadinessReportRow = BenchmarkReport;

export type BenchmarkReadinessResult = Partial<BenchmarkCheckResult>;

export type BenchmarkVarianceEvidence = {
  path: string;
  content?: string;
};

type BenchmarkVarianceEvidenceRun = {
  id: number;
  url: string;
  headSha: string;
  headBranch: string;
  baseBranch: string;
  createdAt: string;
  workflowStatus: string;
  workflowConclusion: string;
  artifact: {
    allPassed: boolean;
    reportCount: number;
    gateFailures: string[];
  };
};

type BenchmarkVarianceEvidenceRow = {
  name: string;
  min: number;
  median: number;
  max: number;
  spread: number;
  status: "pass" | "fail";
  p75ByRun: Record<string, number>;
};

type BenchmarkVarianceEvidenceSelection = {
  workflowName: string;
  qualifyingBaseBranch: string;
  qualifyingWorkflowStatus: string;
  qualifyingWorkflowConclusion: string;
  orderedBy: string;
  latestGreenTrunkRunIds: number[];
};

type BenchmarkVarianceEvidenceContract = {
  version: 1;
  source: string;
  reviewedAt: string;
  tolerance: number;
  selection: BenchmarkVarianceEvidenceSelection;
  runs: BenchmarkVarianceEvidenceRun[];
  checks: {
    sameRowSet: boolean;
    runnerFailures: number;
    moduleFailures: number;
    emptyReports: number;
    missingReports: number;
    thresholdFailures: number;
    thresholdSkips: number;
    baselineSkips: number;
    prePromotionBaselineFailures: number;
    promotedBaselineFailures: number;
  };
  rows: BenchmarkVarianceEvidenceRow[];
};

type BenchmarkVarianceGateFailureCounts = {
  runnerFailures: number;
  moduleFailures: number;
  emptyReports: number;
  missingReports: number;
  thresholdFailures: number;
  thresholdSkips: number;
  baselineFailures: number;
  baselineSkips: number;
  otherFailures: number;
};

type BenchmarkVarianceEvidenceValidation = {
  provided: boolean;
  valid: boolean;
  failures: string[];
};

export type BenchmarkReadinessEvaluationOptions = {
  resultFilePath?: string;
  resultReadError?: string;
  varianceEvidence?: BenchmarkVarianceEvidence;
};

export type BenchmarkRowReadiness = {
  name: string;
  p75: number;
  hasThresholdEntry: boolean;
  hasBaselineEntry: boolean;
  thresholdStatus: BenchmarkReportStatus | "missing";
  baselineStatus: BenchmarkReportStatus | "missing";
  notes: string[];
};

export type BenchmarkReadinessEvaluation = {
  enforceReady: boolean;
  blockingReasons: string[];
  reports: BenchmarkReadinessReportRow[];
  rows: BenchmarkRowReadiness[];
  gateFailures: string[];
  runnerFailures: string[];
  missingReports: string[];
  emptyReports: string[];
  thresholdSkips: string[];
  baselineSkips: string[];
  otherGateFailures: string[];
  allRowsHaveThresholdEntries: boolean;
  allRowsHaveBaselineEntries: boolean;
  varianceEvidenceProvided: boolean;
  varianceEvidenceValid: boolean;
  varianceEvidenceFailures: string[];
  varianceEvidenceTolerance: number;
  varianceEvidencePath: string;
  resultFilePath: string;
  resultReadError?: string;
};

export type RenderBenchmarkReadinessReportOptions = {
  gateMode?: string;
  benchmarkOutcome?: string;
  benchmarkConclusion?: string;
  benchmarkCommand?: string;
};

const DEFAULT_RESULT_FILE_PATH = "benchmark-result.json";
const DEFAULT_OUTPUT_PATH = "ci-reports/benchmark/summary.md";
const DEFAULT_VARIANCE_EVIDENCE_PATH = "ci-reports/benchmark/latest-five-green-runs.md";
const DEFAULT_BENCHMARK_COMMAND = "pnpm bench:check --output-json=benchmark-result.json";
const VARIANCE_EVIDENCE_MARKER = "<!-- croco-benchmark-variance-evidence:v1 -->";
const VARIANCE_EVIDENCE_RUN_COUNT = 5;
const VARIANCE_SPREAD_TOLERANCE = 0.15;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const PROMOTED_BASELINE_TOLERANCE = 0.2;

function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(1)}us`;
  }
  return `${ms.toFixed(1)}ms`;
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStatus(value: unknown): value is BenchmarkReportStatus {
  return value === "pass" || value === "fail" || value === "skip";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeReport(value: unknown): BenchmarkReadinessReportRow | null {
  if (!isRecord(value) || typeof value.name !== "string" || !hasFiniteNumber(value.p75)) {
    return null;
  }

  return {
    name: value.name,
    p75: value.p75,
    threshold: hasFiniteNumber(value.threshold) ? value.threshold : undefined,
    baseline: hasFiniteNumber(value.baseline) ? value.baseline : undefined,
    thresholdStatus: isStatus(value.thresholdStatus) ? value.thresholdStatus : undefined,
    baselineStatus: isStatus(value.baselineStatus) ? value.baselineStatus : undefined,
    thresholdSkipReason:
      typeof value.thresholdSkipReason === "string" ? value.thresholdSkipReason : undefined,
    baselineSkipReason:
      typeof value.baselineSkipReason === "string" ? value.baselineSkipReason : undefined,
  };
}

function normalizeResult(value: unknown): BenchmarkReadinessResult {
  if (!isRecord(value)) {
    return { allPassed: false, gateFailures: [], reports: [] };
  }

  return {
    allPassed: typeof value.allPassed === "boolean" ? value.allPassed : undefined,
    gateFailures: Array.isArray(value.gateFailures)
      ? value.gateFailures.filter((failure): failure is string => typeof failure === "string")
      : [],
    reports: Array.isArray(value.reports)
      ? value.reports
          .map(normalizeReport)
          .filter((report): report is BenchmarkReadinessReportRow => report !== null)
      : [],
  };
}

function getThresholdSkipReason(report: BenchmarkReadinessReportRow): string {
  return report.thresholdSkipReason ?? "no threshold skip reason";
}

function getBaselineSkipReason(report: BenchmarkReadinessReportRow): string {
  return report.baselineSkipReason ?? "no baseline skip reason";
}

function toRowReadiness(report: BenchmarkReadinessReportRow): BenchmarkRowReadiness {
  const thresholdStatus = report.thresholdStatus ?? "missing";
  const baselineStatus = report.baselineStatus ?? "missing";
  const hasThresholdEntry = report.thresholdStatus !== "skip" && hasFiniteNumber(report.threshold);
  const hasBaselineEntry = report.baselineStatus !== "skip" && hasFiniteNumber(report.baseline);
  const notes: string[] = [];

  if (report.thresholdStatus === "skip") {
    notes.push(`threshold skipped (${getThresholdSkipReason(report)})`);
  } else if (!hasFiniteNumber(report.threshold)) {
    notes.push("threshold entry missing");
  }

  if (report.baselineStatus === "skip") {
    notes.push(`baseline skipped (${getBaselineSkipReason(report)})`);
  } else if (!hasFiniteNumber(report.baseline)) {
    notes.push("baseline entry missing");
  }

  return {
    name: report.name,
    p75: report.p75,
    hasThresholdEntry,
    hasBaselineEntry,
    thresholdStatus,
    baselineStatus,
    notes,
  };
}

function includesGateFailure(gateFailures: readonly string[], fragment: string): boolean {
  return gateFailures.some((failure) => failure.includes(fragment));
}

function addUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nearlyEqual(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= Math.max(1e-9, Math.abs(expected) * 1e-6);
}

function parseIsoTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !ISO_TIMESTAMP_PATTERN.test(value)) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function createGateFailureCounts(): BenchmarkVarianceGateFailureCounts {
  return {
    runnerFailures: 0,
    moduleFailures: 0,
    emptyReports: 0,
    missingReports: 0,
    thresholdFailures: 0,
    thresholdSkips: 0,
    baselineFailures: 0,
    baselineSkips: 0,
    otherFailures: 0,
  };
}

function addGateFailureCounts(
  target: BenchmarkVarianceGateFailureCounts,
  source: BenchmarkVarianceGateFailureCounts,
): void {
  target.runnerFailures += source.runnerFailures;
  target.moduleFailures += source.moduleFailures;
  target.emptyReports += source.emptyReports;
  target.missingReports += source.missingReports;
  target.thresholdFailures += source.thresholdFailures;
  target.thresholdSkips += source.thresholdSkips;
  target.baselineFailures += source.baselineFailures;
  target.baselineSkips += source.baselineSkips;
  target.otherFailures += source.otherFailures;
}

function countGateFailures(gateFailures: readonly string[]): BenchmarkVarianceGateFailureCounts {
  const counts = createGateFailureCounts();

  for (const failure of gateFailures) {
    if (failure.startsWith(BENCHMARK_RUNNER_ERROR_PREFIX)) {
      counts.runnerFailures += 1;
    } else if (failure.startsWith(BENCHMARK_MODULE_FAILED_PREFIX)) {
      counts.moduleFailures += 1;
    } else if (failure === BENCHMARK_EMPTY_REPORT_FAILURE) {
      counts.emptyReports += 1;
    } else if (failure.endsWith(BENCHMARK_MISSING_REPORT_SUFFIX)) {
      counts.missingReports += 1;
    } else if (failure.includes("threshold skipped")) {
      counts.thresholdSkips += 1;
    } else if (failure.includes("baseline skipped")) {
      counts.baselineSkips += 1;
    } else if (failure.includes("exceeds threshold")) {
      counts.thresholdFailures += 1;
    } else if (failure.includes("exceeds baseline")) {
      counts.baselineFailures += 1;
    } else {
      counts.otherFailures += 1;
    }
  }

  return counts;
}

function parseVarianceEvidenceContract(
  evidence: BenchmarkVarianceEvidence,
): BenchmarkVarianceEvidenceContract | string {
  const markerIndex = evidence.content?.indexOf(VARIANCE_EVIDENCE_MARKER) ?? -1;

  if (markerIndex < 0) {
    return `structured evidence marker ${VARIANCE_EVIDENCE_MARKER} was not found`;
  }

  const evidenceBlock =
    evidence.content?.slice(markerIndex + VARIANCE_EVIDENCE_MARKER.length) ?? "";
  const jsonBlock = /```json\s*([\s\S]*?)```/.exec(evidenceBlock);

  if (!jsonBlock) {
    return "structured evidence JSON block was not found after the evidence marker";
  }

  try {
    return JSON.parse(jsonBlock[1]) as BenchmarkVarianceEvidenceContract;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `structured evidence JSON could not be parsed: ${message}`;
  }
}

function validateVarianceEvidenceContract(
  evidence: BenchmarkVarianceEvidence,
  reports: readonly BenchmarkReadinessReportRow[],
): BenchmarkVarianceEvidenceValidation {
  const provided = Boolean(evidence.content?.trim());

  if (!provided) {
    return { provided, valid: false, failures: [] };
  }

  const parsed = parseVarianceEvidenceContract(evidence);

  if (typeof parsed === "string") {
    return { provided, valid: false, failures: [parsed] };
  }

  const failures: string[] = [];
  const contract = parsed;

  if (contract.version !== 1) {
    failures.push("version must be 1");
  }

  if (contract.source !== "github-actions") {
    failures.push("source must be github-actions");
  }

  if (parseIsoTimestamp(contract.reviewedAt) === null) {
    failures.push("reviewedAt must be an ISO date/time string");
  }

  if (
    !isFiniteNumber(contract.tolerance) ||
    !nearlyEqual(contract.tolerance, VARIANCE_SPREAD_TOLERANCE)
  ) {
    failures.push(
      `tolerance must be ${VARIANCE_SPREAD_TOLERANCE.toFixed(2)} for the committed evidence contract`,
    );
  }

  if (!Array.isArray(contract.runs) || contract.runs.length !== VARIANCE_EVIDENCE_RUN_COUNT) {
    failures.push(`runs must contain exactly ${VARIANCE_EVIDENCE_RUN_COUNT} GitHub Actions runs`);
  }

  const runIds = new Set<string>();
  const orderedRunIds: number[] = [];
  const orderedRunCreatedAt: number[] = [];
  const artifactFailureCounts = createGateFailureCounts();
  for (const run of Array.isArray(contract.runs) ? contract.runs : []) {
    if (!isFiniteNumber(run.id)) {
      failures.push("each run must include a numeric id");
      continue;
    }
    const runId = String(run.id);
    orderedRunIds.push(run.id);
    if (runIds.has(runId)) {
      failures.push(`run id ${runId} is duplicated`);
    }
    runIds.add(runId);

    if (
      typeof run.url !== "string" ||
      !run.url.startsWith(`https://github.com/croco-dev/framework/actions/runs/${runId}`)
    ) {
      failures.push(`run ${runId} must include its GitHub Actions run URL`);
    }
    if (typeof run.headSha !== "string" || !/^[0-9a-f]{40}$/.test(run.headSha)) {
      failures.push(`run ${runId} must include a 40-character head SHA`);
    }
    if (typeof run.headBranch !== "string" || run.headBranch.length === 0) {
      failures.push(`run ${runId} must include a head branch`);
    }
    if (run.baseBranch !== "trunk") {
      failures.push(`run ${runId} must target trunk`);
    }
    const createdAt = parseIsoTimestamp(run.createdAt);
    if (createdAt === null) {
      failures.push(`run ${runId} must include an ISO createdAt timestamp`);
    } else {
      orderedRunCreatedAt.push(createdAt);
    }
    if (run.workflowStatus !== "completed") {
      failures.push(`run ${runId} workflowStatus must be completed`);
    }
    if (run.workflowConclusion !== "success") {
      failures.push(`run ${runId} workflowConclusion must be success`);
    }

    const artifact = run.artifact;
    if (!artifact || typeof artifact !== "object") {
      failures.push(`run ${runId} must include benchmark artifact evidence`);
      continue;
    }
    if (typeof artifact.allPassed !== "boolean") {
      failures.push(`run ${runId} artifact.allPassed must be boolean`);
    }
    if (!isFiniteNumber(artifact.reportCount)) {
      failures.push(`run ${runId} artifact.reportCount must be numeric`);
    }
    if (Array.isArray(contract.rows) && artifact.reportCount !== contract.rows.length) {
      failures.push(`run ${runId} artifact.reportCount must match evidence row count`);
    }
    if (!Array.isArray(artifact.gateFailures)) {
      failures.push(`run ${runId} artifact.gateFailures must be an array`);
      continue;
    }
    if (artifact.gateFailures.some((failure) => typeof failure !== "string")) {
      failures.push(`run ${runId} artifact.gateFailures must contain only strings`);
      continue;
    }

    const runFailureCounts = countGateFailures(artifact.gateFailures);
    addGateFailureCounts(artifactFailureCounts, runFailureCounts);

    if (artifact.allPassed && artifact.gateFailures.length > 0) {
      failures.push(`run ${runId} artifact cannot be allPassed=true with gate failures`);
    }
    if (!artifact.allPassed && artifact.gateFailures.length === 0) {
      failures.push(`run ${runId} artifact cannot be allPassed=false without gate failures`);
    }
    if (runFailureCounts.otherFailures > 0) {
      failures.push(`run ${runId} artifact contains unclassified gate failures`);
    }
  }

  const selection = contract.selection;
  if (!selection || typeof selection !== "object") {
    failures.push("selection must describe the latest green trunk run window");
  } else {
    if (selection.workflowName !== "Performance Benchmark") {
      failures.push("selection.workflowName must be Performance Benchmark");
    }
    if (selection.qualifyingBaseBranch !== "trunk") {
      failures.push("selection.qualifyingBaseBranch must be trunk");
    }
    if (selection.qualifyingWorkflowStatus !== "completed") {
      failures.push("selection.qualifyingWorkflowStatus must be completed");
    }
    if (selection.qualifyingWorkflowConclusion !== "success") {
      failures.push("selection.qualifyingWorkflowConclusion must be success");
    }
    if (selection.orderedBy !== "createdAt-desc") {
      failures.push("selection.orderedBy must be createdAt-desc");
    }
    if (
      !Array.isArray(selection.latestGreenTrunkRunIds) ||
      selection.latestGreenTrunkRunIds.length !== VARIANCE_EVIDENCE_RUN_COUNT
    ) {
      failures.push(
        `selection.latestGreenTrunkRunIds must contain exactly ${VARIANCE_EVIDENCE_RUN_COUNT} run id(s)`,
      );
    } else {
      const selectedRunIds = selection.latestGreenTrunkRunIds;
      if (selectedRunIds.some((runId) => !isFiniteNumber(runId))) {
        failures.push("selection.latestGreenTrunkRunIds must contain only numeric run ids");
      }
      const selectedRunIdSet = new Set(selectedRunIds);
      if (selectedRunIdSet.size !== selectedRunIds.length) {
        failures.push("selection.latestGreenTrunkRunIds must not contain duplicates");
      }
      if (JSON.stringify(selectedRunIds) !== JSON.stringify(orderedRunIds)) {
        failures.push("selection.latestGreenTrunkRunIds must match runs in newest-to-oldest order");
      }
    }
  }

  if (
    orderedRunCreatedAt.length === VARIANCE_EVIDENCE_RUN_COUNT &&
    orderedRunCreatedAt.some(
      (createdAt, index, values) => index > 0 && createdAt >= values[index - 1],
    )
  ) {
    failures.push("runs must be ordered newest-to-oldest by createdAt");
  }

  const checks = contract.checks;
  if (!checks || typeof checks !== "object") {
    failures.push("checks must be provided");
  } else {
    if (checks.sameRowSet !== true) {
      failures.push("checks.sameRowSet must be true");
    }
    const aggregateChecks = {
      runnerFailures: artifactFailureCounts.runnerFailures,
      moduleFailures: artifactFailureCounts.moduleFailures,
      emptyReports: artifactFailureCounts.emptyReports,
      missingReports: artifactFailureCounts.missingReports,
      thresholdFailures: artifactFailureCounts.thresholdFailures,
      thresholdSkips: artifactFailureCounts.thresholdSkips,
      baselineSkips: artifactFailureCounts.baselineSkips,
      prePromotionBaselineFailures: artifactFailureCounts.baselineFailures,
    };

    for (const [key, expectedCount] of Object.entries(aggregateChecks)) {
      if (checks[key as keyof typeof aggregateChecks] !== expectedCount) {
        failures.push(`checks.${key} must match reviewed artifact gate failures`);
      }
    }

    for (const key of [
      "runnerFailures",
      "moduleFailures",
      "emptyReports",
      "missingReports",
      "thresholdFailures",
      "thresholdSkips",
      "baselineSkips",
    ] as const) {
      if (checks[key] !== 0) {
        failures.push(`checks.${key} must be 0`);
      }
    }
    if (!isFiniteNumber(checks.prePromotionBaselineFailures)) {
      failures.push("checks.prePromotionBaselineFailures must be numeric");
    }
  }

  if (!Array.isArray(contract.rows)) {
    failures.push("rows must be an array");
    return { provided, valid: failures.length === 0, failures };
  }

  if (contract.rows.length !== reports.length) {
    failures.push(`rows must contain exactly ${reports.length} benchmark row(s)`);
  }

  const duplicateRowNames = contract.rows
    .map((row) => row.name)
    .filter((name, index, names) => names.indexOf(name) !== index);

  if (duplicateRowNames.length > 0) {
    failures.push(
      `rows must not contain duplicate benchmark names: ${duplicateRowNames.join(", ")}`,
    );
  }

  const evidenceRowsByName = new Map(contract.rows.map((row) => [row.name, row]));
  const expectedNames = reports.map((report) => report.name).sort();
  const evidenceNames = [...evidenceRowsByName.keys()].sort();

  if (JSON.stringify(evidenceNames) !== JSON.stringify(expectedNames)) {
    failures.push(
      `row set must match benchmark-result.json (${evidenceNames.length} evidence row(s), ${expectedNames.length} result row(s))`,
    );
  }

  let promotedBaselineFailures = 0;

  for (const report of reports) {
    const row = evidenceRowsByName.get(report.name);
    if (!row) {
      continue;
    }

    const p75Values = [...runIds].map((runId) => row.p75ByRun?.[runId]);
    if (
      p75Values.length !== VARIANCE_EVIDENCE_RUN_COUNT ||
      p75Values.some((value) => !isFiniteNumber(value))
    ) {
      failures.push(
        `${report.name}: p75ByRun must contain finite p75 values for all reviewed runs`,
      );
      continue;
    }

    const numericP75Values = p75Values as number[];
    const sortedValues = [...numericP75Values].sort((a, b) => a - b);
    const min = Math.min(...numericP75Values);
    const median = sortedValues[Math.floor(sortedValues.length / 2)];
    const max = Math.max(...numericP75Values);
    const spread = (max - min) / median;

    if (!nearlyEqual(row.min, min)) {
      failures.push(`${report.name}: min does not match p75ByRun values`);
    }
    if (!nearlyEqual(row.median, median)) {
      failures.push(`${report.name}: median does not match p75ByRun values`);
    }
    if (!nearlyEqual(row.max, max)) {
      failures.push(`${report.name}: max does not match p75ByRun values`);
    }
    if (!nearlyEqual(row.spread, spread)) {
      failures.push(`${report.name}: spread does not match p75ByRun values`);
    }
    if (row.status !== "pass") {
      failures.push(`${report.name}: status must be pass`);
    }
    if (spread > VARIANCE_SPREAD_TOLERANCE) {
      failures.push(
        `${report.name}: spread ${(spread * 100).toFixed(2)}% exceeds ${(VARIANCE_SPREAD_TOLERANCE * 100).toFixed(0)}% tolerance`,
      );
    }
    const rowPromotedBaselineFailures = numericP75Values.filter(
      (value) => value - median > median * PROMOTED_BASELINE_TOLERANCE,
    ).length;
    promotedBaselineFailures += rowPromotedBaselineFailures;
    if (rowPromotedBaselineFailures > 0) {
      failures.push(
        `${report.name}: ${rowPromotedBaselineFailures} reviewed run(s) fail the promoted baseline tolerance`,
      );
    }
    if (!isFiniteNumber(report.baseline) || !nearlyEqual(report.baseline, median)) {
      failures.push(`${report.name}: committed baseline must match the reviewed median p75`);
    }
  }

  if (checks && typeof checks === "object") {
    if (checks.promotedBaselineFailures !== promotedBaselineFailures) {
      failures.push("checks.promotedBaselineFailures must match promoted baseline validation");
    }
    if (checks.promotedBaselineFailures !== 0) {
      failures.push("checks.promotedBaselineFailures must be 0");
    }
  }

  return { provided, valid: failures.length === 0, failures };
}

export function evaluateBenchmarkReadiness(
  rawResult: BenchmarkReadinessResult | null,
  options: BenchmarkReadinessEvaluationOptions = {},
): BenchmarkReadinessEvaluation {
  const result = rawResult ? normalizeResult(rawResult) : null;
  const reports = result?.reports ?? [];
  const gateFailures = result?.gateFailures ?? [];
  const rows = reports.map(toRowReadiness);
  const resultFilePath = options.resultFilePath ?? DEFAULT_RESULT_FILE_PATH;
  const varianceEvidencePath = options.varianceEvidence?.path ?? DEFAULT_VARIANCE_EVIDENCE_PATH;
  const varianceEvidenceValidation = validateVarianceEvidenceContract(
    options.varianceEvidence ?? { path: varianceEvidencePath },
    reports,
  );
  const varianceEvidenceProvided = varianceEvidenceValidation.provided;
  const blockingReasons: string[] = [];

  if (options.resultReadError) {
    addUnique(blockingReasons, `${resultFilePath} could not be read: ${options.resultReadError}`);
  } else if (!result) {
    addUnique(blockingReasons, `${resultFilePath} was not generated.`);
  }

  const runnerFailures = gateFailures.filter(
    (failure) =>
      failure.startsWith(BENCHMARK_RUNNER_ERROR_PREFIX) ||
      failure.startsWith(BENCHMARK_MODULE_FAILED_PREFIX),
  );
  const missingReports = gateFailures.filter((failure) =>
    failure.endsWith(BENCHMARK_MISSING_REPORT_SUFFIX),
  );
  const emptyReports = gateFailures.filter((failure) => failure === BENCHMARK_EMPTY_REPORT_FAILURE);
  const thresholdSkips = reports
    .filter((report) => report.thresholdStatus === "skip")
    .map((report) => `${report.name}: threshold skipped (${getThresholdSkipReason(report)})`);
  const baselineSkips = reports
    .filter((report) => report.baselineStatus === "skip")
    .map((report) => `${report.name}: baseline skipped (${getBaselineSkipReason(report)})`);
  const categorizedGateFailures = new Set([
    ...runnerFailures,
    ...missingReports,
    ...emptyReports,
    ...thresholdSkips.filter((skip) => includesGateFailure(gateFailures, skip)),
    ...baselineSkips.filter((skip) => includesGateFailure(gateFailures, skip)),
  ]);
  const otherGateFailures = gateFailures.filter((failure) => !categorizedGateFailures.has(failure));

  if (reports.length === 0 && emptyReports.length === 0 && !options.resultReadError) {
    addUnique(blockingReasons, BENCHMARK_EMPTY_REPORT_FAILURE);
  }

  for (const failure of gateFailures) {
    addUnique(blockingReasons, `gateFailures includes: ${failure}`);
  }

  for (const skip of thresholdSkips) {
    if (!includesGateFailure(gateFailures, skip)) {
      addUnique(blockingReasons, skip);
    }
  }

  for (const skip of baselineSkips) {
    if (!includesGateFailure(gateFailures, skip)) {
      addUnique(blockingReasons, skip);
    }
  }

  for (const row of rows) {
    if (!row.hasThresholdEntry && row.thresholdStatus !== "skip") {
      addUnique(blockingReasons, `${row.name}: threshold entry missing.`);
    }
    if (!row.hasBaselineEntry && row.baselineStatus !== "skip") {
      addUnique(blockingReasons, `${row.name}: baseline entry missing.`);
    }
  }

  if (result?.allPassed === false && gateFailures.length === 0) {
    addUnique(blockingReasons, `${resultFilePath} reports allPassed=false without gateFailures.`);
  }

  if (!varianceEvidenceProvided) {
    addUnique(
      blockingReasons,
      `Latest five green benchmark variance evidence was not provided at ${varianceEvidencePath}.`,
    );
  }

  for (const failure of varianceEvidenceValidation.failures) {
    addUnique(
      blockingReasons,
      `Latest five green benchmark variance evidence is invalid: ${failure}.`,
    );
  }

  const allRowsHaveThresholdEntries =
    reports.length > 0 && rows.every((row) => row.hasThresholdEntry);
  const allRowsHaveBaselineEntries =
    reports.length > 0 && rows.every((row) => row.hasBaselineEntry);

  return {
    enforceReady: blockingReasons.length === 0,
    blockingReasons,
    reports,
    rows,
    gateFailures,
    runnerFailures,
    missingReports,
    emptyReports,
    thresholdSkips,
    baselineSkips,
    otherGateFailures,
    allRowsHaveThresholdEntries,
    allRowsHaveBaselineEntries,
    varianceEvidenceProvided,
    varianceEvidenceValid: varianceEvidenceValidation.valid,
    varianceEvidenceFailures: varianceEvidenceValidation.failures,
    varianceEvidenceTolerance: VARIANCE_SPREAD_TOLERANCE,
    varianceEvidencePath,
    resultFilePath,
    resultReadError: options.resultReadError,
  };
}

function formatStatus(value: boolean): string {
  return value ? "pass" : "fail";
}

function formatList(values: readonly string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- none"];
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderBenchmarkReadinessReport(
  evaluation: BenchmarkReadinessEvaluation,
  options: RenderBenchmarkReadinessReportOptions = {},
): string {
  const gateMode = options.gateMode ?? process.env.BENCHMARK_GATE_MODE ?? "unknown";
  const benchmarkOutcome =
    options.benchmarkOutcome ?? process.env.BENCHMARK_STEP_OUTCOME ?? "unknown";
  const benchmarkConclusion =
    options.benchmarkConclusion ?? process.env.BENCHMARK_STEP_CONCLUSION ?? "unknown";
  const benchmarkCommand = options.benchmarkCommand ?? DEFAULT_BENCHMARK_COMMAND;
  const varianceEvidenceLabel = evaluation.varianceEvidenceValid
    ? "valid"
    : evaluation.varianceEvidenceProvided
      ? "invalid"
      : "missing";
  const thresholdEntryIssueCount = evaluation.rows.filter((row) => !row.hasThresholdEntry).length;
  const baselineEntryIssueCount = evaluation.rows.filter((row) => !row.hasBaselineEntry).length;
  const thresholdEntryEvidence =
    evaluation.rows.length > 0
      ? `${thresholdEntryIssueCount} missing or skipped threshold entry(s)`
      : "0 emitted row(s)";
  const baselineEntryEvidence =
    evaluation.rows.length > 0
      ? `${baselineEntryIssueCount} missing or skipped baseline entry(s)`
      : "0 emitted row(s)";
  const rowLines =
    evaluation.rows.length > 0
      ? evaluation.rows.map(
          (row) =>
            `| ${escapeTableCell(row.name)} | ${formatDuration(row.p75)} | ${row.thresholdStatus} | ${row.hasThresholdEntry ? "yes" : "no"} | ${row.baselineStatus} | ${row.hasBaselineEntry ? "yes" : "no"} | ${escapeTableCell(row.notes.join("; ") || "none")} |`,
        )
      : ["| _No benchmark rows collected_ | - | - | no | - | no | empty benchmark report |"];

  return [
    "# Benchmark Enforce-Readiness Report",
    "",
    `- Verdict: \`${evaluation.enforceReady ? "READY" : "NOT_READY"}\``,
    `- Gate mode: \`${gateMode}\``,
    `- Benchmark command: \`${benchmarkCommand}\``,
    `- Benchmark outcome: \`${benchmarkOutcome}\``,
    `- Benchmark conclusion: \`${benchmarkConclusion}\``,
    `- Result file: \`${evaluation.resultFilePath}\``,
    `- Latest-five-green-run variance evidence: \`${varianceEvidenceLabel}\` at \`${evaluation.varianceEvidencePath}\``,
    `- Latest-five-green-run variance tolerance: \`${(evaluation.varianceEvidenceTolerance * 100).toFixed(0)}%\``,
    "- Scope: this report is audit-only and does not change `BENCHMARK_GATE_MODE`.",
    "",
    "## Blocking Reasons",
    ...formatList(evaluation.blockingReasons),
    "",
    "## Readiness Criteria",
    "| Criterion | Status | Evidence |",
    "| --- | --- | --- |",
    `| benchmark result file is readable | ${formatStatus(!evaluation.resultReadError)} | ${evaluation.resultReadError ? escapeTableCell(evaluation.resultReadError) : evaluation.resultFilePath} |`,
    `| benchmark reports are non-empty | ${formatStatus(evaluation.reports.length > 0)} | ${evaluation.reports.length} emitted row(s) |`,
    `| runner/module failures are absent | ${formatStatus(evaluation.runnerFailures.length === 0)} | ${evaluation.runnerFailures.length} failure(s) |`,
    `| configured benchmark reports are collected | ${formatStatus(evaluation.missingReports.length === 0)} | ${evaluation.missingReports.length} missing report(s) |`,
    `| empty benchmark reports are absent | ${formatStatus(evaluation.emptyReports.length === 0)} | ${evaluation.emptyReports.length} empty report signal(s) |`,
    `| every emitted row has a threshold entry | ${formatStatus(evaluation.allRowsHaveThresholdEntries)} | ${thresholdEntryEvidence} |`,
    `| every emitted row has a baseline entry | ${formatStatus(evaluation.allRowsHaveBaselineEntries)} | ${baselineEntryEvidence} |`,
    `| gateFailures is empty | ${formatStatus(evaluation.gateFailures.length === 0)} | ${evaluation.gateFailures.length} gate failure(s) |`,
    `| latest five green run variance evidence is valid | ${formatStatus(evaluation.varianceEvidenceValid)} | ${evaluation.varianceEvidencePath} |`,
    "",
    "## Emitted Benchmark Rows",
    "| Benchmark | p75 | Threshold status | Threshold entry | Baseline status | Baseline entry | Readiness notes |",
    "| --- | ---: | --- | --- | --- | --- | --- |",
    ...rowLines,
    "",
    "## Failure Details",
    "",
    "### Runner And Module Failures",
    ...formatList(evaluation.runnerFailures),
    "",
    "### Missing Reports",
    ...formatList(evaluation.missingReports),
    "",
    "### Empty Reports",
    ...formatList(evaluation.emptyReports),
    "",
    "### Threshold Skips",
    ...formatList(evaluation.thresholdSkips),
    "",
    "### Baseline Skips",
    ...formatList(evaluation.baselineSkips),
    "",
    "### Variance Evidence Failures",
    ...formatList(evaluation.varianceEvidenceFailures),
    "",
    "### Other Gate Failures",
    ...formatList(evaluation.otherGateFailures),
    "",
    "## Variance Evidence Input",
    `Provide the latest five green benchmark workflow run variance review at \`${evaluation.varianceEvidencePath}\` or pass \`--variance-evidence=<path>\`.`,
    `The expected evidence must include a \`${VARIANCE_EVIDENCE_MARKER}\` JSON block that confirms the same emitted benchmark row set, p75 spread at or below ${(VARIANCE_SPREAD_TOLERANCE * 100).toFixed(0)}%, no runner/module/missing/empty/threshold/skip failures, and zero promoted-baseline failures across the reviewed runs. Pre-promotion stale-baseline failures must be preserved as artifact evidence, not hidden.`,
    "",
  ].join("\n");
}

function parseArgs(argv: readonly string[]): {
  inputPath: string;
  outputPath: string;
  varianceEvidencePath: string;
} {
  const inputPath =
    argv.find((arg) => arg.startsWith("--input="))?.slice("--input=".length) ??
    DEFAULT_RESULT_FILE_PATH;
  const outputPath =
    argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length) ??
    DEFAULT_OUTPUT_PATH;
  const varianceEvidencePath =
    argv
      .find((arg) => arg.startsWith("--variance-evidence="))
      ?.slice("--variance-evidence=".length) ?? DEFAULT_VARIANCE_EVIDENCE_PATH;

  return { inputPath, outputPath, varianceEvidencePath };
}

function readBenchmarkResult(inputPath: string): {
  result: BenchmarkReadinessResult | null;
  error?: string;
} {
  if (!existsSync(inputPath)) {
    return { result: null, error: "file does not exist" };
  }

  try {
    return { result: normalizeResult(JSON.parse(readFileSync(inputPath, "utf-8"))) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { result: null, error: message };
  }
}

function readVarianceEvidence(path: string): BenchmarkVarianceEvidence {
  if (!existsSync(path)) {
    return { path };
  }

  return { path, content: readFileSync(path, "utf-8") };
}

export function writeBenchmarkReadinessReport(options: {
  inputPath: string;
  outputPath: string;
  varianceEvidencePath: string;
}): BenchmarkReadinessEvaluation {
  const { result, error } = readBenchmarkResult(options.inputPath);
  const evaluation = evaluateBenchmarkReadiness(result, {
    resultFilePath: options.inputPath,
    resultReadError: error,
    varianceEvidence: readVarianceEvidence(options.varianceEvidencePath),
  });
  const report = renderBenchmarkReadinessReport(evaluation);

  mkdirSync(dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, `${report}\n`);

  return evaluation;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const evaluation = writeBenchmarkReadinessReport(options);

  console.log(`Benchmark enforce-readiness report written to ${resolve(options.outputPath)}`);
  console.log(`Benchmark enforce-ready: ${evaluation.enforceReady ? "yes" : "no"}`);
  process.exit(process.env.BENCHMARK_GATE_MODE === "enforce" && !evaluation.enforceReady ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
