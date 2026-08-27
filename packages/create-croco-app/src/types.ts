import type { TenantModelName } from "@croco/tenant-core/tenant-model";
import type { ApplicationIntentGoal } from "@croco/framework-context";
import type { SaasProviderProfileName } from "./saas-provider-profiles.js";

export type AppGoal = ApplicationIntentGoal;

export type GeneratorPreset =
  | "ddd-fullstack"
  | "ddd-vike-fullstack"
  | "ddd-api"
  | "production-app"
  | "admin-console"
  | "saas"
  | "ai-saas"
  | "blank";

export type GeneratorApi = "graphql" | "trpc";
export type GeneratorApiHosting = "standalone" | "nextjs";
export type GeneratorBackendDeploy = "docker" | "lambda";
export type GeneratorFrontendDeploy =
  | "opennext"
  | "vercel"
  | "docker"
  | "cloudflare-meta-vite"
  | "vite-spa";
export type GeneratorUiProfile = "none" | "astryx";
export type GeneratorDatabase = "postgres" | "mongodb" | "redis";

export type RawCliOptions = Readonly<Record<string, string | boolean | undefined>>;

export type NormalizedGeneratorOptions = {
  projectName?: string | undefined;
  scope?: string | undefined;
  goal?: AppGoal | undefined;
  preset?: GeneratorPreset | undefined;
  webApps?: string[] | undefined;
  api?: GeneratorApi | undefined;
  apiHosting?: GeneratorApiHosting | undefined;
  backendDeploy?: GeneratorBackendDeploy | undefined;
  frontendDeploy?: GeneratorFrontendDeploy | undefined;
  ui?: GeneratorUiProfile | undefined;
  saasProviderProfile?: SaasProviderProfileName | undefined;
  tenantModel?: TenantModelName | undefined;
  db?: GeneratorDatabase[] | undefined;
  agentRules?: boolean | undefined;
  installDeps?: boolean | undefined;
  initGit?: boolean | undefined;
};

type ResolvedGeneratorOptions = {
  projectName: string;
  scope: string;
  webApps: string[];
  apiHosting: GeneratorApiHosting;
  db: GeneratorDatabase[];
  agentRules: boolean;
  installDeps: boolean;
  initGit: boolean;
};

type NonSaasOptions = {
  saasProviderProfile?: never;
  tenantModel?: never;
};

type NoApiOptions = {
  api?: never;
  backendDeploy?: never;
  frontendDeploy?: never;
  ui?: never;
};

type BlankGeneratorOptions = ResolvedGeneratorOptions &
  NonSaasOptions &
  NoApiOptions & {
    goal?: never;
    preset: "blank";
    webApps: [];
    apiHosting: "standalone";
    db: [];
  };

type DddApiGeneratorOptions = ResolvedGeneratorOptions &
  NonSaasOptions & {
    goal?: never;
    preset: "ddd-api";
    webApps: [];
    api: GeneratorApi;
    apiHosting: "standalone";
    backendDeploy?: GeneratorBackendDeploy;
    frontendDeploy?: never;
    ui?: never;
  };

type DddFullstackApiHostingOptions =
  | {
      apiHosting: "standalone";
      backendDeploy?: GeneratorBackendDeploy;
    }
  | {
      apiHosting: "nextjs";
      webApps: [string];
      backendDeploy?: never;
    };

type DddFullstackPresentationOptions =
  | {
      frontendDeploy: "vite-spa";
      ui?: GeneratorUiProfile;
    }
  | {
      frontendDeploy?: Exclude<GeneratorFrontendDeploy, "vite-spa">;
      ui?: never;
    };

type DddFullstackGeneratorOptions = ResolvedGeneratorOptions &
  NonSaasOptions &
  DddFullstackApiHostingOptions &
  DddFullstackPresentationOptions & {
    goal?: never;
    preset: "ddd-fullstack";
    api: GeneratorApi;
  };

type ExplicitVikeGeneratorOptions = ResolvedGeneratorOptions &
  NonSaasOptions & {
    goal?: never;
    preset: "ddd-vike-fullstack";
    api?: GeneratorApi;
    apiHosting: "standalone";
    backendDeploy?: GeneratorBackendDeploy;
    frontendDeploy: "cloudflare-meta-vite";
    ui?: never;
  };

type WorkerGoalGeneratorOptions = ResolvedGeneratorOptions &
  NonSaasOptions & {
    goal: "worker";
    preset: "ddd-vike-fullstack";
    webApps: [];
    api?: never;
    apiHosting: "standalone";
    backendDeploy?: never;
    frontendDeploy: "cloudflare-meta-vite";
    ui?: never;
    db: [];
  };

type ProductionAppGeneratorOptions = ResolvedGeneratorOptions &
  NonSaasOptions &
  NoApiOptions & {
    goal?: never;
    preset: "production-app";
    webApps: [];
    apiHosting: "standalone";
    db: [];
  };

type ProductionAppGoalGeneratorOptions = ResolvedGeneratorOptions &
  NonSaasOptions &
  NoApiOptions & {
    goal: "spa-backend-split";
    preset: "production-app";
    webApps: [];
    apiHosting: "standalone";
    db: [];
  };

type AdminConsoleGeneratorOptions = ResolvedGeneratorOptions &
  NonSaasOptions &
  NoApiOptions & {
    goal?: never;
    preset: "admin-console";
    webApps: [];
    apiHosting: "standalone";
    db: [];
  };

type AdminConsoleGoalGeneratorOptions = ResolvedGeneratorOptions &
  NonSaasOptions &
  NoApiOptions & {
    goal: "internal-tool";
    preset: "admin-console";
    webApps: [];
    apiHosting: "standalone";
    db: [];
  };

type SaasGeneratorOptions = ResolvedGeneratorOptions &
  NoApiOptions & {
    goal?: never;
    preset: "saas" | "ai-saas";
    webApps: [];
    apiHosting: "standalone";
    saasProviderProfile: SaasProviderProfileName;
    tenantModel: TenantModelName;
    db: [];
  };

type SaasGoalGeneratorOptions = ResolvedGeneratorOptions &
  NoApiOptions & {
    goal: "saas-api";
    preset: "saas";
    webApps: [];
    apiHosting: "standalone";
    saasProviderProfile: "saas-node-postgres";
    tenantModel: "org";
    db: [];
  };

export type GeneratorOptions =
  | BlankGeneratorOptions
  | DddApiGeneratorOptions
  | DddFullstackGeneratorOptions
  | ExplicitVikeGeneratorOptions
  | WorkerGoalGeneratorOptions
  | ProductionAppGeneratorOptions
  | ProductionAppGoalGeneratorOptions
  | AdminConsoleGeneratorOptions
  | AdminConsoleGoalGeneratorOptions
  | SaasGeneratorOptions
  | SaasGoalGeneratorOptions;
