import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { InvalidGoalOptionProblem } from "./libs/problems/InvalidGoalOptionProblem.js";
import type { AppGoal, GeneratorOptions } from "./types.js";

export type GoalManifest = {
  readonly schemaVersion: 1;
  readonly projectName: string;
  readonly scope: string;
  readonly goal: AppGoal;
  readonly preset: GeneratorOptions["preset"];
  readonly runtimeTarget: "node" | "cloudflare-workers";
  readonly protocol: "rest" | "rest-rpc-client";
  readonly providers: readonly string[];
  readonly storage: readonly string[];
  readonly auth: "none" | "tenant-demo" | "admin-demo";
  readonly billing: "none" | "demo";
  readonly telemetry: "opentelemetry-otlp" | "none";
  readonly deploymentPreset: string;
  readonly qualityGates: readonly string[];
};

type GoalSpec = {
  readonly label: string;
  readonly hint: string;
  readonly options: Omit<GeneratorOptions, "projectName" | "scope" | "installDeps" | "initGit">;
  readonly manifest: Omit<GoalManifest, "projectName" | "scope">;
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
      agentRules: true,
    },
    manifest: {
      schemaVersion: 1,
      goal: "saas-api",
      preset: "saas",
      runtimeTarget: "node",
      protocol: "rest",
      providers: [
        "in-memory-tenant",
        "in-memory-auth",
        "in-memory-billing",
        "in-memory-metering",
        "in-memory-events",
      ],
      storage: ["in-memory-demo"],
      auth: "tenant-demo",
      billing: "demo",
      telemetry: "opentelemetry-otlp",
      deploymentPreset: "node-api",
      qualityGates: ["install", "typecheck", "build", "test", "contract:verify", "demo:smoke"],
    },
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
    manifest: {
      schemaVersion: 1,
      goal: "spa-backend-split",
      preset: "production-app",
      runtimeTarget: "node",
      protocol: "rest-rpc-client",
      providers: ["in-memory-repository", "in-memory-events", "generated-rpc-client"],
      storage: ["in-memory-demo"],
      auth: "none",
      billing: "none",
      telemetry: "opentelemetry-otlp",
      deploymentPreset: "lambda-spa",
      qualityGates: [
        "install",
        "dev:smoke",
        "lint",
        "test",
        "typecheck",
        "build",
        "contract:verify",
      ],
    },
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
    manifest: {
      schemaVersion: 1,
      goal: "worker",
      preset: "ddd-vike-fullstack",
      runtimeTarget: "cloudflare-workers",
      protocol: "rest",
      providers: ["cloudflare-workers", "meta-vite"],
      storage: [],
      auth: "none",
      billing: "none",
      telemetry: "none",
      deploymentPreset: "cloudflare-workers",
      qualityGates: ["install", "typecheck", "build", "ssr-worker:presentation:smoke"],
    },
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
    manifest: {
      schemaVersion: 1,
      goal: "internal-tool",
      preset: "admin-console",
      runtimeTarget: "node",
      protocol: "rest-rpc-client",
      providers: ["in-memory-admin-data", "generated-rpc-client"],
      storage: ["in-memory-demo"],
      auth: "admin-demo",
      billing: "none",
      telemetry: "opentelemetry-otlp",
      deploymentPreset: "lambda-spa",
      qualityGates: [
        "install",
        "admin:smoke",
        "lint",
        "test",
        "typecheck",
        "build",
        "contract:verify",
      ],
    },
  },
} as const satisfies Record<AppGoal, GoalSpec>;

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
  cliOptions: Partial<GeneratorOptions>,
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
  };
}

export function validateGoalCliOptions(options: Partial<GeneratorOptions>): void {
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

export function validateResolvedGoalOptions(options: GeneratorOptions): void {
  if (!options.goal) return;

  const expectedOptions: GoalSpec["options"] = GOAL_SPECS[options.goal].options;
  const mismatches: string[] = [];

  if (options.preset !== expectedOptions.preset) mismatches.push("preset");
  if (options.api !== expectedOptions.api) mismatches.push("api");
  if (options.apiHosting !== expectedOptions.apiHosting) mismatches.push("apiHosting");
  if (options.backendDeploy !== expectedOptions.backendDeploy) mismatches.push("backendDeploy");
  if (options.frontendDeploy !== expectedOptions.frontendDeploy) mismatches.push("frontendDeploy");
  if (!sameStringArray(options.webApps, expectedOptions.webApps)) mismatches.push("webApps");
  if (!sameStringArray(options.db, expectedOptions.db)) mismatches.push("db");

  if (mismatches.length === 0) return;

  throw new InvalidGoalOptionProblem(
    options.goal,
    `Resolved options for --goal ${options.goal} do not match the goal contract: ${mismatches.join(", ")}.`,
    "Use resolveGoalOptions() for goal-based generation, or remove --goal when constructing explicit GeneratorOptions.",
  );
}

function assertGoalDoesNotMixStackOptions(goal: AppGoal, options: Partial<GeneratorOptions>): void {
  const unsupportedOptions: string[] = [];

  if (options.preset) unsupportedOptions.push("--preset");
  if (options.api) unsupportedOptions.push("--api");
  if (options.apiHosting) unsupportedOptions.push("--api-hosting");
  if (options.backendDeploy) unsupportedOptions.push("--backend-deploy");
  if (options.frontendDeploy) unsupportedOptions.push("--frontend-deploy");
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
