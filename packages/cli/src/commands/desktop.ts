import { readFileSync } from "node:fs";
import { resolve, win32 } from "node:path";
import { defineCommand } from "citty";
import {
  computeDesktopContractSemanticHash,
  diffDesktopContractGraphs,
  formatDesktopContractGraphDiagnostic,
  formatDesktopContractGraphDiff,
  resolveDesktopContractGraphDiffExitStatus,
} from "@croco/protocols-desktop";
import type {
  DesktopContractGraphDiff,
  DesktopContractGraphDiffFingerprint,
  DesktopContractGraphV1,
  DesktopContractSemanticHash,
} from "@croco/protocols-desktop";
import {
  createDesktopGeneratedArtifacts,
  DesktopArtifactError,
  inspectDesktopArtifactDrift,
  writeDesktopGeneratedArtifacts,
} from "../libs/desktopArtifacts.js";
import type { DesktopArtifactDrift, DesktopArtifactWriteResult } from "../libs/desktopArtifacts.js";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";
import { loadDesktopConfig, resolveDesktopConfigPath } from "../libs/desktopConfig.js";
import type {
  DesktopConfigLoadFailure,
  DesktopConfigLoadResult,
  LoadDesktopConfigOptions,
} from "../libs/desktopConfig.js";
import { GLOBAL_OPTIONS } from "./options.js";

const DEFAULT_OUTPUT_DIRECTORY = ".croco/build/desktop";

const DESKTOP_CLI_CODES = {
  ok: "CROCO_DESKTOP_OK",
  configFailure: "CROCO_DESKTOP_CONFIG_FAILURE",
  contractDiagnostics: "CROCO_DESKTOP_CONTRACT_DIAGNOSTICS",
  generatedDrift: "CROCO_DESKTOP_GENERATED_DRIFT",
  compatibilityBreak: "CROCO_DESKTOP_COMPATIBILITY_BREAK",
  authorityEscalation: "CROCO_DESKTOP_AUTHORITY_ESCALATION",
  baselineInvalid: "CROCO_DESKTOP_BASELINE_INVALID",
  artifactFailure: "CROCO_DESKTOP_ARTIFACT_FAILURE",
} as const;

const DESKTOP_EXIT_CODES = {
  success: 0,
  compatibilityBreak: 1,
  authorityEscalation: 2,
  contractDiagnostics: 4,
  generatedDrift: 8,
  configFailure: 16,
} as const;

type DesktopCommandName = "generate" | "check" | "diff";

type DesktopCommandIo = {
  readonly cwd: string;
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
  readonly readFile: (path: string) => string;
};

type DesktopCommandDependencies = {
  readonly io?: Partial<DesktopCommandIo>;
  readonly loadConfig?: (options: LoadDesktopConfigOptions) => Promise<DesktopConfigLoadResult>;
};

type DesktopCommonOptions = {
  readonly cwd: string;
  readonly cwdArgument?: string;
  readonly configPath: string;
  readonly configArgument: string;
  readonly json: boolean;
  readonly strict: boolean;
};

type DesktopOutputOptions = DesktopCommonOptions & {
  readonly outputDirectory: string;
  readonly outputArgument: string;
};

type DesktopDiffOptions = DesktopCommonOptions & {
  readonly baselinePath: string;
  readonly baselineArgument: string;
  readonly reviewedAuthority: readonly DesktopContractGraphDiffFingerprint[];
};

type DesktopParseResult<T> =
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "run"; readonly options: T };

type DesktopCommandReport = {
  readonly version: "croco.desktop-command-report.v1";
  readonly command: DesktopCommandName;
  readonly status: "passed" | "failed";
  readonly exitCode: number;
  readonly codes: readonly string[];
  readonly message: string;
  readonly recovery?: string;
  readonly configPath?: string;
  readonly outputDirectory?: string;
  readonly semanticHash?: DesktopContractSemanticHash;
  readonly evaluationCount?: 1 | 2;
  readonly diagnostics?: DesktopContractGraphV1["diagnostics"];
  readonly configFailure?: DesktopConfigLoadFailure;
  readonly drift?: readonly DesktopArtifactDrift[];
  readonly generated?: DesktopArtifactWriteResult;
  readonly diff?: DesktopContractGraphDiff;
};

const outputArgs = {
  config: {
    type: "string",
    description: "Desktop config module",
  },
  "out-dir": {
    type: "string",
    description: "Generated desktop artifact directory",
  },
  strict: {
    type: "boolean",
    description: "Evaluate the config twice in fresh processes",
  },
  json: {
    type: "boolean",
    description: "Print a machine-readable report",
  },
} as const;

const desktopGenerate = defineCommand({
  meta: {
    name: "generate",
    description: "Generate deterministic desktop contract artifacts",
  },
  args: { ...GLOBAL_OPTIONS, ...outputArgs },
  async run({ rawArgs }) {
    getCrocoCommandRuntime().setExitCode(await runDesktopGenerate(rawArgs));
  },
});

const desktopCheck = defineCommand({
  meta: {
    name: "check",
    description: "Check desktop contracts and generated artifact drift without writing",
  },
  args: { ...GLOBAL_OPTIONS, ...outputArgs },
  async run({ rawArgs }) {
    getCrocoCommandRuntime().setExitCode(await runDesktopCheck(rawArgs));
  },
});

const desktopDiff = defineCommand({
  meta: {
    name: "diff",
    description: "Compare a desktop contract baseline with the current graph",
  },
  args: {
    ...GLOBAL_OPTIONS,
    config: outputArgs.config,
    baseline: {
      type: "string",
      description: "Baseline desktop contract graph JSON",
    },
    strict: outputArgs.strict,
    json: outputArgs.json,
    "reviewed-authority": {
      type: "string",
      description: "Reviewed authority escalation fingerprint; may be repeated",
    },
  },
  async run({ rawArgs }) {
    getCrocoCommandRuntime().setExitCode(await runDesktopDiff(rawArgs));
  },
});

export const desktop = defineCommand({
  meta: {
    name: "desktop",
    description: "Generate and validate Croco desktop contract artifacts",
  },
  args: { ...GLOBAL_OPTIONS },
  subCommands: {
    generate: desktopGenerate,
    check: desktopCheck,
    diff: desktopDiff,
  },
});

export async function runDesktopGenerate(
  args: readonly string[],
  dependencies: DesktopCommandDependencies = {},
): Promise<number> {
  const io = createIo(dependencies.io);
  const parsed = parseOutputOptions(args, io.cwd);
  if (parsed.kind !== "run") return finishParse(parsed, "generate", io);
  const loaded = await loadGraph(parsed.options, dependencies.loadConfig);
  if (!loaded.ok) return reportConfigFailure("generate", parsed.options, loaded, io);
  const diagnosticsExit = reportGraphDiagnostics("generate", parsed.options, loaded, io);
  if (diagnosticsExit !== null) return diagnosticsExit;

  let artifacts: ReturnType<typeof createDesktopGeneratedArtifacts>;
  let generated: DesktopArtifactWriteResult;
  try {
    artifacts = createDesktopGeneratedArtifacts(loaded.graph);
    generated = writeDesktopGeneratedArtifacts(parsed.options.outputDirectory, artifacts);
  } catch (error) {
    return reportArtifactFailure("generate", parsed.options, error, io);
  }
  return printReport(
    {
      version: "croco.desktop-command-report.v1",
      command: "generate",
      status: "passed",
      exitCode: DESKTOP_EXIT_CODES.success,
      codes: [DESKTOP_CLI_CODES.ok],
      message: `Generated ${generated.written.length} desktop artifact(s).`,
      configPath: loaded.configPath,
      outputDirectory: parsed.options.outputDirectory,
      semanticHash: loaded.semanticHash,
      evaluationCount: loaded.evaluationCount,
      generated,
    },
    parsed.options.json,
    io,
  );
}

export async function runDesktopCheck(
  args: readonly string[],
  dependencies: DesktopCommandDependencies = {},
): Promise<number> {
  const io = createIo(dependencies.io);
  const parsed = parseOutputOptions(args, io.cwd);
  if (parsed.kind !== "run") return finishParse(parsed, "check", io);
  const loaded = await loadGraph(parsed.options, dependencies.loadConfig);
  if (!loaded.ok) return reportConfigFailure("check", parsed.options, loaded, io);
  const diagnosticsExit = reportGraphDiagnostics("check", parsed.options, loaded, io);
  if (diagnosticsExit !== null) return diagnosticsExit;

  let artifacts: ReturnType<typeof createDesktopGeneratedArtifacts>;
  let drift: readonly DesktopArtifactDrift[];
  try {
    artifacts = createDesktopGeneratedArtifacts(loaded.graph);
    drift = inspectDesktopArtifactDrift(parsed.options.outputDirectory, artifacts);
  } catch (error) {
    return reportArtifactFailure("check", parsed.options, error, io);
  }
  const failed = drift.length > 0;
  return printReport(
    {
      version: "croco.desktop-command-report.v1",
      command: "check",
      status: failed ? "failed" : "passed",
      exitCode: failed ? DESKTOP_EXIT_CODES.generatedDrift : DESKTOP_EXIT_CODES.success,
      codes: [failed ? DESKTOP_CLI_CODES.generatedDrift : DESKTOP_CLI_CODES.ok],
      message: failed
        ? `Desktop generated artifacts have ${drift.length} drift item(s).`
        : `Desktop generated artifacts match ${artifacts.length} expected file(s).`,
      ...(failed ? { recovery: `Run ${renderGenerateCommand(parsed.options)}.` } : {}),
      configPath: loaded.configPath,
      outputDirectory: parsed.options.outputDirectory,
      semanticHash: loaded.semanticHash,
      evaluationCount: loaded.evaluationCount,
      drift,
    },
    parsed.options.json,
    io,
  );
}

export async function runDesktopDiff(
  args: readonly string[],
  dependencies: DesktopCommandDependencies = {},
): Promise<number> {
  const io = createIo(dependencies.io);
  const parsed = parseDiffOptions(args, io.cwd);
  if (parsed.kind !== "run") return finishParse(parsed, "diff", io);
  const loaded = await loadGraph(parsed.options, dependencies.loadConfig);
  if (!loaded.ok) return reportConfigFailure("diff", parsed.options, loaded, io);
  const diagnosticsExit = reportGraphDiagnostics("diff", parsed.options, loaded, io);
  if (diagnosticsExit !== null) return diagnosticsExit;

  const baseline = readDesktopBaseline(parsed.options.baselinePath, io);
  if (!baseline.ok) {
    return printReport(
      {
        version: "croco.desktop-command-report.v1",
        command: "diff",
        status: "failed",
        exitCode: DESKTOP_EXIT_CODES.configFailure,
        codes: [DESKTOP_CLI_CODES.baselineInvalid],
        message: baseline.message,
        recovery: `Generate a valid baseline with ${renderGenerateCommand({
          ...parsed.options,
          outputArgument: DEFAULT_OUTPUT_DIRECTORY,
          outputDirectory: resolveInputPath(DEFAULT_OUTPUT_DIRECTORY, parsed.options.cwd),
        })}, then pass its desktop-contract-graph.json path to --baseline.`,
        configPath: loaded.configPath,
        semanticHash: loaded.semanticHash,
        evaluationCount: loaded.evaluationCount,
      },
      parsed.options.json,
      io,
    );
  }

  const diff = diffDesktopContractGraphs(baseline.graph, loaded.graph);
  const status = resolveDesktopContractGraphDiffExitStatus(diff, {
    reviewedAuthorityEscalationFingerprints: parsed.options.reviewedAuthority,
  });
  const codes = [
    ...(status.hasBreakingCompatibility ? [DESKTOP_CLI_CODES.compatibilityBreak] : []),
    ...(status.unreviewedAuthorityEscalations.length > 0
      ? [DESKTOP_CLI_CODES.authorityEscalation]
      : []),
  ];
  const failed = status.exitCode !== 0;
  const recovery = failed
    ? renderDiffRecovery(
        parsed.options,
        status.hasBreakingCompatibility,
        status.unreviewedAuthorityEscalations,
      )
    : undefined;
  return printReport(
    {
      version: "croco.desktop-command-report.v1",
      command: "diff",
      status: failed ? "failed" : "passed",
      exitCode: status.exitCode,
      codes: failed ? codes : [DESKTOP_CLI_CODES.ok],
      message: `Desktop contract diff found ${diff.breakingCompatibilityCount} breaking compatibility change(s) and ${status.unreviewedAuthorityEscalations.length} unreviewed authority escalation(s).`,
      ...(recovery ? { recovery } : {}),
      configPath: loaded.configPath,
      semanticHash: loaded.semanticHash,
      evaluationCount: loaded.evaluationCount,
      diff,
    },
    parsed.options.json,
    io,
  );
}

function createIo(overrides: Partial<DesktopCommandIo> | undefined): DesktopCommandIo {
  const runtime = getCrocoCommandRuntime();
  return {
    cwd: overrides?.cwd ?? runtime.cwd,
    stdout: overrides?.stdout ?? runtime.stdout,
    stderr: overrides?.stderr ?? runtime.stderr,
    readFile: overrides?.readFile ?? ((path) => readFileSync(path, "utf8")),
  };
}

async function loadGraph(
  options: DesktopCommonOptions,
  loader: DesktopCommandDependencies["loadConfig"],
): Promise<DesktopConfigLoadResult> {
  try {
    return await (loader ?? loadDesktopConfig)({
      configPath: options.configPath,
      cwd: options.cwd,
      strict: options.strict,
    });
  } catch (error) {
    return {
      ok: false,
      code: "CROCO_DESKTOP_CONFIG_WORKER_FAILED",
      message: error instanceof Error ? error.message : String(error),
      recovery: "Fix the desktop config evaluation failure, then run the command again.",
    };
  }
}

function reportConfigFailure(
  command: DesktopCommandName,
  options: DesktopCommonOptions,
  failure: DesktopConfigLoadFailure,
  io: DesktopCommandIo,
): number {
  return printReport(
    {
      version: "croco.desktop-command-report.v1",
      command,
      status: "failed",
      exitCode: DESKTOP_EXIT_CODES.configFailure,
      codes: [DESKTOP_CLI_CODES.configFailure, failure.code],
      message: failure.message,
      recovery: `${failure.recovery} Then run ${renderCurrentCommand(command, options)}.`,
      configFailure: failure,
    },
    options.json,
    io,
  );
}

function reportArtifactFailure(
  command: "generate" | "check",
  options: DesktopOutputOptions,
  error: unknown,
  io: DesktopCommandIo,
): number {
  const failure =
    error instanceof DesktopArtifactError
      ? error
      : new DesktopArtifactError(
          "CROCO_DESKTOP_ARTIFACT_IO_FAILED",
          error instanceof Error ? error.message : String(error),
          `Make '${options.outputDirectory}' readable and writable.`,
        );
  return printReport(
    {
      version: "croco.desktop-command-report.v1",
      command,
      status: "failed",
      exitCode: DESKTOP_EXIT_CODES.generatedDrift,
      codes: [DESKTOP_CLI_CODES.artifactFailure, failure.code],
      message: failure.message,
      recovery: `${failure.recovery} Then run ${renderCurrentCommand(command, options)}.`,
      configPath: options.configPath,
      outputDirectory: options.outputDirectory,
    },
    options.json,
    io,
  );
}

function reportGraphDiagnostics(
  command: DesktopCommandName,
  options: DesktopCommonOptions,
  loaded: Extract<DesktopConfigLoadResult, { readonly ok: true }>,
  io: DesktopCommandIo,
): number | null {
  if (loaded.graph.diagnostics.length === 0) return null;
  const recovery = `Correct the reported desktop contract source, then run ${renderCurrentCommand(command, options)}.`;
  return printReport(
    {
      version: "croco.desktop-command-report.v1",
      command,
      status: "failed",
      exitCode: DESKTOP_EXIT_CODES.contractDiagnostics,
      codes: [DESKTOP_CLI_CODES.contractDiagnostics],
      message: `Desktop contract compilation produced ${loaded.graph.diagnostics.length} error diagnostic(s).`,
      recovery,
      configPath: loaded.configPath,
      semanticHash: loaded.semanticHash,
      evaluationCount: loaded.evaluationCount,
      diagnostics: loaded.graph.diagnostics,
    },
    options.json,
    io,
  );
}

function readDesktopBaseline(
  path: string,
  io: DesktopCommandIo,
):
  | { readonly ok: true; readonly graph: DesktopContractGraphV1 }
  | { readonly ok: false; readonly message: string } {
  try {
    const value = JSON.parse(io.readFile(path)) as unknown;
    if (!isDesktopContractGraph(value)) {
      return { ok: false, message: `${path} is not a croco.desktop-contract-graph.v1 artifact.` };
    }
    if (computeDesktopContractSemanticHash(value) !== value.semanticHash) {
      return { ok: false, message: `${path} has a stale or forged desktop semantic hash.` };
    }
    if (value.diagnostics.length > 0) {
      return {
        ok: false,
        message: `${path} contains contract diagnostics and cannot be a baseline.`,
      };
    }
    return { ok: true, graph: value };
  } catch (error) {
    return {
      ok: false,
      message: `Could not read desktop baseline ${path}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function isDesktopContractGraph(value: unknown): value is DesktopContractGraphV1 {
  if (!isRecord(value)) return false;
  return (
    value["version"] === "croco.desktop-contract-graph.v1" &&
    typeof value["semanticHash"] === "string" &&
    value["semanticHash"].startsWith("sha256:") &&
    isRecord(value["app"]) &&
    [
      value["contracts"],
      value["commands"],
      value["events"],
      value["effects"],
      value["grants"],
      value["problems"],
      value["windows"],
      value["diagnostics"],
    ].every(Array.isArray)
  );
}

function printReport(report: DesktopCommandReport, json: boolean, io: DesktopCommandIo): number {
  if (json) {
    io.stdout(JSON.stringify(report, null, 2));
    return report.exitCode;
  }

  if (report.diagnostics) {
    for (const diagnostic of report.diagnostics)
      io.stdout(formatDesktopContractGraphDiagnostic(diagnostic));
  }
  if (report.configFailure?.findings) {
    for (const finding of report.configFailure.findings) {
      io.stdout(
        `${finding.code} ${finding.file}:${finding.line}:${finding.column}: ${finding.message}`,
      );
    }
  }
  if (report.drift) {
    for (const drift of report.drift)
      io.stdout(`${drift.kind.toUpperCase()} ${drift.relativePath}`);
  }
  if (report.diff) io.stdout(formatDesktopContractGraphDiff(report.diff));
  io.stdout(`${report.codes.join("+")}: ${report.message}`);
  if (report.recovery) io.stdout(`Recovery: ${report.recovery}`);
  return report.exitCode;
}

function parseOutputOptions(
  args: readonly string[],
  cwd: string,
): DesktopParseResult<DesktopOutputOptions> {
  if (hasHelp(args)) return { kind: "help" };
  const configArgument = getFlagValue(args, "--config");
  if (!configArgument)
    return { kind: "invalid", message: "Missing desktop config. Pass --config <path>." };
  const outputArgument = getFlagValue(args, "--out-dir") ?? DEFAULT_OUTPUT_DIRECTORY;
  const cwdArgument = getFlagValue(args, "--cwd") ?? undefined;
  const effectiveCwd = cwdArgument ? resolveInputPath(cwdArgument, cwd) : cwd;
  return {
    kind: "run",
    options: {
      cwd: effectiveCwd,
      ...(cwdArgument ? { cwdArgument } : {}),
      configArgument,
      configPath: resolveDesktopConfigPath(configArgument, effectiveCwd),
      outputArgument,
      outputDirectory: resolveInputPath(outputArgument, effectiveCwd),
      strict: args.includes("--strict"),
      json: args.includes("--json"),
    },
  };
}

function parseDiffOptions(
  args: readonly string[],
  cwd: string,
): DesktopParseResult<DesktopDiffOptions> {
  if (hasHelp(args)) return { kind: "help" };
  const configArgument = getFlagValue(args, "--config");
  const baselineArgument = getFlagValue(args, "--baseline");
  if (!configArgument)
    return { kind: "invalid", message: "Missing desktop config. Pass --config <path>." };
  if (!baselineArgument)
    return { kind: "invalid", message: "Missing desktop baseline. Pass --baseline <path>." };
  const reviewedAuthority = getFlagValues(args, "--reviewed-authority");
  if (reviewedAuthority.some((fingerprint) => !fingerprint.startsWith("sha256:"))) {
    return {
      kind: "invalid",
      message: "Every --reviewed-authority value must be a sha256: fingerprint.",
    };
  }
  const cwdArgument = getFlagValue(args, "--cwd") ?? undefined;
  const effectiveCwd = cwdArgument ? resolveInputPath(cwdArgument, cwd) : cwd;
  return {
    kind: "run",
    options: {
      cwd: effectiveCwd,
      ...(cwdArgument ? { cwdArgument } : {}),
      configArgument,
      configPath: resolveDesktopConfigPath(configArgument, effectiveCwd),
      baselineArgument,
      baselinePath: resolveInputPath(baselineArgument, effectiveCwd),
      reviewedAuthority: reviewedAuthority as DesktopContractGraphDiffFingerprint[],
      strict: args.includes("--strict"),
      json: args.includes("--json"),
    },
  };
}

function finishParse(
  parsed: Exclude<DesktopParseResult<unknown>, { readonly kind: "run" }>,
  command: DesktopCommandName,
  io: DesktopCommandIo,
): number {
  if (parsed.kind === "invalid") io.stderr(parsed.message);
  printHelp(command, io);
  return parsed.kind === "help" ? 0 : 1;
}

function printHelp(command: DesktopCommandName, io: DesktopCommandIo): void {
  if (command === "diff") {
    io.stdout(
      `Usage: croco desktop diff --config <path> --baseline <desktop-contract-graph.json> [--cwd <directory>] [--strict] [--json] [--reviewed-authority <fingerprint>]`,
    );
    return;
  }
  io.stdout(
    `Usage: croco desktop ${command} --config <path> [--out-dir <directory>] [--cwd <directory>] [--strict] [--json]`,
  );
}

function renderCurrentCommand(command: DesktopCommandName, options: DesktopCommonOptions): string {
  if (command === "diff" && "baselineArgument" in options)
    return renderDiffCommand(options as DesktopDiffOptions);
  if (command !== "diff" && "outputArgument" in options) {
    return renderOutputCommand(command, options as DesktopOutputOptions);
  }
  return `croco desktop ${command}${renderCwd(options)} --config ${quoteArgument(options.configArgument)}${options.strict ? " --strict" : ""}`;
}

function renderGenerateCommand(options: DesktopOutputOptions): string {
  return renderOutputCommand("generate", options);
}

function renderOutputCommand(command: "generate" | "check", options: DesktopOutputOptions): string {
  return `croco desktop ${command}${renderCwd(options)} --config ${quoteArgument(options.configArgument)} --out-dir ${quoteArgument(options.outputArgument)}${options.strict ? " --strict" : ""}`;
}

function renderDiffCommand(
  options: DesktopDiffOptions,
  additionalReviewed: readonly DesktopContractGraphDiffFingerprint[] = [],
): string {
  const reviewed = [...new Set([...options.reviewedAuthority, ...additionalReviewed])];
  return [
    `croco desktop diff${renderCwd(options)} --config ${quoteArgument(options.configArgument)}`,
    `--baseline ${quoteArgument(options.baselineArgument)}`,
    ...(options.strict ? ["--strict"] : []),
    ...reviewed.map((fingerprint) => `--reviewed-authority ${quoteArgument(fingerprint)}`),
  ].join(" ");
}

function renderDiffRecovery(
  options: DesktopDiffOptions,
  hasBreakingCompatibility: boolean,
  unreviewedAuthority: DesktopContractGraphDiff["authorityEscalations"],
): string {
  const reviewed = unreviewedAuthority.map(({ fingerprint }) => fingerprint);
  const command = renderDiffCommand(options, reviewed);
  if (hasBreakingCompatibility) {
    return `Correct the breaking desktop contract source, then run ${command}.`;
  }
  return `Review the authority escalation fingerprints, then run ${command}.`;
}

function resolveInputPath(path: string, cwd: string): string {
  if (isWindowsDrivePath(path) || isWindowsDrivePath(cwd)) return win32.resolve(cwd, path);
  return resolve(cwd, path);
}

function renderCwd(options: DesktopCommonOptions): string {
  return options.cwdArgument ? ` --cwd ${quoteArgument(options.cwdArgument)}` : "";
}

function isWindowsDrivePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path);
}

function quoteArgument(value: string): string {
  return /^[A-Za-z0-9_./:@\\-]+$/.test(value) ? value : `"${value.split('"').join('\\"')}"`;
}

function getFlagValue(args: readonly string[], flag: string): string | null {
  const values = getFlagValues(args, flag);
  return values[0] ?? null;
}

function getFlagValues(args: readonly string[], flag: string): string[] {
  const assignmentPrefix = `${flag}=`;
  return args.flatMap((argument, index) => {
    if (argument.startsWith(assignmentPrefix)) {
      const value = argument.slice(assignmentPrefix.length);
      return value ? [value] : [];
    }
    if (argument !== flag) return [];
    const value = args[index + 1];
    return value && !value.startsWith("--") ? [value] : [];
  });
}

function hasHelp(args: readonly string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
