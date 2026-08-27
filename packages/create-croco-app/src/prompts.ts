import * as p from "@clack/prompts";
import {
  DEFAULT_TENANT_MODEL,
  TENANT_MODEL_NAMES,
  getTenantModelDefinition,
} from "@croco/tenant-core/tenant-model";
import pc from "picocolors";
import { GOAL_SPECS, readGoal, resolveGoalOptions } from "./goals.js";
import { parseWebAppNames } from "./helpers/validate.js";
import {
  assertUiCompatibility,
  assertUiPresetCompatibility,
  assertValidWebAppNames,
  validateResolvedOptions,
} from "./options.js";
import {
  DEFAULT_SAAS_PROVIDER_PROFILE,
  SAAS_PROVIDER_PROFILE_CHOICES,
} from "./saas-provider-profiles.js";
import type { GeneratorOptions, NormalizedGeneratorOptions } from "./types.js";

export async function runPrompts(cliArgs: NormalizedGeneratorOptions): Promise<GeneratorOptions> {
  p.intro(pc.bgCyan(pc.black(" create-croco-app ")));

  // 1. projectName
  const projectName =
    cliArgs.projectName ??
    (await p.text({
      message: "What is the project name?",
      placeholder: "my-app",
      validate(value) {
        if (!value) return "Project name is required";
        if (!/^[a-z0-9-_]+$/.test(value))
          return "Only lowercase letters, numbers, hyphens, underscores";
        return undefined;
      },
    }));
  if (p.isCancel(projectName)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // 2. scope
  const scope =
    cliArgs.scope ??
    (await p.text({
      message: "Package scope?",
      placeholder: "@myorg",
      validate(value) {
        if (value && !value.startsWith("@")) return "Scope must start with @";
        return undefined;
      },
    }));
  if (p.isCancel(scope)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  const goal =
    cliArgs.goal ??
    (cliArgs.preset
      ? undefined
      : await p.select({
          message: "Select an app goal:",
          options: [
            ...Object.entries(GOAL_SPECS).map(([value, spec]) => ({
              value,
              label: spec.label,
              hint: spec.hint,
            })),
            {
              value: "custom-preset",
              label: "Custom technology preset",
              hint: "Choose the lower-level preset, protocol, hosting, deploy, and database options",
            },
          ],
        }));
  if (p.isCancel(goal)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  if (goal && goal !== "custom-preset") {
    const agentRules =
      cliArgs.agentRules ??
      (await p.confirm({
        message: "Add AI agent rules? (.cursor/rules, AGENTS.md)",
        initialValue: true,
      }));
    if (p.isCancel(agentRules)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    const installDeps =
      cliArgs.installDeps ?? (await p.confirm({ message: "Install dependencies?" }));
    if (p.isCancel(installDeps)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    const initGit = cliArgs.initGit ?? (await p.confirm({ message: "Initialize git repository?" }));
    if (p.isCancel(initGit)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    p.outro(pc.green("✓ Project configuration complete"));

    return resolveGoalOptions(projectName as string, scope as string, readGoal(goal as string), {
      ...cliArgs,
      agentRules: agentRules as boolean,
      installDeps: installDeps as boolean,
      initGit: initGit as boolean,
    });
  }

  // 3. preset
  const preset =
    cliArgs.preset ??
    (await p.select({
      message: "Select a project preset:",
      options: [
        { value: "blank", label: "Blank", hint: "Empty monorepo structure" },
        {
          value: "ddd-api",
          label: "DDD API",
          hint: "Basic DDD skeleton (Drizzle ORM + env utils)",
        },
        { value: "ddd-fullstack", label: "DDD Fullstack", hint: "API + Web frontend" },
        {
          value: "ddd-vike-fullstack",
          label: "DDD Worker Fullstack",
          hint: "Legacy preset name; generates meta-vite API and SSR Workers",
        },
        {
          value: "production-app",
          label: "Production App",
          hint: "REST API + React SPA with telemetry, Problems, smoke checks, and Lambda entrypoint",
        },
        {
          value: "admin-console",
          label: "Admin Console",
          hint: "REST API + generated client React admin console with Problem and operations panels",
        },
        {
          value: "saas",
          label: "SaaS Golden Path",
          hint: "Tenant, auth, access, billing, metering, entitlements demo",
        },
        {
          value: "ai-saas",
          label: "AI SaaS Golden Path",
          hint: "SaaS baseline plus tenant-metered LLM proxy demo",
        },
      ],
    }));
  if (p.isCancel(preset)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  if (cliArgs.ui !== undefined) {
    assertUiPresetCompatibility({
      preset: preset as GeneratorOptions["preset"],
      ui: cliArgs.ui,
    });
  }

  // blank preset: return early with defaults
  if (preset === "blank") {
    const installDeps =
      cliArgs.installDeps ?? (await p.confirm({ message: "Install dependencies?" }));
    if (p.isCancel(installDeps)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }
    const initGit = cliArgs.initGit ?? (await p.confirm({ message: "Initialize git repository?" }));
    if (p.isCancel(initGit)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    p.outro(pc.green("✓ Project configuration complete"));
    return {
      projectName: projectName as string,
      scope: scope as string,
      preset: "blank",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: installDeps as boolean,
      initGit: initGit as boolean,
    };
  }

  if (
    preset === "production-app" ||
    preset === "admin-console" ||
    preset === "saas" ||
    preset === "ai-saas"
  ) {
    const saasProviderProfile =
      preset === "saas" || preset === "ai-saas"
        ? (cliArgs.saasProviderProfile ??
          (await p.select({
            message: "Select a production SaaS provider profile:",
            initialValue: DEFAULT_SAAS_PROVIDER_PROFILE,
            options: SAAS_PROVIDER_PROFILE_CHOICES.map((value) => ({
              value,
              label: value,
              ...(value === DEFAULT_SAAS_PROVIDER_PROFILE ? { hint: "Node/Postgres default" } : {}),
            })),
          })))
        : undefined;
    if (p.isCancel(saasProviderProfile)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    const tenantModel =
      preset === "saas" || preset === "ai-saas"
        ? (cliArgs.tenantModel ??
          (await p.select({
            message: "Select a tenant model:",
            initialValue: DEFAULT_TENANT_MODEL,
            options: TENANT_MODEL_NAMES.map((value) => {
              const definition = getTenantModelDefinition(value);

              return {
                value,
                label: definition.displayName,
                hint:
                  value === DEFAULT_TENANT_MODEL
                    ? "Default SaaS organization model"
                    : definition.summary,
              };
            }),
          })))
        : undefined;
    if (p.isCancel(tenantModel)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    const agentRules =
      cliArgs.agentRules ??
      (await p.confirm({
        message: "Add AI agent rules? (.cursor/rules, AGENTS.md)",
        initialValue: true,
      }));
    if (p.isCancel(agentRules)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    const installDeps =
      cliArgs.installDeps ?? (await p.confirm({ message: "Install dependencies?" }));
    if (p.isCancel(installDeps)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    const initGit = cliArgs.initGit ?? (await p.confirm({ message: "Initialize git repository?" }));
    if (p.isCancel(initGit)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    p.outro(pc.green("✓ Project configuration complete"));
    const options: NormalizedGeneratorOptions = {
      projectName: projectName as string,
      scope: scope as string,
      preset: preset as "production-app" | "admin-console" | "saas" | "ai-saas",
      saasProviderProfile:
        preset === "saas" || preset === "ai-saas"
          ? (saasProviderProfile as GeneratorOptions["saasProviderProfile"])
          : undefined,
      tenantModel:
        preset === "saas" || preset === "ai-saas"
          ? (tenantModel as GeneratorOptions["tenantModel"])
          : undefined,
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: agentRules as boolean,
      installDeps: installDeps as boolean,
      initGit: initGit as boolean,
    };

    return validateResolvedOptions(options);
  }

  // 4. webApps (fullstack only)
  let webApps: string[] = cliArgs.webApps ?? [];
  if (preset === "ddd-fullstack" && (!cliArgs.webApps || cliArgs.webApps.length === 0)) {
    const webAppsInput = await p.text({
      message: "Web app names? (comma-separated)",
      placeholder: "web",
      initialValue: "web",
    });
    if (p.isCancel(webAppsInput)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }
    webApps = parseWebAppNames(webAppsInput as string);
    assertValidWebAppNames(webApps);
  }

  // 5. api type
  const api =
    cliArgs.api ??
    (await p.select({
      message: "Select API type:",
      options: [
        { value: "graphql", label: "GraphQL", hint: "type-graphql + Apollo Server" },
        { value: "trpc", label: "tRPC", hint: "Type-safe RPC" },
      ],
    }));
  if (p.isCancel(api)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // 6. apiHosting — 역방향 가드: webApps >= 2 → standalone 강제
  let apiHosting: "standalone" | "nextjs" = "standalone";
  if (webApps.length >= 2) {
    p.note("Multiple web apps detected — API hosting forced to Standalone", "Auto-selected");
    apiHosting = "standalone";
  } else if (preset === "ddd-fullstack" && webApps.length === 1) {
    const hostingChoice =
      cliArgs.apiHosting ??
      (await p.select({
        message: "Where to host the API?",
        options: [
          { value: "standalone", label: "Standalone", hint: "Separate API server process" },
          { value: "nextjs", label: "Next.js API Route", hint: "Bundled with web app" },
        ],
      }));
    if (p.isCancel(hostingChoice)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }
    apiHosting = hostingChoice as "standalone" | "nextjs";
  } else if (preset === "ddd-api" || preset === "ddd-vike-fullstack") {
    // If ddd-api preset is selected, apiHosting is standalone
    apiHosting = "standalone";
  }

  // 7. backendDeploy (standalone only)
  let backendDeploy: "docker" | "lambda" | undefined;
  if (apiHosting === "standalone") {
    const deployChoice =
      cliArgs.backendDeploy ??
      (await p.select({
        message: "Backend deployment target:",
        initialValue: "lambda",
        options: [
          { value: "docker", label: "Docker", hint: "Containerized deployment" },
          { value: "lambda", label: "AWS Lambda (SST v3)", hint: "Serverless" },
        ],
      }));
    if (p.isCancel(deployChoice)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }
    backendDeploy = deployChoice as "docker" | "lambda";
  }

  // 8. frontendDeploy (fullstack only)
  let frontendDeploy:
    | "opennext"
    | "vercel"
    | "docker"
    | "cloudflare-meta-vite"
    | "vite-spa"
    | undefined;
  if (preset === "ddd-fullstack" || preset === "ddd-vike-fullstack") {
    const frontendChoice =
      cliArgs.frontendDeploy ??
      (await p.select({
        message: "Frontend deployment target:",
        options: [
          { value: "opennext", label: "OpenNext (Cloudflare)", hint: "Edge deployment" },
          {
            value: "cloudflare-meta-vite",
            label: "Cloudflare Meta Vite",
            hint: "SSR Worker deployment",
          },
          { value: "vite-spa", label: "Vite SPA", hint: "Browser SPA deployment" },
          { value: "vercel", label: "Vercel", hint: "Vercel platform" },
          { value: "docker", label: "Docker", hint: "Containerized" },
        ],
      }));
    if (p.isCancel(frontendChoice)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }
    frontendDeploy = frontendChoice as NonNullable<GeneratorOptions["frontendDeploy"]>;
  }

  if (cliArgs.ui !== undefined) {
    assertUiCompatibility({ ...(frontendDeploy ? { frontendDeploy } : {}), ui: cliArgs.ui });
  }

  // 9. UI profile (Vite SPA only)
  let ui: GeneratorOptions["ui"];
  if (frontendDeploy === "vite-spa") {
    const uiChoice =
      cliArgs.ui ??
      (await p.select({
        message: "UI profile:",
        initialValue: "none",
        options: [
          { value: "none", label: "None", hint: "Provider-neutral React starter" },
          {
            value: "astryx",
            label: "Astryx",
            hint: "Beta StyleX design-system profile",
          },
        ],
      }));
    if (p.isCancel(uiChoice)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }
    ui = uiChoice as NonNullable<GeneratorOptions["ui"]>;
  }

  // 10. db
  const db =
    cliArgs.db && cliArgs.db.length > 0
      ? cliArgs.db
      : await p.multiselect({
          message: "Select databases:",
          options: [
            { value: "postgres", label: "PostgreSQL", hint: "Relational (Drizzle ORM)" },
            { value: "mongodb", label: "MongoDB", hint: "Document store" },
            { value: "redis", label: "Redis", hint: "Cache / pub-sub" },
          ],
          required: false,
        });
  if (p.isCancel(db)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // 10. agentRules
  const agentRules =
    cliArgs.agentRules ??
    (await p.confirm({
      message: "Add AI agent rules? (.cursor/rules, AGENTS.md)",
      initialValue: true,
    }));
  if (p.isCancel(agentRules)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // 11. installDeps
  const installDeps =
    cliArgs.installDeps ?? (await p.confirm({ message: "Install dependencies?" }));
  if (p.isCancel(installDeps)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // 12. initGit
  const initGit = cliArgs.initGit ?? (await p.confirm({ message: "Initialize git repository?" }));
  if (p.isCancel(initGit)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  p.outro(pc.green("✓ Project configuration complete"));

  const options: NormalizedGeneratorOptions = {
    projectName: projectName as string,
    scope: scope as string,
    preset: preset as GeneratorOptions["preset"],
    webApps,
    api: api as GeneratorOptions["api"],
    apiHosting,
    backendDeploy,
    frontendDeploy,
    ...(ui === undefined ? {} : { ui }),
    db: db as GeneratorOptions["db"],
    agentRules: agentRules as boolean,
    installDeps: installDeps as boolean,
    initGit: initGit as boolean,
  };

  return validateResolvedOptions(options);
}
