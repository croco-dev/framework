export const DIAGNOSTIC_CODE_PATTERN =
  /^CROCO_(?:[A-Z][A-Z0-9]*(?:_[A-Z][A-Z0-9]*)*_[0-9]{3}|[A-Z][A-Z0-9]*(?:_[A-Z][A-Z0-9]*){2,})$/;

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
  readonly severity?: DiagnosticSeverity;
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
    severity: input.severity ?? "error",
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
    searchKeywords: [
      "CROCO_DI_001",
      "framework-context/di-missing-provider",
      "missing provider",
      "Container.get",
      "provider registration",
    ],
    fixExamples: [
      {
        label: "Register the provider before resolving it",
        before: "Container.get(PaymentGateway);",
        after: "Container.set(PaymentGateway, gateway);\nContainer.get(PaymentGateway);",
      },
    ],
    legacyCodes: ["framework-context/di-missing-provider"],
  },
  {
    code: "CROCO_DI_002",
    category: "dependency-injection",
    severity: "error",
    title: "Circular dependency detected",
    cause:
      "The DI graph contains a provider cycle, so one or more providers cannot be constructed in a deterministic order.",
    action:
      "Break the provider cycle by extracting shared state behind an explicit token, moving one dependency behind a factory, or splitting responsibilities so construction is acyclic.",
    docs: "docs/troubleshooting/diagnostics.md#croco_di_002",
    searchKeywords: [
      "CROCO_DI_002",
      "framework-context/di-circular-dependency",
      "circular dependency",
      "DI graph",
      "cycle",
    ],
    fixExamples: [
      {
        label: "Regenerate the DI graph after breaking the cycle",
        command:
          "croco di graph --module apps/api-server/src/app.ts --bootstrap createCrocoApp --roots createCrocoDiGraphRoots --write .croco/build/di-graph.manifest.json",
      },
    ],
    legacyCodes: ["framework-context/di-circular-dependency"],
  },
  {
    code: "CROCO_DI_003",
    category: "dependency-injection",
    severity: "error",
    title: "Scope lifetime mismatch",
    cause:
      "A longer-lived provider depends directly on a request-scoped provider, which can capture request-local state outside the request boundary.",
    action:
      "Move request-scoped work behind a request boundary, inject a request-safe factory, or reduce the dependent provider lifetime so it cannot retain request state.",
    docs: "docs/troubleshooting/diagnostics.md#croco_di_003",
    searchKeywords: [
      "CROCO_DI_003",
      "framework-context/di-scope-mismatch",
      "scope mismatch",
      "request scope",
      "singleton request dependency",
    ],
    fixExamples: [
      {
        label: "Verify request-scope dependencies locally",
        command:
          "croco di graph --module apps/api-server/src/app.ts --bootstrap createCrocoApp --roots createCrocoDiGraphRoots --write .croco/build/di-graph.manifest.json",
      },
    ],
    legacyCodes: ["framework-context/di-scope-mismatch"],
  },
  {
    code: "CROCO_DI_004",
    category: "dependency-injection",
    severity: "error",
    title: "Provider falls back to unverifiable TypeDI metadata",
    cause:
      "A dependency is visible only through TypeDI fallback metadata, so Croco cannot prove the provider registration, scope, or construction path at build time.",
    action:
      "Annotate the provider with Croco component metadata, register the token explicitly, or move the dependency behind a generated manifest-backed provider.",
    docs: "docs/troubleshooting/diagnostics.md#croco_di_004",
    searchKeywords: [
      "CROCO_DI_004",
      "framework-context/di-unknown-provider",
      "TypeDI fallback",
      "unknown provider",
      "unverifiable provider",
    ],
    fixExamples: [
      {
        label: "Regenerate the manifest after annotating the provider",
        command:
          "croco di graph --module apps/api-server/src/app.ts --bootstrap createCrocoApp --roots createCrocoDiGraphRoots --write .croco/build/di-graph.manifest.json",
      },
    ],
    legacyCodes: ["framework-context/di-unknown-provider"],
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
    code: "CROCO_RUNTIME_CAPABILITY_001",
    category: "runtime",
    severity: "error",
    title: "Runtime capability is unsupported",
    cause:
      "A route, provider, policy, or runtime hook requires a capability that the selected runtime manifest does not support.",
    action:
      "Choose a runtime that supports the capability, remove the requirement, or move the code behind an adapter that declares a supported capability.",
    docs: "docs/troubleshooting/diagnostics.md#croco_runtime_capability_001",
    searchKeywords: [
      "CROCO_RUNTIME_CAPABILITY_001",
      "runtime capability",
      "unsupported capability",
      "RuntimeCapabilityManifest",
    ],
    fixExamples: [
      {
        label: "Use a runtime-supported policy requirement",
        before:
          "definePolicy(target, { kind: 'retry', maxAttempts: 2 }, { requiredCapabilities: ['nodeApi'] });",
        after:
          "definePolicy(target, { kind: 'retry', maxAttempts: 2 }, { requiredCapabilities: ['waitUntil'] });",
        note: "Only require capabilities present in croco-runtime-capability.manifest.json for the selected runtime.",
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
  {
    code: "CROCO_BUILD_004",
    category: "build-time",
    severity: "error",
    title: "Application TypeScript config cannot be loaded",
    cause:
      "Protocol contract generation selected an application tsconfig that is missing, unreadable, or invalid, so controller analysis cannot use the application's compiler contract.",
    action:
      "Fix the reported config path or pass --tsconfig with a readable, valid application tsconfig, then run contract generation again.",
    docs: "docs/troubleshooting/diagnostics.md#croco_build_004",
    searchKeywords: [
      "CROCO_BUILD_004",
      "tsconfig",
      "protocol codegen",
      "RPC codegen",
      "OpenAPI generation",
    ],
    fixExamples: [
      {
        label: "Select the application TypeScript config explicitly",
        command: "croco-rpc-codegen --controllers 'src/**/*.ts' --tsconfig tsconfig.json --check",
        note: "Use the same config that typechecks the matched application controllers.",
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
    code: "CROCO_DOCTOR_WORKSPACE_VERSION_CONFLICT",
    category: "build-time",
    title: "Workspace package versions conflict",
    cause: "croco doctor found spine package versions that do not agree across the workspace.",
    action: "Align workspace package versions or run the normal changesets release flow.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "workspace version conflict", "spine package versions"],
    fixExample: { label: "Inspect doctor output", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_APP_MANIFEST_JSON_INVALID",
    category: "build-time",
    title: "Application intent manifest JSON is invalid",
    cause: "croco.app.json cannot be parsed as JSON.",
    action: "Restore valid JSON or regenerate the application from its selected goal.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "croco.app.json", "invalid JSON"],
    fixExample: { label: "Inspect doctor output", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_APP_MANIFEST_SHAPE_INVALID",
    category: "build-time",
    title: "Application intent manifest shape is invalid",
    cause: "croco.app.json is missing a required field or contains a field with an invalid type.",
    action: "Restore the versioned application intent shape or regenerate the application.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "croco.app.json", "manifest shape"],
    fixExample: { label: "Inspect doctor output", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_APP_MANIFEST_VERSION_UNSUPPORTED",
    category: "build-time",
    title: "Application intent manifest version is unsupported",
    cause: "croco.app.json declares a schema version that this Croco release does not support.",
    action: "Use a supported schema version or regenerate the application with this Croco release.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "croco.app.json", "schema version"],
    fixExample: { label: "Inspect doctor output", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_APP_MANIFEST_GOAL_UNSUPPORTED",
    category: "build-time",
    title: "Application goal is unsupported",
    cause: "croco.app.json declares an application goal that this Croco release does not support.",
    action: "Choose a supported goal or regenerate the application with this Croco release.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "croco.app.json", "application goal"],
    fixExample: { label: "Inspect doctor output", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_APP_MANIFEST_GOAL_CONTRACT_MISMATCH",
    category: "build-time",
    title: "Application intent contradicts its goal contract",
    cause:
      "croco.app.json combines supported values that do not match the selected application goal.",
    action: "Restore the selected goal contract or regenerate the application from that goal.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "croco.app.json", "goal contract mismatch"],
    fixExample: { label: "Inspect doctor output", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_APP_MANIFEST_RUNTIME_UNSUPPORTED",
    category: "build-time",
    title: "Application runtime is unsupported",
    cause: "croco.app.json declares a runtime that this Croco release does not support.",
    action: "Choose a supported runtime or regenerate the application with this Croco release.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "croco.app.json", "application runtime"],
    fixExample: { label: "Inspect doctor output", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_APP_MANIFEST_PROVIDER_UNSUPPORTED",
    category: "build-time",
    title: "Application provider is unsupported",
    cause: "croco.app.json declares a provider that this Croco release does not support.",
    action: "Choose a supported provider or regenerate the application with this Croco release.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "croco.app.json", "application provider"],
    fixExample: { label: "Inspect doctor output", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_APP_MANIFEST_VALUE_UNSUPPORTED",
    category: "build-time",
    title: "Application intent value is unsupported",
    cause: "croco.app.json declares a supported field with an unsupported value.",
    action: "Choose a supported value or regenerate the application with this Croco release.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "croco.app.json", "application intent"],
    fixExample: { label: "Inspect doctor output", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_APP_MANIFEST_WORKSPACE_DRIFT",
    category: "build-time",
    title: "Workspace has drifted from application intent",
    cause:
      "The workspace no longer provides a package or quality-gate script declared by croco.app.json.",
    action: "Restore the reported workspace evidence or regenerate the application from its goal.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "croco.app.json", "workspace drift"],
    fixExample: { label: "Inspect doctor output", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_SPINE_PACKAGE_NOT_INSTALLED",
    category: "build-time",
    title: "Required spine package is not installed",
    cause: "A Croco 1.0 spine package is absent from the workspace package set.",
    action: "Install or restore the required spine package before shipping the workspace.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "spine package", "not installed"],
    fixExample: { label: "Check workspace packages", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_SPINE_PACKAGE_MANIFEST_INVALID",
    category: "build-time",
    title: "Spine package manifest is invalid",
    cause: "A required spine package has an invalid or incomplete package manifest.",
    action: "Fix the package manifest fields that croco doctor reported.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "spine package", "invalid manifest"],
    fixExample: { label: "Validate package manifests", command: "pnpm package-manifests:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_SPINE_PACKAGE_NOT_BUILT",
    category: "build-time",
    title: "Spine package has not been built",
    cause: "A required spine package export points at build output that is missing from dist.",
    action: "Build the package before running doctor or publishing the workspace.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "spine package", "missing dist"],
    fixExample: { label: "Build the workspace", command: "pnpm build" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_CONTRACT_GRAPH_MISSING",
    category: "build-time",
    title: "Contract graph manifest is missing",
    cause: "croco doctor could not find the committed contract graph manifest.",
    action: "Regenerate the contract graph artifact and commit it with the source change.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "contract graph", "missing manifest"],
    fixExample: { label: "Regenerate contracts", command: "pnpm contracts:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_CONTRACT_GRAPH_INVALID",
    category: "build-time",
    title: "Contract graph manifest is invalid",
    cause: "croco doctor could not parse the contract graph manifest as a valid artifact.",
    action: "Regenerate the contract graph manifest from current route sources.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "contract graph", "invalid manifest"],
    fixExample: { label: "Check contracts", command: "pnpm contracts:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_CONTRACT_GRAPH_ERRORS",
    category: "routing",
    title: "Contract graph reports diagnostics",
    cause: "The contract graph manifest contains route or contract diagnostics.",
    action: "Fix the reported route contract diagnostics and regenerate the graph.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "contract graph", "route diagnostics"],
    fixExample: { label: "Check contracts", command: "pnpm contracts:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_PROBLEM_REGISTRY_MISSING",
    category: "build-time",
    title: "Problem registry artifact is missing",
    cause: "croco doctor could not find the generated Problem registry artifact.",
    action: "Regenerate the Problem registry artifact and commit it.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "Problem registry", "missing artifact"],
    fixExample: { label: "Check Problem registry", command: "pnpm problem-registry:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_PROBLEM_REGISTRY_INVALID",
    category: "build-time",
    title: "Problem registry artifact is invalid",
    cause: "croco doctor could not parse the Problem registry artifact.",
    action: "Regenerate the registry from current Problem definitions.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "Problem registry", "invalid artifact"],
    fixExample: { label: "Check Problem registry", command: "pnpm problem-registry:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_PROBLEM_REGISTRY_DRIFT",
    category: "build-time",
    title: "Problem registry artifact is stale",
    cause: "The committed Problem registry does not match the current generated output.",
    action: "Regenerate the Problem registry, review the diff, and commit it.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "Problem registry", "drift"],
    fixExample: { label: "Refresh Problem registry", command: "pnpm problem-registry:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_PROBLEM_REGISTRY_CHECK_TIMEOUT",
    category: "build-time",
    title: "Problem registry drift check timed out",
    cause: "croco doctor timed out while running the Problem registry drift check.",
    action: "Run the registry check directly and inspect why it did not finish in time.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "Problem registry", "timeout"],
    fixExample: { label: "Run registry check", command: "pnpm problem-registry:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_PROBLEM_REGISTRY_CHECK_FAILED",
    category: "build-time",
    title: "Problem registry drift check failed",
    cause: "croco doctor could not complete the Problem registry drift check.",
    action: "Run the registry check directly and fix the reported failure.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "Problem registry", "check failed"],
    fixExample: { label: "Run registry check", command: "pnpm problem-registry:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_RUNTIME_CAPABILITY_MANIFEST_MISSING",
    category: "runtime",
    title: "Runtime capability manifest is missing",
    cause: "croco doctor could not find the runtime capability manifest artifact.",
    action: "Generate and commit the runtime capability manifest for the workspace.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "runtime capability", "missing manifest"],
    fixExample: { label: "Check runtime policy", command: "pnpm runtime-policy:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_RUNTIME_CAPABILITY_MANIFEST_INVALID",
    category: "runtime",
    title: "Runtime capability manifest is invalid",
    cause: "croco doctor could not parse the runtime capability manifest artifact.",
    action: "Regenerate the runtime capability manifest from current runtime policy sources.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "runtime capability", "invalid manifest"],
    fixExample: { label: "Check runtime policy", command: "pnpm runtime-policy:check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_RUNTIME_PROFILE_MISMATCH",
    category: "runtime",
    title: "Runtime and provider profiles disagree",
    cause:
      "The runtime capability manifest and provider profile manifest declare different runtime targets.",
    action:
      "Regenerate the runtime capability and provider profile artifacts from the same application profile, then rerun croco doctor.",
    legacyCodes: [],
    searchKeywords: [
      "croco doctor",
      "runtime profile mismatch",
      "provider profile",
      "runtimeTarget",
    ],
    fixExample: {
      label: "Verify the regenerated profile artifacts",
      command: "pnpm profile:check",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_HTTP_SECURITY_VALIDATION_DISABLED",
    category: "runtime",
    title: "HTTP security validation is disabled",
    cause: "croco doctor found an HTTP app configured to skip security middleware validation.",
    action: "Enable security validation or document the explicit local-only testing boundary.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "HTTP security", "securityValidation"],
    fixExample: { label: "Run doctor", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_HTTP_SECURITY_MIDDLEWARE_MISSING",
    category: "runtime",
    title: "HTTP security middleware is missing",
    cause: "croco doctor found an HTTP app missing required security middleware.",
    action: "Register the required CORS, headers, body limit, and rate-limit middleware.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "HTTP security", "middleware missing"],
    fixExample: { label: "Run doctor", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_DI_GRAPH_MANIFEST_INVALID",
    category: "dependency-injection",
    title: "DI graph manifest is invalid",
    cause: "croco doctor could not parse the dependency graph manifest artifact.",
    action: "Regenerate the DI graph manifest and fix any reported producer errors.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "DI graph", "invalid manifest"],
    fixExample: { label: "Check DI graph", command: "pnpm exec croco di check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_DI_BOOTSTRAP_ERRORS",
    category: "dependency-injection",
    title: "DI bootstrap reports errors",
    cause: "The dependency graph manifest contains bootstrap diagnostics.",
    action:
      "Register missing providers, fix cycles or scope mismatches, then regenerate the graph.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "DI bootstrap", "provider diagnostics"],
    fixExample: { label: "Check DI graph", command: "pnpm exec croco di check" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_PROVIDER_PROFILE_INVALID",
    category: "build-time",
    title: "Provider profile manifest is invalid",
    cause: "croco doctor could not parse the provider profile manifest.",
    action: "Regenerate provider profile artifacts and rerun doctor.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "provider profile", "invalid manifest"],
    fixExample: { label: "Run doctor", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_PROVIDER_PROFILE_VERSION_UNSUPPORTED",
    category: "build-time",
    title: "Provider profile manifest version is unsupported",
    cause:
      "The provider profile manifest uses a schemaVersion this version of croco doctor does not support.",
    action:
      "Regenerate provider profile artifacts with a supported schemaVersion or apply the published manifest migration guidance.",
    legacyCodes: [],
    searchKeywords: [
      "croco doctor",
      "provider profile",
      "unsupported manifest version",
      "schemaVersion",
    ],
    fixExample: {
      label: "Regenerate provider profile artifacts",
      command: "pnpm exec create-croco-app --template saas",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_TENANT_MODEL_MANIFEST_INVALID",
    category: "build-time",
    title: "Tenant model manifest is invalid",
    cause: "A provider profile links a tenant model manifest that is missing or malformed.",
    action:
      "Regenerate tenant model artifacts so the provider manifest, tenant manifest, schema, playbook, and generated source stay in sync.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "tenant model", "tenant manifest", "invalid manifest"],
    fixExample: {
      label: "Check generated provider artifacts",
      command: "pnpm profile:check",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_TENANT_MODEL_VERSION_UNSUPPORTED",
    category: "build-time",
    title: "Tenant model manifest version is unsupported",
    cause:
      "A provider profile links a tenant model manifest schemaVersion this version of croco doctor does not support.",
    action:
      "Regenerate tenant model artifacts with a supported schemaVersion or apply the published tenant model migration guidance.",
    legacyCodes: [],
    searchKeywords: [
      "croco doctor",
      "tenant model",
      "unsupported manifest version",
      "schemaVersion",
    ],
    fixExample: {
      label: "Check generated provider artifacts",
      command: "pnpm profile:check",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_PROVIDER_PACKAGE_MISSING",
    category: "build-time",
    title: "Provider package dependency is missing",
    cause: "A provider profile references a package that is not installed in the workspace.",
    action: "Add the required provider dependency or regenerate the provider profile.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "provider package", "missing dependency"],
    fixExample: { label: "Run doctor", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_PROVIDER_CERTIFICATION_GAP",
    category: "build-time",
    title: "Provider capability certification is incomplete",
    cause: "A provider capability is not zero-credential configured in the profile.",
    action: "Add zero-credential evidence or run the documented real-provider smoke later.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "provider certification", "capability gap"],
    fixExample: { label: "Run doctor", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_PROVIDER_CERTIFICATION_DOCUMENTED",
    category: "build-time",
    title: "Provider capability is documented but not zero-credential configured",
    cause: "A provider profile documents a live-provider capability outside the local smoke path.",
    action: "Keep the documented live smoke gated until credentials are intentionally configured.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "provider certification", "documented capability"],
    fixExample: { label: "Run doctor", command: "pnpm exec croco doctor" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_CORE_COVERAGE_CANDIDATE_MISSING",
    category: "build-time",
    severity: "warning",
    title: "Core coverage candidate is missing",
    cause:
      "croco doctor found a release-critical workspace package that is not selected by test:coverage:core.",
    action:
      "Add the package to test:coverage:core, run pnpm test:coverage:core, and refresh the committed core coverage baseline.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "core coverage", "release-hardening"],
    fixExample: {
      label: "Check core coverage selection",
      command: "pnpm test:coverage:core:warning",
    },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_BUNDLE_SIZE_BASELINE_MISSING",
    category: "build-time",
    severity: "warning",
    title: "Bundle-size baseline is missing",
    cause:
      "croco doctor could not read the advisory bundle-size baseline required by package-quality reporting.",
    action: "Run pnpm build && pnpm package-quality:report, then commit the baseline artifact.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "bundle size", "package quality"],
    fixExample: { label: "Refresh package quality report", command: "pnpm package-quality:report" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_BENCHMARK_VARIANCE_EVIDENCE_MISSING",
    category: "build-time",
    severity: "warning",
    title: "Benchmark variance evidence is missing",
    cause: "croco doctor could not verify the structured benchmark variance evidence artifact.",
    action:
      "Run pnpm bench:check and pnpm bench:readiness, then commit the latest five-green-runs evidence artifact.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "benchmark readiness", "variance evidence"],
    fixExample: { label: "Check benchmark readiness", command: "pnpm bench:readiness" },
  }),
  createCliDiagnosticCodeDefinition({
    code: "CROCO_DOCTOR_SECURITY_ALLOWLIST_METADATA_INVALID",
    category: "build-time",
    severity: "warning",
    title: "Security allowlist metadata is invalid",
    cause:
      "croco doctor found static-misuse allowlist entries without the required owner or expiry metadata.",
    action:
      "Add owner or expiresOn metadata to each allowlist entry, or remove stale entries after fixing the misuse.",
    legacyCodes: [],
    searchKeywords: ["croco doctor", "security allowlist", "static misuse"],
    fixExample: {
      label: "Check static misuse allowlist",
      command: "pnpm static-misuse:check",
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
    code: "CROCO_CLI_USAGE_DASHBOARD_005",
    category: "build-time",
    title: "Usage dashboard route path is invalid",
    cause:
      "The usage dashboard generator received an API or page path outside the supported route path grammar.",
    action:
      "Pass a non-empty route path containing only letters, numbers, underscore, dot, slash, colon, or hyphen.",
    legacyCodes: ["usage-dashboard/invalid-route-path"],
    searchKeywords: ["usage dashboard", "invalid route path", "apiPath", "pagePath"],
    fixExample: {
      label: "Generate dashboard routes with valid paths",
      command: "pnpm exec croco generate usage-dashboard --apiPath /ops/usage --pagePath /usage",
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
  {
    code: "CROCO_HTTP_MIDDLEWARE_001",
    category: "runtime",
    severity: "error",
    title: "HTTP middleware did not complete the pipeline contract",
    cause:
      "An HTTP middleware returned without a native Response, without an explicit shortCircuit(reason) marker, and without calling next() exactly once.",
    action:
      "Return next(), await next() and return undefined, return a native Response, or return shortCircuit(reason) for intentional no-next termination.",
    docs: "docs/troubleshooting/diagnostics.md#croco_http_middleware_001",
    searchKeywords: [
      "CROCO_HTTP_MIDDLEWARE_001",
      "shortCircuit",
      "middleware next",
      "missing next",
      "invalid middleware return",
      "transports-http middleware diagnostics",
    ],
    fixExamples: [
      {
        label: "Continue or explicitly short-circuit middleware",
        before: "async (ctx, next) => {\n  ctx.res.headers['X-Trace'] = 'enabled';\n}",
        after:
          "async (ctx, next) => {\n  ctx.res.headers['X-Trace'] = 'enabled';\n  await next();\n}",
      },
    ],
  },
  {
    code: "CROCO_HTTP_MIDDLEWARE_002",
    category: "runtime",
    severity: "error",
    title: "HTTP middleware called next multiple times",
    cause:
      "An HTTP middleware attempted to resume the downstream pipeline more than once for a single request.",
    action:
      "Call next() at most once, store the returned Response if it must be inspected or transformed, and return that Response or a replacement Response.",
    docs: "docs/troubleshooting/diagnostics.md#croco_http_middleware_002",
    legacyCodes: ["transports-http/middleware-next-called-multiple-times"],
    searchKeywords: [
      "CROCO_HTTP_MIDDLEWARE_002",
      "transports-http/middleware-next-called-multiple-times",
      "middleware next twice",
      "multiple next",
      "transports-http middleware diagnostics",
    ],
    fixExamples: [
      {
        label: "Reuse the downstream response instead of calling next twice",
        before: "async (_ctx, next) => {\n  await next();\n  return next();\n}",
        after: "async (_ctx, next) => {\n  const response = await next();\n  return response;\n}",
      },
    ],
  },
  {
    code: "CROCO_HTTP_FILTER_001",
    category: "runtime",
    severity: "error",
    title: "HTTP exception filter failed to handle deterministically",
    cause:
      "An HTTP exception filter threw while handling a route error or returned a value outside the official filter result contract.",
    action:
      "Return a native Response, a valid HttpExceptionFilterResponse, or undefined to pass handling to the next filter; fix throwing filters without replacing the original route error.",
    docs: "docs/troubleshooting/diagnostics.md#croco_http_filter_001",
    searchKeywords: [
      "CROCO_HTTP_FILTER_001",
      "ExceptionFilter",
      "HttpExceptionFilterResponse",
      "exception filter invalid return",
      "exception filter threw",
      "transports-http filter diagnostics",
    ],
    fixExamples: [
      {
        label: "Return an official filter response or pass through",
        before: "catch(error) {\n  return { handled: true };\n}",
        after:
          'catch(error) {\n  if (!canHandle(error)) return undefined;\n  return { status: 400, headers: { "Content-Type": "application/problem+json" }, body: problem };\n}',
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
