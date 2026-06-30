export const DIAGNOSTIC_CODE_PATTERN = /^CROCO_[A-Z][A-Z0-9]*(?:_[A-Z][A-Z0-9]*)*_[0-9]{3}$/;

export type DiagnosticCode = `CROCO_${string}_${string}`;
export type DiagnosticSeverity = "error" | "warning" | "info";
export type DiagnosticCategory =
  | "dependency-injection"
  | "routing"
  | "build-time"
  | "runtime"
  | "telemetry"
  | "events";

export type DiagnosticSourceLocation = {
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly packageName?: string;
  readonly symbol?: string;
};

export type DiagnosticFixExample = {
  readonly label: string;
  readonly before?: string;
  readonly after?: string;
  readonly command?: string;
  readonly note?: string;
};

export type DiagnosticCodeDefinition = {
  readonly code: DiagnosticCode;
  readonly category: DiagnosticCategory;
  readonly severity: DiagnosticSeverity;
  readonly title: string;
  readonly cause: string;
  readonly action: string;
  readonly docs: string;
  readonly searchKeywords: readonly string[];
  readonly fixExamples: readonly DiagnosticFixExample[];
  readonly legacyCodes?: readonly string[];
};

export type DiagnosticMessage = {
  readonly code: DiagnosticCode;
  readonly category: DiagnosticCategory;
  readonly severity: DiagnosticSeverity;
  readonly title?: string;
  readonly cause: string;
  readonly action: string;
  readonly location?: DiagnosticSourceLocation | null;
  readonly docs?: string;
  readonly searchKeywords?: readonly string[];
};

export type CreateDiagnosticMessageOptions = {
  readonly title?: string;
  readonly cause?: string;
  readonly action?: string;
  readonly location?: DiagnosticSourceLocation | null;
  readonly docs?: string;
  readonly searchKeywords?: readonly string[];
};

export const DIAGNOSTIC_CODE_CHANGE_POLICY = {
  stability: "append-only",
  allowedChanges: [
    "add-code",
    "clarify-cause",
    "clarify-action",
    "add-fix-example",
    "add-search-keyword",
  ],
  breakingChanges: ["reuse-code", "rename-code", "change-category", "downgrade-severity"],
} as const;

type CliDiagnosticCodeDefinitionInput = {
  readonly code: DiagnosticCode;
  readonly category: DiagnosticCategory;
  readonly title: string;
  readonly cause: string;
  readonly action: string;
  readonly legacyCodes: readonly string[];
  readonly searchKeywords: readonly string[];
  readonly fixExample: DiagnosticFixExample;
};

function createCliDiagnosticCodeDefinition(
  input: CliDiagnosticCodeDefinitionInput,
): DiagnosticCodeDefinition {
  return {
    code: input.code,
    category: input.category,
    severity: "error",
    title: input.title,
    cause: input.cause,
    action: input.action,
    docs: "docs/troubleshooting/diagnostics.md#cli-diagnostic-code-migration",
    searchKeywords: [input.code, ...input.legacyCodes, ...input.searchKeywords],
    fixExamples: [input.fixExample],
    legacyCodes: input.legacyCodes,
  };
}

export const CROCO_DIAGNOSTIC_CODE_DEFINITIONS = [
  {
    code: "CROCO_DI_001",
    category: "dependency-injection",
    severity: "error",
    title: "Provider is not registered",
    cause:
      "The DI container was asked to resolve a token that has no registered provider in the active container scope.",
    action:
      "Register the provider before resolution, export it from the owning module, or inject an optional dependency only through an explicit optional lookup path.",
    docs: "docs/troubleshooting/diagnostics.md#croco_di_001",
    searchKeywords: ["CROCO_DI_001", "missing provider", "Container.get", "provider registration"],
    fixExamples: [
      {
        label: "Register the provider before resolving it",
        before: "Container.get(PaymentGateway);",
        after: "Container.set(PaymentGateway, gateway);\nContainer.get(PaymentGateway);",
      },
    ],
  },
  {
    code: "CROCO_ROUTE_004",
    category: "routing",
    severity: "error",
    title: "Route path parameter is not bound",
    cause:
      "A route path declares a path parameter but the controller method metadata does not bind that parameter.",
    action:
      "Add the matching path parameter decorator or rename the path token so generated contracts and runtime routing agree.",
    docs: "docs/troubleshooting/diagnostics.md#croco_route_004",
    searchKeywords: ["CROCO_ROUTE_004", "missing path param", "@Param", "route contract"],
    fixExamples: [
      {
        label: "Bind the route path token",
        before: '@Get("/:id")\ngetUser(): User;',
        after: '@Get("/:id")\ngetUser(@Param("id") id: string): User;',
      },
    ],
  },
  {
    code: "CROCO_BUILD_002",
    category: "build-time",
    severity: "error",
    title: "Generated artifact is stale",
    cause: "A build-time contract artifact no longer matches the source code that generated it.",
    action:
      "Run the package-specific write command, review the generated diff, and commit the updated artifact with the source change.",
    docs: "docs/troubleshooting/diagnostics.md#croco_build_002",
    searchKeywords: [
      "CROCO_BUILD_002",
      "generated artifact drift",
      "contract drift",
      "snapshot update",
    ],
    fixExamples: [
      {
        label: "Refresh public API snapshots",
        command: "pnpm public-api:write",
        note: "Use the narrower package-specific write command when one exists.",
      },
    ],
  },
  {
    code: "CROCO_BUILD_003",
    category: "build-time",
    severity: "error",
    title: "Controller source has TypeScript errors",
    cause:
      "A controller source matched by a contract loader has TypeScript diagnostics, so generated RPC or OpenAPI artifacts would not reflect a type-safe source contract.",
    action:
      "Fix the reported TypeScript diagnostic in the controller source before running contract check, OpenAPI generation, or RPC client generation again.",
    docs: "docs/troubleshooting/diagnostics.md#croco_build_003",
    searchKeywords: [
      "CROCO_BUILD_003",
      "controller TypeScript diagnostic",
      "contract loader",
      "RPC codegen",
      "OpenAPI generation",
    ],
    fixExamples: [
      {
        label: "Fix the controller type error before generating contracts",
        before: "readonly id: string = 123;",
        after: 'readonly id: string = "123";',
      },
    ],
  },
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_DOCTOR_001",
    category: "build-time",
    title: "Croco workspace root is missing",
    cause: "croco doctor could not find pnpm-workspace.yaml from the execution directory.",
    action:
      "Run croco doctor inside a Croco monorepo or pass --cwd to a directory under the workspace root.",
    legacyCodes: ["doctor/workspace-not-found"],
    searchKeywords: ["croco doctor", "workspace discovery", "pnpm-workspace.yaml"],
    fixExample: { label: "Run doctor from a workspace", command: "pnpm exec croco doctor --cwd ." },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_DOCTOR_002",
    category: "build-time",
    title: "Workspace package globs found no packages",
    cause: "pnpm-workspace.yaml defines include globs, but no package.json files matched them.",
    action: "Fix the workspace package globs or run croco doctor from the repository root.",
    legacyCodes: ["doctor/workspace-packages-empty"],
    searchKeywords: ["croco doctor", "workspace packages", "empty package globs"],
    fixExample: { label: "Check workspace package globs", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_DOCTOR_003",
    category: "build-time",
    title: "Workspace package manifest is invalid",
    cause:
      "A discovered workspace package.json is not parseable JSON or is missing a string name field.",
    action: "Fix the package.json so it contains valid JSON and a string package name.",
    legacyCodes: ["doctor/workspace-package-invalid"],
    searchKeywords: ["croco doctor", "package.json", "invalid package manifest"],
    fixExample: { label: "Validate package manifests", command: "pnpm package-manifests:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_DOCTOR_004",
    category: "build-time",
    title: "repository-core references Drizzle implementation details",
    cause:
      "@croco/repository-core is an interface layer but references Drizzle implementation details.",
    action:
      "Move Drizzle-specific types and implementation code to @croco/tx-drizzle or another adapter package.",
    legacyCodes: ["doctor/repository-core-drizzle-boundary"],
    searchKeywords: ["croco doctor", "repository-core", "drizzle boundary"],
    fixExample: {
      label: "Find Drizzle boundary leaks",
      command: 'rg -n "drizzle" packages/repository-core/src',
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_DOCTOR_005",
    category: "telemetry",
    title: "Lambda telemetry entrypoint is missing forceFlush",
    cause:
      "A Lambda entrypoint initializes @croco/telemetry-sdk-node but does not flush telemetry before returning.",
    action:
      "Await telemetry readiness before handler work and call telemetry.forceFlush() in a finally block before returning.",
    legacyCodes: ["doctor/lambda-telemetry-flush-missing"],
    searchKeywords: ["croco doctor", "lambda telemetry", "forceFlush"],
    fixExample: {
      label: "Verify Lambda telemetry flush boundaries",
      command: "pnpm exec croco doctor",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_USAGE_DASHBOARD_001",
    category: "runtime",
    title: "Usage dashboard request is missing tenant context",
    cause: "The generated usage dashboard service was called without a tenant id.",
    action: "Pass x-tenant-id or tenantId before reading usage dashboard data.",
    legacyCodes: ["usage-dashboard/tenant-required"],
    searchKeywords: ["usage dashboard", "tenant required", "x-tenant-id"],
    fixExample: {
      label: "Request dashboard data with a tenant",
      command: "curl -H 'x-tenant-id: tenant_acme'",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_USAGE_DASHBOARD_002",
    category: "runtime",
    title: "Usage dashboard tenant was not found",
    cause: "The generated usage dashboard tenant lookup returned no tenant for the requested id.",
    action: "Use an existing tenant id or seed the tenant before opening the dashboard.",
    legacyCodes: ["usage-dashboard/tenant-not-found"],
    searchKeywords: ["usage dashboard", "tenant not found"],
    fixExample: { label: "Check generated SaaS seed data", command: "pnpm ops:smoke" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_USAGE_DASHBOARD_003",
    category: "runtime",
    title: "Usage dashboard meter was not found",
    cause:
      "The generated usage dashboard was asked to read a meter that is not registered for the tenant.",
    action:
      "Use a registered meter id or update the tenant meter registry before requesting the dashboard.",
    legacyCodes: ["usage-dashboard/meter-not-found"],
    searchKeywords: ["usage dashboard", "meter not found"],
    fixExample: {
      label: "Regenerate the usage dashboard",
      command: "pnpm exec croco generate usage-dashboard",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_USAGE_DASHBOARD_004",
    category: "runtime",
    title: "Usage dashboard provider is unavailable",
    cause:
      "A generated usage dashboard dependency failed while loading tenant, billing, entitlement, or usage data.",
    action: "Wire the generated runtime dependencies and inspect the provider failure detail.",
    legacyCodes: ["usage-dashboard/provider-unavailable"],
    searchKeywords: ["usage dashboard", "provider unavailable"],
    fixExample: {
      label: "Regenerate the usage dashboard",
      command: "pnpm exec croco generate usage-dashboard",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_OPS_001",
    category: "runtime",
    title: "Ops command target URL is invalid",
    cause: "A croco ops command received a target value that cannot be parsed as a URL.",
    action: "Pass a valid Croco app base URL to the ops command.",
    legacyCodes: ["cli/invalid-ops-target-url"],
    searchKeywords: ["croco ops", "invalid target URL"],
    fixExample: {
      label: "Check an app URL",
      command: "pnpm exec croco ops check http://localhost:3000",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_OPS_002",
    category: "runtime",
    title: "Ops command timeout is invalid",
    cause: "A croco ops command received a timeout that is not a positive finite number.",
    action: "Pass a positive timeout in milliseconds.",
    legacyCodes: ["cli/invalid-ops-timeout"],
    searchKeywords: ["croco ops", "invalid timeout"],
    fixExample: {
      label: "Use a positive timeout",
      command: "pnpm exec croco ops check http://localhost:3000 --timeout 5000",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_JOBS_001",
    category: "runtime",
    title: "Jobs command target URL is invalid",
    cause: "A croco jobs command received a target value that cannot be parsed as a URL.",
    action: "Pass a valid Croco app base URL to the jobs command.",
    legacyCodes: ["cli/invalid-jobs-target-url"],
    searchKeywords: ["croco jobs", "invalid target URL"],
    fixExample: {
      label: "List jobs for an app URL",
      command: "pnpm exec croco jobs list --url http://localhost:3000",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_JOBS_002",
    category: "runtime",
    title: "Jobs command numeric option is invalid",
    cause: "A croco jobs command received a numeric option that is not a non-negative integer.",
    action: "Pass a non-negative integer for numeric job query options.",
    legacyCodes: ["cli/invalid-jobs-number"],
    searchKeywords: ["croco jobs", "invalid number", "limit", "offset"],
    fixExample: {
      label: "Use a numeric limit",
      command: "pnpm exec croco jobs list --url http://localhost:3000 --limit 20",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_JOBS_003",
    category: "runtime",
    title: "Jobs command target URL is missing",
    cause:
      "A croco jobs command needs an app URL but neither --url nor CROCO_JOBS_URL was provided.",
    action: "Pass --url or set CROCO_JOBS_URL before running the jobs command.",
    legacyCodes: ["cli/missing-jobs-target-url"],
    searchKeywords: ["croco jobs", "missing target URL", "CROCO_JOBS_URL"],
    fixExample: {
      label: "Set the app URL",
      command: "CROCO_JOBS_URL=http://localhost:3000 pnpm exec croco jobs list",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_JOBS_004",
    category: "runtime",
    title: "Jobs endpoint returned an error",
    cause: "A croco jobs command received a non-404 failure response from the app jobs endpoint.",
    action:
      "Inspect the endpoint response detail and retry after the app or requested job id is corrected.",
    legacyCodes: ["cli/jobs-http-error"],
    searchKeywords: ["croco jobs", "HTTP error", "jobs endpoint"],
    fixExample: {
      label: "Show one job",
      command: "pnpm exec croco jobs show <job-id> --url http://localhost:3000",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_JOBS_005",
    category: "runtime",
    title: "Jobs endpoint was not found",
    cause: "A croco jobs command received a 404 response from the app jobs endpoint.",
    action: "Check the app base URL and requested job id, then retry the jobs command.",
    legacyCodes: ["cli/jobs-endpoint-not-found"],
    searchKeywords: ["croco jobs", "HTTP 404", "jobs endpoint", "not found"],
    fixExample: {
      label: "Use the app base URL",
      command: "pnpm exec croco jobs show <job-id> --url http://localhost:3000",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_DI_CHECK_001",
    category: "build-time",
    title: "DI check manifest is invalid",
    cause: "croco di check could not read a valid DI or module graph manifest.",
    action: "Regenerate the manifest or pass a path to a valid JSON manifest.",
    legacyCodes: ["cli/di-manifest-invalid"],
    searchKeywords: ["croco di check", "invalid manifest"],
    fixExample: {
      label: "Run DI check on a manifest",
      command: "pnpm exec croco di check croco.di-graph.manifest.json",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_DI_CHECK_002",
    category: "build-time",
    title: "DI check manifest failed without diagnostics",
    cause:
      "The DI or module graph manifest reports failed status but does not include diagnostics.",
    action:
      "Regenerate the manifest with diagnostics or fix the producer that emitted the failed manifest.",
    legacyCodes: ["cli/di-manifest-failed"],
    searchKeywords: ["croco di check", "manifest failed"],
    fixExample: {
      label: "Write a DI check report",
      command: "pnpm exec croco di check croco.di-graph.manifest.json --json",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_DI_CHECK_003",
    category: "build-time",
    title: "DI check diagnostic code is missing",
    cause: "A manifest diagnostic did not include a code value.",
    action: "Fix the manifest producer so every diagnostic carries a stable code.",
    legacyCodes: ["cli/di-diagnostic-unknown"],
    searchKeywords: ["croco di check", "missing diagnostic code"],
    fixExample: {
      label: "Inspect DI check JSON output",
      command: "pnpm exec croco di check croco.di-graph.manifest.json --json",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_PROJECT_MAP_001",
    category: "build-time",
    title: "Project Map wrapped a framework manifest diagnostic",
    cause:
      "The framework manifest contained a diagnostic that was surfaced through the Project Map.",
    action:
      "Inspect the diagnostic sourceCode and legacyCode fields, fix the source manifest issue, and regenerate the Project Map.",
    legacyCodes: ["project-map/framework-manifest-*"],
    searchKeywords: ["croco project map", "framework manifest diagnostic"],
    fixExample: {
      label: "Regenerate Project Map",
      command: "pnpm exec croco project map --out croco.project-map.json",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_PROJECT_MAP_002",
    category: "build-time",
    title: "Project Map route contract conflicts with framework manifest",
    cause:
      "The Contract Graph route set and framework manifest route set do not contain the same route ids.",
    action: "Regenerate both route artifacts from the same source and commit the matching outputs.",
    legacyCodes: ["project-map/contract-route-conflict"],
    searchKeywords: ["croco project map", "contract route conflict"],
    fixExample: {
      label: "Check Project Map drift",
      command: "pnpm exec croco project map --check",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_PROJECT_MAP_003",
    category: "build-time",
    title: "Project Map wrapped a Contract Graph diagnostic",
    cause: "The Contract Graph contained a diagnostic that was surfaced through the Project Map.",
    action:
      "Inspect the diagnostic sourceCode and legacyCode fields, fix the route contract issue, and regenerate artifacts.",
    legacyCodes: ["project-map/contract-graph-*"],
    searchKeywords: ["croco project map", "contract graph diagnostic"],
    fixExample: {
      label: "Regenerate Project Map",
      command: "pnpm exec croco project map --out croco.project-map.json",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_PROJECT_MAP_004",
    category: "build-time",
    title: "Project Map runtime target is missing",
    cause: "The runtime policy manifest does not declare runtime.platform or target.",
    action: "Add runtime.platform or target to the runtime policy manifest.",
    legacyCodes: ["project-map/runtime-target-missing"],
    searchKeywords: ["croco project map", "runtime target missing"],
    fixExample: {
      label: "Check runtime policy",
      command: "pnpm exec croco project map --runtime-policy croco-runtime-policy.manifest.json",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_PROJECT_MAP_005",
    category: "build-time",
    title: "Project Map runtime target is unsupported",
    cause: "The runtime policy manifest declares a runtime target that Croco does not recognize.",
    action: "Use a supported runtime platform in the runtime policy manifest.",
    legacyCodes: ["project-map/runtime-target-unsupported"],
    searchKeywords: ["croco project map", "runtime target unsupported"],
    fixExample: {
      label: "Check runtime policy",
      command: "pnpm exec croco project map --runtime-policy croco-runtime-policy.manifest.json",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_PROJECT_MAP_006",
    category: "build-time",
    title: "Project Map runtime capability conflict",
    cause:
      "The runtime policy table requires a capability that is not supported by the selected runtime preset.",
    action: "Change the runtime target or remove the unsupported capability requirement.",
    legacyCodes: ["project-map/runtime-capability-conflict"],
    searchKeywords: ["croco project map", "runtime capability conflict"],
    fixExample: { label: "Check Project Map", command: "pnpm exec croco project map --check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_PROJECT_MAP_007",
    category: "build-time",
    title: "Project Map provider profile references an undeclared package",
    cause: "A provider profile package is not declared in any discovered package manifest.",
    action: "Declare the package dependency or remove it from the provider profile manifest.",
    legacyCodes: ["project-map/package-manifest-conflict"],
    searchKeywords: ["croco project map", "provider profile", "package manifest conflict"],
    fixExample: { label: "Check package manifests", command: "pnpm package-manifests:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_PROJECT_MAP_008",
    category: "build-time",
    title: "Project Map manifest is missing",
    cause: "Project Map check mode could not find the committed manifest file.",
    action: "Run croco project map with --out and commit the generated manifest.",
    legacyCodes: ["project-map/manifest-missing"],
    searchKeywords: ["croco project map", "manifest missing"],
    fixExample: {
      label: "Write Project Map manifest",
      command: "pnpm exec croco project map --out croco.project-map.json",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_CLI_PROJECT_MAP_009",
    category: "build-time",
    title: "Project Map manifest is stale",
    cause: "The committed Project Map manifest does not match the current generated output.",
    action:
      "Regenerate the Project Map manifest, review the diff, and commit it with the source change.",
    legacyCodes: ["project-map/manifest-drift"],
    searchKeywords: ["croco project map", "manifest drift"],
    fixExample: {
      label: "Refresh Project Map manifest",
      command: "pnpm exec croco project map --out croco.project-map.json",
    },
  }),
  {
    code: "CROCO_HTTP_SECURITY_001",
    category: "runtime",
    severity: "error",
    title: "Required HTTP security middleware is missing",
    cause:
      "HTTP bootstrap validation found a generated or application HTTP app without the required security headers, CORS, body limit, or rate-limit middleware.",
    action:
      "Register all required @croco/transports-http security middleware before bootstrap, or use securityValidation: 'off' only for explicit local migration/testing.",
    docs: "docs/troubleshooting/diagnostics.md#croco_http_security_001",
    searchKeywords: [
      "CROCO_HTTP_SECURITY_001",
      "transports-http/security-middleware-validation",
      "securityValidation",
      "securityHeadersMiddleware",
      "corsMiddleware",
      "bodyLimitMiddleware",
      "rateLimitHttpMiddleware",
    ],
    fixExamples: [
      {
        label: "Register the required HTTP security middleware",
        before: "createApp({ controllers: [UserController] });",
        after:
          "createApp({\n  controllers: [UserController],\n  middlewares: [\n    securityHeadersMiddleware(),\n    corsMiddleware({ origins: allowedOrigins }),\n    bodyLimitMiddleware({ limit: mb(1) }),\n    rateLimitHttpMiddleware({ rateLimiter, policy }),\n  ],\n});",
      },
    ],
  },
] as const satisfies readonly DiagnosticCodeDefinition[];

const diagnosticCodeDefinitionByCode = new Map<string, DiagnosticCodeDefinition>(
  CROCO_DIAGNOSTIC_CODE_DEFINITIONS.map((definition) => [definition.code, definition]),
);

export function isDiagnosticCode(value: string): value is DiagnosticCode {
  return DIAGNOSTIC_CODE_PATTERN.test(value);
}

export function getDiagnosticCodeDefinition(code: string): DiagnosticCodeDefinition | undefined {
  return diagnosticCodeDefinitionByCode.get(code);
}

export function createDiagnosticMessage(
  definition: DiagnosticCodeDefinition,
  options: CreateDiagnosticMessageOptions = {},
): DiagnosticMessage {
  return {
    code: definition.code,
    category: definition.category,
    severity: definition.severity,
    title: options.title ?? definition.title,
    cause: options.cause ?? definition.cause,
    action: options.action ?? definition.action,
    location: options.location,
    docs: options.docs ?? definition.docs,
    searchKeywords: options.searchKeywords ?? definition.searchKeywords,
  };
}

export function formatDiagnosticMessage(message: DiagnosticMessage): string {
  const title = message.title ? ` - ${message.title}` : "";
  const lines = [
    `${message.severity.toUpperCase()} ${message.code}${title}`,
    `Category: ${message.category}`,
    `Cause: ${message.cause}`,
    `Location: ${formatDiagnosticSourceLocation(message.location)}`,
    `Action: ${message.action}`,
  ];

  if (message.docs) {
    lines.push(`Docs: ${message.docs}`);
  }

  if (message.searchKeywords && message.searchKeywords.length > 0) {
    lines.push(`Search: ${message.searchKeywords.join(", ")}`);
  }

  return lines.join("\n");
}

export function formatDiagnosticSourceLocation(location?: DiagnosticSourceLocation | null): string {
  if (!location) {
    return "unknown";
  }

  const file = location.file ?? "unknown";
  const line = typeof location.line === "number" ? `:${location.line}` : "";
  const column = typeof location.column === "number" ? `:${location.column}` : "";
  const symbol = location.symbol ? `#${location.symbol}` : "";
  const packageName = location.packageName ? ` (${location.packageName})` : "";

  return `${file}${line}${column}${symbol}${packageName}`;
}
