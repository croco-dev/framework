import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineCommand } from "citty";
import {
  assertChangedTestPlanEnforceable,
  assertChangedTestSelectionBaseline,
  assertExecutableAssuranceGraph,
  assertTestEvidenceBundle,
  ChangedTestPlanProblem,
  createChangedTestPlan,
  serializeChangedTestPlan,
  updateChangedTestSelectionBaseline,
} from "@croco/testing/executable-assurance";
import { GLOBAL_OPTIONS } from "./options.js";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";

import type {
  ChangedTestSelectionBaseline,
  ExecutableAssuranceGraph,
  TestEvidenceBundle,
} from "@croco/testing/executable-assurance";

const DEFAULT_GRAPH = "executable-assurance.graph.json";
const DEFAULT_EVIDENCE = "ci-reports/test-evidence/bundle.json";
const DEFAULT_BASELINE = "ci-reports/changed-test-plan/baseline.json";

export type TestPlanIo = {
  readonly cwd: string;
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
  readonly exists: (path: string) => boolean;
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly git: (args: readonly string[]) => string;
};

type TestPlanOptions = {
  readonly changed: string;
  readonly graph: string;
  readonly evidence: string;
  readonly fullEvidence: string | null;
  readonly out: string | null;
  readonly baseline: string;
  readonly baselineOut: string | null;
  readonly observationWindow: number;
  readonly missThreshold: number;
  readonly budgetMs: number | undefined;
  readonly enforce: boolean;
};

type ParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "run"; readonly options: TestPlanOptions };

function createDefaultIo(): TestPlanIo {
  const runtime = getCrocoCommandRuntime();
  return {
    cwd: runtime.cwd,
    stdout: runtime.stdout,
    stderr: runtime.stderr,
    exists: existsSync,
    readFile: (path) => readFileSync(path, "utf8"),
    writeFile: (path, content) => writeFileSync(path, content),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
    git: (args) =>
      execFileSync("git", [...args], { encoding: "utf8", env: getCrocoCommandRuntime().env }),
  };
}

export const testPlan = defineCommand({
  meta: {
    name: "plan",
    description: "Derive an explainable conservative test plan from base/head assurance artifacts",
  },
  args: {
    ...GLOBAL_OPTIONS,
    changed: { type: "string", description: "Git base revision to compare with HEAD" },
    graph: { type: "string", description: `Head assurance graph (default: ${DEFAULT_GRAPH})` },
    evidence: {
      type: "string",
      description: `Head test evidence bundle (default: ${DEFAULT_EVIDENCE})`,
    },
    "full-evidence": {
      type: "string",
      description: "Full-suite evidence used to record shadow-mode selection misses",
    },
    out: { type: "string", description: "Write the machine-readable plan to this path" },
    baseline: {
      type: "string",
      description: `Existing durable selection baseline (default: ${DEFAULT_BASELINE})`,
    },
    "baseline-out": { type: "string", description: "Write the updated selection baseline" },
    "observation-window": { type: "string", description: "Runs required before enforcement" },
    "miss-threshold": { type: "string", description: "Maximum miss rate before enforcement" },
    "budget-ms": { type: "string", description: "Advisory execution budget in milliseconds" },
    enforce: { type: "boolean", description: "Require the documented observation gate" },
  },
  async run({ rawArgs }) {
    getCrocoCommandRuntime().setExitCode(runTestPlan(rawArgs));
  },
});

export function runTestPlan(
  args: readonly string[],
  ioOverrides: Partial<TestPlanIo> = {},
): number {
  const io = { ...createDefaultIo(), ...ioOverrides };
  const parsed = parseTestPlanArgs(args);
  if (parsed.kind === "help") {
    printHelp(io);
    return 0;
  }
  if (parsed.kind === "invalid") {
    io.stderr(parsed.message);
    printHelp(io);
    return 1;
  }

  const options = parsed.options;
  const graphPath = resolveInputPath(options.graph, io.cwd);
  const evidencePath = resolveInputPath(options.evidence, io.cwd);
  const headGraph = readOptionalGraph(graphPath, io);
  const baseGraph = readBaseGraph(options.changed, options.graph, io);
  const evidence = readOptionalEvidence(evidencePath, io);
  const changedFiles = lines(runGit(["diff", "--name-only", options.changed, "HEAD"], io));
  const plan = createChangedTestPlan({
    base: options.changed,
    head: runGit(["rev-parse", "HEAD"], io).trim() || "HEAD",
    ...(baseGraph ? { baseGraph } : {}),
    ...(headGraph ? { headGraph } : {}),
    ...(evidence ? { evidence } : {}),
    changedFiles,
    ...(options.budgetMs === undefined ? {} : { budgetMs: options.budgetMs }),
    mode: options.enforce ? "enforce" : "shadow",
  });
  const serializedPlan = serializeChangedTestPlan(plan);
  if (options.out) writeOutput(options.out, serializedPlan, io);
  else io.stdout(serializedPlan.trimEnd());

  if (options.fullEvidence) {
    const fullEvidence = readRequiredEvidence(resolveInputPath(options.fullEvidence, io.cwd), io);
    const previous = readOptionalBaseline(resolveInputPath(options.baseline, io.cwd), io);
    const baseline = updateChangedTestSelectionBaseline(plan, fullEvidence, {
      ...(previous ? { previous } : {}),
      observationWindow: options.observationWindow,
      missThreshold: options.missThreshold,
    });
    const baselineOut = options.baselineOut ?? options.baseline;
    writeOutput(baselineOut, serializeChangedTestPlan(baseline), io);
    if (options.enforce) assertChangedTestPlanEnforceable(baseline);
  } else if (options.enforce) {
    throw new ChangedTestPlanProblem(
      "--enforce requires --full-evidence so the observation gate can be proven.",
    );
  }

  return 0;
}

export function parseTestPlanArgs(args: readonly string[]): ParseResult {
  if (args.includes("--help") || args.includes("-h")) return { kind: "help" };
  const changed = flag(args, "--changed");
  if (!changed)
    return { kind: "invalid", message: "Missing base revision. Pass --changed <base>." };
  const observationWindow = numberFlag(args, "--observation-window", 20);
  const missThreshold = numberFlag(args, "--miss-threshold", 0);
  const budgetMs = optionalNumberFlag(args, "--budget-ms");
  if (
    observationWindow === null ||
    !Number.isInteger(observationWindow) ||
    observationWindow <= 0
  ) {
    return { kind: "invalid", message: "--observation-window must be a positive integer." };
  }
  if (missThreshold === null || missThreshold < 0 || missThreshold > 1) {
    return { kind: "invalid", message: "--miss-threshold must be a number from 0 through 1." };
  }
  if (budgetMs === null || (budgetMs !== undefined && budgetMs < 0)) {
    return { kind: "invalid", message: "--budget-ms must be a non-negative number." };
  }
  return {
    kind: "run",
    options: {
      changed,
      graph: flag(args, "--graph") ?? DEFAULT_GRAPH,
      evidence: flag(args, "--evidence") ?? DEFAULT_EVIDENCE,
      fullEvidence: flag(args, "--full-evidence"),
      out: flag(args, "--out"),
      baseline: flag(args, "--baseline") ?? DEFAULT_BASELINE,
      baselineOut: flag(args, "--baseline-out"),
      observationWindow,
      missThreshold,
      budgetMs,
      enforce: args.includes("--enforce"),
    },
  };
}

function readOptionalGraph(path: string, io: TestPlanIo): ExecutableAssuranceGraph | undefined {
  if (!io.exists(path)) return undefined;
  return parseGraph(io.readFile(path), path);
}

function readBaseGraph(
  base: string,
  path: string,
  io: TestPlanIo,
): ExecutableAssuranceGraph | undefined {
  assertRepositoryRelative(path, "--graph");
  try {
    const content = io.git(["show", `${base}:${path}`]);
    return parseGraph(content, `${base}:${path}`);
  } catch (error) {
    if (isMissingGitPath(error)) return undefined;
    throw asChangedTestPlanProblem(
      `Unable to read base assurance graph '${base}:${path}': ${errorMessage(error)}`,
      error,
    );
  }
}

function runGit(args: readonly string[], io: TestPlanIo): string {
  try {
    return io.git(args);
  } catch (error) {
    throw asChangedTestPlanProblem(
      `Unable to run Git command 'git ${args.join(" ")}': ${errorMessage(error)}`,
      error,
    );
  }
}

function parseGraph(content: string, label: string): ExecutableAssuranceGraph {
  const value = parseJson(content, label);
  try {
    assertExecutableAssuranceGraph(value);
  } catch (error) {
    throw asChangedTestPlanProblem(
      `Invalid executable assurance graph '${label}': ${errorMessage(error)}`,
      error,
    );
  }
  return value;
}

function readOptionalEvidence(path: string, io: TestPlanIo): TestEvidenceBundle | undefined {
  if (!io.exists(path)) return undefined;
  return readRequiredEvidence(path, io);
}

function readRequiredEvidence(path: string, io: TestPlanIo): TestEvidenceBundle {
  const value = parseJson(io.readFile(path), path);
  assertTestEvidenceBundle(value);
  return value;
}

function readOptionalBaseline(
  path: string,
  io: TestPlanIo,
): ChangedTestSelectionBaseline | undefined {
  if (!io.exists(path)) return undefined;
  const value = parseJson(io.readFile(path), path);
  assertChangedTestSelectionBaseline(value, `changed-test baseline '${path}'`);
  return value;
}

function parseJson(content: string, label: string): unknown {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw asChangedTestPlanProblem(
      `Unable to parse JSON artifact '${label}': ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }
}

function writeOutput(path: string, content: string, io: TestPlanIo): void {
  const absolute = resolveInputPath(path, io.cwd);
  io.mkdir(dirname(absolute));
  io.writeFile(absolute, content);
  io.stdout(`Wrote changed test plan artifact to ${absolute}.`);
}

function resolveInputPath(path: string, cwd: string): string {
  return resolve(cwd, path);
}

function assertRepositoryRelative(path: string, flagName: string): void {
  const pathSegments = path.split(/[\\/]/);
  if (
    path.startsWith("/") ||
    path.startsWith("\\") ||
    /^[A-Za-z]:/.test(path) ||
    pathSegments.includes("..")
  ) {
    throw new ChangedTestPlanProblem(
      `${flagName} must be a repository-relative path so its base revision can be read.`,
    );
  }
}

function isMissingGitPath(error: unknown): boolean {
  const output = errorOutput(error);
  return /path ['"].+['"] (?:does not exist in|exists on disk, but not in) ['"].+['"]/.test(output);
}

function errorOutput(error: unknown): string {
  const stderr = isRecord(error) ? error["stderr"] : undefined;
  const stderrText =
    typeof stderr === "string" ? stderr : Buffer.isBuffer(stderr) ? stderr.toString("utf8") : "";
  return `${errorMessage(error)}\n${stderrText}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asChangedTestPlanProblem(detail: string, cause: unknown): ChangedTestPlanProblem {
  if (cause instanceof ChangedTestPlanProblem) return cause;
  return new ChangedTestPlanProblem(detail, cause instanceof Error ? cause : undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function lines(value: string): readonly string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function flag(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
}

function numberFlag(args: readonly string[], name: string, fallback: number): number | null {
  const value = flag(args, name);
  return value === null ? fallback : parseFiniteNumber(value);
}

function optionalNumberFlag(args: readonly string[], name: string): number | null | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value === undefined ? null : parseFiniteNumber(value);
}

function parseFiniteNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function printHelp(io: TestPlanIo): void {
  io.stdout(`Usage: croco test plan --changed <base> [options]

Options:
  --changed <base>          Git base revision to compare with HEAD
  --graph <path>            Head executable assurance graph (${DEFAULT_GRAPH})
  --evidence <path>         Selected/full test evidence catalog (${DEFAULT_EVIDENCE})
  --full-evidence <path>    Full-suite evidence for advisory selection-miss measurement
  --out <path>              Write the machine-readable plan
  --baseline <path>         Existing durable shadow baseline (${DEFAULT_BASELINE})
  --baseline-out <path>     Write the updated shadow baseline
  --observation-window <n>  Required observed runs before enforcement (20)
  --miss-threshold <0..1>   Maximum observed miss rate before enforcement (0)
  --budget-ms <n>           Report budget overflow without dropping required evidence
  --enforce                 Require a qualified observation baseline
  --help, -h                Show this help message`);
}
