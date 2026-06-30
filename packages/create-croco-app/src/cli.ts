import { intro, outro } from "@clack/prompts";
import { Command } from "commander";
import {
  createFailureResult,
  createSuccessResult,
  formatHumanFailure,
  formatHumanSuccess,
  formatJsonResult,
} from "./cli-result.js";
import { InvalidCliOptionProblem } from "./libs/problems/InvalidCliOptionProblem.js";
import { getPackageVersion } from "./package-version.js";
import { formatSaasProviderProfileChoices } from "./saas-provider-profiles.js";
import type { GeneratorOptions } from "./types.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("create-croco-app")
    .description("Create a pnpm-based Croco application")
    .version(getPackageVersion())
    .argument("[directory]", "Target directory")
    .option(
      "--goal <goal>",
      "App goal (saas-api|spa-backend-split|worker|internal-tool). Chooses the supported stack and writes croco.app.json",
    )
    .option(
      "--preset <preset>",
      [
        "Project preset (blank|ddd-api|ddd-fullstack|ddd-vike-fullstack|production-app|admin-console|saas|ai-saas).",
        "ddd-vike-fullstack is a legacy compatibility name for the meta-vite Worker profile",
      ].join(" "),
    )
    .option("--scope <scope>", "Package scope (e.g. @myorg)")
    .option(
      "--saas-profile <profile>",
      `Production SaaS provider profile (${formatSaasProviderProfileChoices()})`,
    )
    .option(
      "--tenant-model <model>",
      "SaaS tenant model (single|org|workspace|shared-schema|rls-backed)",
    )
    .option("--api <api>", "API type (graphql|trpc)")
    .option("--api-hosting <hosting>", "API hosting (standalone|nextjs)")
    .option("--web-apps <apps>", "Comma-separated web app names")
    .option("--backend-deploy <deploy>", "Backend deploy (docker|lambda)")
    .option(
      "--frontend-deploy <deploy>",
      "Frontend deploy (opennext|vercel|docker|cloudflare-meta-vite|vite-spa)",
    )
    .option("--db <dbs>", "Comma-separated DB types (postgres,mongodb,redis)")
    .option("--no-agent-rules", "Skip agent rules")
    .option("--no-install", "Skip pnpm dependency installation")
    .option("--no-git", "Skip git initialization")
    .option("--json", "Print a machine-readable JSON result")
    .action(async (directory: string | undefined, rawOptions: Record<string, string | boolean>) => {
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
    });

  return program;
}
