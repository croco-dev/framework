import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type {
  ChangedTestPlan,
  ChangedTestSelectionBaseline,
  ExecutableAssuranceGraph,
  ExecutableAssuranceGraphInput,
  TestEvidenceBundle,
} from "../packages/testing/src/executable-assurance.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME = resolve(ROOT, "packages/testing/dist/executable-assurance.mjs");
const GIT_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

type PlannerRuntime = {
  readonly assertChangedTestSelectionBaseline: (
    value: unknown,
    label?: string,
  ) => asserts value is ChangedTestSelectionBaseline;
  readonly assertExecutableAssuranceGraph: (
    value: unknown,
  ) => asserts value is ExecutableAssuranceGraph;
  readonly assertTestEvidenceBundle: (value: unknown) => asserts value is TestEvidenceBundle;
  readonly createChangedTestPlan: (input: {
    readonly base: string;
    readonly head: string;
    readonly baseGraph?: ExecutableAssuranceGraph;
    readonly headGraph?: ExecutableAssuranceGraph;
    readonly evidence: TestEvidenceBundle;
    readonly changedFiles: readonly string[];
  }) => ChangedTestPlan;
  readonly createExecutableAssuranceGraph: (input: {
    readonly contractGraph?: ExecutableAssuranceGraphInput["contractGraph"];
    readonly rpcContracts?: ExecutableAssuranceGraphInput["rpcContracts"];
    readonly problemRegistry?: ExecutableAssuranceGraphInput["problemRegistry"];
    readonly frameworkManifest?: ExecutableAssuranceGraphInput["frameworkManifest"];
    readonly projectMap?: ExecutableAssuranceGraphInput["projectMap"];
    readonly runtimeCapability?: ExecutableAssuranceGraphInput["runtimeCapability"];
    readonly providerProfile?: ExecutableAssuranceGraphInput["providerProfile"];
    readonly publicApi?: ExecutableAssuranceGraphInput["publicApi"];
  }) => ExecutableAssuranceGraph;
  readonly serializeChangedTestPlan: (
    value: ChangedTestPlan | ChangedTestSelectionBaseline,
  ) => string;
  readonly updateChangedTestSelectionBaseline: (
    plan: ChangedTestPlan,
    evidence: TestEvidenceBundle,
    options: {
      readonly previous?: ChangedTestSelectionBaseline;
      readonly observationWindow: number;
      readonly missThreshold: number;
    },
  ) => ChangedTestSelectionBaseline;
};

type ShadowArtifactReader = (path: string, revision: string | null) => unknown | undefined;

const ASSURANCE_ARTIFACT_PATHS = {
  contractGraph: "contract-graph.snapshot.json",
  rpcContracts: "rpc-contracts.json",
  problemRegistry: "docs/problem-code-registry.json",
  frameworkManifest: ".croco/build/framework-manifest.json",
  projectMap: "croco.project-map.json",
  runtimeCapability: "croco-runtime-capability.manifest.json",
  providerProfile: "croco-saas-profile.manifest.json",
  publicApi: "public-api-surface.snapshot.json",
} as const;

export type ChangedTestShadowOptions = {
  readonly base: string;
  readonly head: string;
  readonly fullEvidence: string;
  readonly outputDirectory: string;
  readonly observationWindow: number;
  readonly missThreshold: number;
  readonly executeSelected: boolean;
};

export type ChangedTestExecution = {
  readonly command: readonly string[];
  readonly status: "passed" | "failed";
  readonly exitCode: number | null;
};

export function parseChangedTestShadowArgs(args: readonly string[]): ChangedTestShadowOptions {
  const base = flag(args, "--base");
  const fullEvidence = flag(args, "--full-evidence");
  if (!base) throw new Error("--base requires a Git revision.");
  if (!fullEvidence) throw new Error("--full-evidence requires a test evidence bundle.");
  return {
    base,
    head: flag(args, "--head") ?? "HEAD",
    fullEvidence,
    outputDirectory: flag(args, "--output") ?? "ci-reports/changed-test-plan",
    observationWindow: positiveInteger(flag(args, "--observation-window") ?? "20"),
    missThreshold: threshold(flag(args, "--miss-threshold") ?? "0"),
    executeSelected: args.includes("--execute-selected"),
  };
}

export async function writeChangedTestShadowReport(
  options: ChangedTestShadowOptions,
  runtime: PlannerRuntime,
): Promise<{ readonly plan: ChangedTestPlan; readonly baseline: ChangedTestSelectionBaseline }> {
  const evidencePath = resolve(ROOT, options.fullEvidence);
  const evidenceValue = readJsonFile(evidencePath);
  runtime.assertTestEvidenceBundle(evidenceValue);
  const headGraph = graphAtRevision(runtime, null);
  const baseGraph = graphAtRevision(runtime, options.base);
  const head = git(["rev-parse", options.head]).trim();
  const checkedHead = git(["rev-parse", "HEAD"]).trim();
  if (checkedHead !== head) {
    throw new Error(`Checked revision ${checkedHead} does not match requested head ${head}.`);
  }
  const changedFiles = git(["diff", "--name-only", options.base, head]).split("\n").filter(Boolean);
  const plan = runtime.createChangedTestPlan({
    base: options.base,
    head,
    ...(baseGraph ? { baseGraph } : {}),
    ...(headGraph ? { headGraph } : {}),
    evidence: evidenceValue,
    changedFiles,
  });
  const outputDirectory = resolve(ROOT, options.outputDirectory);
  const baselinePath = resolve(outputDirectory, "baseline.json");
  const previousValue: unknown = existsSync(baselinePath) ? readJsonFile(baselinePath) : undefined;
  if (previousValue !== undefined) {
    runtime.assertChangedTestSelectionBaseline(previousValue, "changed-test shadow baseline");
  }
  const previous = previousValue;
  const baseline = runtime.updateChangedTestSelectionBaseline(plan, evidenceValue, {
    ...(previous ? { previous } : {}),
    observationWindow: options.observationWindow,
    missThreshold: options.missThreshold,
  });
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(resolve(outputDirectory, "plan.json"), runtime.serializeChangedTestPlan(plan));
  writeFileSync(baselinePath, runtime.serializeChangedTestPlan(baseline));
  writeFileSync(resolve(outputDirectory, "summary.md"), renderSummary(plan, baseline));
  return { plan, baseline };
}

export function readJsonFile(path: string): unknown {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`Unable to read JSON artifact '${path}'.`, { cause: error });
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Unable to parse JSON artifact '${path}'.`, { cause: error });
  }
}

export function executeChangedTestPlan(
  plan: ChangedTestPlan,
  outputDirectory: string,
): readonly ChangedTestExecution[] {
  const evidenceDirectory = resolve(ROOT, outputDirectory, "selected-evidence", "records");
  mkdirSync(evidenceDirectory, { recursive: true });
  const results = plan.commands.map((command): ChangedTestExecution => {
    const executable = command[0];
    if (!executable) return { command, status: "failed", exitCode: null };
    try {
      execFileSync(executable, command.slice(1), {
        cwd: ROOT,
        env: { ...process.env, CROCO_TEST_EVIDENCE_DIR: evidenceDirectory },
        stdio: "inherit",
      });
      return { command, status: "passed", exitCode: 0 };
    } catch (error) {
      const exitCode =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof error.status === "number"
          ? error.status
          : null;
      return { command, status: "failed", exitCode };
    }
  });
  writeFileSync(
    resolve(ROOT, outputDirectory, "selected-execution.json"),
    `${JSON.stringify({ schemaVersion: "croco.changed-test-execution/v1", results }, null, 2)}\n`,
  );
  return results;
}

async function loadRuntime(): Promise<PlannerRuntime> {
  if (!existsSync(RUNTIME)) {
    execFileSync("pnpm", ["--filter", "@croco/testing", "build"], {
      cwd: ROOT,
      stdio: "inherit",
    });
  }
  return (await import(pathToFileURL(RUNTIME).href)) as PlannerRuntime;
}

function graphAtRevision(
  runtime: PlannerRuntime,
  revision: string | null,
): ExecutableAssuranceGraph | undefined {
  return createShadowAssuranceGraph(runtime, revision, readJsonAtRevision);
}

export function createShadowAssuranceGraph(
  runtime: Pick<
    PlannerRuntime,
    "assertExecutableAssuranceGraph" | "createExecutableAssuranceGraph"
  >,
  revision: string | null,
  readArtifact: ShadowArtifactReader,
): ExecutableAssuranceGraph | undefined {
  const input = Object.fromEntries(
    Object.entries(ASSURANCE_ARTIFACT_PATHS).flatMap(([name, path]) => {
      const value = readArtifact(path, revision);
      return value === undefined ? [] : [[name, value]];
    }),
  ) as ExecutableAssuranceGraphInput;
  if (Object.keys(input).length === 0) return undefined;
  const graph = runtime.createExecutableAssuranceGraph(input);
  runtime.assertExecutableAssuranceGraph(graph);
  return graph;
}

export function readJsonAtRevision(path: string, revision: string | null): unknown | undefined {
  let content: string;
  try {
    content = revision
      ? git(["show", `${revision}:${path}`])
      : readFileSync(resolve(ROOT, path), "utf8");
  } catch (error) {
    if (isMissingArtifact(error, revision)) return undefined;
    throw new Error(`Unable to read assurance artifact '${artifactLabel(path, revision)}'.`, {
      cause: error,
    });
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Unable to parse assurance artifact '${artifactLabel(path, revision)}'.`, {
      cause: error,
    });
  }
}

function isMissingArtifact(error: unknown, revision: string | null): boolean {
  if (!revision) {
    return isRecord(error) && error["code"] === "ENOENT";
  }
  const output = errorOutput(error);
  return /path ['"].+['"] (?:does not exist in|exists on disk, but not in) ['"].+['"]/.test(output);
}

function artifactLabel(path: string, revision: string | null): string {
  return revision ? `${revision}:${path}` : path;
}

function errorOutput(error: unknown): string {
  const stderr = isRecord(error) ? error["stderr"] : undefined;
  const stderrText =
    typeof stderr === "string" ? stderr : Buffer.isBuffer(stderr) ? stderr.toString("utf8") : "";
  return `${error instanceof Error ? error.message : String(error)}\n${stderrText}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function renderSummary(
  plan: ChangedTestPlan,
  baseline: ChangedTestSelectionBaseline,
  execution: readonly ChangedTestExecution[] = [],
): string {
  const latest = baseline.runs.at(-1);
  return `# Changed Test Plan Shadow Report

- Base: \`${plan.base}\`
- Head: \`${plan.head}\`
- Changed contracts: ${plan.changedContracts.length}
- Selected tests: ${plan.selectedTests.length}
- Fallbacks: ${plan.fallbacks.length}
- Selection misses in this run: ${latest?.missedTests.length ?? 0}
- Observed runs: ${baseline.observedRuns}/${baseline.observationWindow}
- Miss rate: ${baseline.missRate}
- Enforcement eligible: ${baseline.eligibleForEnforcement ? "yes" : "no"}
- Selected replay commands: ${execution.length}
- Selected replay failures: ${execution.filter(({ status }) => status === "failed").length}

Product test failures and selection misses remain advisory in shadow mode. Planner contract failures remain blocking.
`;
}

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: GIT_MAX_BUFFER_BYTES,
  });
}

function flag(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
}

function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error("Observation window must be a positive integer.");
  return parsed;
}

function threshold(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1)
    throw new Error("Miss threshold must be from 0 through 1.");
  return parsed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseChangedTestShadowArgs(process.argv.slice(2));
    const { plan, baseline } = await writeChangedTestShadowReport(options, await loadRuntime());
    const execution = options.executeSelected
      ? executeChangedTestPlan(plan, options.outputDirectory)
      : [];
    const summary = renderSummary(plan, baseline, execution);
    writeFileSync(resolve(ROOT, options.outputDirectory, "summary.md"), summary);
    process.stdout.write(summary);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
