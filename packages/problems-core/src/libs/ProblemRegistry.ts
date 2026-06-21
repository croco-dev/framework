import { Problem } from "./Problem";
import { ProblemCategory } from "./ProblemCategory";
import { ProblemCategoryMapper } from "./ProblemCategoryMapper";

export type ProblemCodeRegistryVersion = "croco.problem-code-registry.v1";
export type ProblemCodeSourceKind =
  | "problem-class"
  | "problem-constructor"
  | "problem-factory"
  | "problem-metadata";
export type ProblemRetryability = "retryable" | "conditional" | "not-retryable";
export type ProblemRedactionPolicy = "public" | "safe-message" | "operator-only";
export type ProblemTelemetrySeverity = "info" | "warning" | "error";

export type ProblemCodeSource = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly kind: ProblemCodeSourceKind;
};

export type ProblemCodeDiscovery = {
  readonly code: string;
  readonly category: ProblemCategory;
  readonly sources: readonly ProblemCodeSource[];
};

export type ProblemTelemetryMapping = {
  readonly eventName: string;
  readonly severity: ProblemTelemetrySeverity;
  readonly attributes: readonly string[];
};

export type ProblemRecoveryMetadata = {
  readonly cause: string;
  readonly userAction: string;
  readonly operatorAction: string;
  readonly retryability: ProblemRetryability;
  readonly redactionPolicy: ProblemRedactionPolicy;
  readonly telemetry: ProblemTelemetryMapping;
};

export type ProblemCodeRegistryEntry = {
  readonly code: string;
  readonly category: ProblemCategory;
  readonly status: number;
  readonly title: string;
  readonly cookbookPath: string;
  readonly recovery: ProblemRecoveryMetadata;
  readonly sources: readonly ProblemCodeSource[];
};

export type ProblemCodeRegistry = {
  readonly version: ProblemCodeRegistryVersion;
  readonly problemCount: number;
  readonly problems: readonly ProblemCodeRegistryEntry[];
};

export type CreateProblemCodeRegistryOptions = {
  readonly cookbookBasePath?: string;
};

export class ProblemRegistryValidationProblem extends Problem {
  public readonly errors: readonly string[];

  public constructor(errors: readonly string[]) {
    super(
      "problems-core/problem-registry-invalid",
      ProblemCategory.ValidationError,
      errors.join("\n"),
      {
        extensions: { errors },
      },
    );
    this.errors = errors;
  }
}

const PROBLEM_TELEMETRY_ATTRIBUTES = [
  "problem.code",
  "problem.category",
  "problem.status",
] as const;

const CATEGORY_RECOVERY_METADATA = {
  [ProblemCategory.BadRequest]: createRecoveryMetadata({
    cause: "The caller sent malformed input or unsupported request options.",
    userAction: "Correct the request input and retry after validation passes.",
    operatorAction: "Inspect validation details and request logs; do not retry unchanged input.",
    retryability: "not-retryable",
    redactionPolicy: "public",
    severity: "info",
  }),
  [ProblemCategory.Unauthorized]: createRecoveryMetadata({
    cause: "The request did not include valid authentication credentials.",
    userAction: "Sign in again or provide a valid credential.",
    operatorAction: "Check authentication configuration, token issuer, and clock skew.",
    retryability: "not-retryable",
    redactionPolicy: "safe-message",
    severity: "warning",
  }),
  [ProblemCategory.Forbidden]: createRecoveryMetadata({
    cause: "The authenticated caller is not allowed to perform the requested action.",
    userAction: "Request the required permission or choose an allowed action.",
    operatorAction: "Review policy, role, tenant, entitlement, and impersonation context.",
    retryability: "not-retryable",
    redactionPolicy: "safe-message",
    severity: "warning",
  }),
  [ProblemCategory.NotFound]: createRecoveryMetadata({
    cause: "The requested resource or route-visible record does not exist.",
    userAction: "Verify the identifier and refresh the resource list before retrying.",
    operatorAction: "Confirm tenant scoping, data retention, and backing-store lookup behavior.",
    retryability: "not-retryable",
    redactionPolicy: "public",
    severity: "info",
  }),
  [ProblemCategory.Conflict]: createRecoveryMetadata({
    cause: "The request conflicts with current state or an idempotency constraint.",
    userAction: "Refresh state, resolve the conflict, and retry with the updated intent.",
    operatorAction: "Inspect concurrent writes, idempotency keys, and uniqueness constraints.",
    retryability: "conditional",
    redactionPolicy: "safe-message",
    severity: "warning",
  }),
  [ProblemCategory.Gone]: createRecoveryMetadata({
    cause: "The requested resource is no longer available through this API surface.",
    userAction: "Stop using the stale reference and follow the replacement flow when available.",
    operatorAction: "Verify lifecycle, migration, deprecation, and retention state.",
    retryability: "not-retryable",
    redactionPolicy: "public",
    severity: "info",
  }),
  [ProblemCategory.ValidationError]: createRecoveryMetadata({
    cause: "The request or generated contract failed schema or semantic validation.",
    userAction: "Fix the invalid fields and retry with schema-conformant input.",
    operatorAction: "Inspect schema diagnostics, generated contracts, and validation metadata.",
    retryability: "not-retryable",
    redactionPolicy: "public",
    severity: "info",
  }),
  [ProblemCategory.BusinessRuleViolation]: createRecoveryMetadata({
    cause: "The request is syntactically valid but violates a domain rule.",
    userAction: "Change the workflow state or request values so the business rule is satisfied.",
    operatorAction: "Review domain policy, entitlement, quota, and lifecycle rule evidence.",
    retryability: "conditional",
    redactionPolicy: "safe-message",
    severity: "warning",
  }),
  [ProblemCategory.TooManyRequests]: createRecoveryMetadata({
    cause: "The caller exceeded a rate, quota, or concurrency limit.",
    userAction: "Wait for the retry window or reduce request volume.",
    operatorAction: "Check limiter state, quota configuration, and abuse signals.",
    retryability: "retryable",
    redactionPolicy: "safe-message",
    severity: "warning",
  }),
  [ProblemCategory.InternalServerError]: createRecoveryMetadata({
    cause: "Croco or an upstream dependency failed after accepting the request.",
    userAction:
      "Retry later only when the operation is idempotent or the caller owns retry safety.",
    operatorAction: "Use traces, logs, and upstream diagnostics to isolate the failing boundary.",
    retryability: "conditional",
    redactionPolicy: "operator-only",
    severity: "error",
  }),
  [ProblemCategory.NotImplemented]: createRecoveryMetadata({
    cause: "The requested capability is not supported by this runtime or adapter.",
    userAction: "Use a supported capability or choose an adapter/runtime that provides it.",
    operatorAction: "Check runtime capability declarations and provider maturity documentation.",
    retryability: "not-retryable",
    redactionPolicy: "public",
    severity: "info",
  }),
} as const satisfies Record<ProblemCategory, ProblemRecoveryMetadata>;

export function createProblemCodeRegistry(
  discoveries: readonly ProblemCodeDiscovery[],
  options: CreateProblemCodeRegistryOptions = {},
): ProblemCodeRegistry {
  const cookbookBasePath = options.cookbookBasePath ?? "/reference/problem-recovery-cookbook/";
  const errors: string[] = [];
  const discoveriesByCode = groupDiscoveriesByCode(discoveries);
  const problems: ProblemCodeRegistryEntry[] = [];

  for (const [code, codeDiscoveries] of discoveriesByCode) {
    const categories = new Set(codeDiscoveries.map((discovery) => discovery.category));
    const sources = getSortedSources(codeDiscoveries.flatMap((discovery) => discovery.sources));

    if (categories.size !== 1) {
      errors.push(
        `Problem code '${code}' has multiple categories: ${[...categories].sort().join(", ")}.`,
      );
      continue;
    }

    const [category] = categories;

    if (!category) {
      errors.push(`Problem code '${code}' did not resolve to a category.`);
      continue;
    }

    if (sources.length > 1) {
      errors.push(
        `Problem code '${code}' is declared ${sources.length} times: ${sources.map(formatProblemCodeSource).join(", ")}.`,
      );
      continue;
    }

    problems.push({
      code,
      category,
      status: ProblemCategoryMapper.toHttpStatus(category),
      title: ProblemCategoryMapper.toTitle(category),
      cookbookPath: getProblemCookbookPath(code, cookbookBasePath),
      recovery: CATEGORY_RECOVERY_METADATA[category],
      sources,
    });
  }

  const registry = {
    version: "croco.problem-code-registry.v1",
    problemCount: problems.length,
    problems: problems.sort(compareProblemRegistryEntries),
  } as const satisfies ProblemCodeRegistry;
  errors.push(...getProblemCodeRegistryValidationErrors(registry));

  if (errors.length > 0) {
    throw new ProblemRegistryValidationProblem(errors);
  }

  return registry;
}

export function getProblemCodeRegistryValidationErrors(
  registry: ProblemCodeRegistry,
): readonly string[] {
  const errors: string[] = [];
  const seenCodes = new Set<string>();

  if (registry.version !== "croco.problem-code-registry.v1") {
    errors.push(`Unsupported Problem registry version '${registry.version}'.`);
  }

  if (registry.problemCount !== registry.problems.length) {
    errors.push(
      `Problem registry count ${registry.problemCount} does not match ${registry.problems.length} entries.`,
    );
  }

  for (const problem of registry.problems) {
    if (seenCodes.has(problem.code)) {
      errors.push(`Problem registry contains duplicate code '${problem.code}'.`);
      continue;
    }

    seenCodes.add(problem.code);

    const expectedStatus = ProblemCategoryMapper.toHttpStatus(problem.category);
    const expectedTitle = ProblemCategoryMapper.toTitle(problem.category);

    if (problem.status !== expectedStatus) {
      errors.push(
        `Problem code '${problem.code}' has status ${problem.status}, expected ${expectedStatus} for ${problem.category}.`,
      );
    }

    if (problem.title !== expectedTitle) {
      errors.push(
        `Problem code '${problem.code}' has title '${problem.title}', expected '${expectedTitle}' for ${problem.category}.`,
      );
    }

    if (!isCompleteRecoveryMetadata(problem.recovery)) {
      errors.push(`Problem code '${problem.code}' is missing recovery cookbook metadata.`);
    }

    if (problem.sources.length === 0) {
      errors.push(`Problem code '${problem.code}' has no source locations.`);
    } else if (problem.sources.length > 1) {
      errors.push(
        `Problem code '${problem.code}' is declared ${problem.sources.length} times: ${problem.sources.map(formatProblemCodeSource).join(", ")}.`,
      );
    }
  }

  return errors;
}

export function assertProblemCodeRegistryValid(registry: ProblemCodeRegistry): void {
  const errors = getProblemCodeRegistryValidationErrors(registry);

  if (errors.length > 0) {
    throw new ProblemRegistryValidationProblem(errors);
  }
}

export function getProblemRecoveryMetadata(category: ProblemCategory): ProblemRecoveryMetadata {
  return CATEGORY_RECOVERY_METADATA[category];
}

export function getProblemCookbookPath(
  code: string,
  cookbookBasePath = "/reference/problem-recovery-cookbook/",
): string {
  const normalizedBasePath = cookbookBasePath.endsWith("/")
    ? cookbookBasePath
    : `${cookbookBasePath}/`;

  return `${normalizedBasePath}#${slugifyProblemCode(code)}`;
}

export function slugifyProblemCode(code: string): string {
  return (
    code
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "problem"
  );
}

function createRecoveryMetadata(options: {
  readonly cause: string;
  readonly userAction: string;
  readonly operatorAction: string;
  readonly retryability: ProblemRetryability;
  readonly redactionPolicy: ProblemRedactionPolicy;
  readonly severity: ProblemTelemetrySeverity;
}): ProblemRecoveryMetadata {
  return {
    cause: options.cause,
    userAction: options.userAction,
    operatorAction: options.operatorAction,
    retryability: options.retryability,
    redactionPolicy: options.redactionPolicy,
    telemetry: {
      eventName: `croco.problem.${options.severity}`,
      severity: options.severity,
      attributes: PROBLEM_TELEMETRY_ATTRIBUTES,
    },
  };
}

function groupDiscoveriesByCode(
  discoveries: readonly ProblemCodeDiscovery[],
): ReadonlyMap<string, readonly ProblemCodeDiscovery[]> {
  const discoveriesByCode = new Map<string, ProblemCodeDiscovery[]>();

  for (const discovery of discoveries) {
    const existing = discoveriesByCode.get(discovery.code) ?? [];
    discoveriesByCode.set(discovery.code, [...existing, discovery]);
  }

  return new Map(
    [...discoveriesByCode.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function getSortedSources(sources: readonly ProblemCodeSource[]): readonly ProblemCodeSource[] {
  const sourcesByKey = new Map<string, ProblemCodeSource>();

  for (const source of sources) {
    sourcesByKey.set(`${source.file}:${source.line}:${source.column}:${source.kind}`, source);
  }

  return [...sourcesByKey.values()].sort(compareProblemCodeSources);
}

function compareProblemRegistryEntries(
  left: ProblemCodeRegistryEntry,
  right: ProblemCodeRegistryEntry,
): number {
  return left.code.localeCompare(right.code);
}

function compareProblemCodeSources(left: ProblemCodeSource, right: ProblemCodeSource): number {
  return (
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    left.column - right.column ||
    left.kind.localeCompare(right.kind)
  );
}

function formatProblemCodeSource(source: ProblemCodeSource): string {
  return `${source.file}:${source.line}:${source.column}`;
}

function isCompleteRecoveryMetadata(metadata: ProblemRecoveryMetadata): boolean {
  return (
    metadata.cause.length > 0 &&
    metadata.userAction.length > 0 &&
    metadata.operatorAction.length > 0 &&
    metadata.retryability.length > 0 &&
    metadata.redactionPolicy.length > 0 &&
    metadata.telemetry.eventName.length > 0 &&
    metadata.telemetry.severity.length > 0 &&
    metadata.telemetry.attributes.length > 0
  );
}
