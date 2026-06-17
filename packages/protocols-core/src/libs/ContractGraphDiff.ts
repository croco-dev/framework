import type {
  ContractGraphSnapshot,
  ContractGraphSnapshotRoute,
  ContractSchemaFieldSnapshot,
  ContractSchemaLocation,
  ContractSchemaSnapshot,
} from "./ContractGraphSnapshot";

export type ContractGraphDiffSeverity = "breaking" | "non-breaking";

export type ContractGraphDiffChange = {
  readonly code: string;
  readonly severity: ContractGraphDiffSeverity;
  readonly message: string;
  readonly controllerName?: string;
  readonly routeId?: string;
  readonly operationId?: string;
  readonly location?: ContractSchemaLocation;
  readonly fieldPath?: string;
};

export type ContractGraphDiff = {
  readonly baselineRouteCount: number;
  readonly currentRouteCount: number;
  readonly breakingChangeCount: number;
  readonly nonBreakingChangeCount: number;
  readonly hasBreakingChanges: boolean;
  readonly changes: readonly ContractGraphDiffChange[];
  readonly breakingChanges: readonly ContractGraphDiffChange[];
  readonly nonBreakingChanges: readonly ContractGraphDiffChange[];
};

export function diffContractGraphSnapshots(
  baseline: ContractGraphSnapshot,
  current: ContractGraphSnapshot,
): ContractGraphDiff {
  const changes = [
    ...diffControllers(baseline, current),
    ...diffRoutes(baseline, current),
    ...diffOperationIds(baseline, current),
  ].sort(compareChanges);
  const breakingChanges = changes.filter((change) => change.severity === "breaking");
  const nonBreakingChanges = changes.filter((change) => change.severity === "non-breaking");

  return {
    baselineRouteCount: baseline.routeCount,
    currentRouteCount: current.routeCount,
    breakingChangeCount: breakingChanges.length,
    nonBreakingChangeCount: nonBreakingChanges.length,
    hasBreakingChanges: breakingChanges.length > 0,
    changes,
    breakingChanges,
    nonBreakingChanges,
  };
}

function diffControllers(
  baseline: ContractGraphSnapshot,
  current: ContractGraphSnapshot,
): ContractGraphDiffChange[] {
  const changes: ContractGraphDiffChange[] = [];
  const currentControllers = new Set(current.controllers.map((controller) => controller.name));
  const baselineControllers = new Set(baseline.controllers.map((controller) => controller.name));

  for (const controller of baseline.controllers) {
    if (!currentControllers.has(controller.name)) {
      changes.push({
        code: "contract-controller-removed",
        severity: "breaking",
        controllerName: controller.name,
        message: `Controller '${controller.name}' was removed from the contract graph.`,
      });
    }
  }

  for (const controller of current.controllers) {
    if (!baselineControllers.has(controller.name)) {
      changes.push({
        code: "contract-controller-added",
        severity: "non-breaking",
        controllerName: controller.name,
        message: `Controller '${controller.name}' was added to the contract graph.`,
      });
    }
  }

  return changes;
}

function diffRoutes(
  baseline: ContractGraphSnapshot,
  current: ContractGraphSnapshot,
): ContractGraphDiffChange[] {
  const changes: ContractGraphDiffChange[] = [];
  const currentRoutes = new Map(current.routes.map((route) => [route.routeId, route]));
  const baselineRoutes = new Map(baseline.routes.map((route) => [route.routeId, route]));

  for (const baselineRoute of baseline.routes) {
    const currentRoute = currentRoutes.get(baselineRoute.routeId);

    if (!currentRoute) {
      changes.push({
        code: "contract-route-removed",
        severity: "breaking",
        routeId: baselineRoute.routeId,
        operationId: baselineRoute.operationId,
        message: `Route '${baselineRoute.routeId}' was removed from the contract graph.`,
      });
      continue;
    }

    changes.push(...diffExistingRoute(baselineRoute, currentRoute));
  }

  for (const currentRoute of current.routes) {
    if (!baselineRoutes.has(currentRoute.routeId)) {
      changes.push({
        code: "contract-route-added",
        severity: "non-breaking",
        routeId: currentRoute.routeId,
        operationId: currentRoute.operationId,
        message: `Route '${currentRoute.routeId}' was added to the contract graph.`,
      });
    }
  }

  return changes;
}

function diffExistingRoute(
  baseline: ContractGraphSnapshotRoute,
  current: ContractGraphSnapshotRoute,
): ContractGraphDiffChange[] {
  const changes: ContractGraphDiffChange[] = [];

  if (baseline.httpMethod !== current.httpMethod || baseline.path !== current.path) {
    changes.push({
      code: "contract-route-method-path-changed",
      severity: "breaking",
      routeId: baseline.routeId,
      operationId: baseline.operationId,
      message: `Route '${baseline.routeId}' changed from ${baseline.httpMethod} ${baseline.path} to ${current.httpMethod} ${current.path}.`,
    });
  }

  if (baseline.operationId !== current.operationId) {
    changes.push({
      code: "contract-operation-id-changed",
      severity: "breaking",
      routeId: baseline.routeId,
      operationId: baseline.operationId,
      message: `Route '${baseline.routeId}' changed operation id from '${baseline.operationId}' to '${current.operationId}'.`,
    });
  }

  changes.push(...diffRequestSchemas(baseline, current));

  if (!isResponseSchemaCompatible(baseline.response, current.response)) {
    changes.push({
      code: "contract-response-schema-incompatible",
      severity: "breaking",
      routeId: baseline.routeId,
      operationId: baseline.operationId,
      location: "response",
      message: `Route '${baseline.routeId}' response schema is not backwards compatible.`,
    });
  }

  return changes;
}

function diffOperationIds(
  baseline: ContractGraphSnapshot,
  current: ContractGraphSnapshot,
): ContractGraphDiffChange[] {
  const currentOperationIds = new Set(current.operationIds);

  return baseline.operationIds
    .filter((operationId) => !currentOperationIds.has(operationId))
    .map((operationId) => ({
      code: "contract-operation-id-removed",
      severity: "breaking" as const,
      operationId,
      message: `Operation id '${operationId}' is no longer present in the contract graph.`,
    }));
}

function diffRequestSchemas(
  baseline: ContractGraphSnapshotRoute,
  current: ContractGraphSnapshotRoute,
): ContractGraphDiffChange[] {
  return (["body", "path", "query", "headers"] as const).flatMap((location) =>
    diffRequestSchema(location, baseline, current),
  );
}

function diffRequestSchema(
  location: Exclude<ContractSchemaLocation, "response">,
  baseline: ContractGraphSnapshotRoute,
  current: ContractGraphSnapshotRoute,
): ContractGraphDiffChange[] {
  const changes: ContractGraphDiffChange[] = [];
  const baselineSchema = baseline.request[location];
  const currentSchema = current.request[location];
  const baselineFields = collectRequestFields(baselineSchema);
  const currentFields = collectRequestFields(currentSchema);

  for (const [fieldPath, currentField] of currentFields) {
    const baselineField = baselineFields.get(fieldPath);

    if (!baselineField) {
      changes.push({
        code: currentField.required
          ? "contract-request-required-field-added"
          : "contract-request-optional-field-added",
        severity: currentField.required ? "breaking" : "non-breaking",
        routeId: baseline.routeId,
        operationId: baseline.operationId,
        location,
        fieldPath,
        message: `Route '${baseline.routeId}' ${location} request field '${fieldPath}' was added as ${currentField.required ? "required" : "optional"}.`,
      });
      continue;
    }

    if (!baselineField.required && currentField.required) {
      changes.push({
        code: "contract-request-field-became-required",
        severity: "breaking",
        routeId: baseline.routeId,
        operationId: baseline.operationId,
        location,
        fieldPath,
        message: `Route '${baseline.routeId}' ${location} request field '${fieldPath}' changed from optional to required.`,
      });
    }

    if (!isRequestSchemaCompatible(baselineField.schema, currentField.schema)) {
      changes.push({
        code: "contract-request-field-schema-incompatible",
        severity: "breaking",
        routeId: baseline.routeId,
        operationId: baseline.operationId,
        location,
        fieldPath,
        message: `Route '${baseline.routeId}' ${location} request field '${fieldPath}' schema is not backwards compatible.`,
      });
    }
  }

  if (
    baselineFields.size === 0 &&
    currentFields.size === 0 &&
    !isRequestSchemaCompatible(baselineSchema, currentSchema)
  ) {
    changes.push({
      code: "contract-request-schema-incompatible",
      severity: "breaking",
      routeId: baseline.routeId,
      operationId: baseline.operationId,
      location,
      message: `Route '${baseline.routeId}' ${location} request schema is not backwards compatible.`,
    });
  }

  return changes;
}

function collectRequestFields(
  schema: ContractSchemaSnapshot | null,
  prefix = "",
  parentRequired = true,
): Map<string, ContractSchemaFieldSnapshot> {
  const fields = new Map<string, ContractSchemaFieldSnapshot>();
  const objectSchema = unwrapSchema(schema);

  if (!objectSchema || objectSchema.kind !== "object" || !objectSchema.fields) {
    return fields;
  }

  for (const field of objectSchema.fields) {
    const fieldPath = prefix ? `${prefix}.${field.name}` : field.name;
    const required = parentRequired && field.required;
    const normalizedField = { ...field, required };

    fields.set(fieldPath, normalizedField);

    for (const [nestedPath, nestedField] of collectRequestFields(
      field.schema,
      fieldPath,
      required,
    )) {
      fields.set(nestedPath, nestedField);
    }
  }

  return fields;
}

function isResponseSchemaCompatible(
  baseline: ContractSchemaSnapshot | null,
  current: ContractSchemaSnapshot | null,
): boolean {
  if (!baseline) {
    return true;
  }

  if (!current) {
    return false;
  }

  return isSchemaCompatible(
    unwrapTransparentSchema(baseline),
    unwrapTransparentSchema(current),
    "response",
  );
}

function isRequestSchemaCompatible(
  baseline: ContractSchemaSnapshot | null,
  current: ContractSchemaSnapshot | null,
): boolean {
  return isSchemaCompatible(
    unwrapTransparentSchema(baseline),
    unwrapTransparentSchema(current),
    "request",
  );
}

function isSchemaCompatible(
  baseline: ContractSchemaSnapshot | null,
  current: ContractSchemaSnapshot | null,
  variance: "response" | "request",
): boolean {
  if (!baseline) {
    return true;
  }

  if (!current) {
    return variance === "request";
  }

  const baselineWrapper = getSchemaWrapper(baseline);
  const currentWrapper = getSchemaWrapper(current);

  if (baselineWrapper || currentWrapper) {
    return areWrappedSchemasCompatible(baseline, current, variance);
  }

  if (baseline.kind === "object" && current.kind === "object") {
    return areObjectSchemasCompatible(baseline, current, variance);
  }

  if (baseline.kind === "array" && current.kind === "array") {
    return isSchemaCompatible(baseline.element ?? null, current.element ?? null, variance);
  }

  if (baseline.kind === "union" && current.kind === "union") {
    return JSON.stringify(baseline.options ?? []) === JSON.stringify(current.options ?? []);
  }

  return JSON.stringify(baseline) === JSON.stringify(current);
}

function areWrappedSchemasCompatible(
  baseline: ContractSchemaSnapshot,
  current: ContractSchemaSnapshot,
  variance: "response" | "request",
): boolean {
  const baselineWrapper = getSchemaWrapper(baseline);
  const currentWrapper = getSchemaWrapper(current);

  if (baselineWrapper && currentWrapper) {
    if (baselineWrapper !== currentWrapper) {
      return false;
    }

    return isSchemaCompatible(baseline.inner ?? null, current.inner ?? null, variance);
  }

  if (baselineWrapper) {
    return variance === "response"
      ? isSchemaCompatible(baseline.inner ?? null, current, variance)
      : false;
  }

  if (currentWrapper) {
    return variance === "request"
      ? isSchemaCompatible(baseline, current.inner ?? null, variance)
      : false;
  }

  return false;
}

function areObjectSchemasCompatible(
  baseline: ContractSchemaSnapshot,
  current: ContractSchemaSnapshot,
  variance: "response" | "request",
): boolean {
  const currentFields = new Map((current.fields ?? []).map((field) => [field.name, field]));

  for (const baselineField of baseline.fields ?? []) {
    const currentField = currentFields.get(baselineField.name);

    if (!currentField) {
      return variance === "request";
    }

    if (variance === "response" && baselineField.required && !currentField.required) {
      return false;
    }

    if (
      !isSchemaCompatible(
        unwrapTransparentSchema(baselineField.schema),
        unwrapTransparentSchema(currentField.schema),
        variance,
      )
    ) {
      return false;
    }
  }

  return true;
}

function unwrapSchema(schema: ContractSchemaSnapshot | null): ContractSchemaSnapshot | null {
  let current = schema;

  while (
    current &&
    (current.kind === "optional" ||
      current.kind === "default" ||
      current.kind === "nullable" ||
      current.kind === "effects")
  ) {
    current = current.inner ?? null;
  }

  return current;
}

function unwrapTransparentSchema(
  schema: ContractSchemaSnapshot | null,
): ContractSchemaSnapshot | null {
  let current = schema;

  while (current?.kind === "effects") {
    current = current.inner ?? null;
  }

  return current;
}

function getSchemaWrapper(
  schema: ContractSchemaSnapshot,
): "default" | "nullable" | "optional" | null {
  if (schema.kind === "default" || schema.kind === "nullable" || schema.kind === "optional") {
    return schema.kind;
  }

  return null;
}

function compareChanges(left: ContractGraphDiffChange, right: ContractGraphDiffChange): number {
  return (
    compareSeverity(left.severity, right.severity) ||
    compareStrings(left.code, right.code) ||
    compareStrings(left.routeId ?? "", right.routeId ?? "") ||
    compareStrings(left.controllerName ?? "", right.controllerName ?? "") ||
    compareStrings(left.operationId ?? "", right.operationId ?? "") ||
    compareStrings(left.fieldPath ?? "", right.fieldPath ?? "")
  );
}

function compareSeverity(
  left: ContractGraphDiffSeverity,
  right: ContractGraphDiffSeverity,
): number {
  if (left === right) {
    return 0;
  }

  return left === "breaking" ? -1 : 1;
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}
