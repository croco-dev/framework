import * as fs from "node:fs";
import * as path from "node:path";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  assertContractGraphConsumerRouteCoverage,
  assertContractGraphHasNoErrors,
  type ContractGraph,
  type ContractGraphConsumerRouteField,
  type ContractGraphObservedConsumerRoute,
  type ContractGraphRoute,
} from "@croco/protocols-core";
import type {
  AdminGeneratedArtifact,
  AdminGeneratedClientBinding,
  AdminGeneratedDiagnostic,
  AdminGeneratedOperationKind,
  AdminGeneratedOperationScope,
  AdminGeneratedProblem,
  AdminGeneratedRequestMetadata,
  AdminGeneratedResourceAction,
  AdminGeneratedResourceConfig,
  AdminGeneratedResourceOperation,
  AdminGenerateFilesOptions,
} from "./types";

type ClassifiedRoute =
  | {
      readonly kind: Exclude<AdminGeneratedOperationKind, "action">;
      readonly route: ContractGraphRoute;
      readonly resourcePath: string;
    }
  | {
      readonly kind: "action";
      readonly route: ContractGraphRoute;
      readonly resourcePath: string;
      readonly scope: AdminGeneratedOperationScope;
      readonly action: string;
    };

type ResourceDraft = {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly operations: Map<
    Exclude<AdminGeneratedOperationKind, "action">,
    AdminGeneratedResourceOperation
  >;
  readonly actions: AdminGeneratedResourceAction[];
};

export class AdminGeneratedContractProblem extends Problem {
  readonly diagnostics: readonly AdminGeneratedDiagnostic[];

  constructor(diagnostics: readonly AdminGeneratedDiagnostic[]) {
    super(
      "admin-generated/contract-diagnostics",
      ProblemCategory.ValidationError,
      diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
      { extensions: { diagnostics } },
    );
    this.diagnostics = diagnostics;
  }
}

export function getAdminGeneratedDiagnostics(
  graph: ContractGraph,
): readonly AdminGeneratedDiagnostic[] {
  const diagnostics: AdminGeneratedDiagnostic[] = [];
  const seenOperationKeys = new Map<string, ContractGraphRoute>();

  for (const route of graph.routes) {
    const classified = classifyRoute(route);

    if (classified instanceof AdminGeneratedContractProblem) {
      diagnostics.push(...classified.diagnostics);
      continue;
    }

    const operationKey = getClassifiedOperationKey(classified);
    const existing = seenOperationKeys.get(operationKey);

    if (existing) {
      diagnostics.push({
        code: "admin-generated-duplicate-operation",
        routeId: route.routeId,
        path: route.path,
        message: `Cannot generate admin resource for route '${route.routeId}': route '${existing.routeId}' already maps to '${operationKey}'. Rename or reshape one route so the admin resource operation is unambiguous.`,
      });
      continue;
    }

    seenOperationKeys.set(operationKey, route);
  }

  return diagnostics.sort(compareDiagnostics);
}

export function createAdminGeneratedArtifact(graph: ContractGraph): AdminGeneratedArtifact {
  assertContractGraphHasNoErrors(graph);

  const diagnostics = [...getAdminGeneratedDiagnostics(graph)];
  const resourceDrafts = new Map<string, ResourceDraft>();
  const clientBindings: Record<string, AdminGeneratedClientBinding> = {};

  if (diagnostics.length > 0) {
    return {
      version: "croco.admin-generated.v1",
      resources: [],
      clientBindings,
      diagnostics,
    };
  }

  for (const route of [...graph.routes].sort(compareRoutes)) {
    const classified = classifyRoute(route);

    if (classified instanceof AdminGeneratedContractProblem) {
      continue;
    }

    const resource = getOrCreateResourceDraft(resourceDrafts, classified.resourcePath);
    const binding = createClientBinding(route);
    const bindingName = bindingNameForRoute(route);
    clientBindings[bindingName] = binding;

    if (classified.kind === "action") {
      resource.actions.push(createResourceAction(classified, bindingName));
      continue;
    }

    resource.operations.set(classified.kind, createResourceOperation(classified, bindingName));
  }

  const resources = [...resourceDrafts.values()].map(finalizeResource).sort(compareResources);
  const artifact: AdminGeneratedArtifact = {
    version: "croco.admin-generated.v1",
    resources,
    clientBindings: sortClientBindings(clientBindings),
    diagnostics,
  };

  assertContractGraphConsumerRouteCoverage(
    graph,
    "admin-generated",
    collectAdminGeneratedRoutes(artifact),
  );

  return artifact;
}

export function generateAdminResourceConfigFromContractGraph(
  graph: ContractGraph,
): readonly AdminGeneratedResourceConfig[] {
  const artifact = createAdminGeneratedArtifact(graph);
  assertNoAdminGeneratedDiagnostics(artifact.diagnostics);

  return artifact.resources;
}

export function generateAdminResourceSourceFromContractGraph(graph: ContractGraph): string {
  const artifact = createAdminGeneratedArtifact(graph);
  assertNoAdminGeneratedDiagnostics(artifact.diagnostics);
  const routes = [...graph.routes].sort(compareRoutes);
  const typeDeclarations = routes.map(generateRouteTypes).join("\n");

  return `import type { AdminGeneratedProblem, AdminGeneratedResourceConfig } from '@croco/admin-generated';

${typeDeclarations}
export const adminClientBindings = ${formatValue(artifact.clientBindings)} as const;

export const adminResources = ${formatValue(artifact.resources)} as const satisfies readonly AdminGeneratedResourceConfig[];
`;
}

export function generateAdminResourceFilesFromContractGraph(
  graph: ContractGraph,
  outDir: string,
  options: AdminGenerateFilesOptions = {},
): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const resourceFileName = options.resourceFileName ?? "admin-resources.ts";
  const resourcePath = path.join(outDir, resourceFileName);
  const indexPath = path.join(outDir, "index.ts");

  fs.writeFileSync(resourcePath, generateAdminResourceSourceFromContractGraph(graph));
  fs.writeFileSync(indexPath, `export * from './${path.basename(resourceFileName, ".ts")}';\n`);

  return [resourcePath, indexPath];
}

function assertNoAdminGeneratedDiagnostics(diagnostics: readonly AdminGeneratedDiagnostic[]): void {
  if (diagnostics.length > 0) {
    throw new AdminGeneratedContractProblem(diagnostics);
  }
}

function classifyRoute(route: ContractGraphRoute): ClassifiedRoute | AdminGeneratedContractProblem {
  const method = route.httpMethod.toUpperCase();
  const suffixSegments = getSuffixSegments(route);
  const resourcePath = normalizePath(route.controllerPath);

  if (method === "ALL" || method === "HEAD" || method === "OPTIONS") {
    return routeProblem(
      route,
      "admin-generated-unsupported-method",
      `Cannot generate admin resource for route '${route.routeId}': HTTP method '${method}' is not supported for admin resource generation. Use GET, POST, PUT, PATCH, or DELETE.`,
    );
  }

  if (suffixSegments.length === 0) {
    if (method === "GET") {
      return { kind: "list", route, resourcePath };
    }

    if (method === "POST") {
      return { kind: "create", route, resourcePath };
    }

    return routeProblem(
      route,
      "admin-generated-ambiguous-collection-route",
      `Cannot generate admin resource for route '${route.routeId}': collection path '${route.path}' with method '${method}' is ambiguous. Use GET for list, POST for create, or add an explicit action segment.`,
    );
  }

  if (suffixSegments.length === 1) {
    const [segment] = suffixSegments;

    if (isDynamicSegment(segment)) {
      if (method === "GET") {
        return { kind: "detail", route, resourcePath };
      }

      if (method === "PUT" || method === "PATCH") {
        return { kind: "update", route, resourcePath };
      }

      if (method === "DELETE") {
        return { kind: "delete", route, resourcePath };
      }

      return routeProblem(
        route,
        "admin-generated-ambiguous-record-route",
        `Cannot generate admin resource for route '${route.routeId}': record path '${route.path}' with method '${method}' has no action segment. Add an action segment such as '/:id/archive' or use GET, PUT, PATCH, or DELETE.`,
      );
    }

    if (isActionMethod(method)) {
      return { kind: "action", route, resourcePath, scope: "collection", action: segment };
    }

    return routeProblem(
      route,
      "admin-generated-ambiguous-collection-action",
      `Cannot generate admin resource for route '${route.routeId}': collection action path '${route.path}' with method '${method}' is ambiguous. Use a mutating method for custom admin actions.`,
    );
  }

  if (
    suffixSegments.length === 2 &&
    isDynamicSegment(suffixSegments[0]) &&
    !isDynamicSegment(suffixSegments[1])
  ) {
    if (isActionMethod(method)) {
      return {
        kind: "action",
        route,
        resourcePath,
        scope: "record",
        action: suffixSegments[1],
      };
    }

    return routeProblem(
      route,
      "admin-generated-ambiguous-record-action",
      `Cannot generate admin resource for route '${route.routeId}': record action path '${route.path}' with method '${method}' is ambiguous. Use a mutating method for custom admin actions.`,
    );
  }

  return routeProblem(
    route,
    "admin-generated-unsupported-route-shape",
    `Cannot generate admin resource for route '${route.routeId}': path '${route.path}' is not a supported admin route shape. Supported shapes are collection, '/:id', '/:id/:action', and '/:action' below the controller path.`,
  );
}

function getSuffixSegments(route: ContractGraphRoute): string[] {
  const controllerPath = normalizePath(route.controllerPath);
  const routePath = normalizePath(route.path);

  if (routePath === controllerPath) {
    return [];
  }

  const prefix = controllerPath === "/" ? "/" : `${controllerPath}/`;

  if (!routePath.startsWith(prefix)) {
    throw new AdminGeneratedContractProblem([
      {
        code: "admin-generated-route-outside-controller",
        routeId: route.routeId,
        path: route.path,
        message: `Cannot generate admin resource for route '${route.routeId}': path '${route.path}' is outside controller path '${route.controllerPath}'.`,
      },
    ]);
  }

  return routePath.slice(prefix.length).split("/").filter(Boolean);
}

function isDynamicSegment(segment: string): boolean {
  return segment.startsWith(":");
}

function isActionMethod(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function routeProblem(
  route: ContractGraphRoute,
  code: string,
  message: string,
): AdminGeneratedContractProblem {
  return new AdminGeneratedContractProblem([
    { code, routeId: route.routeId, path: route.path, message },
  ]);
}

function getClassifiedOperationKey(classified: ClassifiedRoute): string {
  if (classified.kind === "action") {
    return `${classified.resourcePath}:action:${classified.scope}:${classified.action}:${classified.route.httpMethod.toUpperCase()}`;
  }

  return `${classified.resourcePath}:${classified.kind}`;
}

function getOrCreateResourceDraft(
  drafts: Map<string, ResourceDraft>,
  resourcePath: string,
): ResourceDraft {
  const existing = drafts.get(resourcePath);

  if (existing) {
    return existing;
  }

  const draft: ResourceDraft = {
    id: resourceIdFromPath(resourcePath),
    label: labelFromPath(resourcePath),
    path: resourcePath,
    operations: new Map(),
    actions: [],
  };

  drafts.set(resourcePath, draft);

  return draft;
}

function createResourceOperation(
  classified: Extract<
    ClassifiedRoute,
    { readonly kind: Exclude<AdminGeneratedOperationKind, "action"> }
  >,
  bindingName: string,
): AdminGeneratedResourceOperation {
  const route = classified.route;

  return {
    kind: classified.kind,
    routeId: route.routeId,
    operationId: route.operationId,
    methodName: route.methodName,
    httpMethod: route.httpMethod.toUpperCase(),
    path: route.path,
    clientBinding: bindingName,
    ...typeNameMetadata(route),
    request: requestMetadata(route),
    response: schemaPresence(route.outputSchema),
    problems: problemMetadata(route),
    access: route.access,
  };
}

function createResourceAction(
  classified: Extract<ClassifiedRoute, { readonly kind: "action" }>,
  bindingName: string,
): AdminGeneratedResourceAction {
  const route = classified.route;

  return {
    kind: "action",
    scope: classified.scope,
    action: classified.action,
    routeId: route.routeId,
    operationId: route.operationId,
    methodName: route.methodName,
    httpMethod: route.httpMethod.toUpperCase(),
    path: route.path,
    clientBinding: bindingName,
    ...typeNameMetadata(route),
    request: requestMetadata(route),
    response: schemaPresence(route.outputSchema),
    problems: problemMetadata(route),
    access: route.access,
  };
}

function createClientBinding(route: ContractGraphRoute): AdminGeneratedClientBinding {
  return {
    routeId: route.routeId,
    operationId: route.operationId,
    methodName: route.methodName,
    httpMethod: route.httpMethod.toUpperCase(),
    path: route.path,
    ...typeNameMetadata(route),
    problemType: getProblemTypeName(route),
    problems: problemMetadata(route),
  };
}

function typeNameMetadata(route: ContractGraphRoute): {
  readonly inputType?: string;
  readonly outputType?: string;
  readonly problemType: string;
} {
  return {
    ...(needsInput(route) ? { inputType: getInputTypeName(route) } : {}),
    ...(route.outputSchema ? { outputType: getOutputTypeName(route) } : {}),
    problemType: getProblemTypeName(route),
  };
}

function requestMetadata(route: ContractGraphRoute): AdminGeneratedRequestMetadata {
  return {
    body: schemaPresence(route.inputSchemas.body),
    path: schemaPresence(route.inputSchemas.path),
    query: schemaPresence(route.inputSchemas.query),
    headers: schemaPresence(route.inputSchemas.headers),
  };
}

function schemaPresence(schema: unknown): "present" | "absent" {
  return schema ? "present" : "absent";
}

function problemMetadata(route: ContractGraphRoute): AdminGeneratedProblem[] {
  return [...(route.problemResponses ?? [])]
    .map((problem) => ({
      code: problem.code,
      category: problem.category,
      status: problem.status,
      ...(problem.description ? { description: problem.description } : {}),
      ...(problem.type ? { type: problem.type } : {}),
    }))
    .sort(compareProblems);
}

function finalizeResource(draft: ResourceDraft): AdminGeneratedResourceConfig {
  const operationEntries = [...draft.operations.entries()].sort(
    ([left], [right]) => operationRank(left) - operationRank(right),
  );

  return {
    id: draft.id,
    label: draft.label,
    path: draft.path,
    routeIds: [
      ...operationEntries.map(([, operation]) => operation.routeId),
      ...draft.actions.map((action) => action.routeId),
    ].sort(compareStrings),
    operations: Object.fromEntries(operationEntries),
    actions: draft.actions.sort(compareActions),
  };
}

function collectAdminGeneratedRoutes(
  artifact: AdminGeneratedArtifact,
): ContractGraphObservedConsumerRoute[] {
  const consumedFields = [
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
  ] as const satisfies readonly ContractGraphConsumerRouteField[];

  return Object.values(artifact.clientBindings)
    .map((binding) => ({
      routeId: binding.routeId,
      operationId: binding.operationId,
      consumedFields,
      fieldFingerprints: {
        routeId: binding.routeId,
        operationId: binding.operationId,
        httpMethod: binding.httpMethod,
        path: binding.path,
        "request.body": getRequestFingerprint(artifact, binding.routeId, "body"),
        "request.path": getRequestFingerprint(artifact, binding.routeId, "path"),
        "request.query": getRequestFingerprint(artifact, binding.routeId, "query"),
        "request.headers": getRequestFingerprint(artifact, binding.routeId, "headers"),
        response: getResponseFingerprint(artifact, binding.routeId),
        problems: JSON.stringify(binding.problems),
        "access.guards": getAccessGuardsFingerprint(artifact, binding.routeId),
        "access.roles": getAccessRolesFingerprint(artifact, binding.routeId),
      },
    }))
    .sort((left, right) => compareStrings(left.routeId, right.routeId));
}

function getRequestFingerprint(
  artifact: AdminGeneratedArtifact,
  routeId: string,
  field: keyof AdminGeneratedRequestMetadata,
): "present" | "absent" {
  const operation = findGeneratedOperation(artifact, routeId);

  return operation?.request[field] ?? "absent";
}

function getResponseFingerprint(
  artifact: AdminGeneratedArtifact,
  routeId: string,
): "present" | "absent" {
  return findGeneratedOperation(artifact, routeId)?.response ?? "absent";
}

function getAccessGuardsFingerprint(artifact: AdminGeneratedArtifact, routeId: string): string {
  return JSON.stringify(
    [...(findGeneratedOperation(artifact, routeId)?.access.guards ?? [])].sort((left, right) =>
      compareStrings(left.id, right.id),
    ),
  );
}

function getAccessRolesFingerprint(artifact: AdminGeneratedArtifact, routeId: string): string {
  return JSON.stringify(
    [...(findGeneratedOperation(artifact, routeId)?.access.roles ?? [])].sort(compareStrings),
  );
}

function findGeneratedOperation(
  artifact: AdminGeneratedArtifact,
  routeId: string,
): AdminGeneratedResourceOperation | AdminGeneratedResourceAction | undefined {
  for (const resource of artifact.resources) {
    for (const operation of Object.values(resource.operations)) {
      if (operation?.routeId === routeId) {
        return operation;
      }
    }

    const action = resource.actions.find((candidate) => candidate.routeId === routeId);

    if (action) {
      return action;
    }
  }

  return undefined;
}

function generateRouteTypes(route: ContractGraphRoute): string {
  const declarations: string[] = [];

  if (needsInput(route)) {
    declarations.push(`export type ${getInputTypeName(route)} = ${generateInputType(route)};`);
  }

  if (route.outputSchema) {
    declarations.push(
      `export type ${getOutputTypeName(route)} = ${zodTypeToTypeScript(route.outputSchema)};`,
    );
  }

  declarations.push(
    `export type ${getProblemTypeName(route)} = ${generateProblemUnion(route)};`,
    `export type ${getBindingTypeName(route)} = { readonly input: ${needsInput(route) ? getInputTypeName(route) : "undefined"}; readonly output: ${route.outputSchema ? getOutputTypeName(route) : "unknown | undefined"}; readonly problem: ${getProblemTypeName(route)}; };`,
  );

  return declarations.join("\n");
}

function generateInputType(route: ContractGraphRoute): string {
  const entries = getInputSchemaEntries(route);

  if (
    entries.length === 1 &&
    entries[0]?.[0] === "body" &&
    !route.inputSchemas.path &&
    !route.inputSchemas.query &&
    !route.inputSchemas.headers
  ) {
    return zodTypeToTypeScript(entries[0][1]);
  }

  return `{ ${entries
    .map(([name, schema]) => `${name}: ${zodTypeToTypeScript(schema)};`)
    .join(" ")} }`;
}

function generateProblemUnion(route: ContractGraphRoute): string {
  const problems = problemMetadata(route);

  if (problems.length === 0) {
    return "never";
  }

  return unionTypes(
    problems.map(
      (problem) =>
        `AdminGeneratedProblem<${literalValueToTypeScript(problem.code)}, ${literalValueToTypeScript(problem.category)}, ${problem.status}>`,
    ),
  );
}

function formatValue(value: unknown, indent = 0): string {
  if (typeof value === "string") {
    return stringValueToTypeScript(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const childIndent = " ".repeat(indent + 2);

    return `[\n${value
      .map((item) => `${childIndent}${formatValue(item, indent + 2)}`)
      .join(",\n")}\n${" ".repeat(indent)}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);

    if (entries.length === 0) {
      return "{}";
    }

    const childIndent = " ".repeat(indent + 2);

    return `{\n${entries
      .map(
        ([key, entryValue]) =>
          `${childIndent}${formatObjectKey(key)}: ${formatValue(entryValue, indent + 2)}`,
      )
      .join(",\n")}\n${" ".repeat(indent)}}`;
  }

  throw new AdminGeneratedContractProblem([
    {
      code: "admin-generated-unsupported-generated-value",
      message: `Cannot generate admin resource literal for unsupported value ${String(value)}.`,
    },
  ]);
}

function normalizePath(value: string): string {
  const pathValue = value.startsWith("/") ? value : `/${value}`;
  const result = pathValue.replace(/\/+/g, "/");

  return result.length > 1 && result.endsWith("/") ? result.slice(0, -1) : result || "/";
}

function resourceIdFromPath(resourcePath: string): string {
  const staticSegments = resourcePath
    .split("/")
    .filter((segment) => segment.length > 0 && !isDynamicSegment(segment));

  if (staticSegments.length === 0) {
    return "root";
  }

  return toCamelCase(staticSegments.join("-"));
}

function labelFromPath(resourcePath: string): string {
  const staticSegments = resourcePath
    .split("/")
    .filter((segment) => segment.length > 0 && !isDynamicSegment(segment));
  const base = staticSegments.at(-1) ?? "resource";

  return toPascalCase(base).replace(/([a-z])([A-Z])/g, "$1 $2");
}

function bindingNameForRoute(route: ContractGraphRoute): string {
  return toCamelCase(route.operationId);
}

function getInputTypeName(route: ContractGraphRoute): string {
  return `${toPascalCase(route.operationId)}Input`;
}

function getOutputTypeName(route: ContractGraphRoute): string {
  return `${toPascalCase(route.operationId)}Output`;
}

function getProblemTypeName(route: ContractGraphRoute): string {
  return `${toPascalCase(route.operationId)}Problem`;
}

function getBindingTypeName(route: ContractGraphRoute): string {
  return `${toPascalCase(route.operationId)}AdminBinding`;
}

function needsInput(route: ContractGraphRoute): boolean {
  return getInputSchemaEntries(route).length > 0;
}

function getInputSchemaEntries(route: ContractGraphRoute): [string, unknown][] {
  const entries: [string, unknown | null][] = [
    ["body", route.inputSchemas.body],
    ["path", route.inputSchemas.path],
    ["query", route.inputSchemas.query],
    ["headers", route.inputSchemas.headers],
  ];

  return entries.filter(
    (entry): entry is [string, unknown] => entry[1] !== null && entry[1] !== undefined,
  );
}

function zodTypeToTypeScript(schema: unknown): string {
  const schemaName = getSchemaName(schema);

  if (schemaName === "ZodString") {
    return "string";
  }

  if (schemaName === "ZodNumber") {
    return "number";
  }

  if (schemaName === "ZodBoolean") {
    return "boolean";
  }

  if (schemaName === "ZodUnknown" || schemaName === "ZodAny") {
    return "unknown";
  }

  if (schemaName === "ZodNever") {
    return "never";
  }

  if (schemaName === "ZodNull") {
    return "null";
  }

  if (schemaName === "ZodUndefined" || schemaName === "ZodVoid") {
    return "undefined";
  }

  if (schemaName === "ZodLiteral") {
    return literalValueToTypeScript(getLiteralValue(schema));
  }

  if (schemaName === "ZodEnum") {
    return unionTypes(getEnumValues(schema).map(literalValueToTypeScript));
  }

  if (schemaName === "ZodNativeEnum") {
    return unionTypes(getNativeEnumValues(schema).map(literalValueToTypeScript));
  }

  if (schemaName === "ZodUnion" || schemaName === "ZodDiscriminatedUnion") {
    return unionTypes(getUnionOptions(schema).map(zodTypeToTypeScript));
  }

  if (schemaName === "ZodOptional") {
    return `${zodTypeToTypeScript(getInnerSchema(schema))} | undefined`;
  }

  if (schemaName === "ZodNullable") {
    return `${zodTypeToTypeScript(getInnerSchema(schema))} | null`;
  }

  if (schemaName === "ZodDefault") {
    return zodTypeToTypeScript(getInnerSchema(schema));
  }

  if (schemaName === "ZodEffects" || schemaName === "ZodBranded" || schemaName === "ZodReadonly") {
    return zodTypeToTypeScript(getInnerSchema(schema));
  }

  if (schemaName === "ZodArray") {
    return `${zodTypeToTypeScript(getArrayElementSchema(schema))}[]`;
  }

  if (schemaName === "ZodRecord") {
    const valueSchema = getRecordValueSchema(schema);

    return `Record<string, ${valueSchema === undefined ? "unknown" : zodTypeToTypeScript(valueSchema)}>`;
  }

  if (schemaName === "ZodObject") {
    return getObjectTypeScript(schema);
  }

  throw new AdminGeneratedContractProblem([
    {
      code: "admin-generated-unsupported-schema",
      message: `Cannot generate admin resource type for unsupported schema ${schemaName || "unknown schema"}. Use a JSON-safe Zod schema supported by @croco/admin-generated or remove the schema from generated admin contracts.`,
    },
  ]);
}

function getSchemaName(schema: unknown): string {
  if (!schema || typeof schema !== "object") {
    return "";
  }

  return schema.constructor.name;
}

function getInnerSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || !("_def" in schema)) {
    return undefined;
  }

  const definition = schema._def as {
    readonly innerType?: unknown;
    readonly schema?: unknown;
    readonly type?: unknown;
  };

  return definition.innerType ?? definition.schema ?? definition.type;
}

function getArrayElementSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || !("_def" in schema)) {
    return undefined;
  }

  const definition = schema._def as {
    readonly element?: unknown;
    readonly type?: unknown;
  };

  return definition.element ?? definition.type;
}

function getRecordValueSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || !("_def" in schema)) {
    return undefined;
  }

  const definition = schema._def as { readonly valueType?: unknown };

  return definition.valueType;
}

function getLiteralValue(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || !("_def" in schema)) {
    return undefined;
  }

  const definition = schema._def as {
    readonly value?: unknown;
    readonly values?: readonly unknown[];
  };

  return definition.value ?? definition.values?.[0];
}

function getEnumValues(schema: unknown): unknown[] {
  if (!schema || typeof schema !== "object" || !("_def" in schema)) {
    return [];
  }

  const definition = schema._def as {
    readonly entries?: Record<string, unknown>;
    readonly values?: readonly unknown[];
  };

  return definition.values ? [...definition.values] : Object.values(definition.entries ?? {});
}

function getNativeEnumValues(schema: unknown): unknown[] {
  if (!schema || typeof schema !== "object" || !("_def" in schema)) {
    return [];
  }

  const definition = schema._def as {
    readonly values?: Record<string, unknown>;
  };

  return [...new Set(Object.values(definition.values ?? {}).filter(isLiteralTypeValue))];
}

function getUnionOptions(schema: unknown): unknown[] {
  if (!schema || typeof schema !== "object" || !("_def" in schema)) {
    return [];
  }

  const definition = schema._def as {
    readonly options?: readonly unknown[] | ReadonlyMap<unknown, unknown>;
  };

  if (definition.options instanceof Map) {
    return [...definition.options.values()];
  }

  return [...(definition.options ?? [])];
}

function getObjectTypeScript(schema: unknown): string {
  const fields = Object.entries(getObjectShape(schema))
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([key, value]) => {
      const optionalFieldSchema = getOptionalObjectFieldSchema(value);

      if (optionalFieldSchema !== undefined) {
        return `${formatObjectKey(key)}?: ${zodTypeToTypeScript(optionalFieldSchema)};`;
      }

      return `${formatObjectKey(key)}: ${zodTypeToTypeScript(value)};`;
    });

  return `{ ${fields.join(" ")} }`;
}

function getOptionalObjectFieldSchema(schema: unknown): unknown {
  if (getSchemaName(schema) !== "ZodOptional") {
    return undefined;
  }

  return getInnerSchema(schema);
}

function getObjectShape(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") {
    return {};
  }

  if ("shape" in schema) {
    const shape = schema.shape;

    return shape && typeof shape === "object" ? (shape as Record<string, unknown>) : {};
  }

  if (!("_def" in schema)) {
    return {};
  }

  const definition = schema._def as { readonly shape?: unknown };
  const shape = typeof definition.shape === "function" ? definition.shape() : definition.shape;

  return shape && typeof shape === "object" ? (shape as Record<string, unknown>) : {};
}

function unionTypes(types: readonly string[]): string {
  const uniqueTypes = [...new Set(types)];

  return uniqueTypes.length === 0 ? "never" : uniqueTypes.join(" | ");
}

function literalValueToTypeScript(value: unknown): string {
  if (typeof value === "string") {
    return stringValueToTypeScript(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  throw new AdminGeneratedContractProblem([
    {
      code: "admin-generated-unsupported-literal",
      message: `Cannot generate admin resource type for unsupported literal value ${String(value)}.`,
    },
  ]);
}

function formatObjectKey(key: string): string {
  if (isJavaScriptIdentifier(key)) {
    return key;
  }

  return stringValueToTypeScript(key);
}

function stringValueToTypeScript(value: string): string {
  return `'${value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")}'`;
}

function isLiteralTypeValue(value: unknown): value is string | number | boolean | null {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
}

function isJavaScriptIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

function operationRank(kind: Exclude<AdminGeneratedOperationKind, "action">): number {
  return ["list", "detail", "create", "update", "delete"].indexOf(kind);
}

function sortClientBindings(
  bindings: Readonly<Record<string, AdminGeneratedClientBinding>>,
): Readonly<Record<string, AdminGeneratedClientBinding>> {
  return Object.fromEntries(
    Object.entries(bindings).sort(([left], [right]) => compareStrings(left, right)),
  );
}

function compareResources(
  left: AdminGeneratedResourceConfig,
  right: AdminGeneratedResourceConfig,
): number {
  return compareStrings(left.id, right.id) || compareStrings(left.path, right.path);
}

function compareRoutes(left: ContractGraphRoute, right: ContractGraphRoute): number {
  return compareStrings(left.routeId, right.routeId);
}

function compareActions(
  left: AdminGeneratedResourceAction,
  right: AdminGeneratedResourceAction,
): number {
  return (
    compareStrings(left.scope, right.scope) ||
    compareStrings(left.action, right.action) ||
    compareStrings(left.httpMethod, right.httpMethod) ||
    compareStrings(left.routeId, right.routeId)
  );
}

function compareProblems(left: AdminGeneratedProblem, right: AdminGeneratedProblem): number {
  return compareStrings(left.code, right.code) || left.status - right.status;
}

function compareDiagnostics(
  left: AdminGeneratedDiagnostic,
  right: AdminGeneratedDiagnostic,
): number {
  return (
    compareStrings(left.code, right.code) ||
    compareStrings(left.routeId ?? "", right.routeId ?? "") ||
    compareStrings(left.message, right.message)
  );
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);

  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`;
}

function toPascalCase(value: string): string {
  return value
    .replace(/Controller$/, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}
