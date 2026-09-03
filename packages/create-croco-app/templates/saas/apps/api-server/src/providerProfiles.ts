import { generatedSaasProviderProfileManifest } from "./generatedSaasProviderProfile";
import { SaasProviderProfileMismatchProblem } from "./problems";

export const SAAS_PROVIDER_PROFILE_ENV = "SAAS_PROVIDER_PROFILE";
export const SAAS_DEMO_ENDPOINTS_ENABLED_ENV = "SAAS_DEMO_ENDPOINTS_ENABLED";
export const DEFAULT_SAAS_PROVIDER_PROFILE = generatedSaasProviderProfileManifest.profile.name;

export type SaasProviderProfileName = typeof DEFAULT_SAAS_PROVIDER_PROFILE;

export type SaasProviderProfile = {
  readonly name: SaasProviderProfileName;
  readonly status: "executable" | "documentation-only";
  readonly description: string;
  readonly packages: readonly string[];
  readonly env: readonly string[];
  readonly commands: readonly string[];
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

const generatedProfile: SaasProviderProfile = {
  name: generatedSaasProviderProfileManifest.profile.name,
  status: generatedSaasProviderProfileManifest.composition.executable
    ? "executable"
    : "documentation-only",
  description: generatedSaasProviderProfileManifest.profile.description,
  packages: generatedSaasProviderProfileManifest.packages,
  env: [
    ...generatedSaasProviderProfileManifest.env.required,
    ...generatedSaasProviderProfileManifest.env.optional,
  ].map((entry) => entry.name),
  commands: [
    generatedSaasProviderProfileManifest.smoke.zeroCredential,
    generatedSaasProviderProfileManifest.smoke.realProviderOptIn,
  ],
};

export function getSaasProviderProfile(
  name: string = DEFAULT_SAAS_PROVIDER_PROFILE,
): SaasProviderProfile {
  if (name !== DEFAULT_SAAS_PROVIDER_PROFILE) {
    throw new SaasProviderProfileMismatchProblem(DEFAULT_SAAS_PROVIDER_PROFILE, name);
  }

  return generatedProfile;
}

export function listSaasProviderProfiles(): SaasProviderProfile[] {
  return [generatedProfile];
}

function getRuntimeEnv(): SaasDemoEndpointEnv {
  return (globalThis as RuntimeGlobal).process?.env ?? {};
}

export function isSaasDemoEndpointEnabled(env: SaasDemoEndpointEnv = getRuntimeEnv()): boolean {
  return env.NODE_ENV !== "production" && env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV] === "true";
}
