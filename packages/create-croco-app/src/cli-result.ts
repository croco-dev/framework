import { Problem, ProblemCategory, type ProblemDetails } from "@croco/problems-core";
import { GENERATED_NODE_ENGINE_RANGE, GENERATED_NODE_VERSION } from "./node-runtime.js";
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
  readonly nextSteps: readonly string[];
};

export type CreateCrocoAppFailureResult = {
  readonly ok: false;
  readonly code: string;
  readonly unexpected: boolean;
  readonly diagnostic: ProblemDetails;
  readonly recovery?: string;
};

export type CreateCrocoAppResult = CreateCrocoAppSuccessResult | CreateCrocoAppFailureResult;

class UnexpectedCliFailureProblem extends Problem {
  readonly code = "create-croco-app/unexpected-failure";
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string, cause?: Error) {
    super(undefined, undefined, detail, {
      cause,
      extensions: {
        recovery:
          "Inspect the unexpected error, fix the underlying cause, and rerun create-croco-app.",
      },
    });
  }
}

export function createSuccessResult(
  targetDir: string,
  options: GeneratorOptions,
): CreateCrocoAppSuccessResult {
  return {
    ok: true,
    code: "create-croco-app/project-created",
    targetDir,
    projectName: options.projectName,
    preset: options.preset,
    packageManager: "pnpm",
    nodeRequirement: GENERATED_NODE_ENGINE_RANGE,
    nodeRecovery: `Run nvm install ${GENERATED_NODE_VERSION} && nvm use ${GENERATED_NODE_VERSION}.`,
    nextSteps: createNextStepCommands(targetDir, options),
  };
}

export function createFailureResult(error: unknown): CreateCrocoAppFailureResult {
  const problem = toCliProblem(error);
  const recovery = readRecovery(problem.extensions);

  return {
    ok: false,
    code: problem.code,
    unexpected: problem instanceof UnexpectedCliFailureProblem,
    diagnostic: problem.toJSON(),
    ...(recovery ? { recovery } : {}),
  };
}

export function formatHumanSuccess(result: CreateCrocoAppSuccessResult): string {
  return [
    `Project created in ${result.targetDir}.`,
    `Node.js ${result.nodeRequirement} is required for install and build. Recovery: ${result.nodeRecovery}`,
    "Next steps:",
    ...result.nextSteps.map((command) => `  ${command}`),
  ].join("\n");
}

export function formatHumanFailure(result: CreateCrocoAppFailureResult): string {
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

  return `\n${lines.join("\n")}`;
}

export function formatJsonResult(result: CreateCrocoAppResult): string {
  return JSON.stringify(result, null, 2);
}

function createNextStepCommands(targetDir: string, options: GeneratorOptions): string[] {
  const commands = [`cd ${quoteShellArg(targetDir)}`];

  if (!options.installDeps) {
    commands.push("pnpm install");
  }

  commands.push(resolveRunCommand(options));

  return commands;
}

function resolveRunCommand(options: GeneratorOptions): string {
  if (options.preset === "saas" || options.preset === "ai-saas") {
    return "pnpm dev:api";
  }

  return "pnpm dev";
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

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }

  return `'${value.split("'").join("'\\''")}'`;
}
