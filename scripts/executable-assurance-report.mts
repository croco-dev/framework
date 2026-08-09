import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatVerificationProblem, VerificationProblem } from "./verification-problem.mts";
import { assertTestEvidenceBundle } from "./test-evidence-runtime.mts";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const testingRuntimeEntry = resolve(
  rootDirectory,
  "packages/testing/dist/executable-assurance.mjs",
);
let runtimePromise: ReturnType<typeof importExecutableAssuranceRuntime> | undefined;

type ReportOptions = {
  readonly graphPath: string;
  readonly evidencePath: string;
  readonly outputDirectory: string;
  readonly mode: "advisory" | "enforce";
};

type RuntimeBuildRunner = (command: string, args: readonly string[]) => void;

export function parseExecutableAssuranceReportOptions(args: readonly string[]): ReportOptions {
  let graphPath: string | undefined;
  let evidencePath: string | undefined;
  let outputDirectory = "ci-reports/executable-assurance";
  let mode: ReportOptions["mode"] = "advisory";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--enforce") {
      mode = "enforce";
      continue;
    }
    if (arg === "--graph" || arg === "--evidence" || arg === "--out") {
      const value = args[index + 1];
      if (!value) {
        throw configurationProblem(`${arg} requires a path.`);
      }
      if (arg === "--graph") graphPath = value;
      if (arg === "--evidence") evidencePath = value;
      if (arg === "--out") outputDirectory = value;
      index += 1;
      continue;
    }
    throw configurationProblem(`Unknown executable assurance option '${arg}'.`);
  }

  if (!graphPath || !evidencePath) {
    throw configurationProblem("--graph and --evidence are required.");
  }
  return { graphPath, evidencePath, outputDirectory, mode };
}

export async function writeExecutableAssuranceReport(
  options: ReportOptions,
): Promise<{ readonly status: string; readonly outputDirectory: string }> {
  const runtime = await loadExecutableAssuranceRuntime();
  const graphPath = resolve(rootDirectory, options.graphPath);
  const evidencePath = resolve(rootDirectory, options.evidencePath);
  const outputDirectory = resolve(rootDirectory, options.outputDirectory);
  const graph = readJson(graphPath, "graph");
  const evidence = readJson(evidencePath, "evidence");
  runtime.assertExecutableAssuranceGraph(graph);
  assertTestEvidenceBundle(evidence);
  const report = runtime.evaluateExecutableAssuranceGraph(graph, evidence, { mode: options.mode });

  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    resolve(outputDirectory, "report.json"),
    runtime.serializeExecutableAssurance(report),
  );
  writeFileSync(
    resolve(outputDirectory, "summary.md"),
    runtime.renderExecutableAssuranceMarkdown(report),
  );
  process.stdout.write(runtime.renderExecutableAssuranceMarkdown(report));
  return { status: report.status, outputDirectory };
}

async function loadExecutableAssuranceRuntime() {
  runtimePromise ??= importExecutableAssuranceRuntime();
  return runtimePromise;
}

async function importExecutableAssuranceRuntime() {
  bootstrapExecutableAssuranceRuntime();
  return import(pathToFileURL(testingRuntimeEntry).href);
}

export function bootstrapExecutableAssuranceRuntime(
  run: RuntimeBuildRunner = runRuntimeBuild,
  platform: NodeJS.Platform = process.platform,
): void {
  try {
    run(platform === "win32" ? "pnpm.cmd" : "pnpm", ["--filter", "@croco/testing", "build"]);
  } catch (error) {
    throw new VerificationProblem(
      "EXECUTABLE_ASSURANCE_RUNTIME_BOOTSTRAP_FAILED",
      "configuration",
      `Unable to build @croco/testing before loading the executable assurance runtime: ${runtimeBuildDiagnostics(error)}`,
    );
  }
}

function runRuntimeBuild(command: string, args: readonly string[]): void {
  execFileSync(command, [...args], {
    cwd: rootDirectory,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function runtimeBuildDiagnostics(error: unknown): string {
  const diagnostics = [
    isRecord(error) && typeof error["stderr"] === "string" ? error["stderr"].trim() : "",
    isRecord(error) && typeof error["stdout"] === "string" ? error["stdout"].trim() : "",
    errorMessage(error),
  ].filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
  return diagnostics.join("\n");
}

function readJson(path: string, label: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new VerificationProblem(
      "EXECUTABLE_ASSURANCE_INPUT_INVALID",
      "configuration",
      `Unable to read executable assurance ${label} '${path}': ${errorMessage(error)}`,
    );
  }
}

function configurationProblem(message: string): VerificationProblem {
  return new VerificationProblem(
    "EXECUTABLE_ASSURANCE_CONFIGURATION_INVALID",
    "configuration",
    message,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function main(): Promise<void> {
  try {
    const options = parseExecutableAssuranceReportOptions(process.argv.slice(2));
    const result = await writeExecutableAssuranceReport(options);
    if (options.mode === "enforce" && result.status === "failed") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${formatVerificationProblem(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
