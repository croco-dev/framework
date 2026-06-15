import { validateProjectName } from "./helpers/validate.js";
import { SUPPORTED_CREATE_CROCO_APP_CHOICES } from "./supported-options.js";
import type { GeneratorOptions } from "./types.js";

const PRESETS = SUPPORTED_CREATE_CROCO_APP_CHOICES.presets;
const APIS = SUPPORTED_CREATE_CROCO_APP_CHOICES.apis;
const API_HOSTING = SUPPORTED_CREATE_CROCO_APP_CHOICES.apiHosting;
const BACKEND_DEPLOYS = SUPPORTED_CREATE_CROCO_APP_CHOICES.backendDeploys;
const FRONTEND_DEPLOYS = SUPPORTED_CREATE_CROCO_APP_CHOICES.frontendDeploys;
const DATABASES = SUPPORTED_CREATE_CROCO_APP_CHOICES.databases;

type ChoiceName = "preset" | "api" | "api-hosting" | "backend-deploy" | "frontend-deploy" | "db";

type RawCliOptions = Record<string, string | boolean | undefined>;

export function parseCliOptions(
  directory: string | undefined,
  rawOptions: RawCliOptions,
): Partial<GeneratorOptions> {
  const cliOptions: Partial<GeneratorOptions> = {};

  if (directory) cliOptions.projectName = directory.split("/").at(-1) ?? directory;
  if (typeof rawOptions.preset === "string")
    cliOptions.preset = rawOptions.preset as GeneratorOptions["preset"];
  if (typeof rawOptions.scope === "string") cliOptions.scope = rawOptions.scope;
  if (typeof rawOptions.api === "string")
    cliOptions.api = rawOptions.api as GeneratorOptions["api"];
  if (typeof rawOptions.apiHosting === "string") {
    cliOptions.apiHosting = rawOptions.apiHosting as GeneratorOptions["apiHosting"];
  }
  if (typeof rawOptions.webApps === "string") {
    cliOptions.webApps = rawOptions.webApps
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof rawOptions.backendDeploy === "string") {
    cliOptions.backendDeploy = rawOptions.backendDeploy as GeneratorOptions["backendDeploy"];
  }
  if (typeof rawOptions.frontendDeploy === "string") {
    cliOptions.frontendDeploy = rawOptions.frontendDeploy as GeneratorOptions["frontendDeploy"];
  }
  if (typeof rawOptions.db === "string") {
    cliOptions.db = rawOptions.db
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as GeneratorOptions["db"];
  }
  if (rawOptions.agentRules === false) cliOptions.agentRules = false;
  if (rawOptions.install === false) cliOptions.installDeps = false;
  if (rawOptions.git === false) cliOptions.initGit = false;

  return cliOptions;
}

export function isNonInteractiveOptions(cliOptions: Partial<GeneratorOptions>): boolean {
  return !!cliOptions.preset && !!cliOptions.scope && !!cliOptions.projectName;
}

export function validateCliOptions(cliOptions: Partial<GeneratorOptions>): void {
  if (cliOptions.projectName !== undefined) {
    const error = validateProjectName(cliOptions.projectName);
    if (error) throw new Error(error);
  }

  if (cliOptions.scope !== undefined && cliOptions.scope === "") {
    throw new Error("Package scope is required");
  }
  if (cliOptions.scope && !cliOptions.scope.startsWith("@")) {
    throw new Error("Scope must start with @");
  }

  if (cliOptions.preset !== undefined) readChoice("preset", cliOptions.preset, PRESETS);
  if (cliOptions.api !== undefined) readChoice("api", cliOptions.api, APIS);
  if (cliOptions.apiHosting !== undefined)
    readChoice("api-hosting", cliOptions.apiHosting, API_HOSTING);
  if (cliOptions.backendDeploy !== undefined)
    readChoice("backend-deploy", cliOptions.backendDeploy, BACKEND_DEPLOYS);
  if (cliOptions.frontendDeploy !== undefined) {
    readChoice("frontend-deploy", cliOptions.frontendDeploy, FRONTEND_DEPLOYS);
  }
  for (const db of cliOptions.db ?? []) {
    readChoice("db", db, DATABASES);
  }
}

export function validateResolvedOptions(options: GeneratorOptions): void {
  const error = validateProjectName(options.projectName);
  if (error) throw new Error(error);

  if (!options.scope) throw new Error("Package scope is required");
  if (!options.scope.startsWith("@")) throw new Error("Scope must start with @");

  readChoice("preset", options.preset, PRESETS);
  readChoice("api-hosting", options.apiHosting, API_HOSTING);
  if (options.api) readChoice("api", options.api, APIS);
  if (options.backendDeploy) readChoice("backend-deploy", options.backendDeploy, BACKEND_DEPLOYS);
  if (options.frontendDeploy)
    readChoice("frontend-deploy", options.frontendDeploy, FRONTEND_DEPLOYS);
  for (const db of options.db) {
    readChoice("db", db, DATABASES);
  }

  if (options.preset === "blank") {
    if (options.api) throw new Error("--api is not supported with the blank preset");
    if (options.backendDeploy)
      throw new Error("--backend-deploy is not supported with the blank preset");
    if (options.frontendDeploy)
      throw new Error("--frontend-deploy is not supported with the blank preset");
    if (options.webApps.length > 0) {
      throw new Error("--web-apps is not supported with the blank preset");
    }
    if (options.db.length > 0) {
      throw new Error("--db is not supported with the blank preset");
    }
    return;
  }

  if (options.preset === "ddd-api") {
    if (!options.api) throw new Error("--api is required for ddd-api and ddd-fullstack");
    if (options.webApps.length > 0) {
      throw new Error("--web-apps is only supported with the ddd-fullstack preset");
    }
    if (options.apiHosting !== "standalone") {
      throw new Error("--api-hosting nextjs is only supported with ddd-fullstack");
    }
    if (options.frontendDeploy) {
      throw new Error("--frontend-deploy is only supported with fullstack presets");
    }
    return;
  }

  if (options.preset === "ddd-fullstack") {
    if (!options.api) throw new Error("--api is required for ddd-api and ddd-fullstack");
    if (options.apiHosting === "nextjs" && options.webApps.length !== 1) {
      throw new Error("--api-hosting nextjs requires exactly one web app");
    }
    if (options.apiHosting === "nextjs" && options.backendDeploy) {
      throw new Error("--backend-deploy is only supported with standalone API hosting");
    }
    return;
  }

  if (options.frontendDeploy !== "cloudflare-meta-vite") {
    throw new Error("ddd-vike-fullstack only supports --frontend-deploy cloudflare-meta-vite");
  }
}

export function normalizeNonInteractiveOptions(
  cliOptions: Partial<GeneratorOptions>,
): GeneratorOptions {
  validateCliOptions(cliOptions);

  const projectName = requireOption(cliOptions.projectName, "Project name is required");
  const scope = requireOption(cliOptions.scope, "Package scope is required");
  const preset = readChoice(
    "preset",
    requireOption(cliOptions.preset, "Project preset is required"),
    PRESETS,
  );

  if (preset === "blank") {
    assertBlankOptions(cliOptions);

    return {
      projectName,
      scope,
      preset,
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: cliOptions.agentRules ?? false,
      installDeps: cliOptions.installDeps ?? true,
      initGit: cliOptions.initGit ?? true,
    };
  }

  const db = cliOptions.db ?? [];
  const webApps = preset === "ddd-fullstack" ? normalizeFullstackWebApps(cliOptions.webApps) : [];
  const apiHosting = normalizeApiHosting(preset, webApps, cliOptions.apiHosting);
  const backendDeploy = normalizeBackendDeploy(apiHosting, cliOptions.backendDeploy);
  const frontendDeploy = normalizeFrontendDeploy(preset, cliOptions.frontendDeploy);

  if (preset === "ddd-api" && cliOptions.webApps && cliOptions.webApps.length > 0) {
    throw new Error("--web-apps is only supported with the ddd-fullstack preset");
  }

  const api =
    preset === "ddd-vike-fullstack"
      ? undefined
      : readChoice(
          "api",
          requireOption(cliOptions.api, "--api is required for ddd-api and ddd-fullstack"),
          APIS,
        );

  const options: GeneratorOptions = {
    projectName,
    scope,
    preset,
    webApps,
    api,
    apiHosting,
    backendDeploy,
    frontendDeploy,
    db,
    agentRules: cliOptions.agentRules ?? true,
    installDeps: cliOptions.installDeps ?? true,
    initGit: cliOptions.initGit ?? true,
  };

  validateResolvedOptions(options);

  return options;
}

function assertBlankOptions(cliOptions: Partial<GeneratorOptions>): void {
  if (cliOptions.api) throw new Error("--api is not supported with the blank preset");
  if (cliOptions.apiHosting)
    throw new Error("--api-hosting is not supported with the blank preset");
  if (cliOptions.backendDeploy)
    throw new Error("--backend-deploy is not supported with the blank preset");
  if (cliOptions.frontendDeploy)
    throw new Error("--frontend-deploy is not supported with the blank preset");
  if (cliOptions.webApps && cliOptions.webApps.length > 0) {
    throw new Error("--web-apps is not supported with the blank preset");
  }
  if (cliOptions.db && cliOptions.db.length > 0) {
    throw new Error("--db is not supported with the blank preset");
  }
}

function normalizeFullstackWebApps(webApps: string[] | undefined): string[] {
  return webApps && webApps.length > 0 ? webApps : ["web"];
}

function normalizeApiHosting(
  preset: GeneratorOptions["preset"],
  webApps: string[],
  apiHosting: GeneratorOptions["apiHosting"] | undefined,
): GeneratorOptions["apiHosting"] {
  if (preset === "ddd-api" || preset === "ddd-vike-fullstack") {
    if (apiHosting && apiHosting !== "standalone") {
      throw new Error("--api-hosting nextjs is only supported with ddd-fullstack");
    }
    return "standalone";
  }

  const resolvedApiHosting = apiHosting ?? "standalone";
  if (resolvedApiHosting === "nextjs" && webApps.length !== 1) {
    throw new Error("--api-hosting nextjs requires exactly one web app");
  }

  return resolvedApiHosting;
}

function normalizeBackendDeploy(
  apiHosting: GeneratorOptions["apiHosting"],
  backendDeploy: GeneratorOptions["backendDeploy"] | undefined,
): GeneratorOptions["backendDeploy"] | undefined {
  if (apiHosting === "nextjs" && backendDeploy) {
    throw new Error("--backend-deploy is only supported with standalone API hosting");
  }

  return backendDeploy;
}

function normalizeFrontendDeploy(
  preset: GeneratorOptions["preset"],
  frontendDeploy: GeneratorOptions["frontendDeploy"] | undefined,
): GeneratorOptions["frontendDeploy"] | undefined {
  if (preset === "ddd-api" && frontendDeploy) {
    throw new Error("--frontend-deploy is only supported with fullstack presets");
  }

  if (preset === "ddd-vike-fullstack") {
    if (!frontendDeploy) {
      throw new Error("--frontend-deploy cloudflare-meta-vite is required for ddd-vike-fullstack");
    }
    if (frontendDeploy !== "cloudflare-meta-vite") {
      throw new Error("ddd-vike-fullstack only supports --frontend-deploy cloudflare-meta-vite");
    }
  }

  return frontendDeploy;
}

function requireOption<T>(value: T | undefined, message: string): T {
  if (value === undefined || value === "") throw new Error(message);

  return value;
}

function readChoice<T extends string>(name: ChoiceName, value: string, allowed: readonly T[]): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;

  throw new Error(`Invalid --${name} value "${value}". Expected ${formatChoices(allowed)}.`);
}

function formatChoices(choices: readonly string[]): string {
  if (choices.length <= 1) return choices.join("");

  return `${choices.slice(0, -1).join(", ")} or ${choices.at(-1)}`;
}
