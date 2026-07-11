type ProviderProfileManifest = {
  readonly profile: {
    readonly name: string;
  };
  readonly env: {
    readonly required: readonly {
      readonly name: string;
    }[];
  };
};

export type ProviderProfileEnvMissingDiagnostic = {
  readonly code: "CROCO_SAAS_PROFILE_ENV_MISSING";
  readonly fields: {
    readonly missingEnv: readonly string[];
  };
};

export class ProviderProfileEnvMissingError extends Error {
  readonly diagnostic: ProviderProfileEnvMissingDiagnostic;

  constructor(missingEnv: readonly string[]) {
    super(`CROCO_SAAS_PROFILE_ENV_MISSING: ${missingEnv.join(", ")}`);
    this.name = "ProviderProfileEnvMissingError";
    this.diagnostic = {
      code: "CROCO_SAAS_PROFILE_ENV_MISSING",
      fields: { missingEnv: [...missingEnv] },
    };
  }
}

export function assertRealProviderEnv(
  manifest: ProviderProfileManifest,
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const configuredProfile = env.SAAS_PROVIDER_PROFILE;

  if (configuredProfile !== manifest.profile.name) {
    throw new Error(
      `CROCO_SAAS_PROFILE_MISMATCH: expected SAAS_PROVIDER_PROFILE=${manifest.profile.name}`,
    );
  }

  const missingEnv = manifest.env.required
    .map((entry) => entry.name)
    .filter((name) => !isEnvConfigured(env[name]));

  if (missingEnv.length > 0) {
    throw new ProviderProfileEnvMissingError(missingEnv);
  }
}

function isEnvConfigured(value: string | undefined): boolean {
  return value !== undefined && value !== "" && !value.startsWith("<");
}
