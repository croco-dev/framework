import {
  DEFAULT_TENANT_MODEL,
  createTenantModelManifest,
  getTenantModelDefinition,
  validateTenantModelCompatibility,
  type TenantModelCapabilityName,
  type TenantModelName,
} from "@croco/tenant-core/tenant-model";
import {
  renderSafeEnvExampleValue,
  renderSecretPlaceholderPolicyTable,
  renderSecretsChecklistPlaceholderItems,
} from "./secret-placeholder-policy.js";
import { getGeneratedAppDependencyRange } from "./package-version.js";

export const SAAS_PROVIDER_PROFILE_CHOICES = [
  "saas-node-postgres",
  "saas-cloudflare",
  "saas-lambda",
] as const;

export const DEFAULT_SAAS_PROVIDER_PROFILE = "saas-node-postgres" satisfies SaasProviderProfileName;
export const SAAS_PROVIDER_PROFILE_MANIFEST_SCHEMA_VERSION = "croco.saas-provider-profile/v1";
export const SAAS_PROVIDER_PROFILE_MANIFEST_SCHEMA_ID =
  "https://croco.dev/schemas/saas-provider-profile.v1.json";
export const SUPPORTED_SAAS_PROVIDER_PROFILE_MANIFEST_SCHEMA_VERSIONS = [
  SAAS_PROVIDER_PROFILE_MANIFEST_SCHEMA_VERSION,
] as const;
export const SAAS_PROVIDER_PROFILE_MANIFEST_COMPATIBILITY_RULES = [
  "croco.saas-provider-profile/v1 changes must be additive for existing fields.",
  "Removing or renaming provider profile fields requires a new schemaVersion and migration notes.",
  "Generated provider manifest, tenant manifest, provider docs, .env.example, and generated TS source must be committed together.",
] as const;

export type SaasProviderProfileName = (typeof SAAS_PROVIDER_PROFILE_CHOICES)[number];
export type SaasProviderProfileManifestSchemaVersion =
  (typeof SUPPORTED_SAAS_PROVIDER_PROFILE_MANIFEST_SCHEMA_VERSIONS)[number];

export type SaasProviderCapabilityName =
  | "runtime"
  | "auth"
  | "billing"
  | "metering"
  | "storage"
  | "tasks"
  | "telemetry"
  | "webhookVerification";

type CapabilityStatus = "configured" | "documented";

export type SaasProviderEnvVar = {
  name: string;
  description: string;
  requiredForRealProvider: boolean;
  secret: boolean;
  example?: string;
};

export type SaasProviderCapability = {
  capability: SaasProviderCapabilityName;
  provider: string;
  status: CapabilityStatus;
  packageName?: string;
  env: readonly string[];
  notes: string;
};

export type SaasProviderProfileDefinition = {
  name: SaasProviderProfileName;
  displayName: string;
  runtimeTarget: "node" | "cloudflare-workers" | "lambda";
  description: string;
  packages: readonly string[];
  env: readonly SaasProviderEnvVar[];
  capabilities: Record<SaasProviderCapabilityName, SaasProviderCapability>;
  zeroCredentialSmoke: string;
  realProviderSmoke: string;
  deployNotes: readonly string[];
};

export type SaasProviderProfileManifest = {
  schemaVersion: SaasProviderProfileManifestSchemaVersion;
  schema: {
    id: typeof SAAS_PROVIDER_PROFILE_MANIFEST_SCHEMA_ID;
    version: typeof SAAS_PROVIDER_PROFILE_MANIFEST_SCHEMA_VERSION;
    supportedVersions: typeof SUPPORTED_SAAS_PROVIDER_PROFILE_MANIFEST_SCHEMA_VERSIONS;
  };
  profile: {
    name: SaasProviderProfileName;
    displayName: string;
    runtimeTarget: SaasProviderProfileDefinition["runtimeTarget"];
    description: string;
  };
  packages: readonly string[];
  env: {
    required: readonly SaasProviderEnvVar[];
    optional: readonly SaasProviderEnvVar[];
  };
  capabilities: readonly SaasProviderCapability[];
  smoke: {
    zeroCredential: string;
    realProviderOptIn: string;
  };
  compatibility: {
    requiredCapabilities: readonly SaasProviderCapabilityName[];
    rules: typeof SAAS_PROVIDER_PROFILE_MANIFEST_COMPATIBILITY_RULES;
    generatedArtifacts: {
      manifest: "croco-saas-profile.manifest.json";
      tenantModelManifest: "croco-tenant-model.manifest.json";
      tenantModelSchema: "croco-tenant-model.schema.json";
      providerDocs: "docs/provider-profile.md";
      secretsChecklist: "docs/secrets-checklist.md";
      tenantModelPlaybook: "docs/tenant-model-playbook.md";
      envExample: ".env.example";
      source: "apps/api-server/src/generatedSaasProviderProfile.ts";
    };
    migration: {
      requiredForVersionChange: true;
      guidance: readonly string[];
    };
    qualityGates: readonly string[];
  };
  tenantModel: {
    currentModel: TenantModelName;
    defaultModel: TenantModelName;
    manifest: "croco-tenant-model.manifest.json";
    schema: "croco-tenant-model.schema.json";
    playbook: "docs/tenant-model-playbook.md";
    requiredPackages: readonly string[];
    requiredAdapters: readonly string[];
    requiredCapabilities: readonly TenantModelCapabilityName[];
  };
  deployNotes: readonly string[];
};

const SAAS_PROVIDER_THIRD_PARTY_PACKAGE_RANGES: Record<string, string> = {
  "@clerk/backend": "^1.0.0",
  "@polar-sh/sdk": "^0.32.2",
  "@upstash/qstash": "^2.9.0",
  "@upstash/redis": "^1.34.0",
  cloudinary: "^2.10.0",
};

export const REQUIRED_SAAS_PROVIDER_CAPABILITIES = [
  "runtime",
  "auth",
  "billing",
  "metering",
  "storage",
  "tasks",
  "telemetry",
  "webhookVerification",
] as const satisfies readonly SaasProviderCapabilityName[];

const GENERATED_SAAS_TENANT_MODEL_PACKAGES = [
  "@croco/tenant-core",
  "@croco/membership-core",
  "@croco/invitation-core",
  "@croco/tx-core",
] as const;

const commonEnv = [
  envVar("SAAS_PROVIDER_PROFILE", "Selected generated provider profile name.", true, false),
  envVar("SAAS_DEMO_ENDPOINTS_ENABLED", "Opt-in local HTTP demo endpoints.", false, false, "false"),
  envVar("TELEMETRY_ENABLED", "Enable OpenTelemetry exporter wiring.", false, false, "true"),
  envVar(
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "OTLP endpoint used by telemetry init and flush.",
    false,
    false,
  ),
] as const;

export const SAAS_PROVIDER_PROFILES = {
  "saas-node-postgres": {
    name: "saas-node-postgres",
    displayName: "Node/Postgres SaaS",
    runtimeTarget: "node",
    description:
      "Node API profile with Postgres-backed domain state, Polar billing, Upstash queues, Cloudinary storage, and OTLP telemetry.",
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
      "drizzle-orm",
      "@polar-sh/sdk",
      "@upstash/qstash",
      "cloudinary",
    ],
    env: [
      ...commonEnv,
      envVar("DATABASE_URL", "Postgres connection URL for Drizzle-backed providers.", true, true),
      envVar("BETTER_AUTH_SECRET", "Better Auth signing secret.", true, true),
      envVar("BETTER_AUTH_URL", "Public API origin used by Better Auth callbacks.", true, false),
      envVar("POLAR_ACCESS_TOKEN", "Polar API access token.", true, true),
      envVar("POLAR_WEBHOOK_SECRET", "Polar webhook signature secret.", true, true),
      envVar("POLAR_PRODUCT_ID_TEAM", "Polar product id for the team plan.", true, false),
      envVar("UPSTASH_QSTASH_TOKEN", "QStash token for task delivery.", true, true),
      envVar(
        "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
        "Current QStash webhook signing key.",
        true,
        true,
      ),
      envVar("UPSTASH_QSTASH_NEXT_SIGNING_KEY", "Next QStash webhook signing key.", true, true),
      envVar("CLOUDINARY_URL", "Cloudinary URL for generated object storage.", true, true),
    ],
    capabilities: capabilities({
      runtime: capability("runtime", "Node HTTP", "configured", "@croco/transports-http", ["PORT"]),
      auth: capability("auth", "Better Auth + Drizzle", "documented", "@croco/auth-better-auth", [
        "DATABASE_URL",
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL",
      ]),
      billing: capability("billing", "Polar", "documented", "@croco/billing-polar", [
        "POLAR_ACCESS_TOKEN",
        "POLAR_WEBHOOK_SECRET",
        "POLAR_PRODUCT_ID_TEAM",
      ]),
      metering: capability(
        "metering",
        "Drizzle metering",
        "documented",
        "@croco/metering-drizzle",
        ["DATABASE_URL"],
      ),
      storage: capability("storage", "Cloudinary", "documented", "@croco/storage-cloudinary", [
        "CLOUDINARY_URL",
      ]),
      tasks: capability("tasks", "QStash", "documented", "@croco/tasks-qstash", [
        "UPSTASH_QSTASH_TOKEN",
        "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
        "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
      ]),
      telemetry: capability(
        "telemetry",
        "OpenTelemetry SDK Node",
        "configured",
        "@croco/telemetry-sdk-node",
        ["TELEMETRY_ENABLED", "OTEL_EXPORTER_OTLP_ENDPOINT"],
      ),
      webhookVerification: capability(
        "webhookVerification",
        "Polar + QStash signatures",
        "documented",
        undefined,
        [
          "POLAR_WEBHOOK_SECRET",
          "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
          "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
        ],
      ),
    }),
    zeroCredentialSmoke: "pnpm demo:smoke",
    realProviderSmoke: "SAAS_PROVIDER_PROFILE=saas-node-postgres pnpm profile:smoke:real",
    deployNotes: [
      "Start the Node API after TelemetryRuntime.init() resolves and call forceFlush() before process shutdown.",
      "Verify Polar webhooks with POLAR_WEBHOOK_SECRET before mutating billing or entitlement state.",
      "Verify QStash signatures before queue/task handlers accept delivery.",
      "Run pnpm profile:check in CI to detect manifest drift before deployment.",
    ],
  },
  "saas-cloudflare": {
    name: "saas-cloudflare",
    displayName: "Cloudflare SaaS",
    runtimeTarget: "cloudflare-workers",
    description:
      "Cloudflare Workers profile with Clerk auth, Polar billing, Upstash metering/tasks, R2 storage, and explicit Worker runtime limits.",
    packages: [
      "@croco/preset-cloudflare",
      "@croco/transports-cloudflare-workers",
      "@croco/auth-clerk",
      "@croco/billing-polar",
      "@croco/metering-upstash",
      "@croco/storage-r2",
      "@croco/tasks-qstash",
      "@croco/triggers-qstash",
      "@clerk/backend",
      "@polar-sh/sdk",
      "@upstash/qstash",
      "@upstash/redis",
    ],
    env: [
      ...commonEnv,
      envVar("CLOUDFLARE_ACCOUNT_ID", "Cloudflare account id for Workers and R2.", true, true),
      envVar("CLOUDFLARE_API_TOKEN", "Cloudflare deploy token.", true, true),
      envVar("R2_BUCKET", "R2 bucket name for object storage.", true, false),
      envVar("CLERK_SECRET_KEY", "Clerk backend secret key.", true, true),
      envVar("POLAR_ACCESS_TOKEN", "Polar API access token.", true, true),
      envVar("POLAR_WEBHOOK_SECRET", "Polar webhook signature secret.", true, true),
      envVar("POLAR_PRODUCT_ID_TEAM", "Polar product id for the team plan.", true, false),
      envVar("UPSTASH_REDIS_REST_URL", "Upstash Redis REST URL for metering state.", true, true),
      envVar("UPSTASH_REDIS_REST_TOKEN", "Upstash Redis REST token.", true, true),
      envVar("UPSTASH_QSTASH_TOKEN", "QStash token for task delivery.", true, true),
      envVar(
        "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
        "Current QStash webhook signing key.",
        true,
        true,
      ),
      envVar("UPSTASH_QSTASH_NEXT_SIGNING_KEY", "Next QStash webhook signing key.", true, true),
    ],
    capabilities: capabilities({
      runtime: capability(
        "runtime",
        "Cloudflare Workers",
        "documented",
        "@croco/transports-cloudflare-workers",
        ["CLOUDFLARE_ACCOUNT_ID"],
      ),
      auth: capability("auth", "Clerk", "documented", "@croco/auth-clerk", ["CLERK_SECRET_KEY"]),
      billing: capability("billing", "Polar", "documented", "@croco/billing-polar", [
        "POLAR_ACCESS_TOKEN",
        "POLAR_WEBHOOK_SECRET",
        "POLAR_PRODUCT_ID_TEAM",
      ]),
      metering: capability("metering", "Upstash Redis", "documented", "@croco/metering-upstash", [
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
      ]),
      storage: capability("storage", "Cloudflare R2", "documented", "@croco/storage-r2", [
        "R2_BUCKET",
      ]),
      tasks: capability("tasks", "QStash", "documented", "@croco/tasks-qstash", [
        "UPSTASH_QSTASH_TOKEN",
        "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
        "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
      ]),
      telemetry: capability(
        "telemetry",
        "OpenTelemetry fetch export",
        "documented",
        "@croco/telemetry-api",
        ["TELEMETRY_ENABLED", "OTEL_EXPORTER_OTLP_ENDPOINT"],
      ),
      webhookVerification: capability(
        "webhookVerification",
        "Polar + QStash signatures",
        "documented",
        undefined,
        [
          "POLAR_WEBHOOK_SECRET",
          "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
          "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
        ],
      ),
    }),
    zeroCredentialSmoke: "pnpm demo:smoke",
    realProviderSmoke: "SAAS_PROVIDER_PROFILE=saas-cloudflare pnpm profile:smoke:real",
    deployNotes: [
      "Keep generated smoke local; use pnpm profile:smoke:real only after Worker secrets are bound.",
      "Verify Polar and QStash signatures before Worker handlers mutate billing, metering, or task state.",
      "Flush telemetry through the Worker request lifecycle instead of AWS exec-wrapper style boot hooks.",
      "Run pnpm profile:check in CI and fail deployment when runtimeTarget or required capabilities drift.",
    ],
  },
  "saas-lambda": {
    name: "saas-lambda",
    displayName: "Lambda SaaS",
    runtimeTarget: "lambda",
    description:
      "AWS Lambda profile with Clerk auth, Polar billing, Upstash metering/tasks, Cloudinary storage, and explicit init/flush telemetry.",
    packages: [
      "@croco/preset-lambda",
      "@croco/auth-clerk",
      "@croco/billing-polar",
      "@croco/metering-upstash",
      "@croco/storage-cloudinary",
      "@croco/tasks-qstash",
      "@croco/triggers-qstash",
      "@croco/telemetry-sdk-node",
      "@clerk/backend",
      "@polar-sh/sdk",
      "@upstash/qstash",
      "@upstash/redis",
      "cloudinary",
    ],
    env: [
      ...commonEnv,
      envVar("AWS_REGION", "AWS region for Lambda deployment.", true, false),
      envVar("CLERK_SECRET_KEY", "Clerk backend secret key.", true, true),
      envVar("POLAR_ACCESS_TOKEN", "Polar API access token.", true, true),
      envVar("POLAR_WEBHOOK_SECRET", "Polar webhook signature secret.", true, true),
      envVar("POLAR_PRODUCT_ID_TEAM", "Polar product id for the team plan.", true, false),
      envVar("UPSTASH_REDIS_REST_URL", "Upstash Redis REST URL for metering state.", true, true),
      envVar("UPSTASH_REDIS_REST_TOKEN", "Upstash Redis REST token.", true, true),
      envVar("UPSTASH_QSTASH_TOKEN", "QStash token for task delivery.", true, true),
      envVar(
        "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
        "Current QStash webhook signing key.",
        true,
        true,
      ),
      envVar("UPSTASH_QSTASH_NEXT_SIGNING_KEY", "Next QStash webhook signing key.", true, true),
      envVar("CLOUDINARY_URL", "Cloudinary URL for generated object storage.", true, true),
    ],
    capabilities: capabilities({
      runtime: capability("runtime", "AWS Lambda", "documented", "@croco/preset-lambda", [
        "AWS_REGION",
      ]),
      auth: capability("auth", "Clerk", "documented", "@croco/auth-clerk", ["CLERK_SECRET_KEY"]),
      billing: capability("billing", "Polar", "documented", "@croco/billing-polar", [
        "POLAR_ACCESS_TOKEN",
        "POLAR_WEBHOOK_SECRET",
        "POLAR_PRODUCT_ID_TEAM",
      ]),
      metering: capability("metering", "Upstash Redis", "documented", "@croco/metering-upstash", [
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
      ]),
      storage: capability("storage", "Cloudinary", "documented", "@croco/storage-cloudinary", [
        "CLOUDINARY_URL",
      ]),
      tasks: capability("tasks", "QStash", "documented", "@croco/tasks-qstash", [
        "UPSTASH_QSTASH_TOKEN",
        "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
        "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
      ]),
      telemetry: capability(
        "telemetry",
        "OpenTelemetry SDK Node",
        "configured",
        "@croco/telemetry-sdk-node",
        ["TELEMETRY_ENABLED", "OTEL_EXPORTER_OTLP_ENDPOINT"],
      ),
      webhookVerification: capability(
        "webhookVerification",
        "Polar + QStash signatures",
        "documented",
        undefined,
        [
          "POLAR_WEBHOOK_SECRET",
          "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
          "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
        ],
      ),
    }),
    zeroCredentialSmoke: "pnpm demo:smoke",
    realProviderSmoke: "SAAS_PROVIDER_PROFILE=saas-lambda pnpm profile:smoke:real",
    deployNotes: [
      "Initialize TelemetryRuntime at module scope and call forceFlush() in the Lambda handler finally block.",
      "Do not rely on AWS_LAMBDA_EXEC_WRAPPER; generated Croco Lambda apps own telemetry init timing.",
      "Verify Polar and QStash webhook signatures before enqueueing or mutating state.",
      "Run pnpm profile:check before packaging and pnpm profile:smoke:real only with real-provider env loaded.",
    ],
  },
} as const satisfies Record<SaasProviderProfileName, SaasProviderProfileDefinition>;

export function getSaasProviderProfileDefinition(
  name: SaasProviderProfileName = DEFAULT_SAAS_PROVIDER_PROFILE,
): SaasProviderProfileDefinition {
  return SAAS_PROVIDER_PROFILES[name];
}

export function createSaasProviderProfileManifest(
  profile: SaasProviderProfileDefinition,
  tenantModel: TenantModelName = DEFAULT_TENANT_MODEL,
): SaasProviderProfileManifest {
  const tenantModelManifest = createTenantModelManifest(tenantModel);

  return {
    schemaVersion: SAAS_PROVIDER_PROFILE_MANIFEST_SCHEMA_VERSION,
    schema: {
      id: SAAS_PROVIDER_PROFILE_MANIFEST_SCHEMA_ID,
      version: SAAS_PROVIDER_PROFILE_MANIFEST_SCHEMA_VERSION,
      supportedVersions: SUPPORTED_SAAS_PROVIDER_PROFILE_MANIFEST_SCHEMA_VERSIONS,
    },
    profile: {
      name: profile.name,
      displayName: profile.displayName,
      runtimeTarget: profile.runtimeTarget,
      description: profile.description,
    },
    packages: profile.packages,
    env: {
      required: profile.env.filter((entry) => entry.requiredForRealProvider),
      optional: profile.env.filter((entry) => !entry.requiredForRealProvider),
    },
    capabilities: REQUIRED_SAAS_PROVIDER_CAPABILITIES.map(
      (capabilityName) => profile.capabilities[capabilityName],
    ),
    smoke: {
      zeroCredential: profile.zeroCredentialSmoke,
      realProviderOptIn: profile.realProviderSmoke,
    },
    compatibility: {
      requiredCapabilities: REQUIRED_SAAS_PROVIDER_CAPABILITIES,
      rules: SAAS_PROVIDER_PROFILE_MANIFEST_COMPATIBILITY_RULES,
      generatedArtifacts: {
        manifest: "croco-saas-profile.manifest.json",
        tenantModelManifest: "croco-tenant-model.manifest.json",
        tenantModelSchema: "croco-tenant-model.schema.json",
        providerDocs: "docs/provider-profile.md",
        secretsChecklist: "docs/secrets-checklist.md",
        tenantModelPlaybook: "docs/tenant-model-playbook.md",
        envExample: ".env.example",
        source: "apps/api-server/src/generatedSaasProviderProfile.ts",
      },
      migration: {
        requiredForVersionChange: true,
        guidance: [
          "Keep v1 changes additive unless generated app consumers cannot safely read the new shape.",
          "Bump schemaVersion only with release notes, migration guidance, and croco doctor support for the new version.",
          "Run profile:check, croco doctor, and generated app smoke checks before accepting a manifest version change.",
        ],
      },
      qualityGates: ["profile:check", "croco doctor --json", "demo:smoke"],
    },
    tenantModel: {
      currentModel: tenantModelManifest.currentModel,
      defaultModel: tenantModelManifest.defaultModel,
      manifest: "croco-tenant-model.manifest.json",
      schema: "croco-tenant-model.schema.json",
      playbook: "docs/tenant-model-playbook.md",
      requiredPackages: tenantModelManifest.selected.requiredPackages,
      requiredAdapters: tenantModelManifest.selected.requiredAdapters,
      requiredCapabilities: tenantModelManifest.selected.requiredCapabilities,
    },
    deployNotes: profile.deployNotes,
  };
}

export function assertSaasProviderProfileCapabilities(profile: {
  name: string;
  capabilities: Partial<Record<SaasProviderCapabilityName, SaasProviderCapability>>;
}): void {
  const missingCapabilities = REQUIRED_SAAS_PROVIDER_CAPABILITIES.filter(
    (capabilityName) => profile.capabilities[capabilityName] === undefined,
  );

  if (missingCapabilities.length > 0) {
    throw new Error(
      `CROCO_SAAS_PROFILE_CAPABILITY_MISSING: ${profile.name} lacks ${missingCapabilities.join(", ")}`,
    );
  }
}

export function getSaasProviderPackageDependencyRange(packageName: string): string {
  if (packageName.startsWith("@croco/")) {
    return "workspace:*";
  }

  if (packageName === "drizzle-orm") {
    return getGeneratedAppDependencyRange(packageName);
  }

  const range = SAAS_PROVIDER_THIRD_PARTY_PACKAGE_RANGES[packageName];
  if (range === undefined) {
    throw new Error(`CROCO_SAAS_PROFILE_PACKAGE_RANGE_MISSING: ${packageName}`);
  }

  return range;
}

export function assertSaasProviderTenantModelCompatibility(
  profile: SaasProviderProfileDefinition,
  tenantModel: TenantModelName = DEFAULT_TENANT_MODEL,
): void {
  const result = validateTenantModelCompatibility({
    tenantModel,
    providerProfileName: profile.name,
    runtimeTarget: profile.runtimeTarget,
    packages: [...profile.packages, ...GENERATED_SAAS_TENANT_MODEL_PACKAGES],
  });

  if (result.ok) return;

  throw new Error(
    [
      `CROCO_TENANT_MODEL_COMPATIBILITY_FAILED: ${profile.name} cannot use tenant model '${tenantModel}'`,
      ...result.diagnostics.map((diagnostic) => `- ${diagnostic.code}: ${diagnostic.message}`),
    ].join("\n"),
  );
}

export function renderSaasEnvExample(manifest: SaasProviderProfileManifest): string {
  const lines = [
    "# Generated by create-croco-app. Keep in sync with croco-saas-profile.manifest.json.",
    ...[...manifest.env.required, ...manifest.env.optional].flatMap((entry) => [
      "",
      `# ${entry.description}`,
      `${entry.name}=${renderSafeEnvExampleValue(entry, manifest.profile.name)}`,
    ]),
    "",
  ];

  return lines.join("\n");
}

export function renderSaasSecretsChecklist(manifest: SaasProviderProfileManifest): string {
  const requiredSecrets = manifest.env.required.filter((entry) => entry.secret);
  const nonSecretConfig = manifest.env.required.filter((entry) => !entry.secret);

  return [
    `# ${manifest.profile.displayName} Secrets Checklist`,
    "",
    "## Placeholder Policy",
    "",
    renderSecretPlaceholderPolicyTable(manifest),
    "",
    "## Required Secrets",
    "",
    ...renderSecretsChecklistPlaceholderItems(manifest, requiredSecrets),
    "",
    "## Required Non-Secret Config",
    "",
    ...renderSecretsChecklistPlaceholderItems(manifest, nonSecretConfig),
    "",
    "## Real-Provider Smoke",
    "",
    `Run \`${manifest.smoke.realProviderOptIn}\` only after the required values above are loaded.`,
    "",
  ].join("\n");
}

export function renderSaasDeployNotes(manifest: SaasProviderProfileManifest): string {
  const tenantModel = getTenantModelDefinition(manifest.tenantModel.currentModel);

  return [
    `# ${manifest.profile.displayName} Deploy Notes`,
    "",
    "## Manifest Contract",
    "",
    `Schema id: \`${manifest.schema.id}\``,
    `Schema version: \`${manifest.schemaVersion}\``,
    `Supported versions: \`${manifest.schema.supportedVersions.join(", ")}\``,
    "",
    "Compatibility rules:",
    ...manifest.compatibility.rules.map((rule) => `- ${rule}`),
    "",
    "Generated artifacts:",
    ...Object.entries(manifest.compatibility.generatedArtifacts).map(
      ([label, file]) => `- ${label}: \`${file}\``,
    ),
    "",
    "Version migration guidance:",
    ...manifest.compatibility.migration.guidance.map((step) => `- ${step}`),
    "",
    "Quality gates:",
    ...manifest.compatibility.qualityGates.map((gate) => `- \`${gate}\``),
    "",
    "## Placeholder Policy",
    "",
    renderSecretPlaceholderPolicyTable(manifest),
    "",
    "Generated `.env.example`, provider docs, and secrets checklists must use these safe values. Load real provider credentials from deployment secrets only.",
    "",
    `Runtime target: \`${manifest.profile.runtimeTarget}\``,
    `Tenant model: \`${tenantModel.name}\` (${tenantModel.displayName})`,
    "",
    "## Provider Packages",
    "",
    ...manifest.packages.map((packageName) => `- ${packageName}`),
    "",
    "## Capability Matrix",
    "",
    "| Capability | Provider | Package | Env | Status |",
    "| --- | --- | --- | --- | --- |",
    ...manifest.capabilities.map(
      (capability) =>
        `| ${capability.capability} | ${capability.provider} | ${capability.packageName ?? "-"} | ${
          capability.env.length > 0 ? capability.env.join(", ") : "-"
        } | ${capability.status} |`,
    ),
    "",
    "## Tenant Model",
    "",
    tenantModel.summary,
    "",
    `Playbook: \`${manifest.tenantModel.playbook}\``,
    `Manifest: \`${manifest.tenantModel.manifest}\``,
    "",
    "## Deployment Notes",
    "",
    ...manifest.deployNotes.map((note) => `- ${note}`),
    "",
  ].join("\n");
}

export function formatSaasProviderProfileChoices(): string {
  return SAAS_PROVIDER_PROFILE_CHOICES.join("|");
}

function envVar(
  name: string,
  description: string,
  requiredForRealProvider: boolean,
  secret: boolean,
  example?: string,
): SaasProviderEnvVar {
  const base = { name, description, requiredForRealProvider, secret };
  return example === undefined ? base : { ...base, example };
}

function capability(
  capabilityName: SaasProviderCapabilityName,
  provider: string,
  status: CapabilityStatus,
  packageName: string | undefined,
  env: readonly string[],
): SaasProviderCapability {
  const base = {
    capability: capabilityName,
    provider,
    status,
    env,
    notes: `${provider} covers ${capabilityName}.`,
  };
  return packageName === undefined ? base : { ...base, packageName };
}

function capabilities(
  entries: Record<SaasProviderCapabilityName, SaasProviderCapability>,
): Record<SaasProviderCapabilityName, SaasProviderCapability> {
  return entries;
}
