import { Problem } from "./Problem";
import { ProblemCategory } from "./ProblemCategory";
import { ProblemCategoryMapper } from "./ProblemCategoryMapper";

export type ProblemCodeRegistryVersion = "croco.problem-code-registry.v1";
export type ProblemCategoryName = keyof typeof ProblemCategory;
export type ProblemCodeSourceKind =
  | "problem-class"
  | "problem-constructor"
  | "problem-factory"
  | "problem-metadata";
export type ProblemRetryability = "retryable" | "conditional" | "not-retryable";
export type ProblemRedactionPolicy = "public" | "safe-message" | "operator-only";
export type ProblemTelemetrySeverity = "info" | "warning" | "error";
export type PackageProblemRegistryVersion = "croco.problem-registry.v1";
export type ProblemRegistrySnapshotVersion = "croco.problem-registry.snapshot.v1";
export type ProblemRegistryVisibility = "public" | "private";
export type ProblemRegistryRedaction = "public" | "safe" | "operator-only";
export type ProblemLifecycleStatus = "active" | "deprecated";

export type ProblemDeprecationMetadata =
  | {
      readonly reason: string;
      readonly migrationNote: string;
      readonly replacementCode: string;
      readonly noReplacementReason?: never;
      readonly since?: string;
    }
  | {
      readonly reason: string;
      readonly migrationNote: string;
      readonly replacementCode?: never;
      readonly noReplacementReason: string;
      readonly since?: string;
    };

export type ProblemLifecycle = {
  readonly status: ProblemLifecycleStatus;
  readonly deprecation?: ProblemDeprecationMetadata;
};

export type ProblemCodeSource = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly kind: ProblemCodeSourceKind;
};

export type ProblemCodeDiscovery = {
  readonly code: string;
  readonly category: ProblemCategoryName;
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
  readonly category: ProblemCategoryName;
  readonly status: number;
  readonly title: string;
  readonly cookbookPath: string;
  readonly recovery: ProblemRecoveryMetadata;
  readonly lifecycle: ProblemLifecycle;
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

export type ProblemRegistryProblemDefinition<
  Category extends ProblemCategory = ProblemCategory,
  Status extends number = number,
> = {
  readonly category: Category;
  readonly status?: Status;
  readonly retryable: boolean;
  readonly public: boolean;
  readonly redaction: ProblemRegistryRedaction;
  readonly description?: string;
  readonly type?: string;
  readonly cookbookPath?: string;
};

export type ProblemRegistryProblemDefinitions = Record<string, ProblemRegistryProblemDefinition>;

export type ProblemRegistryStatusForCategory<Category extends ProblemCategory> =
  Category extends ProblemCategory.BadRequest
    ? 400
    : Category extends ProblemCategory.Unauthorized
      ? 401
      : Category extends ProblemCategory.Forbidden
        ? 403
        : Category extends ProblemCategory.NotFound
          ? 404
          : Category extends ProblemCategory.Conflict
            ? 409
            : Category extends ProblemCategory.Gone
              ? 410
              : Category extends ProblemCategory.ValidationError
                ? 422
                : Category extends ProblemCategory.BusinessRuleViolation
                  ? 422
                  : Category extends ProblemCategory.TooManyRequests
                    ? 429
                    : Category extends ProblemCategory.InternalServerError
                      ? 500
                      : Category extends ProblemCategory.NotImplemented
                        ? 501
                        : number;

export type DefinedProblemRegistryEntries<Problems extends ProblemRegistryProblemDefinitions> = {
  readonly [Code in keyof Problems & string]: PackageProblemRegistryEntry<
    Code,
    Problems[Code]["category"],
    Problems[Code]["status"] extends number
      ? Problems[Code]["status"]
      : ProblemRegistryStatusForCategory<Problems[Code]["category"]>
  >;
}[keyof Problems & string][];

export type DefineProblemRegistryOptions<
  Problems extends ProblemRegistryProblemDefinitions = ProblemRegistryProblemDefinitions,
> = {
  readonly package: string;
  readonly problems: Problems;
};

export type PackageProblemRegistryEntry<
  Code extends string = string,
  Category extends ProblemCategory = ProblemCategory,
  Status extends number = number,
> = {
  readonly package: string;
  readonly code: Code;
  readonly category: Category;
  readonly status: Status;
  readonly retryable: boolean;
  readonly retryability: "retryable" | "not-retryable";
  readonly public: boolean;
  readonly visibility: ProblemRegistryVisibility;
  readonly redaction: ProblemRegistryRedaction;
  readonly cookbookPath: string;
  readonly description?: string;
  readonly type?: string;
};

export type PackageProblemRegistry<
  Problems extends readonly PackageProblemRegistryEntry[] = readonly PackageProblemRegistryEntry[],
> = {
  readonly version: PackageProblemRegistryVersion;
  readonly package: string;
  readonly packagePrefix: string;
  readonly problemCount: number;
  readonly problems: Problems;
};

export type ProblemRegistrySnapshotPackage = {
  readonly package: string;
  readonly packagePrefix: string;
  readonly problemCodes: readonly string[];
};

export type ProblemRegistrySnapshot = {
  readonly snapshotVersion: ProblemRegistrySnapshotVersion;
  readonly registryVersion: PackageProblemRegistryVersion;
  readonly packageCount: number;
  readonly problemCount: number;
  readonly packages: readonly ProblemRegistrySnapshotPackage[];
  readonly problems: readonly PackageProblemRegistryEntry[];
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

export function defineProblemRegistry<const Problems extends ProblemRegistryProblemDefinitions>(
  options: DefineProblemRegistryOptions<Problems>,
): PackageProblemRegistry<DefinedProblemRegistryEntries<Problems>> {
  const packagePrefix = getProblemRegistryPackagePrefix(options.package);
  const problems = Object.entries(options.problems)
    .map(([code, definition]) =>
      createPackageProblemRegistryEntry(options.package, code, definition),
    )
    .sort(comparePackageProblemRegistryEntries);
  const registry = {
    version: "croco.problem-registry.v1",
    package: options.package,
    packagePrefix,
    problemCount: problems.length,
    problems,
  } as const;
  const errors = getPackageProblemRegistryValidationErrors(registry);

  if (errors.length > 0) {
    throw new ProblemRegistryValidationProblem(errors);
  }

  return registry as PackageProblemRegistry<DefinedProblemRegistryEntries<Problems>>;
}

export function createProblemRegistrySnapshot(
  registries: readonly PackageProblemRegistry[],
): ProblemRegistrySnapshot {
  const errors = registries.flatMap(getPackageProblemRegistryValidationErrors);
  const packageSummaries = registries
    .map((registry) => ({
      package: registry.package,
      packagePrefix: registry.packagePrefix,
      problemCodes: registry.problems.map((problem) => problem.code).sort(compareStrings),
    }))
    .sort(compareProblemRegistrySnapshotPackages);
  const problems = registries
    .flatMap((registry) => registry.problems)
    .sort(comparePackageProblemRegistryEntries);
  const seenCodes = new Map<string, PackageProblemRegistryEntry>();

  for (const problem of problems) {
    const existing = seenCodes.get(problem.code);

    if (existing) {
      errors.push(
        `Problem code '${problem.code}' is declared by both ${existing.package} and ${problem.package}.`,
      );
      continue;
    }

    seenCodes.set(problem.code, problem);
  }

  if (errors.length > 0) {
    throw new ProblemRegistryValidationProblem(errors);
  }

  return {
    snapshotVersion: "croco.problem-registry.snapshot.v1",
    registryVersion: "croco.problem-registry.v1",
    packageCount: registries.length,
    problemCount: problems.length,
    packages: packageSummaries,
    problems,
  };
}

export function stringifyProblemRegistrySnapshot(snapshot: ProblemRegistrySnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function getPackageProblemRegistryValidationErrors(
  registry: PackageProblemRegistry,
): readonly string[] {
  const errors: string[] = [];
  const seenCodes = new Set<string>();
  const expectedPrefix = getProblemRegistryPackagePrefix(registry.package);

  if (registry.version !== "croco.problem-registry.v1") {
    errors.push(`Unsupported ProblemRegistry manifest version '${registry.version}'.`);
  }

  if (registry.package.length === 0) {
    errors.push("ProblemRegistry package name must not be empty.");
  }

  if (registry.packagePrefix !== expectedPrefix) {
    errors.push(
      `ProblemRegistry package '${registry.package}' has prefix '${registry.packagePrefix}', expected '${expectedPrefix}'.`,
    );
  }

  if (registry.problemCount !== registry.problems.length) {
    errors.push(
      `ProblemRegistry package '${registry.package}' count ${registry.problemCount} does not match ${registry.problems.length} entries.`,
    );
  }

  for (const problem of registry.problems) {
    if (seenCodes.has(problem.code)) {
      errors.push(
        `ProblemRegistry package '${registry.package}' contains duplicate code '${problem.code}'.`,
      );
      continue;
    }

    seenCodes.add(problem.code);

    if (problem.package !== registry.package) {
      errors.push(
        `Problem code '${problem.code}' belongs to package '${problem.package}', expected '${registry.package}'.`,
      );
    }

    if (!hasProblemRegistryPackagePrefix(problem.code, registry.packagePrefix)) {
      errors.push(
        `Problem code '${problem.code}' must start with package prefix '${registry.packagePrefix}_'.`,
      );
    }

    const expectedStatus = ProblemCategoryMapper.toHttpStatus(problem.category);

    if (problem.status !== expectedStatus) {
      errors.push(
        `Problem code '${problem.code}' has status ${problem.status}, expected ${expectedStatus} for ${problem.category}.`,
      );
    }

    if (problem.retryability !== (problem.retryable ? "retryable" : "not-retryable")) {
      errors.push(`Problem code '${problem.code}' has inconsistent retryability metadata.`);
    }

    if (problem.visibility !== (problem.public ? "public" : "private")) {
      errors.push(`Problem code '${problem.code}' has inconsistent visibility metadata.`);
    }

    if (!isProblemRegistryRedaction(problem.redaction)) {
      errors.push(
        `Problem code '${problem.code}' has unsupported redaction '${problem.redaction}'.`,
      );
    }
  }

  return errors;
}

export function assertPackageProblemRegistryValid(registry: PackageProblemRegistry): void {
  const errors = getPackageProblemRegistryValidationErrors(registry);

  if (errors.length > 0) {
    throw new ProblemRegistryValidationProblem(errors);
  }
}

export function getProblemRegistryPackagePrefix(packageName: string): string {
  const packageNameSegments = packageName.split("/");
  const unscoped = packageName.includes("/")
    ? packageNameSegments[packageNameSegments.length - 1]
    : packageName;

  return (
    (unscoped ?? packageName)
      .replace(/^@/, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_")
      .toUpperCase() || "PACKAGE"
  );
}

export function hasProblemRegistryPackagePrefix(code: string, packagePrefix: string): boolean {
  return code.startsWith(`${packagePrefix}_`);
}

function createPackageProblemRegistryEntry(
  packageName: string,
  code: string,
  definition: ProblemRegistryProblemDefinition,
): PackageProblemRegistryEntry {
  const status = definition.status ?? ProblemCategoryMapper.toHttpStatus(definition.category);

  return {
    package: packageName,
    code,
    category: definition.category,
    status,
    retryable: definition.retryable,
    retryability: definition.retryable ? "retryable" : "not-retryable",
    public: definition.public,
    visibility: definition.public ? "public" : "private",
    redaction: definition.redaction,
    cookbookPath: definition.cookbookPath ?? getProblemCookbookPath(code),
    ...(definition.description ? { description: definition.description } : {}),
    ...(definition.type ? { type: definition.type } : {}),
  };
}

function isProblemRegistryRedaction(value: string): value is ProblemRegistryRedaction {
  return value === "public" || value === "safe" || value === "operator-only";
}

function comparePackageProblemRegistryEntries(
  left: PackageProblemRegistryEntry,
  right: PackageProblemRegistryEntry,
): number {
  return left.code.localeCompare(right.code) || left.package.localeCompare(right.package);
}

function compareProblemRegistrySnapshotPackages(
  left: ProblemRegistrySnapshotPackage,
  right: ProblemRegistrySnapshotPackage,
): number {
  return left.package.localeCompare(right.package);
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
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
      status: ProblemCategoryMapper.toHttpStatus(toProblemCategory(category)),
      title: ProblemCategoryMapper.toTitle(toProblemCategory(category)),
      cookbookPath: getProblemCookbookPath(code, cookbookBasePath),
      recovery: CATEGORY_RECOVERY_METADATA[category],
      lifecycle: createActiveProblemLifecycle(),
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
  const registryByCode = new Map(registry.problems.map((problem) => [problem.code, problem]));

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
    const lifecycle = problem.lifecycle;

    const expectedStatus = ProblemCategoryMapper.toHttpStatus(toProblemCategory(problem.category));
    const expectedTitle = ProblemCategoryMapper.toTitle(toProblemCategory(problem.category));

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

    if (!lifecycle || (lifecycle.status !== "active" && lifecycle.status !== "deprecated")) {
      errors.push(`Problem code '${problem.code}' has an invalid lifecycle status.`);
    } else if (lifecycle.status === "deprecated") {
      errors.push(...getDeprecationMetadataValidationErrors(problem, registryByCode));
    }

    if (problem.sources.length === 0 && lifecycle?.status !== "deprecated") {
      errors.push(`Problem code '${problem.code}' has no source locations.`);
    } else if (problem.sources.length > 1) {
      errors.push(
        `Problem code '${problem.code}' is declared ${problem.sources.length} times: ${problem.sources.map(formatProblemCodeSource).join(", ")}.`,
      );
    }
  }

  return errors;
}

function getDeprecationMetadataValidationErrors(
  problem: ProblemCodeRegistryEntry,
  registryByCode: ReadonlyMap<string, ProblemCodeRegistryEntry>,
): readonly string[] {
  const metadata = problem.lifecycle.deprecation;
  const diagnostics: string[] = [];

  if (!metadata) {
    return [`Deprecated Problem code '${problem.code}' is missing deprecation metadata.`];
  }

  const metadataRecord = metadata as {
    readonly reason?: unknown;
    readonly migrationNote?: unknown;
    readonly replacementCode?: unknown;
    readonly noReplacementReason?: unknown;
  };
  const reason = getTrimmedString(metadataRecord.reason);
  const migrationNote = getTrimmedString(metadataRecord.migrationNote);
  const replacementCode = getTrimmedString(metadataRecord.replacementCode);
  const noReplacementReason = getTrimmedString(metadataRecord.noReplacementReason);

  if (!reason) {
    diagnostics.push(`Deprecated Problem code '${problem.code}' is missing deprecation reason.`);
  }

  if (!migrationNote) {
    diagnostics.push(`Deprecated Problem code '${problem.code}' is missing migration guidance.`);
  }

  if (!replacementCode && !noReplacementReason) {
    diagnostics.push(
      `Deprecated Problem code '${problem.code}' must declare replacementCode or noReplacementReason.`,
    );
  }

  if (replacementCode && noReplacementReason) {
    diagnostics.push(
      `Deprecated Problem code '${problem.code}' must not declare both replacementCode and noReplacementReason.`,
    );
  }

  if (!replacementCode) {
    return diagnostics;
  }

  if (replacementCode === problem.code) {
    diagnostics.push(
      `Deprecated Problem code '${problem.code}' replacementCode must reference a different Problem code.`,
    );
    return diagnostics;
  }

  const replacement = registryByCode.get(replacementCode);

  if (!replacement) {
    diagnostics.push(
      `Deprecated Problem code '${problem.code}' replacementCode '${replacementCode}' is not registered.`,
    );
    return diagnostics;
  }

  if (replacement.lifecycle.status === "deprecated") {
    diagnostics.push(
      `Deprecated Problem code '${problem.code}' replacementCode '${replacementCode}' points to a deprecated Problem code.`,
    );
  }

  return diagnostics;
}

function getTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function toProblemCategory(category: ProblemCategoryName): ProblemCategory {
  return ProblemCategory[category];
}

function createActiveProblemLifecycle(): ProblemLifecycle {
  return { status: "active" };
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
