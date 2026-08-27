import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_TENANT_MODEL, type TenantModelName } from "@croco/tenant-core/tenant-model";
import { APPLICATION_INTENT_GOAL_CONTRACTS } from "@croco/framework-context";
import type { ApplicationIntentManifest } from "@croco/framework-context";
import { InvalidGoalOptionProblem } from "./libs/problems/InvalidGoalOptionProblem.js";
import { DEFAULT_SAAS_PROVIDER_PROFILE } from "./saas-provider-profiles.js";
import type { AppGoal, GeneratorOptions, NormalizedGeneratorOptions } from "./types.js";

export type GoalManifest = Omit<ApplicationIntentManifest, "tenantModel"> & {
  readonly tenantModel?: TenantModelName;
};

type GoalSpec<Goal extends AppGoal> = {
  readonly label: string;
  readonly hint: string;
  readonly options: Omit<
    Extract<GeneratorOptions, { goal: Goal }>,
    "projectName" | "scope" | "installDeps" | "initGit"
  >;
  readonly manifest: Omit<GoalManifest, "projectName" | "scope">;
};

type GoalSpecs = {
  readonly [Goal in AppGoal]: GoalSpec<Goal>;
};

export const GOAL_SPECS = {
  "saas-api": {
    label: "SaaS API",
    hint: "Tenant, auth, billing, metering, telemetry, contracts, and demo smoke",
    options: {
      goal: "saas-api",
      preset: "saas",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      saasProviderProfile: DEFAULT_SAAS_PROVIDER_PROFILE,
      tenantModel: DEFAULT_TENANT_MODEL,
      agentRules: true,
    },
    manifest: APPLICATION_INTENT_GOAL_CONTRACTS["saas-api"],
  },
  "spa-backend-split": {
    label: "SPA + Backend Split",
    hint: "React SPA, REST API, RPC client, Problems, telemetry, and contract gates",
    options: {
      goal: "spa-backend-split",
      preset: "production-app",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: true,
    },
    manifest: APPLICATION_INTENT_GOAL_CONTRACTS["spa-backend-split"],
  },
  worker: {
    label: "Worker",
    hint: "Cloudflare API worker plus SSR worker with presentation smoke",
    options: {
      goal: "worker",
      preset: "ddd-vike-fullstack",
      webApps: [],
      apiHosting: "standalone",
      frontendDeploy: "cloudflare-meta-vite",
      db: [],
      agentRules: true,
    },
    manifest: APPLICATION_INTENT_GOAL_CONTRACTS.worker,
  },
  "internal-tool": {
    label: "Internal Tool",
    hint: "Admin console with generated client, tenant context, operations, and recovery states",
    options: {
      goal: "internal-tool",
      preset: "admin-console",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: true,
    },
    manifest: APPLICATION_INTENT_GOAL_CONTRACTS["internal-tool"],
  },
} as const satisfies GoalSpecs;

export function formatGoalChoices(): string {
  return Object.keys(GOAL_SPECS).join(", ");
}

export function readGoal(value: string): AppGoal {
  if (isAppGoal(value)) return value;

  throw new InvalidGoalOptionProblem(
    value,
    `Invalid --goal value "${value}". Expected ${formatGoalChoices()}.`,
    "Choose one supported goal, or use --preset for explicit technology-stack generation.",
  );
}

export function isAppGoal(value: string): value is AppGoal {
  return Object.prototype.hasOwnProperty.call(GOAL_SPECS, value);
}

export function resolveGoalOptions(
  projectName: string,
  scope: string,
  goal: AppGoal,
  cliOptions: NormalizedGeneratorOptions,
): GeneratorOptions {
  assertGoalDoesNotMixStackOptions(goal, cliOptions);

  const spec = GOAL_SPECS[goal];

  return {
    projectName,
    scope,
    ...spec.options,
    agentRules: cliOptions.agentRules ?? spec.options.agentRules,
    installDeps: cliOptions.installDeps ?? true,
    initGit: cliOptions.initGit ?? true,
  } as GeneratorOptions;
}

export function validateGoalCliOptions(options: NormalizedGeneratorOptions): void {
  if (!options.goal) return;

  assertGoalDoesNotMixStackOptions(readGoal(options.goal), options);
}

export function createGoalManifest(options: GeneratorOptions): GoalManifest | undefined {
  if (!options.goal) return undefined;

  validateResolvedGoalOptions(options);

  return {
    ...GOAL_SPECS[options.goal].manifest,
    projectName: options.projectName,
    scope: options.scope,
  };
}

export function writeGoalManifest(targetDir: string, options: GeneratorOptions): void {
  const manifest = createGoalManifest(options);

  if (!manifest) return;

  writeFileSync(join(targetDir, "croco.app.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

export function validateResolvedGoalOptions(options: NormalizedGeneratorOptions): void {
  if (!options.goal) return;

  const expectedOptions: NormalizedGeneratorOptions = GOAL_SPECS[options.goal].options;
  const mismatches: string[] = [];

  if (options.preset !== expectedOptions.preset) mismatches.push("preset");
  if (options.api !== expectedOptions.api) mismatches.push("api");
  if (options.apiHosting !== expectedOptions.apiHosting) mismatches.push("apiHosting");
  if (options.backendDeploy !== expectedOptions.backendDeploy) mismatches.push("backendDeploy");
  if (options.frontendDeploy !== expectedOptions.frontendDeploy) mismatches.push("frontendDeploy");
  if (options.ui !== expectedOptions.ui) mismatches.push("ui");
  if (options.saasProviderProfile !== expectedOptions.saasProviderProfile) {
    mismatches.push("saasProviderProfile");
  }
  if (options.tenantModel !== expectedOptions.tenantModel) mismatches.push("tenantModel");
  if (!sameStringArray(options.webApps ?? [], expectedOptions.webApps ?? [])) {
    mismatches.push("webApps");
  }
  if (!sameStringArray(options.db ?? [], expectedOptions.db ?? [])) mismatches.push("db");

  if (mismatches.length === 0) return;

  throw new InvalidGoalOptionProblem(
    options.goal,
    `Resolved options for --goal ${options.goal} do not match the goal contract: ${mismatches.join(", ")}.`,
    "Use resolveGoalOptions() for goal-based generation, or remove --goal when constructing explicit GeneratorOptions.",
  );
}

function assertGoalDoesNotMixStackOptions(
  goal: AppGoal,
  options: NormalizedGeneratorOptions,
): void {
  const unsupportedOptions: string[] = [];

  if (options.preset) unsupportedOptions.push("--preset");
  if (options.api) unsupportedOptions.push("--api");
  if (options.apiHosting) unsupportedOptions.push("--api-hosting");
  if (options.backendDeploy) unsupportedOptions.push("--backend-deploy");
  if (options.frontendDeploy) unsupportedOptions.push("--frontend-deploy");
  if (options.ui) unsupportedOptions.push("--ui");
  if (options.saasProviderProfile) unsupportedOptions.push("--saas-profile");
  if (options.tenantModel) unsupportedOptions.push("--tenant-model");
  if (options.webApps && options.webApps.length > 0) unsupportedOptions.push("--web-apps");
  if (options.db && options.db.length > 0) unsupportedOptions.push("--db");

  if (unsupportedOptions.length === 0) return;

  const formattedOptions = unsupportedOptions.join(", ");

  throw new InvalidGoalOptionProblem(
    goal,
    `${formattedOptions} cannot be combined with --goal ${goal}. Goal generation chooses the supported runtime, protocol, storage, auth, billing, telemetry, and deployment preset before files are created.`,
    "Remove the stack option(s) to use goal-first generation, or remove --goal and use --preset for explicit stack configuration.",
  );
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
