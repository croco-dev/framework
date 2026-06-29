import type { TenantModelName } from "@croco/tenant-core/tenant-model";

export type AppGoal = "saas-api" | "spa-backend-split" | "worker" | "internal-tool";

export type GeneratorOptions = {
  projectName: string;
  scope: string;
  goal?: AppGoal;
  preset:
    | "ddd-fullstack"
    | "ddd-vike-fullstack"
    | "ddd-api"
    | "production-app"
    | "admin-console"
    | "saas"
    | "ai-saas"
    | "blank";
  webApps: string[];
  api?: "graphql" | "trpc";
  apiHosting: "standalone" | "nextjs";
  backendDeploy?: "docker" | "lambda";
  frontendDeploy?: "opennext" | "vercel" | "docker" | "cloudflare-meta-vite" | "vite-spa";
  saasProviderProfile?: "saas-node-postgres" | "saas-cloudflare" | "saas-lambda";
  tenantModel?: TenantModelName;
  db: ("postgres" | "mongodb" | "redis")[];
  agentRules: boolean;
  installDeps: boolean;
  initGit: boolean;
};
