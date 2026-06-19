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
