export const SAAS_PROVIDER_PROFILE_ENV = "SAAS_PROVIDER_PROFILE";
export const SAAS_DEMO_ENDPOINTS_ENABLED_ENV = "SAAS_DEMO_ENDPOINTS_ENABLED";
export const DEFAULT_SAAS_PROVIDER_PROFILE = "in-memory";

export type SaasProviderProfileName = "in-memory" | "drizzle-polar-upstash";

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
} satisfies Record<SaasProviderProfileName, SaasProviderProfile>;

export function getSaasProviderProfile(
  name: SaasProviderProfileName = DEFAULT_SAAS_PROVIDER_PROFILE,
): SaasProviderProfile {
  return SAAS_PROVIDER_PROFILES[name];
}

export function listSaasProviderProfiles(): SaasProviderProfile[] {
  return Object.values(SAAS_PROVIDER_PROFILES);
}

export function isSaasDemoEndpointEnabled(env: SaasDemoEndpointEnv = process.env): boolean {
  return env.NODE_ENV !== "production" && env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV] === "true";
}
