import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createVitest } from "vitest/node";

interface Thresholds {
  [benchmarkName: string]: BenchmarkLimit;
}

interface Baseline {
  [benchmarkName: string]: {
    p75: number;
  };
}

export interface BenchmarkReport {
  name: string;
  p75: number;
  threshold?: number;
  baseline?: number;
  thresholdStatus?: "pass" | "fail" | "skip";
  baselineStatus?: "pass" | "fail" | "skip";
  thresholdDiff?: number;
  baselineDiff?: number;
  thresholdSkipReason?: string;
  baselineSkipReason?: string;
}

export type BenchmarkGateEvaluation = {
  allPassed: boolean;
  gateFailures: string[];
};

export type BenchmarkCheckResult = BenchmarkGateEvaluation & {
  reports: BenchmarkReport[];
};

export type BenchmarkEntry = { name: string; p75: number };

export type BenchmarkCollection = {
  entries: BenchmarkEntry[];
  failures: string[];
};

export type BenchmarkCollectionTask = {
  name: string;
  state?: unknown;
  result?: {
    state?: unknown;
    benchmark?: Record<string, unknown>;
  };
  tasks?: readonly BenchmarkCollectionTask[];
};

export type BenchmarkLimit = number | { p75: number };

const projectRoot = process.cwd();
const thresholdsPath = join(projectRoot, "benchmarks", "thresholds.json");
const baselinePath = join(projectRoot, "benchmarks", "baseline.json");

const args = process.argv.slice(2);
const isUpdateBaseline = args.includes("--update-baseline");
const outputJsonArg = args.find((a) => a.startsWith("--output-json="));
const outputJsonPath = outputJsonArg ? outputJsonArg.split("=")[1] : null;

const BASELINE_TOLERANCE = 0.2;
const CI_THRESHOLD_MULTIPLIER = 2;
const LOCAL_THRESHOLD_MULTIPLIER = 1;
const BOX_WIDTH = 62;

export const BENCHMARK_EMPTY_REPORT_FAILURE = "No benchmark reports were collected.";
export const BENCHMARK_MISSING_REPORT_SUFFIX = ": benchmark report was not collected.";
export const BENCHMARK_RUNNER_ERROR_PREFIX = "benchmark runner error:";
export const BENCHMARK_MODULE_FAILED_PREFIX = "benchmark module failed:";

const EXPLICIT_THRESHOLD_SKIPS: Record<string, string> = {};

const EXPLICIT_BASELINE_SKIPS: Record<string, string> = {};

function getThresholdSkipReason(name: string): string {
  const explicitReason = EXPLICIT_THRESHOLD_SKIPS[name];

  if (explicitReason) {
    return explicitReason;
  }

  return "No threshold defined in benchmarks/thresholds.json.";
}

function getBaselineSkipReason(name: string): string {
  const explicitReason = EXPLICIT_BASELINE_SKIPS[name];

  if (explicitReason) {
    return explicitReason;
  }

  return "No baseline defined in benchmarks/baseline.json.";
}

function loadThresholds(): Thresholds {
  if (!existsSync(thresholdsPath)) {
    console.error(`⚠️  thresholds.json not found at ${thresholdsPath}`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(thresholdsPath, "utf-8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to parse thresholds.json at ${thresholdsPath}: ${message}`);
    process.exit(1);
  }
}

function loadBaseline(): Baseline | null {
  if (!existsSync(baselinePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(baselinePath, "utf-8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to parse baseline.json at ${baselinePath}: ${message}`);
    return null;
  }
}

export function getBenchmarkP75(value: BenchmarkLimit, source: string): number {
  const p75 = typeof value === "number" ? value : value.p75;

  if (typeof p75 !== "number" || !Number.isFinite(p75)) {
    throw new Error(`${source} must define a finite p75 number`);
  }

  return p75;
}

function saveBaseline(results: BenchmarkReport[]) {
  const baseline: Baseline = {};
  for (const result of results) {
    baseline[result.name] = { p75: result.p75 };
  }
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
  console.log(`\n✅ Baseline updated at ${baselinePath}`);
}

function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(1)}μs`;
  }
  return `${ms.toFixed(1)}ms`;
}

function formatDiff(actual: number, expected: number): string {
  const diff = actual - expected;
  if (expected === 0) {
    if (diff === 0) return "+0.0%";
    return diff > 0 ? "+∞" : "-∞";
  }
  const percent = ((diff / expected) * 100).toFixed(1);
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${percent}%`;
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function evaluateBenchmarkGate(
  reports: BenchmarkReport[],
  runnerFailures: string[] = [],
  expectedBenchmarkNames: string[] = [],
): BenchmarkGateEvaluation {
  const gateFailures: string[] = [...runnerFailures];
  const reportedNames = new Set(reports.map((report) => report.name));

  if (reports.length === 0) {
    gateFailures.push(BENCHMARK_EMPTY_REPORT_FAILURE);
  }

  for (const benchmarkName of expectedBenchmarkNames) {
    if (!reportedNames.has(benchmarkName)) {
      gateFailures.push(`${benchmarkName}${BENCHMARK_MISSING_REPORT_SUFFIX}`);
    }
  }

  for (const report of reports) {
    if (report.thresholdStatus === "fail") {
      gateFailures.push(
        `${report.name}: p75 ${formatDuration(report.p75)} exceeds threshold ${formatDuration(report.threshold ?? 0)}`,
      );
    }

    if (report.baselineStatus === "fail") {
      gateFailures.push(
        `${report.name}: p75 ${formatDuration(report.p75)} exceeds baseline ${formatDuration(report.baseline ?? 0)} by more than ${(BASELINE_TOLERANCE * 100).toFixed(0)}%`,
      );
    }

    if (report.thresholdStatus === "skip") {
      gateFailures.push(
        `${report.name}: threshold skipped (${report.thresholdSkipReason ?? "no threshold skip reason"})`,
      );
    }

    if (report.baselineStatus === "skip") {
      gateFailures.push(
        `${report.name}: baseline skipped (${report.baselineSkipReason ?? "no baseline skip reason"})`,
      );
    }
  }

  return {
    allPassed: gateFailures.length === 0,
    gateFailures,
  };
}

export function evaluateBaselineUpdateReadiness(
  reports: BenchmarkReport[],
  runnerFailures: string[] = [],
  expectedBenchmarkNames: string[] = [],
): BenchmarkGateEvaluation {
  const gateFailures: string[] = [...runnerFailures];
  const reportedNames = new Set(reports.map((report) => report.name));

  if (reports.length === 0) {
    gateFailures.push(BENCHMARK_EMPTY_REPORT_FAILURE);
  }

  for (const benchmarkName of expectedBenchmarkNames) {
    if (!reportedNames.has(benchmarkName)) {
      gateFailures.push(`${benchmarkName}${BENCHMARK_MISSING_REPORT_SUFFIX}`);
    }
  }

  for (const report of reports) {
    if (report.thresholdStatus === "fail") {
      gateFailures.push(
        `${report.name}: p75 ${formatDuration(report.p75)} exceeds threshold ${formatDuration(report.threshold ?? 0)}`,
      );
    }

    if (report.thresholdStatus === "skip") {
      gateFailures.push(
        `${report.name}: threshold skipped (${report.thresholdSkipReason ?? "no threshold skip reason"})`,
      );
    }
  }

  return {
    allPassed: gateFailures.length === 0,
    gateFailures,
  };
}

function getConfiguredBenchmarkNames(thresholds: Thresholds, baseline: Baseline | null): string[] {
  const names = new Set<string>();

  for (const name of Object.keys(thresholds)) {
    if (!name.startsWith("_")) {
      names.add(name);
    }
  }

  for (const name of Object.keys(baseline ?? {})) {
    if (!name.startsWith("_")) {
      names.add(name);
    }
  }

  return [...names].sort();
}

function getTaskP75(task: BenchmarkCollectionTask): number | undefined {
  const p75 = task.result?.benchmark?.p75;

  if (typeof p75 === "number" && Number.isFinite(p75)) {
    return p75;
  }

  return undefined;
}

function getTaskState(task: BenchmarkCollectionTask): string | undefined {
  const state = task.result?.state ?? task.state;

  if (typeof state === "string" && state.length > 0) {
    return state;
  }

  return undefined;
}

function formatTaskPath(path: readonly string[]): string {
  return path.join(" > ");
}

export function collectBenchmarkEntries(
  tasks: readonly BenchmarkCollectionTask[],
  parents: readonly string[] = [],
): BenchmarkCollection {
  const entries: BenchmarkEntry[] = [];
  const failures: string[] = [];

  for (const task of tasks) {
    const taskPath = [...parents, task.name];
    const p75 = getTaskP75(task);
    const children = task.tasks ?? [];

    if (children.length > 0) {
      const childCollection = collectBenchmarkEntries(children, taskPath);
      failures.push(...childCollection.failures);

      if (children.length === 1 && childCollection.entries.length === 1) {
        // Single-bench suite: attribute result to the suite name (the threshold key).
        entries.push({ name: task.name, p75: childCollection.entries[0].p75 });
      } else if (childCollection.entries.length > 0) {
        entries.push(...childCollection.entries);
      } else if (p75 !== undefined) {
        entries.push({ name: task.name, p75 });
      }
      continue;
    }

    if (p75 !== undefined) {
      entries.push({ name: task.name, p75 });
      continue;
    }

    const state = getTaskState(task);
    const stateDetail = state ? ` (state: ${state})` : "";
    failures.push(`${formatTaskPath(taskPath)}: benchmark p75 was not collected${stateDetail}.`);
  }

  return { entries, failures };
}

async function main() {
  const thresholds = loadThresholds();
  const baseline = loadBaseline();
  const expectedBenchmarkNames = getConfiguredBenchmarkNames(thresholds, baseline);

  const vitest = await createVitest("benchmark", {
    config: "./vitest.config.bench.ts",
    reporters: [],
  });

  try {
    const runResult = await vitest.start();
    const runnerFailures = [
      ...runResult.unhandledErrors.map(
        (error) => `${BENCHMARK_RUNNER_ERROR_PREFIX} ${formatUnknownError(error)}`,
      ),
      ...runResult.testModules
        .filter((module) => module.state() === "failed")
        .map((module) => `${BENCHMARK_MODULE_FAILED_PREFIX} ${module.relativeModuleId}`),
    ];

    const files = vitest.state.getFiles();
    const reports: BenchmarkReport[] = [];
    const benchmarkCollectionFailures: string[] = [];

    for (const file of files) {
      const collection = collectBenchmarkEntries(
        file.tasks as unknown as readonly BenchmarkCollectionTask[],
      );
      benchmarkCollectionFailures.push(...collection.failures);

      for (const { name, p75 } of collection.entries) {
        const report: BenchmarkReport = {
          name,
          p75,
        };

        const thresholdConfig = thresholds[name];

        if (thresholdConfig !== undefined) {
          const threshold = getBenchmarkP75(thresholdConfig, `benchmarks/thresholds.json:${name}`);
          report.threshold = threshold;
          const ciMargin = process.env.CI ? CI_THRESHOLD_MULTIPLIER : LOCAL_THRESHOLD_MULTIPLIER;
          const effectiveThreshold = threshold * ciMargin;
          report.thresholdDiff = p75 - threshold;

          if (p75 > effectiveThreshold) {
            report.thresholdStatus = "fail";
          } else {
            report.thresholdStatus = "pass";
          }
        } else {
          report.thresholdStatus = "skip";
          report.thresholdSkipReason = getThresholdSkipReason(name);
          console.warn(`⚠️  Threshold skipped for "${name}": ${report.thresholdSkipReason}`);
        }

        if (baseline?.[name]) {
          const baselineP75 = baseline[name].p75;
          report.baseline = baselineP75;
          report.baselineDiff = p75 - baselineP75;

          if (p75 - baselineP75 > baselineP75 * BASELINE_TOLERANCE) {
            report.baselineStatus = "fail";
          } else {
            report.baselineStatus = "pass";
          }
        } else {
          report.baselineStatus = "skip";
          report.baselineSkipReason = getBaselineSkipReason(name);
          console.warn(`⚠️  Baseline skipped for "${name}": ${report.baselineSkipReason}`);
        }

        reports.push(report);
      }
    }

    const gateEvaluation = evaluateBenchmarkGate(
      reports,
      [...runnerFailures, ...benchmarkCollectionFailures],
      expectedBenchmarkNames,
    );

    if (isUpdateBaseline) {
      const baselineUpdateEvaluation = evaluateBaselineUpdateReadiness(
        reports,
        [...runnerFailures, ...benchmarkCollectionFailures],
        expectedBenchmarkNames,
      );

      if (!baselineUpdateEvaluation.allPassed) {
        for (const failure of baselineUpdateEvaluation.gateFailures) {
          console.error(`❌ ${failure}`);
        }
        process.exit(1);
      }

      saveBaseline(reports);
      process.exit(0);
    }

    if (outputJsonPath) {
      writeFileSync(
        outputJsonPath,
        JSON.stringify(
          {
            allPassed: gateEvaluation.allPassed,
            gateFailures: gateEvaluation.gateFailures,
            reports,
          },
          null,
          2,
        ),
      );
    }

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║ Cold-Start Benchmark Report                            ║");
    console.log("╠══════════════════════════════════════════════════════════╣");

    for (const report of reports) {
      const thresholdPart = report.threshold
        ? `threshold: ${formatDuration(report.threshold)}`
        : "no threshold";
      const baselinePart = report.baseline ? `baseline: ${formatDuration(report.baseline)}` : "";
      const skipParts = [report.thresholdSkipReason, report.baselineSkipReason]
        .filter(Boolean)
        .join(" | ");

      const statusIcon =
        report.thresholdStatus === "fail" || report.baselineStatus === "fail"
          ? "❌"
          : report.thresholdStatus === "skip" && report.baselineStatus === "skip"
            ? "⚠️ "
            : "✅";

      let line = `║ ${report.name.padEnd(30)} p75: ${formatDuration(report.p75).padEnd(10)}`;

      if (report.threshold) {
        line += ` ${thresholdPart.padEnd(20)}`;
      }
      if (report.baseline) {
        const diff =
          report.baselineDiff !== undefined ? formatDiff(report.p75, report.baseline) : "";
        line += ` ${baselinePart.padEnd(20)} (${diff})`;
      } else if (skipParts) {
        line += ` ${skipParts}`;
      }

      line += ` ${statusIcon} ║`;
      console.log(line.substring(0, BOX_WIDTH));
    }

    console.log("╠══════════════════════════════════════════════════════════╣");
    if (gateEvaluation.gateFailures.length > 0) {
      for (const failure of gateEvaluation.gateFailures) {
        console.error(`❌ ${failure}`);
      }
    }
    console.log(
      `║ Result: ${gateEvaluation.allPassed ? "ALL PASSED" : "FAILED"}${" ".repeat(40)} ║`,
    );
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    process.exit(gateEvaluation.allPassed ? 0 : 1);
  } finally {
    await vitest.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error("Error running benchmark checks:", err);
    process.exit(1);
  });
}
