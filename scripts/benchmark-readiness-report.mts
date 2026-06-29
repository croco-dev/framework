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
  const varianceEvidenceProvided = Boolean(options.varianceEvidence?.content?.trim());
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
  const varianceEvidenceLabel = evaluation.varianceEvidenceProvided ? "provided" : "missing";
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
    `| latest five green run variance evidence is provided | ${formatStatus(evaluation.varianceEvidenceProvided)} | ${evaluation.varianceEvidencePath} |`,
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
    "### Other Gate Failures",
    ...formatList(evaluation.otherGateFailures),
    "",
    "## Variance Evidence Input",
    `Provide the latest five green benchmark workflow run variance review at \`${evaluation.varianceEvidencePath}\` or pass \`--variance-evidence=<path>\`.`,
    "The expected evidence should confirm the same emitted benchmark row set, p75 spread at or below 10%, and no runner failures, empty reports, threshold skips, or baseline skips across the reviewed runs.",
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
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
