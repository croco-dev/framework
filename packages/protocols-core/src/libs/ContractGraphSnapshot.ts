import type { z } from "zod";
import type {
  ContractAccessMetadata,
  ContractDiagnostic,
  ContractGraph,
  ContractGraphRoute,
  ContractGraphVersion,
  ContractMetadataReference,
} from "./ContractGraph";
import {
  createContractGraphConsumerCoverage,
  type ContractGraphConsumerCoverageReport,
} from "./ContractGraphConsumerCoverage";
import type { ParamIR } from "./RouteIR";

export type ContractGraphSnapshotVersion = "croco.contract-graph.snapshot.v1";
export type ContractSchemaLocation = "body" | "path" | "query" | "headers" | "response" | "problem";

export type ContractSchemaSnapshot = {
  readonly kind: string;
  readonly typeName: string;
  readonly fields?: readonly ContractSchemaFieldSnapshot[];
  readonly element?: ContractSchemaSnapshot | null;
  readonly inner?: ContractSchemaSnapshot | null;
  readonly options?: readonly ContractSchemaSnapshot[];
  readonly values?: readonly string[];
  readonly value?: string | number | boolean | null;
};

export type ContractSchemaFieldSnapshot = {
  readonly name: string;
  readonly required: boolean;
  readonly schema: ContractSchemaSnapshot;
};

export type ContractGraphSnapshotController = {
  readonly name: string;
  readonly path: string;
  readonly guards: readonly ContractMetadataReference[];
  readonly roles: readonly string[];
  readonly routeIds: readonly string[];
};

export type ContractGraphSnapshotParam = {
  readonly kind: ParamIR["kind"];
  readonly name: string;
  readonly schema: ContractSchemaSnapshot | null;
};

export type ContractGraphSnapshotProblemResponse = {
  readonly code: string;
  readonly category: string;
  readonly status: number;
  readonly description?: string;
  readonly type?: string;
};

export type ContractGraphSnapshotRoute = {
  readonly routeId: string;
  readonly operationId: string;
  readonly controllerName: string;
  readonly methodName: string;
  readonly httpMethod: string;
  readonly path: string;
  readonly controllerPath: string;
  readonly domain: string | null;
  readonly access: ContractAccessMetadata;
  readonly params: readonly ContractGraphSnapshotParam[];
  readonly request: {
    readonly body: ContractSchemaSnapshot | null;
    readonly path: ContractSchemaSnapshot | null;
    readonly query: ContractSchemaSnapshot | null;
    readonly headers: ContractSchemaSnapshot | null;
  };
  readonly response: ContractSchemaSnapshot | null;
  readonly problems: readonly ContractGraphSnapshotProblemResponse[];
};

export type ContractGraphSnapshot = {
  readonly snapshotVersion: ContractGraphSnapshotVersion;
  readonly graphVersion: ContractGraphVersion;
  readonly controllerCount: number;
  readonly routeCount: number;
  readonly operationIds: readonly string[];
  readonly consumerCoverage?: ContractGraphConsumerCoverageReport;
  readonly controllers: readonly ContractGraphSnapshotController[];
  readonly routes: readonly ContractGraphSnapshotRoute[];
  readonly diagnostics: readonly ContractDiagnostic[];
};

export function createContractGraphSnapshot(graph: ContractGraph): ContractGraphSnapshot {
  const controllers = [...graph.controllers]
    .map((controller) => ({
      name: controller.name,
      path: controller.path,
      guards: sortGuards(controller.guards),
      roles: [...controller.roles].sort(compareStrings),
      routeIds: [...controller.routeIds].sort(compareStrings),
    }))
    .sort(compareControllers);
  const routes = graph.routes.map(toSnapshotRoute).sort(compareRoutes);

  return {
    snapshotVersion: "croco.contract-graph.snapshot.v1",
    graphVersion: graph.version,
    controllerCount: controllers.length,
    routeCount: routes.length,
    operationIds: routes.map((route) => route.operationId).sort(compareStrings),
    consumerCoverage: createContractGraphConsumerCoverage(graph),
    controllers,
    routes,
    diagnostics: [...graph.diagnostics].sort(compareDiagnostics),
  };
}

export function stringifyContractGraphSnapshot(snapshot: ContractGraphSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function isContractGraphSnapshot(value: unknown): value is ContractGraphSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.snapshotVersion === "croco.contract-graph.snapshot.v1" &&
    value.graphVersion === "croco.contract-graph.v1" &&
    Array.isArray(value.controllers) &&
    Array.isArray(value.routes) &&
    Array.isArray(value.diagnostics)
  );
}

export function snapshotZodSchema(
  schema: z.ZodType | null | undefined,
): ContractSchemaSnapshot | null {
  if (!schema) {
    return null;
  }

  return snapshotUnknownSchema(schema);
}

function toSnapshotRoute(route: ContractGraphRoute): ContractGraphSnapshotRoute {
  return {
    routeId: route.routeId,
    operationId: route.operationId,
    controllerName: route.controllerName,
    methodName: route.methodName,
    httpMethod: route.httpMethod.toUpperCase(),
    path: route.path,
    controllerPath: route.controllerPath,
    domain: route.domain,
    access: {
      guards: sortGuards(route.access.guards),
      roles: [...route.access.roles].sort(compareStrings),
    },
    params: route.params.map((param) => ({
      kind: param.kind,
      name: param.name,
      schema: snapshotZodSchema(param.schema),
    })),
    request: {
      body: snapshotZodSchema(route.inputSchemas.body),
      path: snapshotZodSchema(route.inputSchemas.path),
      query: snapshotZodSchema(route.inputSchemas.query),
      headers: snapshotZodSchema(route.inputSchemas.headers),
    },
    response: snapshotZodSchema(route.outputSchema),
    problems: [...(route.problemResponses ?? [])]
      .map((problem) => ({
        code: problem.code,
        category: problem.category,
        status: problem.status,
        ...(problem.description ? { description: problem.description } : {}),
        ...(problem.type ? { type: problem.type } : {}),
      }))
      .sort(compareProblemResponses),
  };
}

function compareProblemResponses(
  left: ContractGraphSnapshotProblemResponse,
  right: ContractGraphSnapshotProblemResponse,
): number {
  return compareStrings(left.code, right.code) || left.status - right.status;
}

function snapshotUnknownSchema(schema: unknown): ContractSchemaSnapshot {
  const typeName = getSchemaTypeName(schema);
  const definition = getZodDefinition(schema);

  if (typeName === "ZodString") {
    return { kind: "string", typeName };
  }

  if (typeName === "ZodNumber") {
    return { kind: "number", typeName };
  }

  if (typeName === "ZodBoolean") {
    return { kind: "boolean", typeName };
  }

  if (typeName === "ZodBigInt") {
    return { kind: "bigint", typeName };
  }

  if (typeName === "ZodDate") {
    return { kind: "date", typeName };
  }

  if (typeName === "ZodNull") {
    return { kind: "null", typeName };
  }

  if (typeName === "ZodUndefined") {
    return { kind: "undefined", typeName };
  }

  if (
    typeName === "ZodAny" ||
    typeName === "ZodUnknown" ||
    typeName === "ZodNever" ||
    typeName === "ZodVoid"
  ) {
    return { kind: typeName.replace(/^Zod/, "").toLowerCase(), typeName };
  }

  if (typeName === "ZodLiteral") {
    return {
      kind: "literal",
      typeName,
      value: normalizeLiteralValue(definition?.value),
    };
  }

  if (typeName === "ZodEnum") {
    return {
      kind: "enum",
      typeName,
      values: getStringValues(definition?.values).sort(compareStrings),
    };
  }

  if (typeName === "ZodNativeEnum") {
    return {
      kind: "enum",
      typeName,
      values: getNativeEnumValues(definition?.values).sort(compareStrings),
    };
  }

  if (typeName === "ZodOptional" || typeName === "ZodDefault") {
    return {
      kind: typeName === "ZodOptional" ? "optional" : "default",
      typeName,
      inner: snapshotMaybeSchema(definition?.innerType),
    };
  }

  if (typeName === "ZodNullable") {
    return {
      kind: "nullable",
      typeName,
      inner: snapshotMaybeSchema(definition?.innerType),
    };
  }

  if (typeName === "ZodEffects") {
    return {
      kind: "effects",
      typeName,
      inner: snapshotMaybeSchema(definition?.schema ?? definition?.innerType),
    };
  }

  if (typeName === "ZodArray") {
    return {
      kind: "array",
      typeName,
      element: snapshotMaybeSchema(definition?.type ?? definition?.element),
    };
  }

  if (typeName === "ZodObject") {
    return {
      kind: "object",
      typeName,
      fields: Object.entries(getObjectShape(schema))
        .map(([name, fieldSchema]) => ({
          name,
          required: !isOptionalInputSchema(fieldSchema),
          schema: snapshotUnknownSchema(fieldSchema),
        }))
        .sort(compareSchemaFields),
    };
  }

  if (typeName === "ZodUnion" || typeName === "ZodDiscriminatedUnion") {
    return {
      kind: "union",
      typeName,
      options: getSchemaOptions(definition).map(snapshotUnknownSchema).sort(compareSchemaSnapshots),
    };
  }

  return { kind: "other", typeName };
}

function snapshotMaybeSchema(value: unknown): ContractSchemaSnapshot | null {
  return isZodType(value) ? snapshotUnknownSchema(value) : null;
}

function isOptionalInputSchema(schema: unknown): boolean {
  const typeName = getSchemaTypeName(schema);

  if (typeName === "ZodOptional" || typeName === "ZodDefault") {
    return true;
  }

  if (typeName === "ZodEffects") {
    const definition = getZodDefinition(schema);

    return isOptionalInputSchema(definition?.schema ?? definition?.innerType);
  }

  return false;
}

function getSchemaTypeName(schema: unknown): string {
  if (!schema || typeof schema !== "object") {
    return typeof schema;
  }

  return schema.constructor.name;
}

type ZodDefinition = {
  readonly shape?: unknown;
  readonly innerType?: unknown;
  readonly schema?: unknown;
  readonly type?: unknown;
  readonly element?: unknown;
  readonly options?: unknown;
  readonly values?: unknown;
  readonly value?: unknown;
};

function getZodDefinition(schema: unknown): ZodDefinition | undefined {
  if (!schema || typeof schema !== "object" || !("_def" in schema)) {
    return undefined;
  }

  return schema._def as ZodDefinition;
}

function getObjectShape(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") {
    return {};
  }

  if ("shape" in schema) {
    const shape = schema.shape;

    if (shape && typeof shape === "object") {
      return shape as Record<string, unknown>;
    }
  }

  const definition = getZodDefinition(schema);
  const shape = typeof definition?.shape === "function" ? definition.shape() : definition?.shape;

  return shape && typeof shape === "object" ? (shape as Record<string, unknown>) : {};
}

function getSchemaOptions(definition: ZodDefinition | undefined): unknown[] {
  if (!definition) {
    return [];
  }

  if (Array.isArray(definition.options)) {
    return definition.options;
  }

  if (definition.options instanceof Map) {
    return [...definition.options.values()];
  }

  return [];
}

function isZodType(value: unknown): value is z.ZodType {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { readonly safeParse?: unknown };

  return typeof candidate.safeParse === "function";
}

function normalizeLiteralValue(value: unknown): string | number | boolean | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  return String(value);
}

function getStringValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getNativeEnumValues(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.values(value)
    .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
    .map(String);
}

function sortGuards(
  guards: readonly ContractMetadataReference[],
): readonly ContractMetadataReference[] {
  return [...guards].sort((left, right) => compareStrings(left.id, right.id));
}

function compareControllers(
  left: ContractGraphSnapshotController,
  right: ContractGraphSnapshotController,
): number {
  return compareStrings(left.name, right.name) || compareStrings(left.path, right.path);
}

function compareRoutes(
  left: ContractGraphSnapshotRoute,
  right: ContractGraphSnapshotRoute,
): number {
  return (
    compareStrings(left.routeId, right.routeId) ||
    compareStrings(left.httpMethod, right.httpMethod) ||
    compareStrings(left.path, right.path)
  );
}

function compareDiagnostics(left: ContractDiagnostic, right: ContractDiagnostic): number {
  return (
    compareStrings(left.severity, right.severity) ||
    compareStrings(left.code, right.code) ||
    compareStrings(left.routeId ?? "", right.routeId ?? "") ||
    compareStrings(left.controllerName ?? "", right.controllerName ?? "") ||
    compareStrings(left.message, right.message)
  );
}

function compareSchemaFields(
  left: ContractSchemaFieldSnapshot,
  right: ContractSchemaFieldSnapshot,
): number {
  return compareStrings(left.name, right.name);
}

function compareSchemaSnapshots(
  left: ContractSchemaSnapshot,
  right: ContractSchemaSnapshot,
): number {
  return compareStrings(JSON.stringify(left), JSON.stringify(right));
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
