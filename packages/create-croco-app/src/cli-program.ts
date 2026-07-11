import { Command } from "commander";
import { getPackageVersion } from "./package-version.js";
import { formatSaasProviderProfileChoices } from "./saas-provider-profiles.js";

export function createCreateCrocoAppProgram(): Command {
  return configureCreateCrocoAppProgram(new Command());
}

export function configureCreateCrocoAppProgram(program: Command): Command {
  return program
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
    .option("--json", "Print a machine-readable JSON result");
}
