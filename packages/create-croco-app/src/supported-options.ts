import type { GeneratorOptions } from "./types.js";

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
  databases: ["postgres", "mongodb", "redis"],
} as const satisfies {
  readonly presets: readonly GeneratorOptions["preset"][];
  readonly goals: readonly NonNullable<GeneratorOptions["goal"]>[];
  readonly saasProviderProfiles: readonly NonNullable<GeneratorOptions["saasProviderProfile"]>[];
  readonly tenantModels: readonly NonNullable<GeneratorOptions["tenantModel"]>[];
  readonly apis: readonly NonNullable<GeneratorOptions["api"]>[];
  readonly apiHosting: readonly GeneratorOptions["apiHosting"][];
  readonly backendDeploys: readonly NonNullable<GeneratorOptions["backendDeploy"]>[];
  readonly frontendDeploys: readonly NonNullable<GeneratorOptions["frontendDeploy"]>[];
  readonly databases: readonly GeneratorOptions["db"][number][];
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
    readonly [preset in Extract<GeneratorOptions["preset"], "ddd-vike-fullstack">]: {
      readonly status: "legacy-compatibility-name";
      readonly currentRuntime: "@croco/meta-vite";
      readonly requiredFrontendDeploy: Extract<
        NonNullable<GeneratorOptions["frontendDeploy"]>,
        "cloudflare-meta-vite"
      >;
      readonly migrationTarget: string;
    };
  };
};
