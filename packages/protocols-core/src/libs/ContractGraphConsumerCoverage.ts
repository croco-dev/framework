import {
  ContractGraphDiagnosticError,
  type ContractDiagnostic,
  type ContractGraph,
  type ContractGraphRoute,
} from "./ContractGraph";

export type ContractGraphConsumerCoverageVersion = "croco.contract-consumer-coverage.v1";
export type ContractGraphConsumerId = "admin-generated" | "openapi" | "rpc-client";
export type ContractGraphConsumerRouteField =
  | "routeId"
  | "operationId"
  | "httpMethod"
  | "path"
  | "request.body"
  | "request.path"
  | "request.query"
  | "request.headers"
  | "response"
  | "problems"
  | "entitlements"
  | "access.guards"
  | "access.roles";

export type ContractGraphConsumerDefinition = {
  readonly id: ContractGraphConsumerId;
  readonly label: string;
  readonly generatedArtifact: string;
  readonly requiredRouteFields: readonly ContractGraphConsumerRouteField[];
  readonly unsupportedRouteFields: readonly ContractGraphConsumerRouteField[];
};

export type ContractGraphConsumerRouteCoverage = {
  readonly routeId: string;
  readonly operationId: string;
  readonly coveredFields: readonly ContractGraphConsumerRouteField[];
  readonly missingFields: readonly ContractGraphConsumerRouteField[];
  readonly unsupportedFields: readonly ContractGraphConsumerRouteField[];
};

export type ContractGraphConsumerCoverage = {
  readonly consumerId: ContractGraphConsumerId;
  readonly label: string;
  readonly generatedArtifact: string;
  readonly routeCount: number;
  readonly requiredRouteFields: readonly ContractGraphConsumerRouteField[];
  readonly unsupportedRouteFields: readonly ContractGraphConsumerRouteField[];
  readonly routes: readonly ContractGraphConsumerRouteCoverage[];
  readonly diagnostics: readonly ContractDiagnostic[];
};

export type ContractGraphConsumerCoverageReport = {
  readonly version: ContractGraphConsumerCoverageVersion;
  readonly routeCount: number;
  readonly consumers: readonly ContractGraphConsumerCoverage[];
  readonly diagnostics: readonly ContractDiagnostic[];
};

export type ContractGraphConsumerRouteFieldFingerprints = Partial<
  Record<ContractGraphConsumerRouteField, string>
>;

export type ContractGraphObservedConsumerRoute = {
  readonly routeId: string;
  readonly operationId?: string;
  readonly consumedFields?: readonly ContractGraphConsumerRouteField[];
  readonly fieldFingerprints?: ContractGraphConsumerRouteFieldFingerprints;
};

export const DEFAULT_CONTRACT_GRAPH_CONSUMERS = [
  {
    id: "admin-generated",
    label: "Admin resource config",
    generatedArtifact: "admin resource config files",
    requiredRouteFields: [
      "routeId",
      "operationId",
      "httpMethod",
      "path",
      "request.body",
      "request.path",
      "request.query",
      "request.headers",
      "response",
      "problems",
      "access.guards",
      "access.roles",
    ],
    unsupportedRouteFields: [],
  },
  {
    id: "openapi",
    label: "OpenAPI specification",
    generatedArtifact: "openapi.json",
    requiredRouteFields: [
      "routeId",
      "operationId",
      "httpMethod",
      "path",
      "request.body",
      "request.path",
      "request.query",
      "request.headers",
      "response",
      "problems",
      "entitlements",
    ],
    unsupportedRouteFields: ["access.guards", "access.roles"],
  },
  {
    id: "rpc-client",
    label: "RPC fetch client",
    generatedArtifact: "provider-rpc client files",
    requiredRouteFields: [
      "routeId",
      "operationId",
      "httpMethod",
      "path",
      "request.body",
      "request.path",
      "request.query",
      "request.headers",
      "response",
      "problems",
    ],
    unsupportedRouteFields: ["access.guards", "access.roles", "entitlements"],
  },
] as const satisfies readonly ContractGraphConsumerDefinition[];

export function createContractGraphConsumerCoverage(
  graph: ContractGraph,
  consumers: readonly ContractGraphConsumerDefinition[] = DEFAULT_CONTRACT_GRAPH_CONSUMERS,
): ContractGraphConsumerCoverageReport {
  const consumerCoverage = consumers.map((consumer) => createConsumerCoverage(graph, consumer));

  return {
    version: "croco.contract-consumer-coverage.v1",
    routeCount: graph.routes.length,
    consumers: consumerCoverage.sort(compareConsumerCoverage),
    diagnostics: consumerCoverage
      .flatMap((consumer) => consumer.diagnostics)
      .sort(compareDiagnostics),
  };
}

export function assertContractGraphConsumerRouteCoverage(
  graph: ContractGraph,
  consumerId: ContractGraphConsumerId,
  observedRoutes: readonly ContractGraphObservedConsumerRoute[],
): void {
  const diagnostics = getContractGraphConsumerRouteCoverageDiagnostics(
    graph,
    consumerId,
    observedRoutes,
  );

  if (diagnostics.length > 0) {
    throw new ContractGraphDiagnosticError(diagnostics);
  }
}

export function getContractGraphConsumerRouteCoverageDiagnostics(
  graph: ContractGraph,
  consumerId: ContractGraphConsumerId,
  observedRoutes: readonly ContractGraphObservedConsumerRoute[],
): readonly ContractDiagnostic[] {
  const consumer = getConsumerDefinition(consumerId);
  const diagnostics: ContractDiagnostic[] = [];
  const graphRoutesById = new Map(graph.routes.map((route) => [route.routeId, route]));
  const observedRoutesById = new Map<string, ContractGraphObservedConsumerRoute>();

  for (const observedRoute of observedRoutes) {
    const existing = observedRoutesById.get(observedRoute.routeId);

    if (existing) {
      diagnostics.push({
        code: "contract-consumer-duplicate-route",
        severity: "error",
        target: "route",
        routeId: observedRoute.routeId,
        message: `${consumer.label} output reports contract route '${observedRoute.routeId}' more than once.`,
      });
      continue;
    }

    observedRoutesById.set(observedRoute.routeId, observedRoute);
  }

  for (const route of graph.routes) {
    const observedRoute = observedRoutesById.get(route.routeId);

    if (!observedRoute) {
      diagnostics.push(createMissingRouteDiagnostic(consumer, route));
      continue;
    }

    if (observedRoute.operationId && observedRoute.operationId !== route.operationId) {
      diagnostics.push({
        code: "contract-consumer-operation-id-mismatch",
        severity: "error",
        target: "route",
        routeId: route.routeId,
        controllerName: route.controllerName,
        methodName: route.methodName,
        path: route.path,
        message: `${consumer.label} output maps contract route '${route.routeId}' to operation id '${observedRoute.operationId}', but the graph operation id is '${route.operationId}'.`,
      });
    }

    diagnostics.push(...getObservedRouteFieldDiagnostics(consumer, route, observedRoute));
  }

  for (const observedRoute of observedRoutes) {
    if (graphRoutesById.has(observedRoute.routeId)) {
      continue;
    }

    diagnostics.push({
      code: "contract-consumer-orphan-route",
      severity: "error",
      target: "route",
      routeId: observedRoute.routeId,
      message: `${consumer.label} output reports route '${observedRoute.routeId}', but that route is not present in the contract graph.`,
    });
  }

  return diagnostics.sort(compareDiagnostics);
}

function getObservedRouteFieldDiagnostics(
  consumer: ContractGraphConsumerDefinition,
  route: ContractGraphRoute,
  observedRoute: ContractGraphObservedConsumerRoute,
): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];
  const consumedFields = observedRoute.consumedFields
    ? new Set(observedRoute.consumedFields)
    : undefined;

  for (const field of consumer.requiredRouteFields) {
    if (!hasRouteField(route, field)) {
      diagnostics.push(createMissingFieldDiagnostic(consumer, toRouteCoverage(route), field));
      continue;
    }

    if (consumedFields && !consumedFields.has(field)) {
      diagnostics.push(createMissingGeneratedFieldDiagnostic(consumer, route, field));
      continue;
    }

    const expectedFingerprint = createRouteFieldFingerprint(route, consumer.id, field);
    const observedFingerprint = observedRoute.fieldFingerprints?.[field];

    if (expectedFingerprint !== undefined && observedRoute.fieldFingerprints) {
      if (observedFingerprint === undefined) {
        diagnostics.push(createMissingGeneratedFieldDiagnostic(consumer, route, field));
        continue;
      }

      if (observedFingerprint !== expectedFingerprint) {
        diagnostics.push(
          createRouteFieldMismatchDiagnostic(
            consumer,
            route,
            field,
            expectedFingerprint,
            observedFingerprint,
          ),
        );
      }
    }
  }

  return diagnostics;
}

function createConsumerCoverage(
  graph: ContractGraph,
  consumer: ContractGraphConsumerDefinition,
): ContractGraphConsumerCoverage {
  const routes = graph.routes.map((route) => createRouteCoverage(route, consumer));
  const diagnostics = routes
    .flatMap((route) => [
      ...route.missingFields.map((field) => createMissingFieldDiagnostic(consumer, route, field)),
      ...route.unsupportedFields.map((field) =>
        createUnsupportedFieldDiagnostic(consumer, route, field),
      ),
    ])
    .sort(compareDiagnostics);

  return {
    consumerId: consumer.id,
    label: consumer.label,
    generatedArtifact: consumer.generatedArtifact,
    routeCount: graph.routes.length,
    requiredRouteFields: [...consumer.requiredRouteFields],
    unsupportedRouteFields: [...consumer.unsupportedRouteFields],
    routes: routes.sort(compareRouteCoverage),
    diagnostics,
  };
}

function createRouteCoverage(
  route: ContractGraphRoute,
  consumer: ContractGraphConsumerDefinition,
): ContractGraphConsumerRouteCoverage {
  const missingFields = consumer.requiredRouteFields.filter(
    (field) => !hasRouteField(route, field),
  );
  const unsupportedFields = consumer.unsupportedRouteFields.filter((field) =>
    hasUnsupportedRouteFieldValue(route, field),
  );

  return {
    routeId: route.routeId,
    operationId: route.operationId,
    coveredFields: consumer.requiredRouteFields.filter((field) => !missingFields.includes(field)),
    missingFields,
    unsupportedFields,
  };
}

function toRouteCoverage(route: ContractGraphRoute): ContractGraphConsumerRouteCoverage {
  return {
    routeId: route.routeId,
    operationId: route.operationId,
    coveredFields: [],
    missingFields: [],
    unsupportedFields: [],
  };
}

function createRouteFieldFingerprint(
  route: ContractGraphRoute,
  consumerId: ContractGraphConsumerId,
  field: ContractGraphConsumerRouteField,
): string | undefined {
  switch (field) {
    case "routeId":
      return route.routeId;
    case "operationId":
      return route.operationId;
    case "httpMethod":
      return route.httpMethod.toUpperCase();
    case "path":
      return consumerId === "openapi" ? toOpenAPIComparablePath(route.path) : route.path;
    case "request.body":
      return schemaPresenceFingerprint(route.inputSchemas.body);
    case "request.path":
      return schemaPresenceFingerprint(route.inputSchemas.path);
    case "request.query":
      return schemaPresenceFingerprint(route.inputSchemas.query);
    case "request.headers":
      return schemaPresenceFingerprint(route.inputSchemas.headers);
    case "response":
      return schemaPresenceFingerprint(route.outputSchema);
    case "problems":
      return problemResponsesFingerprint(route.problemResponses ?? []);
    case "entitlements":
      return entitlementRequirementsFingerprint(route.entitlements);
    case "access.guards":
      return accessGuardsFingerprint(route.access.guards);
    case "access.roles":
      return accessRolesFingerprint(route.access.roles);
  }
}

function toOpenAPIComparablePath(path: string): string {
  return path.replace(/:\.\.\.([^/]+)/g, ":$1");
}

function schemaPresenceFingerprint(schema: unknown): string | undefined {
  if (schema === undefined) {
    return undefined;
  }

  return schema === null ? "absent" : "present";
}

function problemResponsesFingerprint(
  problems: NonNullable<ContractGraphRoute["problemResponses"]>,
): string {
  return JSON.stringify(
    problems
      .map((problem) => ({
        code: problem.code,
        category: problem.category,
        status: problem.status,
        ...(problem.description ? { description: problem.description } : {}),
        ...(problem.type ? { type: problem.type } : {}),
      }))
      .sort(compareProblemFingerprints),
  );
}

function entitlementRequirementsFingerprint(
  entitlements: ContractGraphRoute["entitlements"],
): string {
  return JSON.stringify(
    entitlements
      .map((entitlement) => ({
        feature: entitlement.feature,
        ...(entitlement.description ? { description: entitlement.description } : {}),
        ...(entitlement.resource ? { resource: entitlement.resource } : {}),
      }))
      .sort(compareEntitlementFingerprints),
  );
}

function accessGuardsFingerprint(guards: ContractGraphRoute["access"]["guards"]): string {
  return JSON.stringify([...guards].sort((left, right) => compareStrings(left.id, right.id)));
}

function accessRolesFingerprint(roles: ContractGraphRoute["access"]["roles"]): string {
  return JSON.stringify([...roles].sort(compareStrings));
}

function compareProblemFingerprints(
  left: {
    readonly code: string;
    readonly category: string;
    readonly status: number;
  },
  right: {
    readonly code: string;
    readonly category: string;
    readonly status: number;
  },
): number {
  return (
    compareStrings(left.code, right.code) ||
    compareStrings(left.category, right.category) ||
    left.status - right.status
  );
}

function compareEntitlementFingerprints(
  left: {
    readonly feature: string;
  },
  right: {
    readonly feature: string;
  },
): number {
  return compareStrings(JSON.stringify(left), JSON.stringify(right));
}

function hasRouteField(route: ContractGraphRoute, field: ContractGraphConsumerRouteField): boolean {
  switch (field) {
    case "routeId":
      return route.routeId.length > 0;
    case "operationId":
      return route.operationId.length > 0;
    case "httpMethod":
      return route.httpMethod.length > 0;
    case "path":
      return route.path.length > 0;
    case "request.body":
      return route.inputSchemas.body !== undefined;
    case "request.path":
      return route.inputSchemas.path !== undefined;
    case "request.query":
      return route.inputSchemas.query !== undefined;
    case "request.headers":
      return route.inputSchemas.headers !== undefined;
    case "response":
      return route.outputSchema !== undefined;
    case "problems":
      return true;
    case "entitlements":
      return route.entitlements !== undefined;
    case "access.guards":
      return route.access.guards !== undefined;
    case "access.roles":
      return route.access.roles !== undefined;
  }
}

function hasUnsupportedRouteFieldValue(
  route: ContractGraphRoute,
  field: ContractGraphConsumerRouteField,
): boolean {
  switch (field) {
    case "access.guards":
      return route.access.guards.length > 0;
    case "access.roles":
      return route.access.roles.length > 0;
    case "entitlements":
      return route.entitlements.length > 0;
    case "routeId":
    case "operationId":
    case "httpMethod":
    case "path":
    case "request.body":
    case "request.path":
    case "request.query":
    case "request.headers":
    case "response":
    case "problems":
      return false;
  }
}

function createMissingRouteDiagnostic(
  consumer: ContractGraphConsumerDefinition,
  route: ContractGraphRoute,
): ContractDiagnostic {
  return {
    code: "contract-consumer-missing-route",
    severity: "error",
    target: "route",
    routeId: route.routeId,
    controllerName: route.controllerName,
    methodName: route.methodName,
    path: route.path,
    message: `${consumer.label} output is missing contract route '${route.routeId}'.`,
  };
}

function createMissingFieldDiagnostic(
  consumer: ContractGraphConsumerDefinition,
  route: ContractGraphConsumerRouteCoverage,
  field: ContractGraphConsumerRouteField,
): ContractDiagnostic {
  return {
    code: "contract-consumer-missing-route-field",
    severity: "error",
    target: "route",
    routeId: route.routeId,
    message: `${consumer.label} requires graph field '${field}' for route '${route.routeId}', but the field is missing from the contract graph.`,
  };
}

function createMissingGeneratedFieldDiagnostic(
  consumer: ContractGraphConsumerDefinition,
  route: ContractGraphRoute,
  field: ContractGraphConsumerRouteField,
): ContractDiagnostic {
  return {
    code: "contract-consumer-missing-generated-route-field",
    severity: "error",
    target: "route",
    routeId: route.routeId,
    controllerName: route.controllerName,
    methodName: route.methodName,
    path: route.path,
    message: `${consumer.label} output is missing generated graph field '${field}' for route '${route.routeId}'.`,
  };
}

function createRouteFieldMismatchDiagnostic(
  consumer: ContractGraphConsumerDefinition,
  route: ContractGraphRoute,
  field: ContractGraphConsumerRouteField,
  expectedFingerprint: string,
  observedFingerprint: string,
): ContractDiagnostic {
  return {
    code: "contract-consumer-route-field-mismatch",
    severity: "error",
    target: "route",
    routeId: route.routeId,
    controllerName: route.controllerName,
    methodName: route.methodName,
    path: route.path,
    message: `${consumer.label} output maps graph field '${field}' for route '${route.routeId}' to '${observedFingerprint}', but the graph fingerprint is '${expectedFingerprint}'.`,
  };
}

function createUnsupportedFieldDiagnostic(
  consumer: ContractGraphConsumerDefinition,
  route: ContractGraphConsumerRouteCoverage,
  field: ContractGraphConsumerRouteField,
): ContractDiagnostic {
  return {
    code: "contract-consumer-unsupported-route-field",
    severity: "warning",
    target: "route",
    routeId: route.routeId,
    message: `${consumer.label} does not consume graph field '${field}' for route '${route.routeId}'. The field is reported explicitly instead of being silently dropped.`,
  };
}

function getConsumerDefinition(
  consumerId: ContractGraphConsumerId,
): ContractGraphConsumerDefinition {
  const consumer = DEFAULT_CONTRACT_GRAPH_CONSUMERS.find(
    (candidate) => candidate.id === consumerId,
  );

  if (!consumer) {
    throw new Error(`Unknown contract graph consumer '${consumerId}'.`);
  }

  return consumer;
}

function compareConsumerCoverage(
  left: ContractGraphConsumerCoverage,
  right: ContractGraphConsumerCoverage,
): number {
  return compareStrings(left.consumerId, right.consumerId);
}

function compareRouteCoverage(
  left: ContractGraphConsumerRouteCoverage,
  right: ContractGraphConsumerRouteCoverage,
): number {
  return compareStrings(left.routeId, right.routeId);
}

function compareDiagnostics(left: ContractDiagnostic, right: ContractDiagnostic): number {
  return (
    compareStrings(left.severity, right.severity) ||
    compareStrings(left.code, right.code) ||
    compareStrings(left.routeId ?? "", right.routeId ?? "") ||
    compareStrings(left.message, right.message)
  );
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}
