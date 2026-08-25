import { intro, outro } from "@clack/prompts";
import {
  createFailureResult,
  createSuccessResult,
  formatHumanFailure,
  formatHumanSuccess,
  formatJsonResult,
} from "./cli-result.js";
import { createCreateCrocoAppProgram } from "./cli-program.js";
import { InvalidCliOptionProblem } from "./libs/problems/InvalidCliOptionProblem.js";
import type { GeneratorOptions } from "./types.js";
import type { CreateCrocoAppFailureContext, CreateCrocoAppRetryCommand } from "./cli-result.js";

export function createProgram(): ReturnType<typeof createCreateCrocoAppProgram> {
  return createCreateCrocoAppProgram().action(
    async (directory: string | undefined, rawOptions: Record<string, string | boolean>) => {
      const outputJson = rawOptions["json"] === true;
      let failureContext: CreateCrocoAppFailureContext | undefined;

      try {
        if (!outputJson) {
          intro("create-croco-app");
        }

        const {
          isNonInteractiveOptions,
          normalizeNonInteractiveOptions,
          parseCliOptions,
          validateCliOptions,
          validateResolvedOptions,
        } = await import("./options.js");
        const cliOptions = parseCliOptions(directory, rawOptions);
        validateCliOptions(cliOptions);

        if (outputJson && !isNonInteractiveOptions(cliOptions)) {
          throw new InvalidCliOptionProblem(
            "--json requires noninteractive create-croco-app options.",
            "Pass a target directory, --scope, and either --goal or --preset, or remove --json.",
            "--json",
          );
        }

        let options: GeneratorOptions;

        if (isNonInteractiveOptions(cliOptions)) {
          options = normalizeNonInteractiveOptions(cliOptions);
        } else {
          const { runPrompts } = await import("./prompts.js");
          // Interactive mode
          options = await runPrompts(cliOptions);
          validateResolvedOptions(options);
        }

        const targetDir = directory ?? options.projectName;
        failureContext = {
          targetDir,
          retryCommand: createRetryCommand(targetDir, rawOptions),
        };
        const { generate } = await import("./generator.js");
        await generate(targetDir, options, { outputMode: outputJson ? "json" : "human" });

        const result = createSuccessResult(targetDir, options);
        if (outputJson) {
          console.log(formatJsonResult(result));
        } else {
          outro(formatHumanSuccess(result));
        }
      } catch (err: unknown) {
        const result = createFailureResult(err, failureContext);
        console.error(outputJson ? formatJsonResult(result) : formatHumanFailure(result));
        process.exit(1);
      }
    },
  );
}

const RETRY_STRING_OPTIONS = [
  ["goal", "--goal"],
  ["preset", "--preset"],
  ["scope", "--scope"],
  ["saasProfile", "--saas-profile"],
  ["tenantModel", "--tenant-model"],
  ["api", "--api"],
  ["apiHosting", "--api-hosting"],
  ["webApps", "--web-apps"],
  ["backendDeploy", "--backend-deploy"],
  ["frontendDeploy", "--frontend-deploy"],
  ["ui", "--ui"],
  ["db", "--db"],
] as const;

function createRetryCommand(
  targetDir: string,
  rawOptions: Record<string, string | boolean>,
): CreateCrocoAppRetryCommand {
  const args = [targetDir];

  for (const [optionName, flag] of RETRY_STRING_OPTIONS) {
    const value = rawOptions[optionName];
    if (typeof value === "string") {
      args.push(flag, value);
    }
  }

  if (rawOptions["agentRules"] === false) args.push("--no-agent-rules");
  if (rawOptions["install"] === false) args.push("--no-install");
  if (rawOptions["git"] === false) args.push("--no-git");
  if (rawOptions["json"] === true) args.push("--json");

  return { command: "create-croco-app", args };
}
