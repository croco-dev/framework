import { intro, outro } from "@clack/prompts";
import { Command } from "commander";
import { generate } from "./generator.js";
import {
  isNonInteractiveOptions,
  normalizeNonInteractiveOptions,
  parseCliOptions,
  validateCliOptions,
  validateResolvedOptions,
} from "./options.js";
import { getPackageVersion } from "./package-version.js";
import { runPrompts } from "./prompts.js";
import type { GeneratorOptions } from "./types.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("create-croco-app")
    .description("Create a pnpm-based Croco application")
    .version(getPackageVersion())
    .argument("[directory]", "Target directory")
    .option("--preset <preset>", "Project preset (blank|ddd-api|ddd-fullstack|ddd-vike-fullstack)")
    .option("--scope <scope>", "Package scope (e.g. @myorg)")
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

        const cliOptions = parseCliOptions(directory, rawOptions);
        validateCliOptions(cliOptions);

        let options: GeneratorOptions;

        if (isNonInteractiveOptions(cliOptions)) {
          options = normalizeNonInteractiveOptions(cliOptions);
        } else {
          // Interactive mode
          options = await runPrompts(cliOptions);
          validateResolvedOptions(options);
        }

        const targetDir = directory ?? options.projectName;
        await generate(targetDir, options);

        outro(`Project created in ${targetDir} 🎉`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`\nError: ${message}`);
        process.exit(1);
      }
    });

  return program;
}
