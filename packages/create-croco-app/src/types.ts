export type GeneratorOptions = {
  projectName: string;
  scope: string;
  preset: "ddd-fullstack" | "ddd-vike-fullstack" | "ddd-api" | "saas" | "ai-saas" | "blank";
  webApps: string[];
  api?: "graphql" | "trpc";
  apiHosting: "standalone" | "nextjs";
  backendDeploy?: "docker" | "lambda";
  frontendDeploy?: "opennext" | "vercel" | "docker" | "cloudflare-meta-vite" | "vite-spa";
  db: ("postgres" | "mongodb" | "redis")[];
  agentRules: boolean;
  installDeps: boolean;
  initGit: boolean;
};
