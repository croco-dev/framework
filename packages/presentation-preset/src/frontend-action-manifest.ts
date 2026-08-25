import { Problem, ProblemCategory } from "@croco/problems-core";

export const FRONTEND_ACTION_MANIFEST_SCHEMA_VERSION = "croco.frontend-action-manifest.v1" as const;

export type FrontendActionManifestSourceKind = "rest-rpc-route" | "meta-vite-server-action";

export type FrontendActionShapeReferenceKind = "generated-type" | "declared-schema" | "none";

export type FrontendActionInputLocation = "body" | "path" | "query" | "headers" | "form-data";

export type FrontendActionShapeReference = {
  readonly kind: FrontendActionShapeReferenceKind;
  readonly ref?: string;
  readonly locations?: readonly FrontendActionInputLocation[];
  readonly description?: string;
};

export type FrontendActionSource = {
  readonly kind: FrontendActionManifestSourceKind;
  readonly packageName: string;
  readonly routeId?: string;
  readonly operationId?: string;
  readonly controllerName?: string;
  readonly methodName?: string;
  readonly domain?: string;
  readonly actionName?: string;
};

export type FrontendActionProblem = {
  readonly code: string;
  readonly category?: string;
  readonly status?: number;
  readonly description?: string;
  readonly type?: string;
  readonly cookbookPath?: string;
};

export type FrontendActionMetadataReference = {
  readonly id: string;
  readonly name: string;
  readonly owner?: {
    readonly controllerName: string;
    readonly routeId?: string;
    readonly methodName?: string;
  };
};

export type FrontendActionEntitlementResource = {
  readonly type: string;
  readonly id?: string;
  readonly idParam?: string;
};

export type FrontendActionEntitlement = {
  readonly feature: string;
  readonly description?: string;
  readonly resource?: FrontendActionEntitlementResource;
};

export type FrontendActionPermissionMetadata = {
  readonly guards: readonly FrontendActionMetadataReference[];
  readonly roles: readonly string[];
  readonly entitlements: readonly FrontendActionEntitlement[];
};

export type FrontendActionInvalidationHint = {
  readonly kind: "query-key-prefix" | "custom";
  readonly target: string;
  readonly reason?: string;
};

export type FrontendActionManifestEntry = {
  readonly id: string;
  readonly source: FrontendActionSource;
  readonly method: string;
  readonly path: string;
  readonly input: FrontendActionShapeReference;
  readonly output: FrontendActionShapeReference;
  readonly problems: readonly FrontendActionProblem[];
  readonly permissions: FrontendActionPermissionMetadata;
  readonly invalidates: readonly FrontendActionInvalidationHint[];
};

export type FrontendActionManifest = {
  readonly schemaVersion: typeof FRONTEND_ACTION_MANIFEST_SCHEMA_VERSION;
  readonly actions: readonly FrontendActionManifestEntry[];
};

export type FrontendActionManifestMergeInput = {
  readonly source: string;
  readonly manifest: unknown;
};

export type FrontendActionManifestDrift =
  | {
      readonly ok: true;
      readonly status: "current";
      readonly path: string;
    }
  | {
      readonly ok: false;
      readonly status: "missing" | "different";
      readonly path: string;
      readonly expected: string;
      readonly actual?: string;
    };

export function createFrontendActionManifest(
  actions: readonly FrontendActionManifestEntry[],
): FrontendActionManifest {
  return {
    schemaVersion: FRONTEND_ACTION_MANIFEST_SCHEMA_VERSION,
    actions: sortFrontendActionManifestEntries(actions),
  };
}

export function mergeFrontendActionManifests(
  inputs: readonly FrontendActionManifestMergeInput[],
): FrontendActionManifest {
  const validatedInputs = inputs
    .map(validateMergeInput)
    .sort((left, right) => compareStrings(left.source, right.source));
  const actions = new Map<
    string,
    {
      readonly action: FrontendActionManifestEntry;
      readonly source: string;
      readonly canonical: string;
      readonly serialized: string;
    }
  >();

  for (const input of validatedInputs) {
    for (const action of input.manifest.actions) {
      const canonical = serializeCanonicalValue(action);
      const serialized = JSON.stringify(action);
      const existing = actions.get(action.id);

      if (!existing) {
        actions.set(action.id, { action, source: input.source, canonical, serialized });
        continue;
      }

      if (existing.canonical !== canonical) {
        throw new FrontendActionManifestDuplicateConflictProblem(
          action.id,
          existing.source,
          input.source,
        );
      }

      if (compareStrings(serialized, existing.serialized) < 0) {
        actions.set(action.id, { action, source: input.source, canonical, serialized });
      }
    }
  }

  return createFrontendActionManifest([...actions.values()].map(({ action }) => action));
}

export function serializeFrontendActionManifest(manifest: FrontendActionManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export async function writeFrontendActionManifest(
  manifest: FrontendActionManifest,
  outputPath: string,
): Promise<void> {
  const [{ mkdir, writeFile }, { dirname }] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeFrontendActionManifest(manifest), "utf-8");
}

export async function writeMergedFrontendActionManifest(
  inputs: readonly FrontendActionManifestMergeInput[],
  outputPath: string,
): Promise<void> {
  const manifest = mergeFrontendActionManifests(inputs);
  await writeFrontendActionManifest(manifest, outputPath);
}

export async function checkFrontendActionManifestFile(
  manifest: FrontendActionManifest,
  outputPath: string,
): Promise<FrontendActionManifestDrift> {
  const expected = serializeFrontendActionManifest(manifest);
  const { readFile } = await import("node:fs/promises");

  try {
    const actual = await readFile(outputPath, "utf-8");

    if (actual === expected) {
      return { ok: true, status: "current", path: outputPath };
    }

    return { ok: false, status: "different", path: outputPath, expected, actual };
  } catch (error) {
    if (isMissingFileError(error)) {
      return { ok: false, status: "missing", path: outputPath, expected };
    }

    throw error;
  }
}

function sortFrontendActionManifestEntries(
  actions: readonly FrontendActionManifestEntry[],
): readonly FrontendActionManifestEntry[] {
  return [...actions].sort(
    (left, right) =>
      compareStrings(left.id, right.id) ||
      compareStrings(left.source.kind, right.source.kind) ||
      compareStrings(left.method, right.method) ||
      compareStrings(left.path, right.path),
  );
}

function validateMergeInput(input: FrontendActionManifestMergeInput): {
  readonly source: string;
  readonly manifest: FrontendActionManifest;
} {
  if (input.source.trim().length === 0) {
    throw new FrontendActionManifestInvalidProblem("Manifest producer source must not be empty.");
  }

  if (!isRecordWithKeys(input.manifest, ["schemaVersion", "actions"])) {
    throw new FrontendActionManifestInvalidProblem(
      `Manifest from ${quote(input.source)} must be an object.`,
    );
  }

  if (input.manifest.schemaVersion !== FRONTEND_ACTION_MANIFEST_SCHEMA_VERSION) {
    throw new FrontendActionManifestInvalidProblem(
      `Manifest from ${quote(input.source)} uses schema version ${quote(String(input.manifest.schemaVersion))}; expected ${quote(FRONTEND_ACTION_MANIFEST_SCHEMA_VERSION)}.`,
    );
  }

  if (!Array.isArray(input.manifest.actions)) {
    throw new FrontendActionManifestInvalidProblem(
      `Manifest from ${quote(input.source)} must contain an actions array.`,
    );
  }

  for (const [index, action] of input.manifest.actions.entries()) {
    if (!isFrontendActionManifestEntry(action)) {
      throw new FrontendActionManifestInvalidProblem(
        `Manifest from ${quote(input.source)} contains an invalid action at index ${index}.`,
      );
    }
  }

  return { source: input.source, manifest: input.manifest as FrontendActionManifest };
}

function isFrontendActionManifestEntry(value: unknown): value is FrontendActionManifestEntry {
  return (
    isRecordWithKeys(value, [
      "id",
      "source",
      "method",
      "path",
      "input",
      "output",
      "problems",
      "permissions",
      "invalidates",
    ]) &&
    isNonEmptyString(value.id) &&
    isFrontendActionSource(value.source) &&
    isNonEmptyString(value.method) &&
    isNonEmptyString(value.path) &&
    isFrontendActionShapeReference(value.input) &&
    isFrontendActionShapeReference(value.output) &&
    isArrayOf(value.problems, isFrontendActionProblem) &&
    isFrontendActionPermissionMetadata(value.permissions) &&
    isArrayOf(value.invalidates, isFrontendActionInvalidationHint)
  );
}

function isFrontendActionSource(value: unknown): value is FrontendActionSource {
  return (
    isRecordWithKeys(value, [
      "kind",
      "packageName",
      "routeId",
      "operationId",
      "controllerName",
      "methodName",
      "domain",
      "actionName",
    ]) &&
    (value.kind === "rest-rpc-route" || value.kind === "meta-vite-server-action") &&
    isNonEmptyString(value.packageName) &&
    isOptionalString(value.routeId) &&
    isOptionalString(value.operationId) &&
    isOptionalString(value.controllerName) &&
    isOptionalString(value.methodName) &&
    isOptionalString(value.domain) &&
    isOptionalString(value.actionName)
  );
}

function isFrontendActionShapeReference(value: unknown): value is FrontendActionShapeReference {
  return (
    isRecordWithKeys(value, ["kind", "ref", "locations", "description"]) &&
    (value.kind === "generated-type" ||
      value.kind === "declared-schema" ||
      value.kind === "none") &&
    isOptionalString(value.ref) &&
    (value.locations === undefined || isArrayOf(value.locations, isFrontendActionInputLocation)) &&
    isOptionalString(value.description)
  );
}

function isFrontendActionProblem(value: unknown): value is FrontendActionProblem {
  return (
    isRecordWithKeys(value, [
      "code",
      "category",
      "status",
      "description",
      "type",
      "cookbookPath",
    ]) &&
    isNonEmptyString(value.code) &&
    isOptionalString(value.category) &&
    (value.status === undefined ||
      (typeof value.status === "number" && Number.isFinite(value.status))) &&
    isOptionalString(value.description) &&
    isOptionalString(value.type) &&
    isOptionalString(value.cookbookPath)
  );
}

function isFrontendActionPermissionMetadata(
  value: unknown,
): value is FrontendActionPermissionMetadata {
  return (
    isRecordWithKeys(value, ["guards", "roles", "entitlements"]) &&
    isArrayOf(value.guards, isFrontendActionMetadataReference) &&
    isArrayOf(value.roles, isString) &&
    isArrayOf(value.entitlements, isFrontendActionEntitlement)
  );
}

function isFrontendActionMetadataReference(
  value: unknown,
): value is FrontendActionMetadataReference {
  return (
    isRecordWithKeys(value, ["id", "name", "owner"]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    (value.owner === undefined || isFrontendActionMetadataOwner(value.owner))
  );
}

function isFrontendActionMetadataOwner(
  value: unknown,
): value is NonNullable<FrontendActionMetadataReference["owner"]> {
  return (
    isRecordWithKeys(value, ["controllerName", "routeId", "methodName"]) &&
    isNonEmptyString(value.controllerName) &&
    isOptionalString(value.routeId) &&
    isOptionalString(value.methodName)
  );
}

function isFrontendActionEntitlement(value: unknown): value is FrontendActionEntitlement {
  return (
    isRecordWithKeys(value, ["feature", "description", "resource"]) &&
    isNonEmptyString(value.feature) &&
    isOptionalString(value.description) &&
    (value.resource === undefined || isFrontendActionEntitlementResource(value.resource))
  );
}

function isFrontendActionEntitlementResource(
  value: unknown,
): value is FrontendActionEntitlementResource {
  return (
    isRecordWithKeys(value, ["type", "id", "idParam"]) &&
    isNonEmptyString(value.type) &&
    isOptionalString(value.id) &&
    isOptionalString(value.idParam)
  );
}

function isFrontendActionInvalidationHint(value: unknown): value is FrontendActionInvalidationHint {
  return (
    isRecordWithKeys(value, ["kind", "target", "reason"]) &&
    (value.kind === "query-key-prefix" || value.kind === "custom") &&
    isNonEmptyString(value.target) &&
    isOptionalString(value.reason)
  );
}

function isFrontendActionInputLocation(value: unknown): value is FrontendActionInputLocation {
  return (
    value === "body" ||
    value === "path" ||
    value === "query" ||
    value === "headers" ||
    value === "form-data"
  );
}

function isRecordWithKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).every((key) => keys.includes(key));
}

function isArrayOf<T>(
  value: unknown,
  predicate: (item: unknown) => item is T,
): value is readonly T[] {
  return Array.isArray(value) && value.every(predicate);
}

function serializeCanonicalValue(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value));
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([key, nestedValue]) => [key, canonicalizeValue(nestedValue)]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

function quote(value: string): string {
  return JSON.stringify(value);
}

class FrontendActionManifestInvalidProblem extends Problem {
  public constructor(detail: string) {
    super(
      "presentation-preset/frontend-action-manifest-invalid",
      ProblemCategory.ValidationError,
      detail,
    );
  }
}

class FrontendActionManifestDuplicateConflictProblem extends Problem {
  public constructor(actionId: string, firstSource: string, secondSource: string) {
    super(
      "presentation-preset/frontend-action-manifest-duplicate-conflict",
      ProblemCategory.Conflict,
      `Action ${quote(actionId)} has conflicting definitions from ${quote(firstSource)} and ${quote(secondSource)}.`,
      { extensions: { actionId, sources: [firstSource, secondSource] } },
    );
  }
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT"
  );
}
