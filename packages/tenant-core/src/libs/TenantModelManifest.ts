export const TENANT_MODEL_MANIFEST_SCHEMA_VERSION = "croco.tenant-model/v1";
export const TENANT_MODEL_MANIFEST_SCHEMA_ID =
  "https://croco.dev/schemas/tenant-model-manifest.v1.json";
export const SUPPORTED_TENANT_MODEL_MANIFEST_SCHEMA_VERSIONS = [
  TENANT_MODEL_MANIFEST_SCHEMA_VERSION,
] as const;
export const TENANT_MODEL_MANIFEST_COMPATIBILITY_RULES = [
  "croco.tenant-model/v1 changes must be additive for existing fields.",
  "Removing or renaming tenant model fields requires a new schemaVersion and migration notes.",
  "Generated croco-tenant-model.manifest.json, croco-tenant-model.schema.json, docs/tenant-model-playbook.md, and generatedTenantModel.ts must be committed together.",
] as const;

export type TenantModelManifestSchemaVersion =
  (typeof SUPPORTED_TENANT_MODEL_MANIFEST_SCHEMA_VERSIONS)[number];

export const TENANT_MODEL_NAMES = [
  "single",
  "org",
  "workspace",
  "shared-schema",
  "rls-backed",
] as const;

export type TenantModelName = (typeof TENANT_MODEL_NAMES)[number];

export const DEFAULT_TENANT_MODEL = "org" satisfies TenantModelName;

export type TenantModelRuntimeTarget = "node" | "cloudflare-workers" | "lambda";

export type TenantModelCapabilityName =
  | "tenant-context"
  | "tenant-identity"
  | "membership"
  | "workspace-selection"
  | "tenant-discriminator"
  | "tenant-query-filter"
  | "postgres-rls"
  | "migration-plan";

export type TenantModelRiskLevel = "none" | "low" | "medium" | "high";

export type TenantModelDiagnosticCode =
  | "tenant-core/tenant-model-runtime-incompatible"
  | "tenant-core/tenant-model-package-missing"
  | "tenant-core/tenant-model-capability-missing"
  | "tenant-core/tenant-model-manual-migration-required";

export type TenantModelDefinition = {
  readonly name: TenantModelName;
  readonly displayName: string;
  readonly summary: string;
  readonly tenantKey: string;
  readonly isolation: "none" | "membership" | "tenant-column" | "postgres-rls";
  readonly requiredPackages: readonly string[];
  readonly requiredAdapters: readonly string[];
  readonly requiredCapabilities: readonly TenantModelCapabilityName[];
  readonly supportedRuntimeTargets: readonly TenantModelRuntimeTarget[];
  readonly schemaHints: readonly string[];
  readonly migrationHints: readonly string[];
  readonly unsafeMigrationWarnings: readonly string[];
};

export type TenantModelManifest = {
  readonly schemaVersion: TenantModelManifestSchemaVersion;
  readonly currentModel: TenantModelName;
  readonly defaultModel: TenantModelName;
  readonly selected: TenantModelDefinition;
  readonly models: readonly TenantModelDefinition[];
  readonly schema: {
    readonly file: "croco-tenant-model.schema.json";
    readonly version: typeof TENANT_MODEL_MANIFEST_SCHEMA_VERSION;
  };
  readonly migration: TenantMigrationPlan;
  readonly diagnostics: readonly {
    readonly code: TenantModelDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly recovery: string;
  }[];
  readonly compatibility: {
    readonly schemaId: typeof TENANT_MODEL_MANIFEST_SCHEMA_ID;
    readonly currentVersion: typeof TENANT_MODEL_MANIFEST_SCHEMA_VERSION;
    readonly supportedVersions: typeof SUPPORTED_TENANT_MODEL_MANIFEST_SCHEMA_VERSIONS;
    readonly rules: typeof TENANT_MODEL_MANIFEST_COMPATIBILITY_RULES;
    readonly generatedArtifacts: {
      readonly manifest: "croco-tenant-model.manifest.json";
      readonly schema: "croco-tenant-model.schema.json";
      readonly playbook: "docs/tenant-model-playbook.md";
      readonly source: "apps/api-server/src/generatedTenantModel.ts";
    };
    readonly migration: {
      readonly requiredForVersionChange: true;
      readonly guidance: readonly string[];
    };
  };
  readonly qualityGates: readonly string[];
};

export type TenantModelManifestSchema = {
  readonly $schema: "https://json-schema.org/draft/2020-12/schema";
  readonly $id: "https://croco.dev/schemas/tenant-model-manifest.v1.json";
  readonly title: "Croco Tenant Model Manifest";
  readonly type: "object";
  readonly required: readonly string[];
  readonly properties: Record<string, unknown>;
};

export type TenantMigrationPlan = {
  readonly from: TenantModelName;
  readonly to: TenantModelName;
  readonly risk: TenantModelRiskLevel;
  readonly manualSteps: readonly string[];
  readonly warnings: readonly {
    readonly code: TenantModelDiagnosticCode;
    readonly message: string;
    readonly recovery: string;
  }[];
};

export type TenantModelCompatibilityInput = {
  readonly tenantModel: TenantModelName;
  readonly providerProfileName: string;
  readonly runtimeTarget: TenantModelRuntimeTarget;
  readonly packages: readonly string[];
  readonly capabilities?: readonly TenantModelCapabilityName[];
};

export type TenantModelCompatibilityDiagnostic = {
  readonly code: TenantModelDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly recovery: string;
};

export type TenantModelCompatibilityResult = {
  readonly ok: boolean;
  readonly diagnostics: readonly TenantModelCompatibilityDiagnostic[];
};

export const TENANT_MODEL_DEFINITIONS = {
  single: {
    name: "single",
    displayName: "Single tenant",
    summary:
      "One logical tenant for the whole application. Use this while product-market fit matters more than tenant administration.",
    tenantKey: "none",
    isolation: "none",
    requiredPackages: ["@croco/tenant-core"],
    requiredAdapters: ["TenantManager"],
    requiredCapabilities: ["tenant-context", "migration-plan"],
    supportedRuntimeTargets: ["node", "cloudflare-workers", "lambda"],
    schemaHints: [
      "Do not add tenant discriminator columns to domain tables.",
      "Keep admin-only data export available so the app can move to an org or workspace model later.",
    ],
    migrationHints: [
      "Create one tenant record that represents the current deployment.",
      "Backfill future tenant-owned rows with that tenant id before enabling scoped queries.",
    ],
    unsafeMigrationWarnings: [],
  },
  org: {
    name: "org",
    displayName: "Organization",
    summary:
      "A SaaS organization owns memberships, invitations, billing, and default tenant context for most B2B apps.",
    tenantKey: "organizationId",
    isolation: "membership",
    requiredPackages: ["@croco/tenant-core", "@croco/membership-core", "@croco/invitation-core"],
    requiredAdapters: ["TenantManager", "MembershipManager", "InvitationManager"],
    requiredCapabilities: ["tenant-context", "tenant-identity", "membership", "migration-plan"],
    supportedRuntimeTargets: ["node", "cloudflare-workers", "lambda"],
    schemaHints: [
      "Create an organizations table or provider-backed organization mapping.",
      "Store membership and invitation records by organization id.",
      "Bind request context from an explicit organization selector, auth claim, header, or route segment.",
    ],
    migrationHints: [
      "Create organization records for each existing account owner or billing account.",
      "Backfill memberships before enforcing tenant-required routes.",
      "Run cross-tenant leak fixtures before removing single-tenant fallbacks.",
    ],
    unsafeMigrationWarnings: [
      "Do not infer organization ownership only from email domains without an explicit admin review.",
    ],
  },
  workspace: {
    name: "workspace",
    displayName: "Workspace",
    summary:
      "A user can belong to multiple workspaces inside an organization. Use this when collaboration spaces need isolated configuration or data.",
    tenantKey: "workspaceId",
    isolation: "membership",
    requiredPackages: ["@croco/tenant-core", "@croco/membership-core", "@croco/invitation-core"],
    requiredAdapters: [
      "TenantManager",
      "MembershipManager",
      "InvitationManager",
      "WorkspaceSelectionAdapter",
    ],
    requiredCapabilities: [
      "tenant-context",
      "tenant-identity",
      "membership",
      "workspace-selection",
      "migration-plan",
    ],
    supportedRuntimeTargets: ["node", "cloudflare-workers", "lambda"],
    schemaHints: [
      "Create workspaces beneath organizations or accounts.",
      "Persist the active workspace id separately from user authentication state.",
      "Scope feature flags, entitlement checks, and generated RPC clients to the active workspace.",
    ],
    migrationHints: [
      "Choose a deterministic default workspace for each existing organization.",
      "Backfill workspace ids onto tenant-owned resources before exposing workspace switching.",
      "Keep an audit trail for rows moved between workspaces.",
    ],
    unsafeMigrationWarnings: [
      "Moving historical rows between workspaces can change entitlement and audit semantics.",
    ],
  },
  "shared-schema": {
    name: "shared-schema",
    displayName: "Shared schema",
    summary:
      "All tenants share the same database schema and every tenant-owned table carries a tenant discriminator column.",
    tenantKey: "tenantId",
    isolation: "tenant-column",
    requiredPackages: ["@croco/tenant-core", "@croco/tx-core"],
    requiredAdapters: ["TenantContextProvider", "TenantFilteredRepository"],
    requiredCapabilities: [
      "tenant-context",
      "tenant-identity",
      "tenant-discriminator",
      "tenant-query-filter",
      "migration-plan",
    ],
    supportedRuntimeTargets: ["node", "cloudflare-workers", "lambda"],
    schemaHints: [
      "Add a non-null tenant id column to every tenant-owned table.",
      "Index tenant id with hot-path lookup keys.",
      "Require repository/query helpers to prove tenant predicates before execution.",
    ],
    migrationHints: [
      "Classify every table as global, tenant-owned, or join data before adding columns.",
      "Backfill tenant ids in a locked or dual-write phase.",
      "Fail reads and writes that omit tenant predicates.",
    ],
    unsafeMigrationWarnings: [
      "A nullable tenant discriminator is an unsafe intermediate state unless writes are frozen.",
      "Global tables must be explicitly marked global instead of silently skipping tenant checks.",
    ],
  },
  "rls-backed": {
    name: "rls-backed",
    displayName: "RLS-backed",
    summary:
      "Postgres row-level security enforces tenant isolation in the database in addition to application-level tenant context.",
    tenantKey: "tenantId",
    isolation: "postgres-rls",
    requiredPackages: ["@croco/tenant-core", "@croco/tx-core", "@croco/tx-drizzle", "drizzle-orm"],
    requiredAdapters: ["TenantContextProvider", "DrizzleTenantSession", "TenantRlsEvidence"],
    requiredCapabilities: [
      "tenant-context",
      "tenant-identity",
      "tenant-discriminator",
      "tenant-query-filter",
      "postgres-rls",
      "migration-plan",
    ],
    supportedRuntimeTargets: ["node"],
    schemaHints: [
      "Use Postgres tables with non-null tenant id columns for tenant-owned rows.",
      "Set the current tenant through a transaction-scoped database setting before queries run.",
      "Enable and force RLS policies before treating the provider as production-ready.",
    ],
    migrationHints: [
      "Add tenant id columns and indexes before enabling RLS.",
      "Create policies in report-only or locked maintenance windows first.",
      "Verify adapter-provided TenantRlsEvidence matches the active tenant before release.",
    ],
    unsafeMigrationWarnings: [
      "Do not enable RLS without proving every write path sets the current tenant database setting.",
      "Do not deploy RLS-backed mode on runtimes without a Postgres transaction boundary.",
    ],
  },
} as const satisfies Record<TenantModelName, TenantModelDefinition>;

export function isTenantModelName(value: string): value is TenantModelName {
  return (TENANT_MODEL_NAMES as readonly string[]).includes(value);
}

export function getTenantModelDefinition(name: TenantModelName): TenantModelDefinition {
  return TENANT_MODEL_DEFINITIONS[name];
}

export function createTenantModelManifest(
  currentModel: TenantModelName = DEFAULT_TENANT_MODEL,
): TenantModelManifest {
  const selected = getTenantModelDefinition(currentModel);
  const migration = createTenantMigrationPlan(DEFAULT_TENANT_MODEL, currentModel);

  return {
    schemaVersion: TENANT_MODEL_MANIFEST_SCHEMA_VERSION,
    currentModel,
    defaultModel: DEFAULT_TENANT_MODEL,
    selected,
    models: TENANT_MODEL_NAMES.map((modelName) => getTenantModelDefinition(modelName)),
    schema: {
      file: "croco-tenant-model.schema.json",
      version: TENANT_MODEL_MANIFEST_SCHEMA_VERSION,
    },
    migration,
    diagnostics: migration.warnings.map((warning) => ({
      ...warning,
      severity: "warning",
    })),
    compatibility: {
      schemaId: TENANT_MODEL_MANIFEST_SCHEMA_ID,
      currentVersion: TENANT_MODEL_MANIFEST_SCHEMA_VERSION,
      supportedVersions: SUPPORTED_TENANT_MODEL_MANIFEST_SCHEMA_VERSIONS,
      rules: TENANT_MODEL_MANIFEST_COMPATIBILITY_RULES,
      generatedArtifacts: {
        manifest: "croco-tenant-model.manifest.json",
        schema: "croco-tenant-model.schema.json",
        playbook: "docs/tenant-model-playbook.md",
        source: "apps/api-server/src/generatedTenantModel.ts",
      },
      migration: {
        requiredForVersionChange: true,
        guidance: [
          "Bump schemaVersion only when existing tenant manifest consumers cannot safely read the new shape.",
          "Ship migration guidance before generated apps start emitting the new tenant manifest version.",
          "Run profile:check and croco doctor on generated apps before accepting the version change.",
        ],
      },
    },
    qualityGates: ["profile:check", "contract:verify", "demo:smoke"],
  };
}

export function createTenantModelManifestSchema(): TenantModelManifestSchema {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: TENANT_MODEL_MANIFEST_SCHEMA_ID,
    title: "Croco Tenant Model Manifest",
    type: "object",
    required: [
      "schemaVersion",
      "currentModel",
      "defaultModel",
      "selected",
      "models",
      "migration",
      "compatibility",
    ],
    properties: {
      schemaVersion: {
        const: TENANT_MODEL_MANIFEST_SCHEMA_VERSION,
      },
      currentModel: {
        enum: TENANT_MODEL_NAMES,
      },
      defaultModel: {
        const: DEFAULT_TENANT_MODEL,
      },
      selected: {
        type: "object",
        required: [
          "name",
          "displayName",
          "summary",
          "tenantKey",
          "isolation",
          "requiredPackages",
          "requiredAdapters",
          "requiredCapabilities",
          "supportedRuntimeTargets",
          "schemaHints",
          "migrationHints",
          "unsafeMigrationWarnings",
        ],
      },
      models: {
        type: "array",
        minItems: TENANT_MODEL_NAMES.length,
      },
      migration: {
        type: "object",
        required: ["from", "to", "risk", "manualSteps", "warnings"],
      },
      compatibility: {
        type: "object",
        required: [
          "schemaId",
          "currentVersion",
          "supportedVersions",
          "rules",
          "generatedArtifacts",
          "migration",
        ],
      },
    },
  };
}

export function createTenantMigrationPlan(
  from: TenantModelName,
  to: TenantModelName,
): TenantMigrationPlan {
  if (from === to) {
    return {
      from,
      to,
      risk: "none",
      manualSteps: ["No tenant model migration is required."],
      warnings: [],
    };
  }

  const target = getTenantModelDefinition(to);
  const manualSteps = [
    `Inventory existing tenant-owned resources before changing the manifest from '${from}' to '${to}'.`,
    ...target.migrationHints,
    "Run generated contract checks and tenant isolation fixtures before accepting writes in the new model.",
    "Commit the updated croco-tenant-model.manifest.json and docs/tenant-model-playbook.md together.",
  ];
  const warnings = target.unsafeMigrationWarnings.map((message) => ({
    code: "tenant-core/tenant-model-manual-migration-required" as const,
    message,
    recovery:
      "Write an explicit migration runbook, backfill evidence, and rollback plan before changing production tenant isolation.",
  }));

  return {
    from,
    to,
    risk: tenantMigrationRisk(from, to),
    manualSteps,
    warnings,
  };
}

export function renderTenantMigrationPlan(plan: TenantMigrationPlan): string {
  return [
    `Tenant model migration: ${plan.from} -> ${plan.to}`,
    `Risk: ${plan.risk}`,
    "",
    "Manual steps:",
    ...plan.manualSteps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Warnings:",
    ...(plan.warnings.length > 0
      ? plan.warnings.map((warning) => `- ${warning.code}: ${warning.message}`)
      : ["- none"]),
    "",
  ].join("\n");
}

export function renderTenantModelPlaybook(manifest: TenantModelManifest): string {
  return [
    "# Tenant Model Playbook",
    "",
    "Generated from `@croco/tenant-core` tenant model definitions.",
    "",
    `Current model: \`${manifest.currentModel}\``,
    `Default model: \`${manifest.defaultModel}\``,
    "",
    "## Model Matrix",
    "",
    "| Model | Isolation | Tenant key | Runtime targets | Required packages | Required adapters |",
    "| --- | --- | --- | --- | --- | --- |",
    ...manifest.models.map(
      (model) =>
        `| ${model.name} | ${model.isolation} | ${model.tenantKey} | ${model.supportedRuntimeTargets.join(", ")} | ${model.requiredPackages.join(", ")} | ${model.requiredAdapters.join(", ")} |`,
    ),
    "",
    "## Current Model",
    "",
    manifest.selected.summary,
    "",
    "### Required Capabilities",
    "",
    ...manifest.selected.requiredCapabilities.map((capability) => `- ${capability}`),
    "",
    "### Schema And Migration Hints",
    "",
    ...manifest.selected.schemaHints.map((hint) => `- ${hint}`),
    "",
    "## Migration Helper Output",
    "",
    "```text",
    renderTenantMigrationPlan(manifest.migration).trimEnd(),
    "```",
    "",
    "## Diagnostic Codes",
    "",
    "- `tenant-core/tenant-model-runtime-incompatible`: selected runtime cannot support the tenant model.",
    "- `tenant-core/tenant-model-package-missing`: generated provider profile lacks a required package.",
    "- `tenant-core/tenant-model-capability-missing`: generated profile lacks a required tenant capability.",
    "- `tenant-core/tenant-model-manual-migration-required`: migration requires operator-controlled manual steps.",
    "",
    "## Manifest Versioning",
    "",
    `Schema id: \`${manifest.compatibility.schemaId}\``,
    `Current version: \`${manifest.compatibility.currentVersion}\``,
    `Supported versions: \`${manifest.compatibility.supportedVersions.join(", ")}\``,
    "",
    "Compatibility rules:",
    ...manifest.compatibility.rules.map((rule) => `- ${rule}`),
    "",
    "Future version migration:",
    ...manifest.compatibility.migration.guidance.map((step) => `- ${step}`),
    "",
  ].join("\n");
}

export function validateTenantModelCompatibility(
  input: TenantModelCompatibilityInput,
): TenantModelCompatibilityResult {
  const model = getTenantModelDefinition(input.tenantModel);
  const packageSet = new Set(input.packages);
  const capabilitySet = new Set(input.capabilities ?? []);
  const diagnostics: TenantModelCompatibilityDiagnostic[] = [];

  if (!model.supportedRuntimeTargets.includes(input.runtimeTarget)) {
    diagnostics.push({
      code: "tenant-core/tenant-model-runtime-incompatible",
      severity: "error",
      message: `${input.providerProfileName} runs on ${input.runtimeTarget}, but tenant model '${model.name}' supports ${model.supportedRuntimeTargets.join(", ")}.`,
      recovery:
        "Choose a compatible tenant model or a provider profile whose runtime can satisfy the tenant isolation contract.",
    });
  }

  for (const packageName of model.requiredPackages) {
    if (!packageSet.has(packageName)) {
      diagnostics.push({
        code: "tenant-core/tenant-model-package-missing",
        severity: "error",
        message: `${input.providerProfileName} is missing required package ${packageName} for tenant model '${model.name}'.`,
        recovery:
          "Add the package to the generated provider profile or choose a tenant model with matching provider support.",
      });
    }
  }

  for (const capability of input.capabilities === undefined ? [] : model.requiredCapabilities) {
    if (!capabilitySet.has(capability)) {
      diagnostics.push({
        code: "tenant-core/tenant-model-capability-missing",
        severity: "error",
        message: `${input.providerProfileName} is missing tenant capability ${capability} for tenant model '${model.name}'.`,
        recovery:
          "Expose the capability from the provider profile manifest or select a tenant model it already supports.",
      });
    }
  }

  return {
    ok: diagnostics.length === 0,
    diagnostics,
  };
}

function tenantMigrationRisk(from: TenantModelName, to: TenantModelName): TenantModelRiskLevel {
  if (from === to) return "none";
  if (to === "rls-backed" || from === "rls-backed") return "high";
  if (to === "shared-schema" || from === "shared-schema") return "high";
  if (from === "single") return "medium";

  return "low";
}
