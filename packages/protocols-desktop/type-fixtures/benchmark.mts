#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import { verifyLargeFixtureGenerated } from "./generate-large-fixture.mts";

const rootDir = resolve(import.meta.dirname, "../../..");
const fixtureDir = import.meta.dirname;
const baselinePath = join(fixtureDir, "benchmark-baseline.json");
const tscPath = join(rootDir, "node_modules", "typescript", "bin", "tsc");
const measuredRunCount = 3;

type Metrics = {
  readonly compileTimeMs: number;
  readonly instantiations: number;
  readonly peakMemoryKiB: number;
};

type BenchmarkBaseline = {
  readonly baseline: Metrics;
  readonly fixture: { readonly commands: number; readonly windows: number };
  readonly rationale: string;
  readonly schema: "croco.protocols-desktop.type-benchmark.v1";
  readonly thresholds: {
    readonly compileTimeRatio: number;
    readonly instantiationsRatio: number;
    readonly peakMemoryRatio: number;
  };
};

type JsonRecord = Record<string, unknown>;

export function runDesktopTypeBenchmark(updateBaseline: boolean): void {
  verifyLargeFixtureGenerated(false);
  compileLargeFixture();
  const samples = Array.from({ length: measuredRunCount }, () => compileLargeFixture());
  const observed = medianMetrics(samples);
  const baseline = readBaseline();

  if (updateBaseline) {
    writeFileSync(
      baselinePath,
      `${JSON.stringify({ ...baseline, baseline: observed }, null, 2)}\n`,
    );
    console.log(`protocols-desktop-type-benchmark: updated ${baselinePath}`);
    return;
  }

  const failures = compareWithBaseline(observed, baseline);
  const report = { baseline, observed, samples };
  const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
  if (outputArgument) {
    const outputPath = resolve(rootDir, outputArgument.slice("--output=".length));
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (failures.length > 0) throw new Error(failures.join("\n"));
  console.log(
    `protocols-desktop-type-benchmark: ${observed.compileTimeMs.toFixed(0)}ms, ${observed.peakMemoryKiB} KiB peak RSS, ${observed.instantiations} instantiations`,
  );
}

function compileLargeFixture(): Metrics {
  const timeArguments = process.platform === "darwin" ? ["-l"] : ["-v"];
  const compilerArguments = [
    process.execPath,
    tscPath,
    "--pretty",
    "false",
    "--extendedDiagnostics",
    "-p",
    join(fixtureDir, "tsconfig.large.json"),
  ];
  const startedAt = performance.now();
  const result = spawnSync("/usr/bin/time", [...timeArguments, ...compilerArguments], {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180_000,
  });
  const compileTimeMs = performance.now() - startedAt;
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`large fixture compilation failed\n${result.stdout}${result.stderr}`);
  }
  return {
    compileTimeMs,
    instantiations: metric(result.stdout, "Instantiations"),
    peakMemoryKiB: peakMemory(result.stderr),
  };
}

function compareWithBaseline(observed: Metrics, config: BenchmarkBaseline): string[] {
  const failures: string[] = [];
  for (const [metricName, thresholdName, unit] of [
    ["compileTimeMs", "compileTimeRatio", "ms"],
    ["peakMemoryKiB", "peakMemoryRatio", "KiB"],
    ["instantiations", "instantiationsRatio", ""],
  ] as const) {
    const limit = config.baseline[metricName] * config.thresholds[thresholdName];
    if (observed[metricName] > limit) {
      failures.push(
        `${metricName} ${observed[metricName].toFixed(0)}${unit} exceeds ${limit.toFixed(0)}${unit} (${config.thresholds[thresholdName]}x baseline)`,
      );
    }
  }
  return failures;
}

function medianMetrics(samples: readonly Metrics[]): Metrics {
  return {
    compileTimeMs: Math.round(median(samples.map(({ compileTimeMs }) => compileTimeMs))),
    instantiations: median(samples.map(({ instantiations }) => instantiations)),
    peakMemoryKiB: median(samples.map(({ peakMemoryKiB }) => peakMemoryKiB)),
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const value = sorted[Math.floor(sorted.length / 2)];
  if (value === undefined) throw new Error("benchmark collected no samples");
  return value;
}

function metric(output: string, label: string): number {
  const match = output.match(new RegExp(`^${label}:\\s+([0-9.]+)`, "m"));
  if (!match?.[1]) throw new Error(`TypeScript did not report ${label}`);
  return Number(match[1]);
}

function peakMemory(output: string): number {
  const gnu = output.match(/Maximum resident set size \(kbytes\):\s+(\d+)/)?.[1];
  if (gnu) return Number(gnu);
  const bsd = output.match(/\s(\d+)\s+maximum resident set size/)?.[1];
  if (bsd) return Math.ceil(Number(bsd) / 1024);
  throw new Error(`time did not report peak resident memory\n${output}`);
}

function readBaseline(): BenchmarkBaseline {
  return parseBenchmarkBaseline(JSON.parse(readFileSync(baselinePath, "utf8")) as unknown);
}

export function parseBenchmarkBaseline(value: unknown): BenchmarkBaseline {
  const root = record(value, "benchmark baseline");
  if (root.schema !== "croco.protocols-desktop.type-benchmark.v1") {
    throw new Error("benchmark baseline has an unsupported schema");
  }

  const fixture = record(root.fixture, "benchmark fixture");
  if (fixture.commands !== 200 || fixture.windows !== 20) {
    throw new Error("benchmark fixture must describe exactly 200 commands and 20 windows");
  }

  const baseline = record(root.baseline, "benchmark metrics");
  const thresholds = record(root.thresholds, "benchmark thresholds");
  const rationale = root.rationale;
  if (typeof rationale !== "string" || rationale.trim().length < 12) {
    throw new Error("benchmark baseline must include a threshold rationale");
  }

  return {
    schema: root.schema,
    fixture: { commands: 200, windows: 20 },
    baseline: {
      compileTimeMs: positiveNumber(baseline, "compileTimeMs", "compile time baseline"),
      instantiations: positiveNumber(baseline, "instantiations", "instantiation baseline"),
      peakMemoryKiB: positiveNumber(baseline, "peakMemoryKiB", "peak memory baseline"),
    },
    thresholds: {
      compileTimeRatio: regressionRatio(thresholds, "compileTimeRatio"),
      instantiationsRatio: regressionRatio(thresholds, "instantiationsRatio"),
      peakMemoryRatio: regressionRatio(thresholds, "peakMemoryRatio"),
    },
    rationale,
  };
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function positiveNumber(record_: JsonRecord, key: string, label: string): number {
  const value = record_[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a finite positive number`);
  }
  return value;
}

function regressionRatio(record_: JsonRecord, key: string): number {
  const value = positiveNumber(record_, key, `${key} threshold`);
  if (value < 1) throw new Error(`${key} threshold must be at least 1`);
  return value;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    runDesktopTypeBenchmark(process.argv.includes("--update-baseline"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`protocols-desktop-type-benchmark: failed: ${message}`);
    process.exitCode = 1;
  }
}
