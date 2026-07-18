import type { z } from "zod";
import type {
  ContractAccessMetadata,
  ContractDiagnostic,
  ContractEntitlementRequirement,
  ContractGraph,
  ContractGraphRoute,
  ContractGraphVersion,
  ContractMetadataOwner,
  ContractMetadataReference,
} from "./ContractGraph";
import {
  createContractGraphConsumerCoverage,
  type ContractGraphConsumerCoverageReport,
} from "./ContractGraphConsumerCoverage";
import type { ParamIR, ProblemRegistryReferenceIR } from "./RouteIR";
import { describeZodSchema, JSON_SAFE_ZOD_SCHEMA_SUPPORT_MATRIX } from "./SchemaDescriptor";
import type { ContractSchemaDescriptor, ContractSchemaFieldDescriptor } from "./SchemaDescriptor";

export type ContractGraphSnapshotVersion = "croco.contract-graph.snapshot.v1";
export type ContractSchemaLocation = "body" | "path" | "query" | "headers" | "response" | "problem";

export type ContractSchemaSnapshot = ContractSchemaDescriptor;
export type ContractSchemaFieldSnapshot = ContractSchemaFieldDescriptor;

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
  readonly cookbookPath?: string;
  readonly description?: string;
  readonly registry?: ProblemRegistryReferenceIR;
  readonly type?: string;
};

export type ContractGraphSnapshotRouteContract = {
  readonly id: string | null;
  readonly method: string;
  readonly path: string;
  readonly operationId?: string;
  readonly sourceLocation?: {
    readonly path: string;
    readonly line?: number;
    readonly column?: number;
  };
};

export type ContractGraphSnapshotEntitlementRequirement = ContractEntitlementRequirement;

export type ContractGraphSnapshotRoute = {
  readonly routeId: string;
  readonly operationId: string;
  readonly controllerName: string;
  readonly methodName: string;
  readonly httpMethod: string;
  readonly path: string;
  readonly controllerPath: string;
  readonly domain: string | null;
  readonly routeContract: ContractGraphSnapshotRouteContract | null;
  readonly access: ContractAccessMetadata;
  readonly entitlements: readonly ContractGraphSnapshotEntitlementRequirement[];
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

type LegacyContractSchemaSnapshot = Omit<
  ContractSchemaSnapshot,
  | "effectType"
  | "element"
  | "fields"
  | "inner"
  | "jsonSafe"
  | "options"
  | "unsupportedReason"
  | "values"
> & {
  readonly fields?: readonly LegacyContractSchemaFieldSnapshot[];
  readonly element?: LegacyContractSchemaSnapshot | null;
  readonly inner?: LegacyContractSchemaSnapshot | null;
  readonly options?: readonly LegacyContractSchemaSnapshot[];
  readonly values?: readonly string[];
};

type LegacyContractSchemaFieldSnapshot = Omit<ContractSchemaFieldSnapshot, "schema"> & {
  readonly schema: LegacyContractSchemaSnapshot;
};

type LegacyContractGraphSnapshotParam = Omit<ContractGraphSnapshotParam, "schema"> & {
  readonly schema: LegacyContractSchemaSnapshot | null;
};

type LegacyContractGraphSnapshotRoute = Omit<
  ContractGraphSnapshotRoute,
  "entitlements" | "params" | "problems" | "request" | "response" | "routeContract"
> & {
  readonly params: readonly LegacyContractGraphSnapshotParam[];
  readonly request: {
    readonly body: LegacyContractSchemaSnapshot | null;
    readonly path: LegacyContractSchemaSnapshot | null;
    readonly query: LegacyContractSchemaSnapshot | null;
    readonly headers: LegacyContractSchemaSnapshot | null;
  };
  readonly response: LegacyContractSchemaSnapshot | null;
  readonly problems?: readonly ContractGraphSnapshotProblemResponse[];
};

type LegacyContractGraphSnapshot = Omit<ContractGraphSnapshot, "routes"> & {
  readonly routes: readonly LegacyContractGraphSnapshotRoute[];
};

/**
 * Versioned, JSON-safe contract graph used as the stable source for strict generators.
 */
export type ContractGraphV1 = {
  readonly version: ContractGraphVersion;
  readonly routes: readonly ContractGraphV1Route[];
  readonly diagnostics: readonly ContractDiagnostic[];
};

/**
 * REST route contract with schemas, problems, policies, runtime requirements, and DI references.
 */
export type ContractGraphV1Route = {
  readonly id: string;
  readonly protocol: "rest";
  readonly method: string;
  readonly path: string;
  readonly source: ContractGraphSnapshotRouteContract["sourceLocation"] | null;
  readonly inputSchemas: {
    readonly body: ContractSchemaSnapshot | null;
    readonly path: ContractSchemaSnapshot | null;
    readonly query: ContractSchemaSnapshot | null;
    readonly headers: ContractSchemaSnapshot | null;
  };
  readonly outputSchema: ContractSchemaSnapshot | null;
  readonly problems: readonly ContractGraphSnapshotProblemResponse[];
  readonly policies: readonly ContractGraphV1PolicyRef[];
  readonly runtime: readonly ContractGraphV1RuntimeRequirement[];
  readonly di: readonly ContractGraphV1DiRef[];
};

/**
 * Policy requirement attached to a ContractGraph v1 route.
 */
export type ContractGraphV1PolicyRef =
  | {
      readonly type: "rest.role";
      readonly id: string;
      readonly owner: ContractMetadataOwner;
      readonly role: string;
    }
  | {
      readonly type: "entitlement";
      readonly id: string;
      readonly owner: ContractMetadataOwner;
      readonly entitlement: ContractGraphSnapshotEntitlementRequirement;
    };

/**
 * Runtime capability required to serve a ContractGraph v1 route.
 */
export type ContractGraphV1RuntimeRequirement = {
  readonly type: "rest.route";
  readonly method: string;
  readonly path: string;
};

/**
 * DI metadata reference required by a ContractGraph v1 route.
 */
export type ContractGraphV1DiRef = ContractMetadataReference;

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

/**
 * Creates the deterministic ContractGraph v1 generator input from a validated contract graph.
 */
export function createContractGraphV1(graph: ContractGraph): ContractGraphV1 {
  const snapshot = createContractGraphSnapshot(graph);

  return {
    version: snapshot.graphVersion,
    routes: snapshot.routes.map(toContractGraphV1Route).sort(compareContractGraphV1Routes),
    diagnostics: [...snapshot.diagnostics],
  };
}

export function stringifyContractGraphSnapshot(snapshot: ContractGraphSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/**
 * Serializes a ContractGraph v1 snapshot with stable pretty-printing and a trailing newline.
 */
export function stringifyContractGraphV1(snapshot: ContractGraphV1): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function isContractGraphSnapshot(value: unknown): value is ContractGraphSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value["snapshotVersion"] === "croco.contract-graph.snapshot.v1" &&
    value["graphVersion"] === "croco.contract-graph.v1" &&
    isNonNegativeInteger(value["controllerCount"]) &&
    isNonNegativeInteger(value["routeCount"]) &&
    isStringArray(value["operationIds"]) &&
    (value["consumerCoverage"] === undefined ||
      isContractGraphConsumerCoverageReport(value["consumerCoverage"])) &&
    Array.isArray(value["controllers"]) &&
    value["controllers"].every(isContractGraphSnapshotController) &&
    Array.isArray(value["routes"]) &&
    value["routes"].every(isContractGraphSnapshotRoute) &&
    Array.isArray(value["diagnostics"]) &&
    value["diagnostics"].every(isContractDiagnosticSnapshot)
  );
}

/**
 * Validates and normalizes persisted ContractGraph snapshot v1 artifacts.
 *
 * Historical v1 snapshots predate consumer coverage, route contracts, entitlements, and schema
 * JSON-safety metadata. The initial epoch also predates Problem responses. Those coherent
 * artifact-wide shapes are normalized only after every persisted member has been validated.
 */
export function parseContractGraphSnapshot(value: unknown): ContractGraphSnapshot | null {
  if (isContractGraphSnapshot(value)) {
    return value;
  }

  if (!isLegacyContractGraphSnapshot(value)) {
    return null;
  }

  return {
    snapshotVersion: value.snapshotVersion,
    graphVersion: value.graphVersion,
    controllerCount: value.controllerCount,
    routeCount: value.routeCount,
    operationIds: value.operationIds,
    controllers: value.controllers,
    routes: value.routes.map(normalizeLegacyContractGraphSnapshotRoute),
    diagnostics: value.diagnostics,
  };
}

/**
 * Narrows unknown JSON to the public ContractGraph v1 envelope shape.
 */
export function isContractGraphV1(value: unknown): value is ContractGraphV1 {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value["version"] === "croco.contract-graph.v1" &&
    Array.isArray(value["routes"]) &&
    value["routes"].every(isContractGraphV1Route) &&
    Array.isArray(value["diagnostics"]) &&
    value["diagnostics"].every(isContractDiagnosticSnapshot)
  );
}

export function snapshotZodSchema(
  schema: z.ZodType | null | undefined,
): ContractSchemaSnapshot | null {
  return describeZodSchema(schema);
}

/**
 * Projects the deterministic legacy snapshot route into the public ContractGraph v1 route shape.
 */
function toContractGraphV1Route(route: ContractGraphSnapshotRoute): ContractGraphV1Route {
  return {
    id: route.routeId,
    protocol: "rest",
    method: route.httpMethod,
    path: route.path,
    source: route.routeContract?.sourceLocation ?? null,
    inputSchemas: route.request,
    outputSchema: route.response,
    problems: route.problems,
    policies: toContractGraphV1Policies(route),
    runtime: [{ type: "rest.route", method: route.httpMethod, path: route.path }],
    di: route.access.guards,
  };
}

/**
 * Normalizes role and entitlement metadata into stable policy references for generators.
 */
function toContractGraphV1Policies(
  route: ContractGraphSnapshotRoute,
): readonly ContractGraphV1PolicyRef[] {
  const owner = {
    controllerName: route.controllerName,
    routeId: route.routeId,
    methodName: route.methodName,
  };
  const roles = route.access.roles.map(
    (role, index): ContractGraphV1PolicyRef => ({
      type: "rest.role",
      id: `rest.role:${route.routeId}:${index}:${role}`,
      owner,
      role,
    }),
  );
  const entitlements = route.entitlements.map(
    (entitlement, index): ContractGraphV1PolicyRef => ({
      type: "entitlement",
      id: `entitlement:${route.routeId}:${index}:${entitlement.feature}`,
      owner,
      entitlement,
    }),
  );

  return [...roles, ...entitlements].sort(compareContractGraphV1PolicyRefs);
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
    routeContract: route.routeContract
      ? {
          id: route.routeContract.id,
          method: route.routeContract.method,
          path: route.routeContract.path,
          ...(route.routeContract.operationId
            ? { operationId: route.routeContract.operationId }
            : {}),
          ...(route.routeContract.sourceLocation
            ? { sourceLocation: route.routeContract.sourceLocation }
            : {}),
        }
      : null,
    access: {
      guards: sortGuards(route.access.guards),
      roles: [...route.access.roles].sort(compareStrings),
    },
    entitlements: sortEntitlements(route.entitlements),
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
        ...(problem.cookbookPath ? { cookbookPath: problem.cookbookPath } : {}),
        ...(problem.description ? { description: problem.description } : {}),
        ...(problem.registry ? { registry: problem.registry } : {}),
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

function sortGuards(
  guards: readonly ContractMetadataReference[],
): readonly ContractMetadataReference[] {
  return [...guards].sort((left, right) => compareStrings(left.id, right.id));
}

function sortEntitlements(
  entitlements: readonly ContractEntitlementRequirement[],
): readonly ContractEntitlementRequirement[] {
  return [...entitlements].sort(compareEntitlements);
}

function compareEntitlements(
  left: ContractEntitlementRequirement,
  right: ContractEntitlementRequirement,
): number {
  return compareStrings(entitlementFingerprint(left), entitlementFingerprint(right));
}

function entitlementFingerprint(entitlement: ContractEntitlementRequirement): string {
  return JSON.stringify({
    feature: entitlement.feature,
    description: entitlement.description,
    resource: entitlement.resource,
  });
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

/**
 * Orders ContractGraph v1 routes so serialization is independent of controller discovery order.
 */
function compareContractGraphV1Routes(
  left: ContractGraphV1Route,
  right: ContractGraphV1Route,
): number {
  return (
    compareStrings(left.id, right.id) ||
    compareStrings(left.method, right.method) ||
    compareStrings(left.path, right.path)
  );
}

/**
 * Orders policy references within a route for stable snapshots.
 */
function compareContractGraphV1PolicyRefs(
  left: ContractGraphV1PolicyRef,
  right: ContractGraphV1PolicyRef,
): number {
  return compareStrings(left.type, right.type) || compareStrings(left.id, right.id);
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

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function isContractGraphV1Route(value: unknown): value is ContractGraphV1Route {
  if (!isRecord(value)) {
    return false;
  }

  const problems = value["problems"];
  const policies = value["policies"];
  const runtime = value["runtime"];
  const di = value["di"];

  return (
    typeof value["id"] === "string" &&
    value["protocol"] === "rest" &&
    typeof value["method"] === "string" &&
    typeof value["path"] === "string" &&
    (value["source"] === null || isContractSourceLocation(value["source"])) &&
    isContractGraphV1InputSchemas(value["inputSchemas"]) &&
    isContractSchemaSnapshotOrNull(value["outputSchema"]) &&
    Array.isArray(problems) &&
    problems.every(isContractGraphProblemResponse) &&
    Array.isArray(policies) &&
    policies.every(isContractGraphV1PolicyRef) &&
    Array.isArray(runtime) &&
    runtime.every(isContractGraphV1RuntimeRequirement) &&
    Array.isArray(di) &&
    di.every(isContractMetadataReference)
  );
}

function isContractGraphV1InputSchemas(
  value: unknown,
): value is ContractGraphV1Route["inputSchemas"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isContractSchemaSnapshotOrNull(value["body"]) &&
    isContractSchemaSnapshotOrNull(value["path"]) &&
    isContractSchemaSnapshotOrNull(value["query"]) &&
    isContractSchemaSnapshotOrNull(value["headers"])
  );
}

function isContractSchemaSnapshotOrNull(value: unknown): value is ContractSchemaSnapshot | null {
  return value === null || isContractSchemaSnapshot(value, new Set());
}

function isLegacyContractGraphSnapshot(value: unknown): value is LegacyContractGraphSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const routes = value["routes"];
  if (!Array.isArray(routes)) {
    return false;
  }

  const hasUniformProblemEpoch =
    routes.every((route) => isRecord(route) && hasOwnProperty(route, "problems")) ||
    routes.every((route) => isRecord(route) && !hasOwnProperty(route, "problems"));

  return (
    value["snapshotVersion"] === "croco.contract-graph.snapshot.v1" &&
    value["graphVersion"] === "croco.contract-graph.v1" &&
    isNonNegativeInteger(value["controllerCount"]) &&
    isNonNegativeInteger(value["routeCount"]) &&
    isStringArray(value["operationIds"]) &&
    value["consumerCoverage"] === undefined &&
    Array.isArray(value["controllers"]) &&
    value["controllers"].every(isContractGraphSnapshotController) &&
    hasUniformProblemEpoch &&
    routes.every(isLegacyContractGraphSnapshotRoute) &&
    Array.isArray(value["diagnostics"]) &&
    value["diagnostics"].every(isContractDiagnosticSnapshot)
  );
}

function isLegacyContractGraphSnapshotRoute(
  value: unknown,
): value is LegacyContractGraphSnapshotRoute {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["routeId"] === "string" &&
    typeof value["operationId"] === "string" &&
    typeof value["controllerName"] === "string" &&
    typeof value["methodName"] === "string" &&
    typeof value["httpMethod"] === "string" &&
    typeof value["path"] === "string" &&
    typeof value["controllerPath"] === "string" &&
    (value["domain"] === null || typeof value["domain"] === "string") &&
    value["routeContract"] === undefined &&
    isContractAccessMetadata(value["access"]) &&
    value["entitlements"] === undefined &&
    Array.isArray(value["params"]) &&
    value["params"].every(isLegacyContractGraphSnapshotParam) &&
    isLegacyContractGraphSnapshotRequest(value["request"]) &&
    isLegacyContractSchemaSnapshotOrNull(value["response"]) &&
    (value["problems"] === undefined ||
      (Array.isArray(value["problems"]) && value["problems"].every(isContractGraphProblemResponse)))
  );
}

function isLegacyContractGraphSnapshotParam(
  value: unknown,
): value is LegacyContractGraphSnapshotParam {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isContractGraphSnapshotParamKind(value["kind"]) &&
    typeof value["name"] === "string" &&
    isLegacyContractSchemaSnapshotOrNull(value["schema"])
  );
}

function isLegacyContractGraphSnapshotRequest(
  value: unknown,
): value is LegacyContractGraphSnapshotRoute["request"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isLegacyContractSchemaSnapshotOrNull(value["body"]) &&
    isLegacyContractSchemaSnapshotOrNull(value["path"]) &&
    isLegacyContractSchemaSnapshotOrNull(value["query"]) &&
    isLegacyContractSchemaSnapshotOrNull(value["headers"])
  );
}

function isLegacyContractSchemaSnapshotOrNull(
  value: unknown,
): value is LegacyContractSchemaSnapshot | null {
  return value === null || isLegacyContractSchemaSnapshot(value, new Set());
}

function isLegacyContractSchemaSnapshot(
  value: unknown,
  ancestors: Set<object>,
): value is LegacyContractSchemaSnapshot {
  if (!isRecord(value) || ancestors.has(value)) {
    return false;
  }

  ancestors.add(value);
  const valid =
    typeof value["kind"] === "string" &&
    typeof value["typeName"] === "string" &&
    value["jsonSafe"] === undefined &&
    value["unsupportedReason"] === undefined &&
    value["effectType"] === undefined &&
    (value["fields"] === undefined ||
      (Array.isArray(value["fields"]) &&
        value["fields"].every((field) => isLegacyContractSchemaFieldSnapshot(field, ancestors)))) &&
    (value["element"] === undefined ||
      value["element"] === null ||
      isLegacyContractSchemaSnapshot(value["element"], ancestors)) &&
    (value["inner"] === undefined ||
      value["inner"] === null ||
      isLegacyContractSchemaSnapshot(value["inner"], ancestors)) &&
    (value["options"] === undefined ||
      (Array.isArray(value["options"]) &&
        value["options"].every((option) => isLegacyContractSchemaSnapshot(option, ancestors)))) &&
    (value["values"] === undefined ||
      (Array.isArray(value["values"]) &&
        value["values"].every((entry) => typeof entry === "string"))) &&
    (value["value"] === undefined || isContractSchemaPrimitiveValue(value["value"]));
  ancestors.delete(value);

  return valid;
}

function isLegacyContractSchemaFieldSnapshot(
  value: unknown,
  ancestors: Set<object>,
): value is LegacyContractSchemaFieldSnapshot {
  return (
    isRecord(value) &&
    typeof value["name"] === "string" &&
    typeof value["required"] === "boolean" &&
    isLegacyContractSchemaSnapshot(value["schema"], ancestors)
  );
}

function normalizeLegacyContractGraphSnapshotRoute(
  route: LegacyContractGraphSnapshotRoute,
): ContractGraphSnapshotRoute {
  return {
    ...route,
    routeContract: null,
    entitlements: [],
    params: route.params.map((param) => ({
      ...param,
      schema: param.schema ? normalizeLegacyContractSchemaSnapshot(param.schema) : null,
    })),
    request: {
      body: route.request.body ? normalizeLegacyContractSchemaSnapshot(route.request.body) : null,
      path: route.request.path ? normalizeLegacyContractSchemaSnapshot(route.request.path) : null,
      query: route.request.query
        ? normalizeLegacyContractSchemaSnapshot(route.request.query)
        : null,
      headers: route.request.headers
        ? normalizeLegacyContractSchemaSnapshot(route.request.headers)
        : null,
    },
    response: route.response ? normalizeLegacyContractSchemaSnapshot(route.response) : null,
    problems: route.problems ?? [],
  };
}

function normalizeLegacyContractSchemaSnapshot(
  schema: LegacyContractSchemaSnapshot,
): ContractSchemaSnapshot {
  const fields = schema.fields?.map((field) => ({
    ...field,
    schema: normalizeLegacyContractSchemaSnapshot(field.schema),
  }));
  const element = schema.element
    ? normalizeLegacyContractSchemaSnapshot(schema.element)
    : schema.element;
  const inner = schema.inner ? normalizeLegacyContractSchemaSnapshot(schema.inner) : schema.inner;
  const options = schema.options?.map(normalizeLegacyContractSchemaSnapshot);
  const children = [
    ...(fields?.map((field) => field.schema) ?? []),
    ...(element ? [element] : []),
    ...(inner ? [inner] : []),
    ...(options ?? []),
  ];
  const support = JSON_SAFE_ZOD_SCHEMA_SUPPORT_MATRIX.find(
    (entry) => entry.typeName === schema.typeName,
  );

  return {
    kind: schema.kind,
    typeName: schema.typeName,
    jsonSafe: support?.jsonSafe === "supported" && children.every((child) => child.jsonSafe),
    ...(fields ? { fields } : {}),
    ...(element !== undefined ? { element } : {}),
    ...(inner !== undefined ? { inner } : {}),
    ...(options ? { options } : {}),
    ...(schema.values ? { values: schema.values } : {}),
    ...(schema.value !== undefined ? { value: schema.value } : {}),
  };
}

function isContractGraphSnapshotController(
  value: unknown,
): value is ContractGraphSnapshotController {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["name"] === "string" &&
    typeof value["path"] === "string" &&
    Array.isArray(value["guards"]) &&
    value["guards"].every(isContractMetadataReference) &&
    isStringArray(value["roles"]) &&
    isStringArray(value["routeIds"])
  );
}

function isContractGraphSnapshotRoute(value: unknown): value is ContractGraphSnapshotRoute {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["routeId"] === "string" &&
    typeof value["operationId"] === "string" &&
    typeof value["controllerName"] === "string" &&
    typeof value["methodName"] === "string" &&
    typeof value["httpMethod"] === "string" &&
    typeof value["path"] === "string" &&
    typeof value["controllerPath"] === "string" &&
    (value["domain"] === null || typeof value["domain"] === "string") &&
    (value["routeContract"] === null ||
      isContractGraphSnapshotRouteContract(value["routeContract"])) &&
    isContractAccessMetadata(value["access"]) &&
    Array.isArray(value["entitlements"]) &&
    value["entitlements"].every(isContractEntitlementRequirement) &&
    Array.isArray(value["params"]) &&
    value["params"].every(isContractGraphSnapshotParam) &&
    isContractGraphSnapshotRequest(value["request"]) &&
    isContractSchemaSnapshotOrNull(value["response"]) &&
    Array.isArray(value["problems"]) &&
    value["problems"].every(isContractGraphProblemResponse)
  );
}

function isContractGraphSnapshotRouteContract(
  value: unknown,
): value is ContractGraphSnapshotRouteContract {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value["id"] === null || typeof value["id"] === "string") &&
    typeof value["method"] === "string" &&
    typeof value["path"] === "string" &&
    isOptionalString(value["operationId"]) &&
    (value["sourceLocation"] === undefined || isContractSourceLocation(value["sourceLocation"]))
  );
}

function isContractAccessMetadata(value: unknown): value is ContractAccessMetadata {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value["guards"]) &&
    value["guards"].every(isContractMetadataReference) &&
    isStringArray(value["roles"])
  );
}

function isContractGraphSnapshotParam(value: unknown): value is ContractGraphSnapshotParam {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isContractGraphSnapshotParamKind(value["kind"]) &&
    typeof value["name"] === "string" &&
    isContractSchemaSnapshotOrNull(value["schema"])
  );
}

function isContractGraphSnapshotParamKind(value: unknown): value is ParamIR["kind"] {
  return (
    value === "body" ||
    value === "query" ||
    value === "path" ||
    value === "header" ||
    value === "ctx"
  );
}

function isContractGraphSnapshotRequest(
  value: unknown,
): value is ContractGraphSnapshotRoute["request"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isContractSchemaSnapshotOrNull(value["body"]) &&
    isContractSchemaSnapshotOrNull(value["path"]) &&
    isContractSchemaSnapshotOrNull(value["query"]) &&
    isContractSchemaSnapshotOrNull(value["headers"])
  );
}

function isContractSchemaSnapshot(
  value: unknown,
  ancestors: Set<object>,
): value is ContractSchemaSnapshot {
  if (!isRecord(value) || ancestors.has(value)) {
    return false;
  }

  ancestors.add(value);
  const valid =
    typeof value["kind"] === "string" &&
    typeof value["typeName"] === "string" &&
    typeof value["jsonSafe"] === "boolean" &&
    isOptionalString(value["unsupportedReason"]) &&
    isOptionalString(value["effectType"]) &&
    (value["fields"] === undefined ||
      (Array.isArray(value["fields"]) &&
        value["fields"].every((field) => isContractSchemaFieldSnapshot(field, ancestors)))) &&
    (value["element"] === undefined ||
      value["element"] === null ||
      isContractSchemaSnapshot(value["element"], ancestors)) &&
    (value["inner"] === undefined ||
      value["inner"] === null ||
      isContractSchemaSnapshot(value["inner"], ancestors)) &&
    (value["options"] === undefined ||
      (Array.isArray(value["options"]) &&
        value["options"].every((option) => isContractSchemaSnapshot(option, ancestors)))) &&
    (value["values"] === undefined ||
      (Array.isArray(value["values"]) &&
        value["values"].every(
          (entry) =>
            typeof entry === "string" || (typeof entry === "number" && Number.isFinite(entry)),
        ))) &&
    (value["value"] === undefined || isContractSchemaPrimitiveValue(value["value"]));
  ancestors.delete(value);

  return valid;
}

function isContractSchemaFieldSnapshot(
  value: unknown,
  ancestors: Set<object>,
): value is ContractSchemaFieldSnapshot {
  return (
    isRecord(value) &&
    typeof value["name"] === "string" &&
    typeof value["required"] === "boolean" &&
    isContractSchemaSnapshot(value["schema"], ancestors)
  );
}

function isContractSchemaPrimitiveValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isContractGraphProblemResponse(
  value: unknown,
): value is ContractGraphSnapshotProblemResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["code"] === "string" &&
    typeof value["category"] === "string" &&
    isFiniteNumber(value["status"]) &&
    isOptionalString(value["cookbookPath"]) &&
    isOptionalString(value["description"]) &&
    isOptionalString(value["type"]) &&
    (value["registry"] === undefined || isProblemRegistryReference(value["registry"]))
  );
}

function isProblemRegistryReference(value: unknown): value is ProblemRegistryReferenceIR {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["package"] === "string" &&
    typeof value["code"] === "string" &&
    isProblemCategory(value["category"]) &&
    isFiniteNumber(value["status"]) &&
    (value["statusPolicy"] === undefined || isProblemStatusPolicy(value["statusPolicy"])) &&
    typeof value["retryable"] === "boolean" &&
    (value["retryability"] === "retryable" || value["retryability"] === "not-retryable") &&
    typeof value["public"] === "boolean" &&
    (value["visibility"] === "public" || value["visibility"] === "private") &&
    (value["redaction"] === "public" ||
      value["redaction"] === "safe" ||
      value["redaction"] === "operator-only") &&
    typeof value["cookbookPath"] === "string"
  );
}

function isProblemCategory(value: unknown): boolean {
  return (
    value === "BadRequest" ||
    value === "Unauthorized" ||
    value === "Forbidden" ||
    value === "NotFound" ||
    value === "Conflict" ||
    value === "Gone" ||
    value === "PayloadTooLarge" ||
    value === "ValidationError" ||
    value === "BusinessRuleViolation" ||
    value === "TooManyRequests" ||
    value === "InternalServerError" ||
    value === "NotImplemented"
  );
}

function isProblemStatusPolicy(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value["kind"] === "runtime-configurable" &&
    isFiniteNumber(value["defaultStatus"]) &&
    typeof value["configuration"] === "string"
  );
}

function isContractGraphV1PolicyRef(value: unknown): value is ContractGraphV1PolicyRef {
  if (!isRecord(value)) {
    return false;
  }

  if (value["type"] === "rest.role") {
    return (
      typeof value["id"] === "string" &&
      isContractMetadataOwner(value["owner"]) &&
      typeof value["role"] === "string"
    );
  }

  if (value["type"] === "entitlement") {
    return (
      typeof value["id"] === "string" &&
      isContractMetadataOwner(value["owner"]) &&
      isContractEntitlementRequirement(value["entitlement"])
    );
  }

  return false;
}

function isContractGraphV1RuntimeRequirement(
  value: unknown,
): value is ContractGraphV1RuntimeRequirement {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value["type"] === "rest.route" &&
    typeof value["method"] === "string" &&
    typeof value["path"] === "string"
  );
}

function isContractMetadataReference(value: unknown): value is ContractGraphV1DiRef {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value["type"] === "rest.guard" &&
    typeof value["id"] === "string" &&
    (value["kind"] === "constructor" || value["kind"] === "instance") &&
    typeof value["name"] === "string" &&
    (value["declaredAt"] === "controller" || value["declaredAt"] === "route") &&
    isContractMetadataOwner(value["owner"]) &&
    isNonNegativeInteger(value["index"])
  );
}

function isContractMetadataOwner(value: unknown): value is ContractMetadataOwner {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["controllerName"] === "string" &&
    isOptionalString(value["routeId"]) &&
    isOptionalString(value["methodName"])
  );
}

function isContractEntitlementRequirement(
  value: unknown,
): value is ContractGraphSnapshotEntitlementRequirement {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["feature"] === "string" &&
    isOptionalString(value["description"]) &&
    (value["resource"] === undefined || isContractEntitlementResource(value["resource"]))
  );
}

function isContractEntitlementResource(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["type"] === "string" &&
    isOptionalString(value["id"]) &&
    isOptionalString(value["idParam"])
  );
}

function isContractGraphConsumerCoverageReport(
  value: unknown,
): value is ContractGraphConsumerCoverageReport {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value["version"] === "croco.contract-consumer-coverage.v1" &&
    isNonNegativeInteger(value["routeCount"]) &&
    Array.isArray(value["consumers"]) &&
    value["consumers"].every(isContractGraphConsumerCoverage) &&
    Array.isArray(value["diagnostics"]) &&
    value["diagnostics"].every(isContractDiagnosticSnapshot)
  );
}

function isContractGraphConsumerCoverage(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isContractGraphConsumerId(value["consumerId"]) &&
    typeof value["label"] === "string" &&
    typeof value["generatedArtifact"] === "string" &&
    isNonNegativeInteger(value["routeCount"]) &&
    isContractGraphConsumerRouteFieldArray(value["requiredRouteFields"]) &&
    isContractGraphConsumerRouteFieldArray(value["unsupportedRouteFields"]) &&
    Array.isArray(value["routes"]) &&
    value["routes"].every(isContractGraphConsumerRouteCoverage) &&
    Array.isArray(value["diagnostics"]) &&
    value["diagnostics"].every(isContractDiagnosticSnapshot)
  );
}

function isContractGraphConsumerRouteCoverage(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["routeId"] === "string" &&
    typeof value["operationId"] === "string" &&
    isContractGraphConsumerRouteFieldArray(value["coveredFields"]) &&
    isContractGraphConsumerRouteFieldArray(value["missingFields"]) &&
    isContractGraphConsumerRouteFieldArray(value["unsupportedFields"])
  );
}

function isContractGraphConsumerId(value: unknown): boolean {
  return value === "admin-generated" || value === "openapi" || value === "rpc-client";
}

function isContractGraphConsumerRouteFieldArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isContractGraphConsumerRouteField);
}

function isContractGraphConsumerRouteField(value: unknown): boolean {
  return (
    value === "routeId" ||
    value === "operationId" ||
    value === "httpMethod" ||
    value === "path" ||
    value === "request.body" ||
    value === "request.path" ||
    value === "request.query" ||
    value === "request.headers" ||
    value === "response" ||
    value === "problems" ||
    value === "entitlements" ||
    value === "access.guards" ||
    value === "access.roles"
  );
}

function isContractDiagnosticSnapshot(value: unknown): value is ContractDiagnostic {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["code"] === "string" &&
    (value["severity"] === "error" || value["severity"] === "warning") &&
    isContractDiagnosticTarget(value["target"]) &&
    typeof value["message"] === "string" &&
    isOptionalString(value["routeId"]) &&
    isOptionalString(value["contractId"]) &&
    isOptionalString(value["controllerName"]) &&
    isOptionalString(value["methodName"]) &&
    isOptionalString(value["path"]) &&
    (value["sourceLocation"] === undefined || isContractSourceLocation(value["sourceLocation"]))
  );
}

function isContractDiagnosticTarget(value: unknown): boolean {
  return (
    value === "graph" ||
    value === "controller" ||
    value === "route" ||
    value === "param" ||
    value === "schema" ||
    value === "problem"
  );
}

function isContractSourceLocation(
  value: unknown,
): value is NonNullable<ContractGraphSnapshotRouteContract["sourceLocation"]> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["path"] === "string" &&
    isOptionalNumber(value["line"]) &&
    isOptionalNumber(value["column"])
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwnProperty(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
