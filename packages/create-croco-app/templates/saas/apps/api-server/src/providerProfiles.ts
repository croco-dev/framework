export const SAAS_PROVIDER_PROFILE_ENV = "SAAS_PROVIDER_PROFILE";
export const SAAS_DEMO_ENDPOINTS_ENABLED_ENV = "SAAS_DEMO_ENDPOINTS_ENABLED";
export const DEFAULT_SAAS_PROVIDER_PROFILE = "in-memory";

export type SaasProviderProfileName =
  | "in-memory"
  | "drizzle-polar-upstash"
  | "saas-node-postgres"
  | "saas-cloudflare"
  | "saas-lambda";

export type SaasProviderProfile = {
  name: SaasProviderProfileName;
  status: "supported" | "documented-seam";
  description: string;
  packages: readonly string[];
  env: readonly string[];
  commands: readonly string[];
};

type SaasDemoEndpointEnv = {
  NODE_ENV?: string;
  [SAAS_DEMO_ENDPOINTS_ENABLED_ENV]?: string;
};

type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: SaasDemoEndpointEnv;
  };
};

export const SAAS_PROVIDER_PROFILES = {
  "in-memory": {
    name: "in-memory",
    status: "supported",
    description: "Zero-credential local SaaS golden path for generated app smoke validation.",
    packages: [
      "@croco/billing-core",
      "@croco/entitlements-core",
      "@croco/membership-core",
      "@croco/metering-core",
    ],
    env: [SAAS_PROVIDER_PROFILE_ENV, SAAS_DEMO_ENDPOINTS_ENABLED_ENV],
    commands: ["pnpm demo:smoke", "SAAS_DEMO_ENDPOINTS_ENABLED=true pnpm dev"],
  },
  "drizzle-polar-upstash": {
    name: "drizzle-polar-upstash",
    status: "documented-seam",
    description:
      "Adapter seam for Drizzle-backed domain storage, Polar billing, and Upstash metering/rate-limit/task queues.",
    packages: [
      "@croco/access-drizzle",
      "@croco/auth-drizzle",
      "@croco/entitlements-drizzle",
      "@croco/invitation-drizzle",
      "@croco/membership-drizzle",
      "@croco/metering-drizzle",
      "@croco/tx-drizzle",
      "@croco/billing-polar",
      "@croco/metering-upstash",
      "@croco/ratelimit-upstash",
      "@croco/tasks-qstash",
      "@croco/triggers-qstash",
      "drizzle-orm",
      "@polar-sh/sdk",
      "@upstash/redis",
      "@upstash/ratelimit",
      "@upstash/qstash",
    ],
    env: [
      "DATABASE_URL",
      "POLAR_ACCESS_TOKEN",
      "POLAR_WEBHOOK_SECRET",
      "POLAR_PRODUCT_ID_TEAM",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "UPSTASH_QSTASH_TOKEN",
      "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
      "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
      SAAS_PROVIDER_PROFILE_ENV,
      SAAS_DEMO_ENDPOINTS_ENABLED_ENV,
    ],
    commands: [
      "pnpm add @croco/access-drizzle @croco/auth-drizzle @croco/entitlements-drizzle @croco/invitation-drizzle @croco/membership-drizzle @croco/metering-drizzle @croco/tx-drizzle drizzle-orm",
      "pnpm add @croco/billing-polar @polar-sh/sdk",
      "pnpm add @croco/metering-upstash @croco/ratelimit-upstash @croco/tasks-qstash @croco/triggers-qstash @upstash/redis @upstash/ratelimit @upstash/qstash",
      "SAAS_PROVIDER_PROFILE=drizzle-polar-upstash pnpm typecheck",
    ],
  },
  "saas-node-postgres": {
    name: "saas-node-postgres",
    status: "documented-seam",
    description:
      "Node/Postgres production profile with Better Auth, Drizzle storage, Polar billing, QStash tasks, Cloudinary storage, and OTLP telemetry.",
    packages: [
      "@croco/auth-better-auth",
      "@croco/auth-drizzle",
      "@croco/billing-polar",
      "@croco/metering-drizzle",
      "@croco/storage-cloudinary",
      "@croco/tasks-qstash",
      "@croco/triggers-qstash",
      "@croco/telemetry-sdk-node",
      "@croco/tx-drizzle",
    ],
    env: [
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      "POLAR_ACCESS_TOKEN",
      "POLAR_WEBHOOK_SECRET",
      "POLAR_PRODUCT_ID_TEAM",
      "UPSTASH_QSTASH_TOKEN",
      "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
      "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
      "CLOUDINARY_URL",
      SAAS_PROVIDER_PROFILE_ENV,
      SAAS_DEMO_ENDPOINTS_ENABLED_ENV,
    ],
    commands: [
      "pnpm profile:check",
      "SAAS_PROVIDER_PROFILE=saas-node-postgres pnpm profile:smoke:real",
    ],
  },
  "saas-cloudflare": {
    name: "saas-cloudflare",
    status: "documented-seam",
    description:
      "Cloudflare Workers production profile with Clerk auth, Polar billing, Upstash metering/tasks, R2 storage, and Worker-safe telemetry.",
    packages: [
      "@croco/preset-cloudflare",
      "@croco/transports-cloudflare-workers",
      "@croco/auth-clerk",
      "@croco/billing-polar",
      "@croco/metering-upstash",
      "@croco/storage-r2",
      "@croco/tasks-qstash",
      "@croco/triggers-qstash",
    ],
    env: [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_TOKEN",
      "R2_BUCKET",
      "CLERK_SECRET_KEY",
      "POLAR_ACCESS_TOKEN",
      "POLAR_WEBHOOK_SECRET",
      "POLAR_PRODUCT_ID_TEAM",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "UPSTASH_QSTASH_TOKEN",
      "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
      "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
      SAAS_PROVIDER_PROFILE_ENV,
      SAAS_DEMO_ENDPOINTS_ENABLED_ENV,
    ],
    commands: [
      "pnpm profile:check",
      "SAAS_PROVIDER_PROFILE=saas-cloudflare pnpm profile:smoke:real",
    ],
  },
  "saas-lambda": {
    name: "saas-lambda",
    status: "documented-seam",
    description:
      "AWS Lambda production profile with Clerk auth, Polar billing, Upstash metering/tasks, Cloudinary storage, and explicit telemetry flush.",
    packages: [
      "@croco/preset-lambda",
      "@croco/auth-clerk",
      "@croco/billing-polar",
      "@croco/metering-upstash",
      "@croco/storage-cloudinary",
      "@croco/tasks-qstash",
      "@croco/triggers-qstash",
      "@croco/telemetry-sdk-node",
    ],
    env: [
      "AWS_REGION",
      "CLERK_SECRET_KEY",
      "POLAR_ACCESS_TOKEN",
      "POLAR_WEBHOOK_SECRET",
      "POLAR_PRODUCT_ID_TEAM",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "UPSTASH_QSTASH_TOKEN",
      "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
      "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
      "CLOUDINARY_URL",
      SAAS_PROVIDER_PROFILE_ENV,
      SAAS_DEMO_ENDPOINTS_ENABLED_ENV,
    ],
    commands: ["pnpm profile:check", "SAAS_PROVIDER_PROFILE=saas-lambda pnpm profile:smoke:real"],
  },
} satisfies Record<SaasProviderProfileName, SaasProviderProfile>;

export function getSaasProviderProfile(
  name: SaasProviderProfileName = DEFAULT_SAAS_PROVIDER_PROFILE,
): SaasProviderProfile {
  return SAAS_PROVIDER_PROFILES[name];
}

export function listSaasProviderProfiles(): SaasProviderProfile[] {
  return Object.values(SAAS_PROVIDER_PROFILES);
}

function getRuntimeEnv(): SaasDemoEndpointEnv {
  return (globalThis as RuntimeGlobal).process?.env ?? {};
}

export function isSaasDemoEndpointEnabled(env: SaasDemoEndpointEnv = getRuntimeEnv()): boolean {
  return env.NODE_ENV !== "production" && env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV] === "true";
}
