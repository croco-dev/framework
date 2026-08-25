import { Problem, ProblemCategory, type ProblemDetails } from "@croco/problems-core";
import { lstatSync, readdirSync } from "node:fs";
import {
  readStagingCleanupFailure,
  type StagingCleanupFailure,
} from "./generation-failure-evidence.js";
import {
  GENERATED_NODE_ENGINE_RANGE,
  GENERATED_NODE_VERSION,
  SAAS_GENERATED_NODE_ENGINE_RANGE,
  SAAS_GENERATED_NODE_VERSION,
} from "./node-runtime.js";
import { isSaasPreset } from "./options.js";
import type { GeneratorOptions } from "./types.js";

export type CreateCrocoAppSuccessResult = {
  readonly ok: true;
  readonly code: "create-croco-app/project-created";
  readonly targetDir: string;
  readonly projectName: string;
  readonly preset: GeneratorOptions["preset"];
  readonly packageManager: "pnpm";
  readonly nodeRequirement: string;
  readonly nodeRecovery: string;
  readonly nextSteps: readonly CreateCrocoAppNextStep[];
};

export type CreateCrocoAppFailureResult = {
  readonly ok: false;
  readonly code: string;
  readonly unexpected: boolean;
  readonly diagnostic: ProblemDetails;
  readonly recovery?: string;
  readonly destination?: CreateCrocoAppDestinationState;
  readonly retryCommand?: CreateCrocoAppRetryCommand;
  readonly diagnosticCommand?: CreateCrocoAppRetryCommand;
  readonly stagingCleanup?: StagingCleanupFailure;
};

export type CreateCrocoAppResult = CreateCrocoAppSuccessResult | CreateCrocoAppFailureResult;

export type CreateCrocoAppDestinationState = {
  readonly targetDir: string;
  readonly state: "absent" | "empty" | "occupied" | "unavailable";
  readonly untouched: boolean;
};

export type CreateCrocoAppRetryCommand = {
  readonly command: "create-croco-app";
  readonly args: readonly string[];
};

export type CreateCrocoAppFailureContext = {
  readonly targetDir: string;
  readonly retryCommand: CreateCrocoAppRetryCommand;
};

class UnexpectedCliFailureProblem extends Problem {
  readonly code = "create-croco-app/unexpected-failure";
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string, cause?: Error) {
    super(undefined, undefined, detail, {
      ...(cause ? { cause } : {}),
      extensions: {
        recovery:
          "Inspect the unexpected error, fix the underlying cause, and rerun create-croco-app.",
      },
    });
  }
}

export type CreateCrocoAppNextStep = {
  readonly command: "pnpm";
  readonly args: readonly string[];
  readonly cwd: string;
};

export function createSuccessResult(
  targetDir: string,
  options: GeneratorOptions,
): CreateCrocoAppSuccessResult {
  const saasPreset = isSaasPreset(options.preset);
  const nodeRequirement = saasPreset
    ? SAAS_GENERATED_NODE_ENGINE_RANGE
    : GENERATED_NODE_ENGINE_RANGE;
  const nodeVersion = saasPreset ? SAAS_GENERATED_NODE_VERSION : GENERATED_NODE_VERSION;
  return {
    ok: true,
    code: "create-croco-app/project-created",
    targetDir,
    projectName: options.projectName,
    preset: options.preset,
    packageManager: "pnpm",
    nodeRequirement,
    nodeRecovery: `Run nvm install ${nodeVersion} && nvm use ${nodeVersion}.`,
    nextSteps: createNextStepCommands(targetDir, options),
  };
}

export function createFailureResult(
  error: unknown,
  context?: CreateCrocoAppFailureContext,
): CreateCrocoAppFailureResult {
  const problem = toCliProblem(error);
  const recovery = readRecovery(problem.extensions);
  const stagingCleanup = readStagingCleanupFailure(error);

  return {
    ok: false,
    code: problem.code,
    unexpected: problem instanceof UnexpectedCliFailureProblem,
    diagnostic: problem.toJSON(),
    ...(recovery ? { recovery } : {}),
    ...(stagingCleanup ? { stagingCleanup } : {}),
    ...(context
      ? {
          destination: inspectDestination(context.targetDir),
          retryCommand: context.retryCommand,
          diagnosticCommand: withoutJsonOutput(context.retryCommand),
        }
      : {}),
  };
}

function withoutJsonOutput(command: CreateCrocoAppRetryCommand): CreateCrocoAppRetryCommand {
  const args = command.args.filter((arg) => arg !== "--json");

  return {
    command: command.command,
    args,
  };
}

export function formatHumanSuccess(
  result: CreateCrocoAppSuccessResult,
  platform: NodeJS.Platform = process.platform,
): string {
  return [
    `Project created in ${result.targetDir}.`,
    `Node.js ${result.nodeRequirement} is required for install and build. Recovery: ${result.nodeRecovery}`,
    "Next steps:",
    ...result.nextSteps.map((step) => `  ${formatNextStepCommand(step, platform)}`),
  ].join("\n");
}

export function formatHumanFailure(
  result: CreateCrocoAppFailureResult,
  platform: NodeJS.Platform = process.platform,
): string {
  const detail =
    typeof result.diagnostic.detail === "string"
      ? result.diagnostic.detail
      : result.diagnostic.title;
  const heading = result.unexpected
    ? `Unexpected error [${result.code}]`
    : `Error [${result.code}]`;
  const lines = [heading, `Reason: ${detail}`];

  if (result.recovery) {
    lines.push(`Recovery: ${result.recovery}`);
  }

  if (result.stagingCleanup) {
    lines.push(`Staging cleanup: ${result.stagingCleanup.detail}`);
  }

  if (result.destination) {
    lines.push(
      `Destination: ${result.destination.targetDir} (${result.destination.state}, untouched: ${result.destination.untouched ? "yes" : "no"})`,
    );
  }

  if (result.retryCommand) {
    lines.push(`Retry command: ${formatCommand(result.retryCommand, platform)}`);
  }

  if (result.diagnosticCommand) {
    lines.push(`Diagnostic command: ${formatCommand(result.diagnosticCommand, platform)}`);
  }

  return `\n${lines.join("\n")}`;
}

export function formatJsonResult(result: CreateCrocoAppResult): string {
  return JSON.stringify(result, null, 2);
}

function createNextStepCommands(
  targetDir: string,
  options: GeneratorOptions,
): CreateCrocoAppNextStep[] {
  const commands: CreateCrocoAppNextStep[] = [];

  if (!options.installDeps) {
    commands.push({ command: "pnpm", args: ["install"], cwd: targetDir });
  }

  commands.push({
    command: "pnpm",
    args: [resolveRunScript(options)],
    cwd: targetDir,
  });

  return commands;
}

function resolveRunScript(options: GeneratorOptions): string {
  if (options.preset === "saas" || options.preset === "ai-saas") {
    return "dev:api";
  }

  return "dev";
}

function toCliProblem(error: unknown): Problem {
  if (error instanceof Problem) {
    return error;
  }

  if (error instanceof Error) {
    return new UnexpectedCliFailureProblem(error.message, error);
  }

  return new UnexpectedCliFailureProblem(String(error));
}

function readRecovery(extensions: Problem["extensions"]): string | undefined {
  const recovery = extensions?.recovery;

  return typeof recovery === "string" ? recovery : undefined;
}

function inspectDestination(targetDir: string): CreateCrocoAppDestinationState {
  try {
    const stats = lstatSync(targetDir);
    if (!stats.isDirectory()) {
      return { targetDir, state: "occupied", untouched: false };
    }

    const state = readdirSync(targetDir).length === 0 ? "empty" : "occupied";
    return { targetDir, state, untouched: state === "empty" };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { targetDir, state: "absent", untouched: true };
    }
    return { targetDir, state: "unavailable", untouched: false };
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

function formatNextStepCommand(step: CreateCrocoAppNextStep, platform: NodeJS.Platform): string {
  return [
    step.command,
    "--dir",
    quoteShellArg(step.cwd, platform),
    ...step.args.map((arg) => quoteShellArg(arg, platform)),
  ].join(" ");
}

function formatCommand(command: CreateCrocoAppRetryCommand, platform: NodeJS.Platform): string {
  return [command.command, ...command.args.map((arg) => quoteShellArg(arg, platform))].join(" ");
}

function quoteShellArg(value: string, platform: NodeJS.Platform): string {
  if (platform === "win32") {
    return quoteWindowsCommandArg(value);
  }

  return quotePosixShellArg(value);
}

function quotePosixShellArg(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }

  return `'${value.split("'").join("'\\''")}'`;
}

function quoteWindowsCommandArg(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }

  let quoted = '"';
  let pendingBackslashes = 0;

  for (const character of value) {
    if (character === "\\") {
      pendingBackslashes += 1;
      continue;
    }

    if (character === '"') {
      quoted += `${"\\".repeat(pendingBackslashes * 2 + 1)}"`;
    } else {
      quoted += `${"\\".repeat(pendingBackslashes)}${character}`;
    }
    pendingBackslashes = 0;
  }

  return `${quoted}${"\\".repeat(pendingBackslashes * 2)}"`;
}
