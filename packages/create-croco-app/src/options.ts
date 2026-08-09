import { DEFAULT_TENANT_MODEL } from "@croco/tenant-core/tenant-model";
import { validateProjectName } from "./helpers/validate.js";
import {
  readGoal,
  resolveGoalOptions,
  validateGoalCliOptions,
  validateResolvedGoalOptions,
} from "./goals.js";
import { InvalidCliOptionProblem } from "./libs/problems/InvalidCliOptionProblem.js";
import { InvalidSaasPresetOptionProblem } from "./libs/problems/InvalidSaasPresetOptionProblem.js";
import {
  DEFAULT_SAAS_PROVIDER_PROFILE,
  getSaasProviderProfileDefinition,
} from "./saas-provider-profiles.js";
import { SUPPORTED_CREATE_CROCO_APP_CHOICES } from "./supported-options.js";
import type { GeneratorOptions } from "./types.js";

const PRESETS = SUPPORTED_CREATE_CROCO_APP_CHOICES.presets;
const APIS = SUPPORTED_CREATE_CROCO_APP_CHOICES.apis;
const API_HOSTING = SUPPORTED_CREATE_CROCO_APP_CHOICES.apiHosting;
const BACKEND_DEPLOYS = SUPPORTED_CREATE_CROCO_APP_CHOICES.backendDeploys;
const FRONTEND_DEPLOYS = SUPPORTED_CREATE_CROCO_APP_CHOICES.frontendDeploys;
const UI_PROFILES = SUPPORTED_CREATE_CROCO_APP_CHOICES.uiProfiles;
const DATABASES = SUPPORTED_CREATE_CROCO_APP_CHOICES.databases;
const SAAS_PROVIDER_PROFILES = SUPPORTED_CREATE_CROCO_APP_CHOICES.saasProviderProfiles;
const TENANT_MODELS = SUPPORTED_CREATE_CROCO_APP_CHOICES.tenantModels;

type ChoiceName =
  | "preset"
  | "api"
  | "api-hosting"
  | "backend-deploy"
  | "frontend-deploy"
  | "ui"
  | "db"
  | "saas-profile"
  | "tenant-model";

type RawCliOptions = Record<string, string | boolean | undefined>;
type SaasPreset = Extract<GeneratorOptions["preset"], "saas" | "ai-saas">;
type ProductionPreset = Extract<GeneratorOptions["preset"], "production-app" | "admin-console">;

export function parseCliOptions(
  directory: string | undefined,
  rawOptions: RawCliOptions,
): Partial<GeneratorOptions> {
  const cliOptions: Partial<GeneratorOptions> = {};

  if (directory) cliOptions.projectName = directory.split(/[\\/]/).at(-1) ?? directory;
  if (typeof rawOptions.goal === "string")
    cliOptions.goal = rawOptions.goal as GeneratorOptions["goal"];
  if (typeof rawOptions.preset === "string")
    cliOptions.preset = rawOptions.preset as GeneratorOptions["preset"];
  if (typeof rawOptions.scope === "string") cliOptions.scope = rawOptions.scope;
  if (typeof rawOptions.saasProfile === "string") {
    cliOptions.saasProviderProfile =
      rawOptions.saasProfile as GeneratorOptions["saasProviderProfile"];
  }
  if (typeof rawOptions.tenantModel === "string") {
    cliOptions.tenantModel = rawOptions.tenantModel as GeneratorOptions["tenantModel"];
  }
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
  if (typeof rawOptions["ui"] === "string") {
    cliOptions.ui = rawOptions["ui"] as NonNullable<GeneratorOptions["ui"]>;
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
  return (
    (!!cliOptions.goal || !!cliOptions.preset) && !!cliOptions.scope && !!cliOptions.projectName
  );
}

export function validateCliOptions(cliOptions: Partial<GeneratorOptions>): void {
  if (cliOptions.projectName !== undefined) {
    const error = validateProjectName(cliOptions.projectName);
    if (error) throwInvalidProjectName(error);
  }

  if (cliOptions.scope !== undefined && cliOptions.scope === "") {
    throwInvalidCliOption("Package scope is required", "Pass --scope @your-org.", "--scope");
  }
  if (cliOptions.scope && !cliOptions.scope.startsWith("@")) {
    throwInvalidCliOption(
      "Scope must start with @",
      "Prefix the package scope with @, for example --scope @myorg.",
      "--scope",
    );
  }

  if (cliOptions.goal !== undefined) validateGoalCliOptions(cliOptions);
  if (cliOptions.preset !== undefined) readChoice("preset", cliOptions.preset, PRESETS);
  if (cliOptions.saasProviderProfile !== undefined) {
    readChoice("saas-profile", cliOptions.saasProviderProfile, SAAS_PROVIDER_PROFILES);
  }
  if (cliOptions.tenantModel !== undefined) {
    readChoice("tenant-model", cliOptions.tenantModel, TENANT_MODELS);
  }
  if (cliOptions.api !== undefined) readChoice("api", cliOptions.api, APIS);
  if (cliOptions.apiHosting !== undefined)
    readChoice("api-hosting", cliOptions.apiHosting, API_HOSTING);
  if (cliOptions.backendDeploy !== undefined)
    readChoice("backend-deploy", cliOptions.backendDeploy, BACKEND_DEPLOYS);
  if (cliOptions.frontendDeploy !== undefined) {
    readChoice("frontend-deploy", cliOptions.frontendDeploy, FRONTEND_DEPLOYS);
  }
  if (cliOptions.ui !== undefined) readChoice("ui", cliOptions.ui, UI_PROFILES);
  for (const db of cliOptions.db ?? []) {
    readChoice("db", db, DATABASES);
  }

  assertUiPresetCompatibility(cliOptions);

  if (isSaasPreset(cliOptions.preset)) {
    assertSaasOptions(cliOptions, cliOptions.preset);
  }
  if (isProductionPreset(cliOptions.preset)) {
    assertProductionOptions(cliOptions, cliOptions.preset);
  }
}

export function validateResolvedOptions(options: GeneratorOptions): void {
  const error = validateProjectName(options.projectName);
  if (error) throwInvalidProjectName(error);

  if (!options.scope) {
    throwInvalidCliOption("Package scope is required", "Pass --scope @your-org.", "--scope");
  }
  if (!options.scope.startsWith("@")) {
    throwInvalidCliOption(
      "Scope must start with @",
      "Prefix the package scope with @, for example --scope @myorg.",
      "--scope",
    );
  }

  readChoice("preset", options.preset, PRESETS);
  if (options.goal) readGoal(options.goal);
  if (options.saasProviderProfile) {
    readChoice("saas-profile", options.saasProviderProfile, SAAS_PROVIDER_PROFILES);
  }
  readChoice("api-hosting", options.apiHosting, API_HOSTING);
  if (options.api) readChoice("api", options.api, APIS);
  if (options.backendDeploy) readChoice("backend-deploy", options.backendDeploy, BACKEND_DEPLOYS);
  if (options.frontendDeploy)
    readChoice("frontend-deploy", options.frontendDeploy, FRONTEND_DEPLOYS);
  if (options.ui) readChoice("ui", options.ui, UI_PROFILES);
  for (const db of options.db) {
    readChoice("db", db, DATABASES);
  }

  assertUiCompatibility(options);

  if (!isSaasPreset(options.preset) && options.saasProviderProfile) {
    throwInvalidCliOption(
      "--saas-profile is only supported with the saas and ai-saas presets",
      "Remove --saas-profile or choose --preset saas or --preset ai-saas.",
      "--saas-profile",
    );
  }
  if (!isSaasPreset(options.preset) && options.tenantModel) {
    throwInvalidCliOption(
      "--tenant-model is only supported with the saas and ai-saas presets",
      "Remove --tenant-model or choose --preset saas or --preset ai-saas.",
      "--tenant-model",
    );
  }

  if (options.preset === "blank") {
    validateResolvedGoalOptions(options);
    if (options.api) throwUnsupportedPresetOption("--api", "blank");
    if (options.backendDeploy) throwUnsupportedPresetOption("--backend-deploy", "blank");
    if (options.frontendDeploy) throwUnsupportedPresetOption("--frontend-deploy", "blank");
    if (options.webApps.length > 0) {
      throwUnsupportedPresetOption("--web-apps", "blank");
    }
    if (options.db.length > 0) {
      throwUnsupportedPresetOption("--db", "blank");
    }
    return;
  }

  if (options.preset === "ddd-api") {
    validateResolvedGoalOptions(options);
    if (!options.api) throwMissingApi();
    if (options.webApps.length > 0) {
      throwInvalidCliOption(
        "--web-apps is only supported with the ddd-fullstack preset",
        "Remove --web-apps or choose --preset ddd-fullstack.",
        "--web-apps",
      );
    }
    if (options.apiHosting !== "standalone") {
      throwInvalidCliOption(
        "--api-hosting nextjs is only supported with ddd-fullstack",
        "Use --api-hosting standalone or choose --preset ddd-fullstack.",
        "--api-hosting",
      );
    }
    if (options.frontendDeploy) {
      throwInvalidCliOption(
        "--frontend-deploy is only supported with fullstack presets",
        "Remove --frontend-deploy or choose a fullstack preset.",
        "--frontend-deploy",
      );
    }
    return;
  }

  if (isSaasPreset(options.preset)) {
    validateResolvedGoalOptions(options);
    assertSaasOptions(options, options.preset);
    return;
  }

  if (isProductionPreset(options.preset)) {
    validateResolvedGoalOptions(options);
    assertProductionOptions(options, options.preset);
    return;
  }

  if (options.preset === "ddd-fullstack") {
    validateResolvedGoalOptions(options);
    if (!options.api) throwMissingApi();
    if (options.apiHosting === "nextjs" && options.webApps.length !== 1) {
      throwInvalidCliOption(
        "--api-hosting nextjs requires exactly one web app",
        "Pass exactly one --web-apps value or use --api-hosting standalone.",
        "--api-hosting",
      );
    }
    if (options.apiHosting === "nextjs" && options.backendDeploy) {
      throwInvalidCliOption(
        "--backend-deploy is only supported with standalone API hosting",
        "Remove --backend-deploy or use --api-hosting standalone.",
        "--backend-deploy",
      );
    }
    return;
  }

  validateResolvedGoalOptions(options);
  if (options.frontendDeploy !== "cloudflare-meta-vite") {
    throwInvalidCliOption(
      "ddd-vike-fullstack only supports --frontend-deploy cloudflare-meta-vite",
      "Use --frontend-deploy cloudflare-meta-vite for ddd-vike-fullstack.",
      "--frontend-deploy",
    );
  }
}

export function normalizeNonInteractiveOptions(
  cliOptions: Partial<GeneratorOptions>,
): GeneratorOptions {
  validateCliOptions(cliOptions);

  const projectName = requireOption(cliOptions.projectName, "Project name is required");
  const scope = requireOption(cliOptions.scope, "Package scope is required");
  if (cliOptions.goal) {
    const goal = readGoal(cliOptions.goal);
    const options = resolveGoalOptions(projectName, scope, goal, cliOptions);

    validateResolvedOptions(options);

    return options;
  }

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

  if (isSaasPreset(preset)) {
    assertSaasOptions(cliOptions, preset);

    return {
      projectName,
      scope,
      preset,
      saasProviderProfile: cliOptions.saasProviderProfile ?? DEFAULT_SAAS_PROVIDER_PROFILE,
      tenantModel: cliOptions.tenantModel ?? DEFAULT_TENANT_MODEL,
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: cliOptions.agentRules ?? true,
      installDeps: cliOptions.installDeps ?? true,
      initGit: cliOptions.initGit ?? true,
    };
  }

  if (isProductionPreset(preset)) {
    assertProductionOptions(cliOptions, preset);

    return {
      projectName,
      scope,
      preset,
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: cliOptions.agentRules ?? true,
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
    throwInvalidCliOption(
      "--web-apps is only supported with the ddd-fullstack preset",
      "Remove --web-apps or choose --preset ddd-fullstack.",
      "--web-apps",
    );
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
    ...(cliOptions.ui === undefined ? {} : { ui: cliOptions.ui }),
    saasProviderProfile: cliOptions.saasProviderProfile,
    tenantModel: cliOptions.tenantModel,
    db,
    agentRules: cliOptions.agentRules ?? true,
    installDeps: cliOptions.installDeps ?? true,
    initGit: cliOptions.initGit ?? true,
  };

  validateResolvedOptions(options);

  return options;
}

function assertBlankOptions(cliOptions: Partial<GeneratorOptions>): void {
  if (cliOptions.saasProviderProfile) {
    throwInvalidCliOption(
      "--saas-profile is only supported with the saas and ai-saas presets",
      "Remove --saas-profile or choose --preset saas or --preset ai-saas.",
      "--saas-profile",
    );
  }
  if (cliOptions.tenantModel) {
    throwInvalidCliOption(
      "--tenant-model is only supported with the saas and ai-saas presets",
      "Remove --tenant-model or choose --preset saas or --preset ai-saas.",
      "--tenant-model",
    );
  }
  if (cliOptions.api) throwUnsupportedPresetOption("--api", "blank");
  if (cliOptions.apiHosting) throwUnsupportedPresetOption("--api-hosting", "blank");
  if (cliOptions.backendDeploy) throwUnsupportedPresetOption("--backend-deploy", "blank");
  if (cliOptions.frontendDeploy) throwUnsupportedPresetOption("--frontend-deploy", "blank");
  if (cliOptions.ui) throwUnsupportedPresetOption("--ui", "blank");
  if (cliOptions.webApps && cliOptions.webApps.length > 0) {
    throwUnsupportedPresetOption("--web-apps", "blank");
  }
  if (cliOptions.db && cliOptions.db.length > 0) {
    throwUnsupportedPresetOption("--db", "blank");
  }
}

export function isSaasPreset(
  preset: GeneratorOptions["preset"] | undefined,
): preset is Extract<GeneratorOptions["preset"], "saas" | "ai-saas"> {
  return preset === "saas" || preset === "ai-saas";
}

function isProductionPreset(
  preset: GeneratorOptions["preset"] | undefined,
): preset is ProductionPreset {
  return preset === "production-app" || preset === "admin-console";
}

function assertSaasOptions(options: Partial<GeneratorOptions>, preset: SaasPreset): void {
  const presetName = preset;
  const saasProviderProfile = options.saasProviderProfile ?? DEFAULT_SAAS_PROVIDER_PROFILE;
  getSaasProviderProfileDefinition(saasProviderProfile);
  const tenantModel = options.tenantModel ?? DEFAULT_TENANT_MODEL;
  readChoice("tenant-model", tenantModel, TENANT_MODELS);

  if (options.api)
    throw new InvalidSaasPresetOptionProblem(
      `--api is not supported with the ${presetName} preset`,
    );
  if (options.apiHosting && options.apiHosting !== "standalone") {
    throw new InvalidSaasPresetOptionProblem(
      `--api-hosting is not configurable with the ${presetName} preset`,
    );
  }
  if (options.backendDeploy)
    throw new InvalidSaasPresetOptionProblem(
      `--backend-deploy is not supported with the ${presetName} preset`,
    );
  if (options.frontendDeploy)
    throw new InvalidSaasPresetOptionProblem(
      `--frontend-deploy is not supported with the ${presetName} preset`,
    );
  if (options.webApps && options.webApps.length > 0) {
    throw new InvalidSaasPresetOptionProblem(
      `--web-apps is not supported with the ${presetName} preset`,
    );
  }
  if (options.db && options.db.length > 0) {
    throw new InvalidSaasPresetOptionProblem(`--db is not supported with the ${presetName} preset`);
  }
}

function assertProductionOptions(
  options: Partial<GeneratorOptions>,
  preset: ProductionPreset,
): void {
  if (options.saasProviderProfile) {
    throwInvalidCliOption(
      "--saas-profile is only supported with the saas and ai-saas presets",
      "Remove --saas-profile or choose --preset saas or --preset ai-saas.",
      "--saas-profile",
    );
  }
  if (options.tenantModel) {
    throwInvalidCliOption(
      "--tenant-model is only supported with the saas and ai-saas presets",
      "Remove --tenant-model or choose --preset saas or --preset ai-saas.",
      "--tenant-model",
    );
  }
  if (options.api) throwUnsupportedPresetOption("--api", preset);
  if (options.apiHosting && options.apiHosting !== "standalone") {
    throwInvalidCliOption(
      `--api-hosting is not configurable with the ${preset} preset`,
      `Use --api-hosting standalone or remove --api-hosting for the ${preset} preset.`,
      "--api-hosting",
    );
  }
  if (options.backendDeploy) throwUnsupportedPresetOption("--backend-deploy", preset);
  if (options.frontendDeploy) throwUnsupportedPresetOption("--frontend-deploy", preset);
  if (options.webApps && options.webApps.length > 0) {
    throwUnsupportedPresetOption("--web-apps", preset);
  }
  if (options.db && options.db.length > 0) {
    throwUnsupportedPresetOption("--db", preset);
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
      throwInvalidCliOption(
        "--api-hosting nextjs is only supported with ddd-fullstack",
        "Use --api-hosting standalone or choose --preset ddd-fullstack.",
        "--api-hosting",
      );
    }
    return "standalone";
  }

  const resolvedApiHosting = apiHosting ?? "standalone";
  if (resolvedApiHosting === "nextjs" && webApps.length !== 1) {
    throwInvalidCliOption(
      "--api-hosting nextjs requires exactly one web app",
      "Pass exactly one --web-apps value or use --api-hosting standalone.",
      "--api-hosting",
    );
  }

  return resolvedApiHosting;
}

function normalizeBackendDeploy(
  apiHosting: GeneratorOptions["apiHosting"],
  backendDeploy: GeneratorOptions["backendDeploy"] | undefined,
): GeneratorOptions["backendDeploy"] | undefined {
  if (apiHosting === "nextjs" && backendDeploy) {
    throwInvalidCliOption(
      "--backend-deploy is only supported with standalone API hosting",
      "Remove --backend-deploy or use --api-hosting standalone.",
      "--backend-deploy",
    );
  }

  return backendDeploy;
}

function normalizeFrontendDeploy(
  preset: GeneratorOptions["preset"],
  frontendDeploy: GeneratorOptions["frontendDeploy"] | undefined,
): GeneratorOptions["frontendDeploy"] | undefined {
  if (preset === "ddd-api" && frontendDeploy) {
    throwInvalidCliOption(
      "--frontend-deploy is only supported with fullstack presets",
      "Remove --frontend-deploy or choose a fullstack preset.",
      "--frontend-deploy",
    );
  }

  if (preset === "ddd-vike-fullstack") {
    if (!frontendDeploy) {
      throwInvalidCliOption(
        "--frontend-deploy cloudflare-meta-vite is required for ddd-vike-fullstack",
        "Pass --frontend-deploy cloudflare-meta-vite.",
        "--frontend-deploy",
      );
    }
    if (frontendDeploy !== "cloudflare-meta-vite") {
      throwInvalidCliOption(
        "ddd-vike-fullstack only supports --frontend-deploy cloudflare-meta-vite",
        "Use --frontend-deploy cloudflare-meta-vite for ddd-vike-fullstack.",
        "--frontend-deploy",
      );
    }
  }

  return frontendDeploy;
}

export function assertUiCompatibility(options: Partial<GeneratorOptions>): void {
  if (!options.ui) return;

  if (options.frontendDeploy !== "vite-spa") {
    throwInvalidCliOption(
      "--ui is currently only supported with --frontend-deploy vite-spa",
      "Use --frontend-deploy vite-spa, or remove --ui until another presentation runtime is supported.",
      "--ui",
    );
  }
}

export function assertUiPresetCompatibility(options: Partial<GeneratorOptions>): void {
  if (!options.ui || options.preset === undefined || options.preset === "ddd-fullstack") return;

  throwInvalidCliOption(
    "--ui is currently only supported with --preset ddd-fullstack",
    "Use --preset ddd-fullstack with --frontend-deploy vite-spa, or remove --ui.",
    "--ui",
  );
}

function requireOption<T>(value: T | undefined, message: string): T {
  if (value === undefined || value === "") {
    throwInvalidCliOption(message, recoveryForRequiredOption(message), optionFromMessage(message));
  }

  return value;
}

function readChoice<T extends string>(name: ChoiceName, value: string, allowed: readonly T[]): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;

  throwInvalidCliOption(
    `Invalid --${name} value "${value}". Expected ${formatChoices(allowed)}.`,
    `Use one of: ${allowed.join(", ")}.`,
    `--${name}`,
  );
}

function formatChoices(choices: readonly string[]): string {
  if (choices.length <= 1) return choices.join("");

  return `${choices.slice(0, -1).join(", ")} or ${choices.at(-1)}`;
}

function throwInvalidProjectName(detail: string): never {
  throw new InvalidCliOptionProblem(
    detail,
    "Choose a project name with lowercase letters, numbers, hyphens, or underscores.",
    "directory",
  );
}

function throwMissingApi(): never {
  throwInvalidCliOption(
    "--api is required for ddd-api and ddd-fullstack",
    "Pass --api graphql or --api trpc.",
    "--api",
  );
}

function throwUnsupportedPresetOption(option: string, preset: string): never {
  throwInvalidCliOption(
    `${option} is not supported with the ${preset} preset`,
    `Remove ${option} or choose a preset that supports it.`,
    option,
  );
}

function throwInvalidCliOption(detail: string, recovery: string, option?: string): never {
  throw new InvalidCliOptionProblem(detail, recovery, option);
}

function recoveryForRequiredOption(message: string): string {
  if (message.includes("--api")) {
    return "Pass --api graphql or --api trpc.";
  }
  if (message.includes("Project name")) {
    return "Pass a target directory or project name.";
  }
  if (message.includes("Project preset")) {
    return "Pass --preset with one supported preset, or use --goal.";
  }
  if (message.includes("Package scope")) {
    return "Pass --scope @your-org.";
  }

  return "Provide the required option and rerun create-croco-app.";
}

function optionFromMessage(message: string): string | undefined {
  const option = message.match(/--[a-z-]+/)?.[0];

  if (option) return option;
  if (message.includes("Project name")) return "directory";
  if (message.includes("Package scope")) return "--scope";

  return undefined;
}
