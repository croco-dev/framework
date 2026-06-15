import * as fs from "node:fs";
import * as path from "node:path";
import {
  assertContractGraphHasNoErrors,
  type ContractGraph,
  type RouteIR,
} from "@croco/protocols-core";
import { Problem, ProblemCategory } from "@croco/problems-core";

export type GenerateClientOptions = {
  readonly reactQuery?: boolean;
};

type DomainRoutes = {
  readonly domain: string;
  readonly routes: RouteIR[];
};

type ResponseHelperOptions = {
  readonly hasOutputRoutes: boolean;
  readonly hasNoOutputRoutes: boolean;
};

class RpcCodegenContractProblem extends Problem {
  constructor(detail: string) {
    super("rpc-codegen/invalid-contract", ProblemCategory.ValidationError, detail);
  }
}

export function generateClientFilesFromContractGraph(
  graph: ContractGraph,
  outDir: string,
  options: GenerateClientOptions = {},
): string[] {
  assertContractGraphHasNoErrors(graph);

  return generateClientFiles([...graph.routes], outDir, options);
}

export function generateClientFiles(
  routes: RouteIR[],
  outDir: string,
  options: GenerateClientOptions = {},
): string[] {
  assertGeneratedClientRoutes(routes);
  fs.mkdirSync(outDir, { recursive: true });

  return groupRoutesByDomain(routes).map((domainRoutes) => {
    const filePath = path.join(outDir, `${domainRoutes.domain}.ts`);
    const content = generateDomainClient(domainRoutes, options);

    assertNoZodImport(content);

    fs.writeFileSync(filePath, content);

    return filePath;
  });
}

function assertGeneratedClientRoutes(routes: RouteIR[]): void {
  for (const route of routes) {
    if (route.httpMethod.toUpperCase() === "ALL") {
      throw new RpcCodegenContractProblem(
        `Cannot generate RPC client for @All route ${formatRoute(route)}: @All is runtime-only and cannot be represented as a concrete generated client request. Use explicit HTTP method decorators for generated contracts.`,
      );
    }

    const bodyParamCount = route.params.filter((param) => param.kind === "body").length;

    if (bodyParamCount > 1) {
      throw new RpcCodegenContractProblem(
        `Cannot generate RPC client for route ${formatRoute(route)}: generated contracts support one request body per route, but ${bodyParamCount} @Body() parameters were found.`,
      );
    }

    assertGeneratedClientPathParams(route);
  }
}

function assertGeneratedClientPathParams(route: RouteIR): void {
  const pathParamNames = new Set(getRoutePathParamNames(route.path));
  const declaredParamNames = new Set(
    route.params.filter((param) => param.kind === "path").map((param) => param.name),
  );
  const schemaParamNames = new Set(
    route.inputSchemas.path ? Object.keys(getObjectShape(route.inputSchemas.path)) : [],
  );

  for (const name of pathParamNames) {
    if (!declaredParamNames.has(name)) {
      throw new RpcCodegenContractProblem(
        `Cannot generate RPC client for route ${formatRoute(route)}: route path declares ':${name}' but no @Param("${name}") metadata was found.`,
      );
    }

    if (!schemaParamNames.has(name)) {
      throw new RpcCodegenContractProblem(
        `Cannot generate RPC client for route ${formatRoute(route)}: route path declares ':${name}' but no generated path schema was found.`,
      );
    }
  }

  for (const name of declaredParamNames) {
    if (name.length > 0 && !pathParamNames.has(name)) {
      throw new RpcCodegenContractProblem(
        `Cannot generate RPC client for route ${formatRoute(route)}: @Param("${name}") is not present in route path '${route.path}'.`,
      );
    }
  }

  for (const name of schemaParamNames) {
    if (!pathParamNames.has(name)) {
      throw new RpcCodegenContractProblem(
        `Cannot generate RPC client for route ${formatRoute(route)}: generated path schema declares '${name}' but route path '${route.path}' does not contain ':${name}'.`,
      );
    }
  }
}

function groupRoutesByDomain(routes: RouteIR[]): DomainRoutes[] {
  const groups = new Map<string, RouteIR[]>();

  for (const route of routes) {
    const domain = getDomainName(route);
    groups.set(domain, [...(groups.get(domain) ?? []), route]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, domainRoutes]) => ({ domain, routes: domainRoutes }));
}

function generateDomainClient(domainRoutes: DomainRoutes, options: GenerateClientOptions): string {
  const clientName = `${domainRoutes.domain}Client`;
  const inputTypes = domainRoutes.routes.map(generateInputType).filter((type) => type.length > 0);
  const outputTypes = domainRoutes.routes.map(generateOutputType).filter((type) => type.length > 0);
  const types = [...inputTypes, ...outputTypes];
  const responseHelpers = getResponseHelpers({
    hasOutputRoutes: domainRoutes.routes.some((route) => route.outputSchema),
    hasNoOutputRoutes: domainRoutes.routes.some((route) => !route.outputSchema),
  });
  const queryHelpers = domainRoutes.routes.some((route) => route.inputSchemas.query)
    ? `type QueryParamValue = string | number | boolean | null | undefined;
type QueryParamInput = QueryParamValue | readonly QueryParamValue[];

function serializeQueryParams(query: Record<string, QueryParamInput>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }

    const values = Array.isArray(value) ? value : [value];

    for (const item of values) {
      if (item === undefined) {
        continue;
      }

      params.append(key, String(item));
    }
  }

  return params.toString();
}
`
    : "";
  const headerHelpers = domainRoutes.routes.some((route) => route.inputSchemas.headers)
    ? `type HeaderParamValue = string | number | boolean | null | undefined;

function serializeHeaders(headers: Record<string, HeaderParamValue>): Record<string, string> {
  const serialized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    serialized[key] = String(value);
  }

  return serialized;
}
`
    : "";
  const clientMethods = domainRoutes.routes.map(generateClientMethod).join("\n");
  const imports = options.reactQuery
    ? "import { useMutation, useQuery } from '@tanstack/react-query';\n"
    : "";
  const hooks = options.reactQuery ? `\n${generateReactQueryHooks(domainRoutes, clientName)}` : "";

  return `${imports}${types.join("\n")}
${responseHelpers}${queryHelpers}${headerHelpers}
export const ${clientName} = {
${clientMethods}
};
${hooks}`;
}

function getResponseHelpers(options: ResponseHelperOptions): string {
  const jsonResponseHelper = options.hasOutputRoutes
    ? `async function handleJsonResponse<T = unknown>(response: Response): Promise<T> {
  if (!response.ok) {
    return rejectErrorResponse(response);
  }

  return response.json() as Promise<T>;
}

`
    : "";
  const optionalJsonResponseHelper = options.hasNoOutputRoutes
    ? `async function readOptionalJsonResponse(response: Response): Promise<unknown | undefined> {
  if (!response.ok) {
    return rejectErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined;
  }

  const body = await response.text();

  if (body.length === 0) {
    return undefined;
  }

  return JSON.parse(body) as unknown;
}

`
    : "";

  return `export type RpcProblemDetails = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
} & Record<string, unknown>;

export class RpcClientProblemError extends Error {
  readonly problem: RpcProblemDetails;
  readonly response: Response;

  constructor(problem: RpcProblemDetails, response: Response) {
    super(problem.detail ?? problem.title);
    this.name = 'RpcClientProblemError';
    this.problem = problem;
    this.response = response;
  }
}

export class RpcClientResponseError extends Error {
  readonly response: Response;
  readonly body?: unknown;

  constructor(response: Response, body?: unknown) {
    super(\`RPC request failed with HTTP \${response.status}\`);
    this.name = 'RpcClientResponseError';
    this.response = response;
    this.body = body;
  }
}

${jsonResponseHelper}${optionalJsonResponseHelper}
async function rejectErrorResponse(response: Response): Promise<never> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new RpcClientResponseError(response);
  }

  if (isRpcProblemDetails(body)) {
    throw new RpcClientProblemError(body, response);
  }

  throw new RpcClientResponseError(response, body);
}

function isRpcProblemDetails(value: unknown): value is RpcProblemDetails {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.type === 'string' &&
    typeof value.title === 'string' &&
    typeof value.status === 'number' &&
    typeof value.code === 'string' &&
    (value.detail === undefined || typeof value.detail === 'string') &&
    (value.instance === undefined || typeof value.instance === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
`;
}

function generateInputType(route: RouteIR): string {
  if (!needsInput(route)) {
    return "";
  }

  if (hasLegacyBodyInput(route)) {
    return `export type ${getInputTypeName(route)} = ${zodTypeToTypeScript(route.inputSchemas.body)};`;
  }

  const fields = getInputSchemaEntries(route).map(
    ([name, schema]) => `${name}: ${zodTypeToTypeScript(schema)};`,
  );

  return `export type ${getInputTypeName(route)} = { ${fields.join(" ")} };`;
}

function generateOutputType(route: RouteIR): string {
  if (!route.outputSchema) {
    return "";
  }

  return `export type ${getOutputTypeName(route)} = ${zodTypeToTypeScript(route.outputSchema)};`;
}

function generateClientMethod(route: RouteIR): string {
  const input = needsInput(route)
    ? `input${hasRequiredInput(route) ? "" : "?"}: ${getInputTypeName(route)}`
    : "";
  const fetchOptions = getFetchOptions(route);
  const response = getResponseExpression(route);
  const returnType = getReturnType(route);

  if (hasStructuredInput(route)) {
    return `  ${route.methodName}: (${input}): ${returnType} => {
    const path = ${getPathExpression(route)};
${getQueryStatements(route)}    return fetch(${getUrlExpression(route)}, ${fetchOptions}).then((response) => ${response});
  },`;
  }

  return `  ${route.methodName}: (${input}): ${returnType} => fetch(${getPathExpression(route)}, ${fetchOptions}).then((response) => ${response}),`;
}

function getFetchOptions(route: RouteIR): string {
  const options = [`method: '${route.httpMethod.toUpperCase()}'`];

  if (hasBody(route)) {
    options.push(`body: JSON.stringify(${hasStructuredInput(route) ? "input.body" : "input"})`);
  }

  const headers = getHeadersExpression(route);

  if (headers.length > 0) {
    options.push(`headers: ${headers}`);
  }

  return `{ ${options.join(", ")} }`;
}

function getHeadersExpression(route: RouteIR): string {
  const hasHeaderInput =
    route.inputSchemas.headers !== null && route.inputSchemas.headers !== undefined;

  if (hasHeaderInput && hasBody(route)) {
    return `{ ...serializeHeaders(input.headers), 'Content-Type': 'application/json' }`;
  }

  if (hasHeaderInput) {
    return "serializeHeaders(input.headers)";
  }

  if (hasBody(route)) {
    return "{ 'Content-Type': 'application/json' }";
  }

  return "";
}

function getResponseExpression(route: RouteIR): string {
  if (!route.outputSchema) {
    return "readOptionalJsonResponse(response)";
  }

  return `handleJsonResponse<${getOutputTypeName(route)}>(response)`;
}

function getReturnType(route: RouteIR): string {
  if (!route.outputSchema) {
    return "Promise<unknown | undefined>";
  }

  return `Promise<${getOutputTypeName(route)}>`;
}

function generateReactQueryHooks(domainRoutes: DomainRoutes, clientName: string): string {
  return domainRoutes.routes.map((route) => generateReactQueryHook(route, clientName)).join("\n");
}

function generateReactQueryHook(route: RouteIR, clientName: string): string {
  const hookName = `use${toPascalCase(route.methodName)}`;

  if (hasBody(route)) {
    return `export function ${hookName}() {
  return useMutation({ mutationFn: ${clientName}.${route.methodName} });
}`;
  }

  const input = needsInput(route)
    ? `input${hasRequiredInput(route) ? "" : "?"}: ${getInputTypeName(route)}`
    : "";
  const callInput = needsInput(route) ? "input" : "";
  const queryKey = needsInput(route) ? `['${route.methodName}', input]` : `['${route.methodName}']`;

  return `export function ${hookName}(${input}) {
  return useQuery({ queryKey: ${queryKey}, queryFn: () => ${clientName}.${route.methodName}(${callInput}) });
}`;
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

  if (schemaName === "ZodOptional") {
    return `${zodTypeToTypeScript(getInnerSchema(schema))} | undefined`;
  }

  if (schemaName === "ZodNullable") {
    return `${zodTypeToTypeScript(getInnerSchema(schema))} | null`;
  }

  if (schemaName === "ZodDefault") {
    return zodTypeToTypeScript(getInnerSchema(schema));
  }

  if (schemaName === "ZodArray") {
    return `${zodTypeToTypeScript(getArrayElementSchema(schema))}[]`;
  }

  if (schemaName === "ZodObject") {
    return getObjectTypeScript(schema);
  }

  return "unknown";
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

  const definition = schema._def as { readonly innerType?: unknown };

  return definition.innerType;
}

function getArrayElementSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || !("_def" in schema)) {
    return undefined;
  }

  const definition = schema._def as { readonly element?: unknown; readonly type?: unknown };

  return definition.element ?? definition.type;
}

function getObjectTypeScript(schema: unknown): string {
  const fields = Object.entries(getObjectShape(schema)).map(
    ([key, value]) => `${formatObjectKey(key)}: ${zodTypeToTypeScript(value)};`,
  );

  return `{ ${fields.join(" ")} }`;
}

function formatObjectKey(key: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
    return key;
  }

  return `'${key.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
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

function getPathExpression(route: RouteIR): string {
  const pathParams = getRoutePathParams(route.path);

  if (pathParams.length === 0) {
    return `'${route.path}'`;
  }

  const pathExpression = pathParams.reduce(
    (currentPath, param) =>
      currentPath
        .split(`:${param.token}`)
        .join(`\${encodeURIComponent(String(input.path.${param.name}))}`),
    route.path,
  );

  return `\`${pathExpression}\``;
}

function getRoutePathParamNames(pathname: string): string[] {
  return getRoutePathParams(pathname).map((param) => param.name);
}

function getRoutePathParams(pathname: string): { readonly token: string; readonly name: string }[] {
  return [...pathname.matchAll(/:([^/]+)/g)]
    .map((match) => {
      const token = match[1];

      return { token, name: token.replace(/^\.\.\./, "") };
    })
    .filter((param) => param.name.length > 0);
}

function getQueryStatements(route: RouteIR): string {
  if (!route.inputSchemas.query) {
    return "";
  }

  return `    const query = serializeQueryParams(input.query);
    const url = query ? \`${"${path}"}?${"${query}"}\` : path;
`;
}

function getUrlExpression(route: RouteIR): string {
  return route.inputSchemas.query ? "url" : "path";
}

function getInputSchemaEntries(route: RouteIR): [string, unknown][] {
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

function needsInput(route: RouteIR): boolean {
  return getInputSchemaEntries(route).length > 0;
}

function hasRequiredInput(route: RouteIR): boolean {
  return needsInput(route);
}

function hasBody(route: RouteIR): boolean {
  return route.inputSchemas.body !== null && route.inputSchemas.body !== undefined;
}

function hasStructuredInput(route: RouteIR): boolean {
  return Boolean(route.inputSchemas.path || route.inputSchemas.query || route.inputSchemas.headers);
}

function hasLegacyBodyInput(route: RouteIR): boolean {
  return Boolean(
    route.inputSchemas.body &&
    !route.inputSchemas.path &&
    !route.inputSchemas.query &&
    !route.inputSchemas.headers,
  );
}

function getDomainName(route: RouteIR): string {
  const rawName = route.domain ?? route.controllerName.replace(/Controller$/, "");

  return toCamelCase(rawName);
}

function getInputTypeName(route: RouteIR): string {
  return `${toPascalCase(route.methodName)}Input`;
}

function getOutputTypeName(route: RouteIR): string {
  return `${toPascalCase(route.methodName)}Output`;
}

function formatRoute(route: RouteIR): string {
  return `${route.controllerName}.${route.methodName} (${route.path})`;
}

function assertNoZodImport(content: string): void {
  if (
    content.includes("from 'zod'") ||
    content.includes("import { z }") ||
    content.includes("zod")
  ) {
    throw new RpcCodegenContractProblem("Generated client must not import zod.");
  }
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
