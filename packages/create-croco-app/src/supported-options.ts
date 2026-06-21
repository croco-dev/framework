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
  apis: ["graphql", "trpc"],
  apiHosting: ["standalone", "nextjs"],
  backendDeploys: ["docker", "lambda"],
  frontendDeploys: ["opennext", "vercel", "docker", "cloudflare-meta-vite", "vite-spa"],
  databases: ["postgres", "mongodb", "redis"],
} as const satisfies {
  readonly presets: readonly GeneratorOptions["preset"][];
  readonly goals: readonly NonNullable<GeneratorOptions["goal"]>[];
  readonly saasProviderProfiles: readonly NonNullable<GeneratorOptions["saasProviderProfile"]>[];
  readonly apis: readonly NonNullable<GeneratorOptions["api"]>[];
  readonly apiHosting: readonly GeneratorOptions["apiHosting"][];
  readonly backendDeploys: readonly NonNullable<GeneratorOptions["backendDeploy"]>[];
  readonly frontendDeploys: readonly NonNullable<GeneratorOptions["frontendDeploy"]>[];
  readonly databases: readonly GeneratorOptions["db"][number][];
};
