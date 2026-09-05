export const APPLICATION_INTENT_MANIFEST_SCHEMA_VERSION = 1;

export const APPLICATION_INTENT_GOALS = [
  "saas-api",
  "spa-backend-split",
  "worker",
  "internal-tool",
] as const;
export const APPLICATION_INTENT_PRESETS = [
  "saas",
  "production-app",
  "ddd-vike-fullstack",
  "admin-console",
] as const;
export const APPLICATION_INTENT_RUNTIME_TARGETS = ["node", "cloudflare-workers"] as const;
export const APPLICATION_INTENT_PROTOCOLS = ["rest", "rest-rpc-client"] as const;
export const APPLICATION_INTENT_PROVIDERS = [
  "in-memory-tenant",
  "in-memory-auth",
  "in-memory-billing",
  "in-memory-metering",
  "in-memory-events",
  "in-memory-repository",
  "generated-rpc-client",
  "cloudflare-workers",
  "meta-vite",
  "in-memory-admin-data",
  "better-auth",
  "drizzle-transaction",
  "polar-billing",
  "qstash-tasks",
  "cloudinary-storage",
  "node-telemetry",
] as const;
export const APPLICATION_INTENT_STORAGE_OPTIONS = ["in-memory-demo", "cloudinary"] as const;
export const APPLICATION_INTENT_AUTH_OPTIONS = [
  "none",
  "tenant-demo",
  "admin-demo",
  "better-auth",
] as const;
export const APPLICATION_INTENT_BILLING_OPTIONS = ["none", "demo", "polar"] as const;
export const APPLICATION_INTENT_TELEMETRY_OPTIONS = ["opentelemetry-otlp", "none"] as const;
export const APPLICATION_INTENT_DEPLOYMENT_PRESETS = [
  "node-api",
  "lambda-spa",
  "cloudflare-workers",
] as const;
export const APPLICATION_INTENT_QUALITY_GATES = [
  "install",
  "typecheck",
  "build",
  "test",
  "contract:verify",
  "demo:smoke",
  "failure-drill:smoke",
  "dev:smoke",
  "lint",
  "ssr-worker:presentation:smoke",
  "admin:smoke",
] as const;

export type ApplicationIntentGoal = (typeof APPLICATION_INTENT_GOALS)[number];
export type ApplicationIntentPreset = (typeof APPLICATION_INTENT_PRESETS)[number];
export type ApplicationIntentRuntimeTarget = (typeof APPLICATION_INTENT_RUNTIME_TARGETS)[number];
export type ApplicationIntentProtocol = (typeof APPLICATION_INTENT_PROTOCOLS)[number];
export type ApplicationIntentProvider = (typeof APPLICATION_INTENT_PROVIDERS)[number];
export type ApplicationIntentStorage = (typeof APPLICATION_INTENT_STORAGE_OPTIONS)[number];
export type ApplicationIntentAuth = (typeof APPLICATION_INTENT_AUTH_OPTIONS)[number];
export type ApplicationIntentBilling = (typeof APPLICATION_INTENT_BILLING_OPTIONS)[number];
export type ApplicationIntentTelemetry = (typeof APPLICATION_INTENT_TELEMETRY_OPTIONS)[number];
export type ApplicationIntentDeploymentPreset =
  (typeof APPLICATION_INTENT_DEPLOYMENT_PRESETS)[number];
export type ApplicationIntentQualityGate = (typeof APPLICATION_INTENT_QUALITY_GATES)[number];

export type ApplicationIntentManifest = {
  readonly schemaVersion: typeof APPLICATION_INTENT_MANIFEST_SCHEMA_VERSION;
  readonly projectName: string;
  readonly scope: string;
  readonly goal: ApplicationIntentGoal;
  readonly preset: ApplicationIntentPreset;
  readonly runtimeTarget: ApplicationIntentRuntimeTarget;
  readonly protocol: ApplicationIntentProtocol;
  readonly providers: readonly ApplicationIntentProvider[];
  readonly storage: readonly ApplicationIntentStorage[];
  readonly auth: ApplicationIntentAuth;
  readonly billing: ApplicationIntentBilling;
  readonly tenantModel?: string;
  readonly telemetry: ApplicationIntentTelemetry;
  readonly deploymentPreset: ApplicationIntentDeploymentPreset;
  readonly qualityGates: readonly ApplicationIntentQualityGate[];
};

export type ApplicationIntentGoalContract = Omit<
  ApplicationIntentManifest,
  "projectName" | "scope"
>;

export const APPLICATION_INTENT_GOAL_CONTRACTS = {
  "saas-api": {
    schemaVersion: 1,
    goal: "saas-api",
    preset: "saas",
    runtimeTarget: "node",
    protocol: "rest",
    providers: [
      "in-memory-tenant",
      "in-memory-metering",
      "in-memory-events",
      "better-auth",
      "drizzle-transaction",
      "polar-billing",
      "qstash-tasks",
      "cloudinary-storage",
      "node-telemetry",
    ],
    storage: ["cloudinary"],
    auth: "better-auth",
    billing: "polar",
    tenantModel: "org",
    telemetry: "opentelemetry-otlp",
    deploymentPreset: "node-api",
    qualityGates: [
      "install",
      "typecheck",
      "build",
      "test",
      "contract:verify",
      "demo:smoke",
      "failure-drill:smoke",
    ],
  },
  "spa-backend-split": {
    schemaVersion: 1,
    goal: "spa-backend-split",
    preset: "production-app",
    runtimeTarget: "node",
    protocol: "rest-rpc-client",
    providers: ["in-memory-repository", "in-memory-events", "generated-rpc-client"],
    storage: ["in-memory-demo"],
    auth: "none",
    billing: "none",
    telemetry: "opentelemetry-otlp",
    deploymentPreset: "lambda-spa",
    qualityGates: ["install", "dev:smoke", "lint", "test", "typecheck", "build", "contract:verify"],
  },
  worker: {
    schemaVersion: 1,
    goal: "worker",
    preset: "ddd-vike-fullstack",
    runtimeTarget: "cloudflare-workers",
    protocol: "rest",
    providers: ["cloudflare-workers", "meta-vite"],
    storage: [],
    auth: "none",
    billing: "none",
    telemetry: "none",
    deploymentPreset: "cloudflare-workers",
    qualityGates: ["install", "typecheck", "build", "ssr-worker:presentation:smoke"],
  },
  "internal-tool": {
    schemaVersion: 1,
    goal: "internal-tool",
    preset: "admin-console",
    runtimeTarget: "node",
    protocol: "rest-rpc-client",
    providers: ["in-memory-admin-data", "generated-rpc-client"],
    storage: ["in-memory-demo"],
    auth: "admin-demo",
    billing: "none",
    telemetry: "opentelemetry-otlp",
    deploymentPreset: "lambda-spa",
    qualityGates: [
      "install",
      "admin:smoke",
      "lint",
      "test",
      "typecheck",
      "build",
      "contract:verify",
    ],
  },
} as const satisfies Record<ApplicationIntentGoal, ApplicationIntentGoalContract>;

export type ApplicationIntentManifestIssueKind =
  | "shape-invalid"
  | "version-unsupported"
  | "goal-unsupported"
  | "runtime-unsupported"
  | "provider-unsupported"
  | "goal-contract-mismatch"
  | "value-unsupported";

export type ApplicationIntentManifestIssue = {
  readonly kind: ApplicationIntentManifestIssueKind;
  readonly field: string;
  readonly actual: unknown;
  readonly expected?: unknown;
};

export type ApplicationIntentManifestValidation =
  | { readonly ok: true; readonly manifest: ApplicationIntentManifest }
  | { readonly ok: false; readonly issues: readonly ApplicationIntentManifestIssue[] };

export function validateApplicationIntentManifest(
  value: unknown,
): ApplicationIntentManifestValidation {
  if (!isRecord(value)) {
    return invalid("shape-invalid", "<root>", value);
  }

  if (typeof value["schemaVersion"] !== "number") {
    return invalid("shape-invalid", "schemaVersion", value["schemaVersion"]);
  }

  if (value["schemaVersion"] !== APPLICATION_INTENT_MANIFEST_SCHEMA_VERSION) {
    return invalid("version-unsupported", "schemaVersion", value["schemaVersion"]);
  }

  const shapeIssue = firstShapeIssue(value);
  if (shapeIssue) {
    return { ok: false, issues: [shapeIssue] };
  }

  const issues = [
    unsupportedScalar(value["goal"], "goal", APPLICATION_INTENT_GOALS, "goal-unsupported"),
    unsupportedScalar(value["preset"], "preset", APPLICATION_INTENT_PRESETS),
    unsupportedScalar(
      value["runtimeTarget"],
      "runtimeTarget",
      APPLICATION_INTENT_RUNTIME_TARGETS,
      "runtime-unsupported",
    ),
    unsupportedScalar(value["protocol"], "protocol", APPLICATION_INTENT_PROTOCOLS),
    ...unsupportedArray(
      value["providers"] as readonly string[],
      "providers",
      APPLICATION_INTENT_PROVIDERS,
      "provider-unsupported",
    ),
    ...unsupportedArray(
      value["storage"] as readonly string[],
      "storage",
      APPLICATION_INTENT_STORAGE_OPTIONS,
    ),
    unsupportedScalar(value["auth"], "auth", APPLICATION_INTENT_AUTH_OPTIONS),
    unsupportedScalar(value["billing"], "billing", APPLICATION_INTENT_BILLING_OPTIONS),
    unsupportedScalar(value["telemetry"], "telemetry", APPLICATION_INTENT_TELEMETRY_OPTIONS),
    unsupportedScalar(
      value["deploymentPreset"],
      "deploymentPreset",
      APPLICATION_INTENT_DEPLOYMENT_PRESETS,
    ),
    ...unsupportedArray(
      value["qualityGates"] as readonly string[],
      "qualityGates",
      APPLICATION_INTENT_QUALITY_GATES,
    ),
  ].filter((issue): issue is ApplicationIntentManifestIssue => issue !== null);

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const manifest = value as ApplicationIntentManifest;
  const contractIssues = applicationIntentGoalContractIssues(manifest);
  if (contractIssues.length > 0) {
    return { ok: false, issues: contractIssues };
  }

  return { ok: true, manifest };
}

function applicationIntentGoalContractIssues(
  manifest: ApplicationIntentManifest,
): ApplicationIntentManifestIssue[] {
  const contract: ApplicationIntentGoalContract = APPLICATION_INTENT_GOAL_CONTRACTS[manifest.goal];
  const issues: ApplicationIntentManifestIssue[] = [];

  for (const field of [
    "preset",
    "runtimeTarget",
    "protocol",
    "auth",
    "billing",
    "tenantModel",
    "telemetry",
    "deploymentPreset",
  ] as const) {
    if (manifest[field] !== contract[field]) {
      issues.push({
        kind: "goal-contract-mismatch",
        field,
        actual: manifest[field],
        expected: contract[field],
      });
    }
  }

  for (const field of ["providers", "storage", "qualityGates"] as const) {
    if (!sameStringArray(manifest[field], contract[field])) {
      issues.push({
        kind: "goal-contract-mismatch",
        field,
        actual: manifest[field],
        expected: contract[field],
      });
    }
  }

  return issues;
}

function firstShapeIssue(value: Record<string, unknown>): ApplicationIntentManifestIssue | null {
  for (const field of [
    "projectName",
    "scope",
    "goal",
    "preset",
    "runtimeTarget",
    "protocol",
    "auth",
    "billing",
    "telemetry",
    "deploymentPreset",
  ] as const) {
    if (!isNonEmptyString(value[field])) {
      return { kind: "shape-invalid", field, actual: value[field] };
    }
  }

  for (const field of ["providers", "storage", "qualityGates"] as const) {
    if (!isStringArray(value[field])) {
      return { kind: "shape-invalid", field, actual: value[field] };
    }
  }

  if (value["tenantModel"] !== undefined && !isNonEmptyString(value["tenantModel"])) {
    return { kind: "shape-invalid", field: "tenantModel", actual: value["tenantModel"] };
  }

  return null;
}

function unsupportedScalar<const T extends string>(
  actual: unknown,
  field: string,
  supported: readonly T[],
  kind: ApplicationIntentManifestIssueKind = "value-unsupported",
): ApplicationIntentManifestIssue | null {
  return supported.includes(actual as T) ? null : { kind, field, actual };
}

function unsupportedArray<const T extends string>(
  actual: readonly string[],
  field: string,
  supported: readonly T[],
  kind: ApplicationIntentManifestIssueKind = "value-unsupported",
): ApplicationIntentManifestIssue[] {
  return actual.flatMap((entry, index) =>
    supported.includes(entry as T) ? [] : [{ kind, field: `${field}[${index}]`, actual: entry }],
  );
}

function invalid(
  kind: ApplicationIntentManifestIssueKind,
  field: string,
  actual: unknown,
): ApplicationIntentManifestValidation {
  return { ok: false, issues: [{ kind, field, actual }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}
