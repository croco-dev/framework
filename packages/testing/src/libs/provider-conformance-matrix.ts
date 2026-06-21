import * as assert from "node:assert/strict";

export type ProviderConformanceCategory =
  | "auth"
  | "batch"
  | "billing"
  | "cache"
  | "drizzle"
  | "llm"
  | "metering"
  | "rate-limit"
  | "search"
  | "storage"
  | "tasks"
  | "telemetry"
  | "triggers";

export type ProviderConformanceMatrixCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type ProviderConformanceCapability =
  | {
      readonly evidence?: readonly string[];
      readonly methods: readonly string[];
      readonly name: string;
      readonly required: boolean;
      readonly suite: string;
      readonly supported: true;
    }
  | {
      readonly evidence?: readonly string[];
      readonly methods?: readonly string[];
      readonly name: string;
      readonly reason: string;
      readonly required: boolean;
      readonly suite?: string;
      readonly supported: false;
    };

export type ProviderConformanceProfile = {
  readonly capabilities: readonly ProviderConformanceCapability[];
  readonly category: ProviderConformanceCategory;
  readonly packageName: string;
  readonly providerName: string;
};

export type ProviderConformanceMatrixOptions = {
  readonly profiles: readonly ProviderConformanceProfile[];
};

export type ProviderConformanceCapabilityManifest = {
  readonly evidence?: readonly string[];
  readonly methods: readonly string[];
  readonly name: string;
  readonly reason?: string;
  readonly required: boolean;
  readonly suite?: string;
  readonly supported: boolean;
};

export type ProviderConformanceProfileManifest = {
  readonly capabilities: readonly ProviderConformanceCapabilityManifest[];
  readonly category: ProviderConformanceCategory;
  readonly packageName: string;
  readonly providerName: string;
};

export type ProviderConformanceMatrixManifest = {
  readonly profiles: readonly ProviderConformanceProfileManifest[];
  readonly version: "croco.provider-conformance.manifest.v1";
};

export type ProviderConformanceMatrixSuite = {
  readonly cases: readonly ProviderConformanceMatrixCase[];
  readonly manifest: ProviderConformanceMatrixManifest;
};

export function createProviderConformanceMatrixSuite(
  options: ProviderConformanceMatrixOptions,
): ProviderConformanceMatrixSuite {
  return {
    cases: [
      {
        name: "provider conformance matrix: declares at least one provider profile",
        run: async () => {
          assert.ok(
            options.profiles.length > 0,
            "Provider conformance matrix requires at least one provider profile.",
          );
        },
      },
      ...options.profiles.flatMap(toProfileCases),
    ],
    manifest: createProviderConformanceMatrixManifest(options.profiles),
  };
}

function createProviderConformanceMatrixManifest(
  profiles: readonly ProviderConformanceProfile[],
): ProviderConformanceMatrixManifest {
  return {
    version: "croco.provider-conformance.manifest.v1",
    profiles: profiles.map((profile) => ({
      packageName: profile.packageName,
      providerName: profile.providerName,
      category: profile.category,
      capabilities: profile.capabilities.map((capability) => ({
        name: capability.name,
        required: capability.required,
        supported: capability.supported,
        methods: capability.methods ?? [],
        ...(capability.suite ? { suite: capability.suite } : {}),
        ...(capability.supported ? {} : { reason: capability.reason }),
        ...(capability.evidence ? { evidence: capability.evidence } : {}),
      })),
    })),
  };
}

function toProfileCases(profile: ProviderConformanceProfile): ProviderConformanceMatrixCase[] {
  const profileLabel = `${profile.packageName} ${profile.category} provider profile`;

  return [
    {
      name: `${profileLabel}: declares provider identity`,
      run: async () => {
        assertNonEmpty(profile.packageName, "Provider conformance profile requires packageName.");
        assertNonEmpty(profile.providerName, `${profile.packageName} requires providerName.`);
        assert.ok(
          profile.capabilities.length > 0,
          `${profile.packageName} must declare at least one ${profile.category} capability.`,
        );
      },
    },
    ...profile.capabilities.map((capability) => toCapabilityCase(profile, capability)),
  ];
}

function toCapabilityCase(
  profile: ProviderConformanceProfile,
  capability: ProviderConformanceCapability,
): ProviderConformanceMatrixCase {
  const label = formatCapabilityLabel(profile, capability);

  if (capability.supported) {
    return {
      name: `${label}: supported by ${capability.suite}`,
      run: async () => {
        assertNonEmpty(
          capability.name,
          `${profile.packageName} has an unnamed ${profile.category} capability.`,
        );
        assertNonEmpty(
          capability.suite,
          `${profile.packageName} ${profile.category}/${capability.name} requires a conformance suite name.`,
        );
        assert.ok(
          capability.methods.length > 0,
          `${profile.packageName} ${profile.category}/${capability.name} must name at least one contract method.`,
        );
        for (const method of capability.methods) {
          assertNonEmpty(
            method,
            `${profile.packageName} ${profile.category}/${capability.name} has an unnamed contract method.`,
          );
        }
      },
    };
  }

  return {
    name: `${label}: documents unsupported ${capability.required ? "required" : "optional"} capability`,
    run: async () => {
      assertNonEmpty(
        capability.name,
        `${profile.packageName} has an unnamed ${profile.category} capability.`,
      );
      assertNonEmpty(
        capability.reason,
        `${profile.packageName} must document why ${profile.category}/${capability.name} is unsupported.`,
      );

      if (capability.required) {
        assert.fail(
          `${profile.packageName} must support required ${profile.category}/${capability.name}${formatMethods(
            capability.methods,
          )}: ${capability.reason}`,
        );
      }
    },
  };
}

function formatCapabilityLabel(
  profile: ProviderConformanceProfile,
  capability: ProviderConformanceCapability,
): string {
  return `${profile.packageName}: ${profile.category}/${capability.name}${formatMethods(
    capability.methods,
  )}`;
}

function formatMethods(methods: readonly string[] | undefined): string {
  if (!methods?.length) {
    return "";
  }

  return ` (${methods.join(", ")})`;
}

function assertNonEmpty(value: string, message: string): void {
  assert.ok(value.trim().length > 0, message);
}
