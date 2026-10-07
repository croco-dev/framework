import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineCommand } from "citty";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";

type PipelineAction = "validate" | "preview" | "run" | "retry" | "status";

type PipelineOperations = {
  validate(): unknown;
  preview(): unknown;
  run(): unknown;
  retry(runId: string): unknown;
  status(runId: string): unknown;
};

class InvalidPipelineCommandProblem extends Problem {
  constructor(detail: string) {
    super("CROCO_CLI_PIPELINE_INVALID_CONFIG", ProblemCategory.BadRequest, detail);
  }
}

function createPipelineAction(action: PipelineAction) {
  const requiresRun = action === "retry" || action === "status";
  return defineCommand({
    meta: { name: action, description: `${action} an application-owned data pipeline` },
    args: {
      config: {
        type: "string",
        required: true,
        description: "Module exporting the pipelines registry",
      },
      pipeline: { type: "string", required: true, description: "Application pipeline ID" },
      cwd: { type: "string", description: "Working directory for the config module" },
      ...(requiresRun
        ? { run: { type: "string" as const, required: true, description: "Existing execution ID" } }
        : {}),
    },
    async run({ args, rawArgs }) {
      validateArguments(rawArgs, requiresRun);
      const runtime = getCrocoCommandRuntime();
      const cwd = typeof args.cwd === "string" ? resolve(runtime.cwd, args.cwd) : runtime.cwd;
      const config = requiredString(args.config, "--config");
      const pipelineId = requiredString(args.pipeline, "--pipeline");
      if (requiresRun) requiredString(args["run"], "--run");
      const module: unknown = await import(pathToFileURL(resolve(cwd, config)).href);
      const operations = readPipelineOperations(module, pipelineId);
      const result = await (action === "retry" || action === "status"
        ? operations[action](requiredString(args["run"], "--run"))
        : operations[action]());
      const output = JSON.stringify(result, null, 2);
      if (output === undefined) {
        throw new InvalidPipelineCommandProblem(`Pipeline ${action} returned no report`);
      }
      runtime.stdout(output);
    },
  });
}

export const pipeline = defineCommand({
  meta: {
    name: "pipeline",
    description: "Validate, preview, execute and inspect application data pipelines",
  },
  setup({ rawArgs }) {
    if (rawArgs[0]?.startsWith("-")) {
      throw new InvalidPipelineCommandProblem(
        "Pipeline options must follow the pipeline subcommand",
      );
    }
  },
  subCommands: {
    validate: createPipelineAction("validate"),
    preview: createPipelineAction("preview"),
    run: createPipelineAction("run"),
    retry: createPipelineAction("retry"),
    status: createPipelineAction("status"),
  },
});

function validateArguments(rawArgs: readonly string[], requiresRun: boolean): void {
  const flags = new Set(["--config", "--pipeline", "--cwd", ...(requiresRun ? ["--run"] : [])]);
  for (let index = 0; index < rawArgs.length; index++) {
    const token = rawArgs[index];
    if (token === undefined) continue;
    const separator = token.indexOf("=");
    const flag = separator === -1 ? token : token.slice(0, separator);
    if (!flags.has(flag)) {
      throw new InvalidPipelineCommandProblem(`Unexpected pipeline argument: ${token}`);
    }
    const value = separator === -1 ? rawArgs[++index] : token.slice(separator + 1);
    if (value === undefined || value.trim() === "" || value.startsWith("--")) {
      throw new InvalidPipelineCommandProblem(`${flag} requires a value`);
    }
  }
}

function requiredString(value: unknown, flag: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidPipelineCommandProblem(`${flag} requires a value`);
  }
  return value;
}

function readPipelineOperations(module: unknown, pipelineId: string): PipelineOperations {
  if (!isRecord(module) || !isRecord(module["pipelines"])) {
    throw new InvalidPipelineCommandProblem("Config module must export a pipelines registry");
  }
  if (!Object.hasOwn(module["pipelines"], pipelineId)) {
    throw new InvalidPipelineCommandProblem(`Unknown pipeline: ${pipelineId}`);
  }
  const operations = module["pipelines"][pipelineId];
  if (
    !isRecord(operations) ||
    !["validate", "preview", "run", "retry", "status"].every(
      (method) => typeof operations[method] === "function",
    )
  ) {
    throw new InvalidPipelineCommandProblem(
      `Pipeline ${pipelineId} must provide validate, preview, run, retry and status`,
    );
  }
  return operations as PipelineOperations;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
