import type { TenantModelName } from "@croco/tenant-core/tenant-model";
import type { SaasProviderProfileName } from "./saas-provider-profiles.js";
import type {
  AppGoal,
  GeneratorApi,
  GeneratorApiHosting,
  GeneratorBackendDeploy,
  GeneratorDatabase,
  GeneratorFrontendDeploy,
  GeneratorPreset,
  GeneratorUiProfile,
} from "./types.js";

export const SUPPORTED_CREATE_CROCO_APP_CHOICES = {
  presets: [
    "blank",
    "ddd-api",
    "ddd-fullstack",
    "ddd-vike-fullstack",
    "production-app",
    "admin-console",
    "saas",
    "ai-saas",
  ],
  goals: ["saas-api", "spa-backend-split", "worker", "internal-tool"],
  saasProviderProfiles: ["saas-node-postgres", "saas-cloudflare", "saas-lambda"],
  tenantModels: ["single", "org", "workspace", "shared-schema", "rls-backed"],
  apis: ["graphql", "trpc"],
  apiHosting: ["standalone", "nextjs"],
  backendDeploys: ["docker", "lambda"],
  frontendDeploys: ["opennext", "vercel", "docker", "cloudflare-meta-vite", "vite-spa"],
  uiProfiles: ["none", "astryx"],
  databases: ["postgres", "mongodb", "redis"],
} as const satisfies {
  readonly presets: readonly GeneratorPreset[];
  readonly goals: readonly AppGoal[];
  readonly saasProviderProfiles: readonly SaasProviderProfileName[];
  readonly tenantModels: readonly TenantModelName[];
  readonly apis: readonly GeneratorApi[];
  readonly apiHosting: readonly GeneratorApiHosting[];
  readonly backendDeploys: readonly GeneratorBackendDeploy[];
  readonly frontendDeploys: readonly GeneratorFrontendDeploy[];
  readonly uiProfiles: readonly GeneratorUiProfile[];
  readonly databases: readonly GeneratorDatabase[];
};

export const CREATE_CROCO_APP_COMPATIBILITY_CHOICES = {
  presets: {
    "ddd-vike-fullstack": {
      status: "legacy-compatibility-name",
      currentRuntime: "@croco/meta-vite",
      requiredFrontendDeploy: "cloudflare-meta-vite",
      migrationTarget: "Use the generated meta-vite Worker fullstack profile.",
    },
  },
} as const satisfies {
  readonly presets: {
    readonly [preset in Extract<GeneratorPreset, "ddd-vike-fullstack">]: {
      readonly status: "legacy-compatibility-name";
      readonly currentRuntime: "@croco/meta-vite";
      readonly requiredFrontendDeploy: Extract<GeneratorFrontendDeploy, "cloudflare-meta-vite">;
      readonly migrationTarget: string;
    };
  };
};
