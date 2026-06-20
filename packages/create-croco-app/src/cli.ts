import { intro, outro } from "@clack/prompts";
import { Problem } from "@croco/problems-core";
import { Command } from "commander";
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
      "Project preset (blank|ddd-api|ddd-fullstack|ddd-vike-fullstack|production-app|admin-console|saas|ai-saas)",
    )
    .option("--scope <scope>", "Package scope (e.g. @myorg)")
    .option(
      "--saas-profile <profile>",
      `Production SaaS provider profile (${formatSaasProviderProfileChoices()})`,
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
    .action(async (directory: string | undefined, rawOptions: Record<string, string | boolean>) => {
      try {
        intro("create-croco-app");

        const {
          isNonInteractiveOptions,
          normalizeNonInteractiveOptions,
          parseCliOptions,
          validateCliOptions,
          validateResolvedOptions,
        } = await import("./options.js");
        const cliOptions = parseCliOptions(directory, rawOptions);
        validateCliOptions(cliOptions);

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

        outro(`Project created in ${targetDir} 🎉`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof Problem) {
          console.error(`\nError [${err.code}]: ${message}`);
          const recovery = readRecovery(err.extensions);
          if (recovery) {
            console.error(`Recovery: ${recovery}`);
          }
        } else {
          console.error(`\nError: ${message}`);
        }
        process.exit(1);
      }
    });

  return program;
}

function readRecovery(extensions: Problem["extensions"]): string | undefined {
  const recovery = extensions?.recovery;

  return typeof recovery === "string" ? recovery : undefined;
}
