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

export function createProgram(): ReturnType<typeof createCreateCrocoAppProgram> {
  return createCreateCrocoAppProgram().action(
    async (directory: string | undefined, rawOptions: Record<string, string | boolean>) => {
      const outputJson = rawOptions.json === true;

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
        const { generate } = await import("./generator.js");
        await generate(targetDir, options);

        const result = createSuccessResult(targetDir, options);
        if (outputJson) {
          console.log(formatJsonResult(result));
        } else {
          outro(formatHumanSuccess(result));
        }
      } catch (err: unknown) {
        const result = createFailureResult(err);
        console.error(outputJson ? formatJsonResult(result) : formatHumanFailure(result));
        process.exit(1);
      }
    },
  );
}
