import * as fs from "node:fs";
import * as path from "node:path";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  assertContractGraphConsumerRouteCoverage,
  assertContractGraphHasNoErrors,
  type ContractGraph,
  type ContractGraphConsumerRouteField,
  type ContractGraphObservedConsumerRoute,
  type ContractSchemaDescriptor,
  describeZodSchema,
  formatSchemaDiagnostic,
  getSchemaDescriptorDiagnostics,
  getZodArrayElementSchema,
  getZodDefaultValue,
  getZodInnerSchema,
  getZodObjectShape,
  getZodObjectUnsupportedDynamicKeyMode,
  getZodSchemaTypeName,
  getContractPathParamNames,
  getContractPathParams,
  type RouteIR,
} from "@croco/protocols-core";

export type GenerateClientOptions = {
  readonly problemRuntime?: GenerateClientProblemRuntime;
  readonly reactQuery?: boolean;
};

export type GenerateClientProblemRuntime = "inline" | "frontend-problems";

type GeneratedClientRoute = RouteIR & {
  readonly routeId?: string;
  readonly operationId?: string;
};

type DomainRoutes = {
  readonly domain: string;
  readonly routes: GeneratedClientRoute[];
};

type GeneratedClientFile = {
  readonly filePath: string;
  readonly content: string;
};

type ResponseHelperOptions = {
  readonly hasOutputRoutes: boolean;
  readonly hasNoOutputRoutes: boolean;
  readonly hasFormRoutes: boolean;
  readonly hasQueryKeyInputs: boolean;
};

type GeneratedFormField = {
  readonly name: string;
  readonly label: string;
  readonly control: "text" | "number" | "checkbox" | "select" | "multi-select" | "list";
  readonly valueKind: "string" | "number" | "boolean" | "enum" | "array";
  readonly required: boolean;
  readonly valueType: string;
  readonly initialValueExpression: string;
  readonly payloadValueExpression: string;
  readonly options: readonly FormFieldOption[];
};

type FormFieldOption = {
  readonly label: string;
  readonly value: string | number | boolean | null;
};

type FormFieldSchemaAnalysis = {
  readonly schema: unknown;
  readonly optional: boolean;
  readonly nullable: boolean;
  readonly defaultValue?: unknown;
};

class RpcCodegenContractProblem extends Problem {
  constructor(detail: string) {
    super("rpc-codegen/invalid-contract", ProblemCategory.ValidationError, detail);
  }
}

class RpcCodegenUnsupportedFormSchemaProblem extends Problem {
  constructor(route: GeneratedClientRoute, detail: string) {
    super(
      "rpc-codegen/unsupported-form-schema",
      ProblemCategory.ValidationError,
      `Cannot generate RPC form model for route ${formatRoute(route)}: ${detail}`,
    );
  }
}

export function generateClientFilesFromContractGraph(
  graph: ContractGraph,
  outDir: string,
  options: GenerateClientOptions = {},
): string[] {
  assertContractGraphHasNoErrors(graph);

  const files = generateClientFiles([...graph.routes], outDir, options);

  assertContractGraphConsumerRouteCoverage(
    graph,
    "rpc-client",
    collectGeneratedRpcConsumerRoutes(files),
  );

  return files;
}

export function generateClientFiles(
  routes: GeneratedClientRoute[],
  outDir: string,
  options: GenerateClientOptions = {},
): string[] {
  assertGeneratedClientRoutes(routes);

  const domainRouteGroups = groupRoutesByDomain(routes);
  const domainFiles = domainRouteGroups.map((domainRoutes) => {
    const content = generateDomainClient(domainRoutes, options);

    assertNoZodImport(content);

    return {
      filePath: path.join(outDir, `${domainRoutes.domain}.ts`),
      content,
    };
  });
  const supportPath = path.join(outDir, "rpc.ts");
  const supportContent = generateRpcSupport(options);
  const indexPath = path.join(outDir, "index.ts");
  const indexContent = generateClientIndex(domainRouteGroups);
  const files: readonly GeneratedClientFile[] = [
    ...domainFiles,
    { filePath: supportPath, content: supportContent },
    { filePath: indexPath, content: indexContent },
  ];

  fs.mkdirSync(outDir, { recursive: true });

  for (const file of files) {
    fs.writeFileSync(file.filePath, file.content);
  }

  return files.map((file) => file.filePath);
}

function assertGeneratedClientRoutes(routes: readonly GeneratedClientRoute[]): void {
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

  for (const domainRoutes of groupRoutesByDomain(routes)) {
    assertGeneratedClientMethodNames(domainRoutes);
  }
}

function assertGeneratedClientMethodNames(domainRoutes: DomainRoutes): void {
  const members = new Map<string, { readonly route: RouteIR; readonly kind: string }>();

  for (const route of domainRoutes.routes) {
    for (const member of [
      { name: route.methodName, kind: "route method" },
      { name: getResultMethodName(route), kind: "result method" },
    ]) {
      const existing = members.get(member.name);

      if (existing) {
        throw new RpcCodegenContractProblem(
          `Cannot generate RPC client for domain '${domainRoutes.domain}': member '${member.name}' would be generated for ${formatRoute(route)} as a ${member.kind}, but ${formatRoute(existing.route)} already generates that member as a ${existing.kind}. Rename one route method because generated Result methods reserve the '<methodName>Result' member pattern.`,
        );
      }

      members.set(member.name, { route, kind: member.kind });
    }
  }
}

function assertGeneratedClientPathParams(route: GeneratedClientRoute): void {
  const pathParamNames = new Set(getContractPathParamNames(route.path));
  const declaredParamNames = new Set(
    route.params.filter((param) => param.kind === "path").map((param) => param.name),
  );
  const schemaParamNames = new Set(
    route.inputSchemas.path ? getObjectFieldNames(route.inputSchemas.path) : [],
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

function groupRoutesByDomain(routes: readonly GeneratedClientRoute[]): DomainRoutes[] {
  const groups = new Map<string, GeneratedClientRoute[]>();

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
  const problemTypes = domainRoutes.routes.map(generateProblemTypes);
  const problemDeclarations = domainRoutes.routes.map(generateProblemDeclarations).join("\n");
  const formArtifacts = domainRoutes.routes
    .map(generateFormArtifacts)
    .filter((artifact) => artifact.length > 0);
  const types = [...inputTypes, ...outputTypes, ...problemTypes];
  const responseHelperImports = getResponseHelperImports({
    hasOutputRoutes: domainRoutes.routes.some((route) => route.outputSchema),
    hasNoOutputRoutes: domainRoutes.routes.some((route) => !route.outputSchema),
    hasFormRoutes: formArtifacts.length > 0,
    hasQueryKeyInputs: domainRoutes.routes.some(needsInput),
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
  const imports = options.reactQuery ? generateReactQueryImports(domainRoutes) : "";
  const hooks = options.reactQuery ? `\n${generateReactQueryHooks(domainRoutes, clientName)}` : "";
  const routeMetadata = generateContractRouteMetadata(domainRoutes);
  const queryKeys = generateQueryKeys(domainRoutes);
  const invalidationManifest = generateInvalidationManifest(domainRoutes);

  return `${imports}${responseHelperImports}${types.join("\n")}
${problemDeclarations}
${formArtifacts.join("\n")}
${routeMetadata}
${queryKeys}
${invalidationManifest}
${queryHelpers}${headerHelpers}
export const ${clientName} = {
${clientMethods}
};
${hooks}`;
}

function generateContractRouteMetadata(domainRoutes: DomainRoutes): string {
  const entries = domainRoutes.routes
    .map(
      (route) =>
        `  { routeId: ${literalValueToTypeScript(getRouteId(route))}, operationId: ${literalValueToTypeScript(getOperationId(route))}, methodName: ${literalValueToTypeScript(route.methodName)}, method: ${literalValueToTypeScript(route.httpMethod.toUpperCase())}, path: ${literalValueToTypeScript(route.path)} }`,
    )
    .join(",\n");

  return `export const ${domainRoutes.domain}ContractRoutes = [
${entries}
] as const;`;
}

function generateQueryKeys(domainRoutes: DomainRoutes): string {
  const keysName = getQueryKeysName(domainRoutes);
  const entries = domainRoutes.routes
    .map((route) => {
      const parameters = getQueryKeyFactoryParameters(route);
      const keyParts = [`...${keysName}.all()`, literalValueToTypeScript(route.methodName)];
      const inputExpression = getQueryKeyInputExpression(route);

      if (inputExpression) {
        keyParts.push(`serializeRpcQueryKeyInput(${inputExpression})`);
      }

      if (hasReactQueryCacheScope(route)) {
        keyParts.push("serializeRpcQueryKeyInput(cacheScope)");
      }

      return `  ${getQueryKeyFactoryProperty(route)}: (${parameters}) => [${keyParts.join(", ")}] as const,`;
    })
    .join("\n");

  return `export const ${keysName} = {
  all: () => [${literalValueToTypeScript(domainRoutes.domain)}] as const,
${entries}
};`;
}

function generateInvalidationManifest(domainRoutes: DomainRoutes): string {
  const mutationRoutes = domainRoutes.routes.filter(isMutationRoute);

  if (mutationRoutes.length === 0) {
    return "";
  }

  const keysName = getQueryKeysName(domainRoutes);
  const entries = mutationRoutes
    .map(
      (route) =>
        `  ${route.methodName}: { route: ${domainRoutes.domain}ContractRoutes[${domainRoutes.routes.indexOf(route)}], invalidates: [${keysName}.all()] },`,
    )
    .join("\n");

  return `export const ${domainRoutes.domain}InvalidationManifest = {
${entries}
} as const;`;
}

function collectGeneratedRpcConsumerRoutes(
  files: readonly string[],
): ContractGraphObservedConsumerRoute[] {
  const routes: ContractGraphObservedConsumerRoute[] = [];
  const metadataPattern =
    /routeId: '([^']+)', operationId: '([^']+)', methodName: '([^']+)', method: '([^']+)', path: '([^']+)'/g;

  for (const file of files) {
    if (path.basename(file) === "rpc.ts" || path.basename(file) === "index.ts") {
      continue;
    }

    const content = fs.readFileSync(file, "utf-8");

    for (const match of content.matchAll(metadataPattern)) {
      const routeId = match[1];
      const operationId = match[2];
      const methodName = match[3];
      const method = match[4];
      const routePath = match[5];

      if (routeId && operationId && methodName && method && routePath) {
        routes.push(
          createGeneratedRpcConsumerRoute(content, {
            routeId,
            operationId,
            methodName,
            method,
            path: routePath,
          }),
        );
      }
    }
  }

  return routes;
}

function createGeneratedRpcConsumerRoute(
  content: string,
  route: {
    readonly routeId: string;
    readonly operationId: string;
    readonly methodName: string;
    readonly method: string;
    readonly path: string;
  },
): ContractGraphObservedConsumerRoute {
  const methodBlock = getGeneratedMethodBlock(content, route.methodName);
  const problemDeclarations = getProblemDeclarationsFingerprint(content, route.methodName);

  return {
    routeId: route.routeId,
    operationId: route.operationId,
    consumedFields: collectGeneratedRpcConsumedFields(),
    fieldFingerprints: {
      routeId: route.routeId,
      operationId: route.operationId,
      httpMethod: route.method,
      path: route.path,
      "request.body": methodBlock.includes("body: JSON.stringify(") ? "present" : "absent",
      "request.path": methodBlock.includes("input.path") ? "present" : "absent",
      "request.query": methodBlock.includes("serializeQueryParams(input.query)")
        ? "present"
        : "absent",
      "request.headers": methodBlock.includes("serializeHeaders(input.headers)")
        ? "present"
        : "absent",
      response: content.includes(
        `export type ${getGeneratedTypeName(route.methodName, "Output")} =`,
      )
        ? "present"
        : "absent",
      problems: problemDeclarations,
    },
  };
}

function collectGeneratedRpcConsumedFields(): ContractGraphConsumerRouteField[] {
  return [
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
  ];
}

function getGeneratedMethodBlock(content: string, methodName: string): string {
  const methodMarker = `  ${methodName}:`;
  const resultMarker = `  ${methodName}Result:`;
  const clientStart = content.search(/\nexport const [A-Za-z_$][A-Za-z0-9_$]*Client = \{\n/);
  const searchStart = clientStart === -1 ? 0 : clientStart;
  const methodStart = content.indexOf(methodMarker, searchStart);
  const resultStart = content.indexOf(resultMarker, methodStart);

  if (methodStart === -1 || resultStart === -1) {
    return "";
  }

  const nextRouteStart = content
    .slice(resultStart + resultMarker.length)
    .search(/\n  [A-Za-z_$][A-Za-z0-9_$]*:/);

  if (nextRouteStart === -1) {
    return content.slice(methodStart);
  }

  return content.slice(methodStart, resultStart + resultMarker.length + nextRouteStart);
}

function getProblemDeclarationsFingerprint(content: string, methodName: string): string {
  const declarationPattern = new RegExp(
    `export const ${escapeRegExp(methodName)}ProblemDeclarations = \\[([\\s\\S]*?)\\] as const`,
  );
  const declaration = content.match(declarationPattern)?.[1] ?? "";
  const problems = [...declaration.matchAll(/\{ ([^}]+) \}/g)].map((match) =>
    parseGeneratedProblemDeclaration(match[1] ?? ""),
  );

  return JSON.stringify(problems.sort(compareGeneratedProblems));
}

function parseGeneratedProblemDeclaration(declaration: string): {
  readonly code: string;
  readonly category: string;
  readonly status: number;
  readonly description?: string;
  readonly type?: string;
} {
  const fields = new Map<string, string | number>();
  const fieldPattern = /(\w+): ('(?:\\.|[^'\\])*'|\d+)/g;

  for (const match of declaration.matchAll(fieldPattern)) {
    const name = match[1];
    const rawValue = match[2];
    fields.set(name, parseGeneratedProblemValue(rawValue));
  }

  return {
    code: String(fields.get("code")),
    category: String(fields.get("category")),
    status: Number(fields.get("status")),
    ...(typeof fields.get("description") === "string"
      ? { description: String(fields.get("description")) }
      : {}),
    ...(typeof fields.get("type") === "string" ? { type: String(fields.get("type")) } : {}),
  };
}

function parseGeneratedProblemValue(value: string): string | number {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  }

  return value;
}

function compareGeneratedProblems(
  left: { readonly code: string; readonly category: string; readonly status: number },
  right: { readonly code: string; readonly category: string; readonly status: number },
): number {
  return (
    left.code.localeCompare(right.code) ||
    left.category.localeCompare(right.category) ||
    left.status - right.status
  );
}

function getGeneratedTypeName(methodName: string, suffix: string): string {
  return `${toPascalCase(methodName)}${suffix}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generateClientIndex(domainRoutes: readonly DomainRoutes[]): string {
  const clientExports = domainRoutes.map((domainRoute) => {
    const exports = [
      `${domainRoute.domain}Client`,
      `${domainRoute.domain}ContractRoutes`,
      getQueryKeysName(domainRoute),
      ...(domainRoute.routes.some(isMutationRoute)
        ? [`${domainRoute.domain}InvalidationManifest`]
        : []),
    ];

    return `export { ${exports.join(", ")} } from './${domainRoute.domain}';`;
  });
  const namespaceExports = domainRoutes.map(
    (domainRoute) => `export * as ${domainRoute.domain}Rpc from './${domainRoute.domain}';`,
  );

  return `export * from './rpc';
${[...clientExports, ...namespaceExports].join("\n")}
`;
}

function getResponseHelperImports(options: ResponseHelperOptions): string {
  const helpers: string[] = [];

  if (options.hasOutputRoutes) {
    helpers.push("handleJsonResponse");
    helpers.push("handleJsonResult");
  }

  if (options.hasNoOutputRoutes) {
    helpers.push("readOptionalJsonResponse");
    helpers.push("readOptionalJsonResult");
  }

  if (options.hasFormRoutes) {
    helpers.push("toRpcFormProblem");
  }

  if (options.hasQueryKeyInputs) {
    helpers.push("serializeRpcQueryKeyInput");
  }

  helpers.push("type RpcClientResult", "type RpcDeclaredProblem");

  if (options.hasFormRoutes) {
    helpers.push(
      "type RpcDomainProblem",
      "type RpcFormFieldProblem",
      "type RpcFormGlobalProblem",
      "type RpcFormModel",
    );
  }

  helpers.push("type RpcProblemDetailsFor");

  if (options.hasFormRoutes) {
    helpers.push("type RpcValidationProblem");
  }

  return helpers.length === 0 ? "" : `import { ${helpers.join(", ")} } from './rpc';\n`;
}

function generateRpcSupport(options: GenerateClientOptions = {}): string {
  if (options.problemRuntime === "frontend-problems") {
    return `export {
  ProblemClientError as RpcClientProblemError,
  ProblemResponseError as RpcClientResponseError,
  assertProblemExhaustive as assertExhaustiveProblem,
  handleJsonResponse,
  handleJsonResult,
  readOptionalJsonResponse,
  readOptionalJsonResult,
  toProblemFormProblem as toRpcFormProblem,
} from '@croco/frontend-problems';

export type {
  ProblemClientExternalFailure as RpcClientExternalFailure,
  ProblemClientFailure as RpcClientFailure,
  ProblemClientProblemFailure as RpcClientProblemFailure,
  ProblemClientResult as RpcClientResult,
  ProblemClientSuccess as RpcClientSuccess,
  ProblemDeclaration as RpcDeclaredProblem,
  ProblemDetails as RpcProblemDetails,
  ProblemDetailsFor as RpcProblemDetailsFor,
  ProblemDomainDeclaration as RpcDomainProblem,
  ProblemFormField as RpcFormField,
  ProblemFormFieldControl as RpcFormFieldControl,
  ProblemFormFieldErrors as RpcFormFieldErrors,
  ProblemFormFieldOption as RpcFormFieldOption,
  ProblemFormFieldProblem as RpcFormFieldProblem,
  ProblemFormFieldValueKind as RpcFormFieldValueKind,
  ProblemFormGlobalProblem as RpcFormGlobalProblem,
  ProblemFormModel as RpcFormModel,
  ProblemFormProblem as RpcFormProblem,
  ProblemValidationDeclaration as RpcValidationProblem,
} from '@croco/frontend-problems';
${generateRpcQueryKeySupport()}
`;
  }

  return `export type RpcProblemDetails<
  Code extends string = string,
  Status extends number = number,
> = {
  type: string;
  title: string;
  status: Status;
  code: Code;
  detail?: string;
  instance?: string;
} & Record<string, unknown>;

export type RpcDeclaredProblem<
  Code extends string = string,
  Category extends string = string,
  Status extends number = number,
> = {
  readonly code: Code;
  readonly category: Category;
  readonly status: Status;
  readonly description?: string;
  readonly type?: string;
};

export type RpcProblemDetailsFor<Problem extends RpcDeclaredProblem> =
  Problem extends RpcDeclaredProblem
    ? RpcProblemDetails<Problem['code'], Problem['status']>
    : never;

export type RpcClientSuccess<T> = {
  readonly ok: true;
  readonly data: T;
  readonly response: Response;
};

export type RpcClientProblemFailure<Problem extends RpcDeclaredProblem> =
  Problem extends RpcDeclaredProblem
    ? {
        readonly ok: false;
        readonly kind: 'problem';
        readonly code: Problem['code'];
        readonly category: Problem['category'];
        readonly status: Problem['status'];
        readonly problem: RpcProblemDetailsFor<Problem>;
        readonly declaration: Problem;
        readonly response: Response;
      }
    : never;

export type RpcClientExternalFailure = {
  readonly ok: false;
  readonly kind: 'external';
  readonly error: RpcClientResponseError | RpcClientProblemError;
  readonly response: Response;
  readonly body?: unknown;
};

export type RpcClientFailure<Problem extends RpcDeclaredProblem = never> =
  | ([Problem] extends [never] ? never : RpcClientProblemFailure<Problem>)
  | RpcClientExternalFailure;

export type RpcClientResult<T, Problem extends RpcDeclaredProblem = never> =
  | RpcClientSuccess<T>
  | RpcClientFailure<Problem>;

export type RpcQueryKeyValue =
  | string
  | number
  | boolean
  | null
  | readonly RpcQueryKeyValue[]
  | { readonly [key: string]: RpcQueryKeyValue };

export type RpcFormFieldControl =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'multi-select'
  | 'list';

export type RpcFormFieldValueKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'array';

export type RpcFormFieldOption = {
  readonly label: string;
  readonly value: string | number | boolean | null;
};

export type RpcFormField<Value = unknown> = {
  readonly name: string;
  readonly label: string;
  readonly control: RpcFormFieldControl;
  readonly valueKind: RpcFormFieldValueKind;
  readonly required: boolean;
  readonly initialValue: Value;
  readonly options?: readonly RpcFormFieldOption[];
};

export type RpcFormModel<
  Values extends Record<string, unknown>,
  FieldName extends keyof Values & string,
> = {
  readonly routeId: string;
  readonly operationId: string;
  readonly methodName: string;
  readonly method: string;
  readonly path: string;
  readonly fieldNames: readonly FieldName[];
  readonly fields: readonly RpcFormField<Values[FieldName]>[];
  readonly initialValues: Values;
};

export type RpcValidationProblem<Problem extends RpcDeclaredProblem> = Extract<
  Problem,
  { readonly category: 'ValidationError' }
>;

export type RpcDomainProblem<Problem extends RpcDeclaredProblem> = Exclude<
  Problem,
  RpcValidationProblem<Problem>
>;

export type RpcFormFieldErrors<FieldName extends string> = Partial<
  Record<FieldName, readonly string[]>
>;

export type RpcFormFieldProblem<
  FieldName extends string,
  Problem extends RpcDeclaredProblem,
> = [Problem] extends [never]
  ? never
  : Problem extends RpcDeclaredProblem
    ? {
        readonly kind: 'field-validation';
        readonly code: Problem['code'];
        readonly category: Problem['category'];
        readonly status: Problem['status'];
        readonly fields: RpcFormFieldErrors<FieldName>;
        readonly problem: RpcProblemDetailsFor<Problem>;
        readonly declaration: Problem;
        readonly response: Response;
      }
    : never;

export type RpcFormGlobalProblem<Problem extends RpcDeclaredProblem> = [Problem] extends [never]
  ? never
  : Problem extends RpcDeclaredProblem
    ? {
        readonly kind: 'global-problem';
        readonly code: Problem['code'];
        readonly category: Problem['category'];
        readonly status: Problem['status'];
        readonly problem: RpcProblemDetailsFor<Problem>;
        readonly declaration: Problem;
        readonly response: Response;
      }
    : never;

export type RpcFormProblem<
  FieldName extends string,
  Problem extends RpcDeclaredProblem,
> =
  | RpcFormFieldProblem<FieldName, RpcValidationProblem<Problem>>
  | RpcFormGlobalProblem<RpcDomainProblem<Problem>>;

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

export async function handleJsonResponse<T = unknown>(response: Response): Promise<T> {
  if (!response.ok) {
    return rejectErrorResponse(response);
  }

  return response.json() as Promise<T>;
}

export async function handleJsonResult<
  T = unknown,
  Problem extends RpcDeclaredProblem = never,
>(
  response: Response,
  declaredProblems: readonly Problem[] = [],
): Promise<RpcClientResult<T, Problem>> {
  if (!response.ok) {
    return readErrorResult(response, declaredProblems);
  }

  return { ok: true, data: (await response.json()) as T, response };
}

export async function readOptionalJsonResponse(response: Response): Promise<unknown | undefined> {
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

export async function readOptionalJsonResult<Problem extends RpcDeclaredProblem = never>(
  response: Response,
  declaredProblems: readonly Problem[] = [],
): Promise<RpcClientResult<unknown | undefined, Problem>> {
  if (!response.ok) {
    return readErrorResult(response, declaredProblems);
  }

  if (response.status === 204) {
    return { ok: true, data: undefined, response };
  }

  const body = await response.text();

  if (body.length === 0) {
    return { ok: true, data: undefined, response };
  }

  return { ok: true, data: JSON.parse(body) as unknown, response };
}

export function assertExhaustiveProblem(problem: never): never {
  const value = problem as { readonly code?: unknown } | undefined;
  const suffix = typeof value?.code === 'string' ? \`: \${value.code}\` : '';

  throw new Error(\`Unhandled RPC Problem variant\${suffix}\`);
}

export function serializeRpcQueryKeyInput(value: unknown): RpcQueryKeyValue {
  return serializeRpcQueryKeyValue(value, 'input') ?? null;
}

function serializeRpcQueryKeyValue(value: unknown, path: string): RpcQueryKeyValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return value;
    }

    throw new Error(\`RPC query key input only supports finite numbers; unsupported value at \${path}.\`);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const result = serializeRpcQueryKeyValue(item, \`\${path}[\${index}]\`);

      return result === undefined ? [] : [result];
    });
  }

  if (isRpcQueryKeyRecord(value)) {
    const serialized: Record<string, RpcQueryKeyValue> = {};

    for (const [key, item] of Object.entries(value).sort(compareRpcQueryKeyRecordEntries)) {
      const result = serializeRpcQueryKeyValue(item, \`\${path}.\${key}\`);

      if (result !== undefined) {
        serialized[key] = result;
      }
    }

    return serialized;
  }

  throw new Error(
    \`RPC query key input only supports JSON-safe primitives, arrays, and plain objects; unsupported value at \${path}.\`,
  );
}

function isRpcQueryKeyRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null ||
    Object.hasOwn(prototype, 'isPrototypeOf')
  );
}

function compareRpcQueryKeyRecordEntries(
  [left]: [string, unknown],
  [right]: [string, unknown],
): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

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

async function readErrorResult<Problem extends RpcDeclaredProblem>(
  response: Response,
  declaredProblems: readonly Problem[],
): Promise<RpcClientFailure<Problem>> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      kind: 'external',
      error: new RpcClientResponseError(response),
      response,
    };
  }

  if (isRpcProblemDetails(body)) {
    const declaration = findDeclaredProblem(body, declaredProblems);

    if (declaration) {
      return {
        ok: false,
        kind: 'problem',
        code: declaration.code,
        category: declaration.category,
        status: declaration.status,
        problem: body as RpcProblemDetailsFor<Problem>,
        declaration,
        response,
      } as RpcClientFailure<Problem>;
    }

    return {
      ok: false,
      kind: 'external',
      error: new RpcClientProblemError(body, response),
      response,
      body,
    };
  }

  return {
    ok: false,
    kind: 'external',
    error: new RpcClientResponseError(response, body),
    response,
    body,
  };
}

export function toRpcFormProblem<
  FieldName extends string,
  Problem extends RpcDeclaredProblem,
>(
  failure: RpcClientProblemFailure<Problem>,
  fieldNames: readonly FieldName[],
): RpcFormProblem<FieldName, Problem> {
  if (failure.category === 'ValidationError') {
    return {
      kind: 'field-validation',
      code: failure.code,
      category: failure.category,
      status: failure.status,
      fields: extractRpcFormFieldErrors(failure.problem, fieldNames),
      problem: failure.problem,
      declaration: failure.declaration,
      response: failure.response,
    } as RpcFormProblem<FieldName, Problem>;
  }

  return {
    kind: 'global-problem',
    code: failure.code,
    category: failure.category,
    status: failure.status,
    problem: failure.problem,
    declaration: failure.declaration,
    response: failure.response,
  } as RpcFormProblem<FieldName, Problem>;
}

function extractRpcFormFieldErrors<FieldName extends string>(
  problem: RpcProblemDetails,
  fieldNames: readonly FieldName[],
): RpcFormFieldErrors<FieldName> {
  const source = getRpcFormFieldErrorSource(problem);
  const errors: Partial<Record<FieldName, readonly string[]>> = {};

  if (!source) {
    return errors;
  }

  for (const fieldName of fieldNames) {
    const value = source[fieldName];

    if (typeof value === 'string') {
      errors[fieldName] = [value];
      continue;
    }

    if (Array.isArray(value)) {
      const messages = value.filter((item): item is string => typeof item === 'string');

      if (messages.length > 0) {
        errors[fieldName] = messages;
      }
    }
  }

  return errors;
}

function getRpcFormFieldErrorSource(problem: RpcProblemDetails): Record<string, unknown> | undefined {
  if (isRecord(problem.fields)) {
    return problem.fields;
  }

  if (isRecord(problem.fieldErrors)) {
    return problem.fieldErrors;
  }

  return undefined;
}

function findDeclaredProblem<Problem extends RpcDeclaredProblem>(
  problem: RpcProblemDetails,
  declaredProblems: readonly Problem[],
): Problem | undefined {
  return declaredProblems.find(
    (declaration) => declaration.code === problem.code && declaration.status === problem.status,
  );
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

function generateRpcQueryKeySupport(): string {
  return `export type RpcQueryKeyValue =
  | string
  | number
  | boolean
  | null
  | readonly RpcQueryKeyValue[]
  | { readonly [key: string]: RpcQueryKeyValue };

export function serializeRpcQueryKeyInput(value: unknown): RpcQueryKeyValue {
  return serializeRpcQueryKeyValue(value, 'input') ?? null;
}

function serializeRpcQueryKeyValue(value: unknown, path: string): RpcQueryKeyValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return value;
    }

    throw new Error(\`RPC query key input only supports finite numbers; unsupported value at \${path}.\`);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const result = serializeRpcQueryKeyValue(item, \`\${path}[\${index}]\`);

      return result === undefined ? [] : [result];
    });
  }

  if (isRpcQueryKeyRecord(value)) {
    const serialized: Record<string, RpcQueryKeyValue> = {};

    for (const [key, item] of Object.entries(value).sort(compareRpcQueryKeyRecordEntries)) {
      const result = serializeRpcQueryKeyValue(item, \`\${path}.\${key}\`);

      if (result !== undefined) {
        serialized[key] = result;
      }
    }

    return serialized;
  }

  throw new Error(
    \`RPC query key input only supports JSON-safe primitives, arrays, and plain objects; unsupported value at \${path}.\`,
  );
}

function isRpcQueryKeyRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null ||
    Object.hasOwn(prototype, 'isPrototypeOf')
  );
}

function compareRpcQueryKeyRecordEntries(
  [left]: [string, unknown],
  [right]: [string, unknown],
): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
`;
}

function generateInputType(route: GeneratedClientRoute): string {
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

function generateOutputType(route: GeneratedClientRoute): string {
  if (!route.outputSchema) {
    return "";
  }

  return `export type ${getOutputTypeName(route)} = ${zodTypeToTypeScript(route.outputSchema)};`;
}

function generateProblemTypes(route: GeneratedClientRoute): string {
  const problemResponses = route.problemResponses ?? [];
  const problemUnion =
    problemResponses.length === 0
      ? "never"
      : unionTypes(
          problemResponses.map(
            (problem) =>
              `RpcDeclaredProblem<${literalValueToTypeScript(problem.code)}, ${literalValueToTypeScript(problem.category)}, ${problem.status}>`,
          ),
        );

  return `export type ${getProblemTypeName(route)} = ${problemUnion};
export type ${getProblemDetailsTypeName(route)} = RpcProblemDetailsFor<${getProblemTypeName(route)}>;
export type ${getResultTypeName(route)} = RpcClientResult<${getSuccessType(route)}, ${getProblemTypeName(route)}>;`;
}

function generateProblemDeclarations(route: GeneratedClientRoute): string {
  const declarations = (route.problemResponses ?? [])
    .map((problem) => {
      const fields = [
        `code: ${literalValueToTypeScript(problem.code)}`,
        `category: ${literalValueToTypeScript(problem.category)}`,
        `status: ${problem.status}`,
      ];

      if (problem.description) {
        fields.push(`description: ${literalValueToTypeScript(problem.description)}`);
      }

      if (problem.type) {
        fields.push(`type: ${literalValueToTypeScript(problem.type)}`);
      }

      return `  { ${fields.join(", ")} }`;
    })
    .join(",\n");

  return `export const ${getProblemDeclarationsName(route)} = [
${declarations}
] as const satisfies readonly RpcDeclaredProblem[];`;
}

function generateFormArtifacts(route: GeneratedClientRoute): string {
  const bodySchema = getFormBodyObjectSchema(route);

  if (!bodySchema) {
    return "";
  }

  const fields = Object.entries(getZodObjectShape(bodySchema)).map(([name, schema]) =>
    generateFormField(route, name, schema),
  );
  const fieldNameType = unionTypes(fields.map((field) => literalValueToTypeScript(field.name)));
  const valueFields = fields.map((field) => `${formatObjectKey(field.name)}: ${field.valueType};`);
  const fieldEntries = fields.map(
    (field) =>
      `{ name: ${literalValueToTypeScript(field.name)}, label: ${literalValueToTypeScript(field.label)}, control: ${literalValueToTypeScript(field.control)}, valueKind: ${literalValueToTypeScript(field.valueKind)}, required: ${field.required}, initialValue: ${field.initialValueExpression}${formatFormFieldOptions(field.options)} }`,
  );
  const fieldNames = fields.map((field) => literalValueToTypeScript(field.name)).join(", ");
  const initialValues = fields
    .map((field) => `${formatObjectKey(field.name)}: ${field.initialValueExpression}`)
    .join(", ");
  const submitFields = fields
    .map((field) => `${formatObjectKey(field.name)}: ${field.payloadValueExpression}`)
    .join(", ");
  const inputTypeName = getInputTypeName(route);
  const formValuesTypeName = getFormValuesTypeName(route);
  const submitPayloadTypeName = getSubmitPayloadTypeName(route);
  const validationProblemTypeName = getValidationProblemTypeName(route);
  const domainProblemTypeName = getDomainProblemTypeName(route);
  const formProblemTypeName = getFormProblemTypeName(route);
  const formModelName = getFormModelName(route);
  const buildPayloadName = getBuildFormPayloadName(route);
  const mapProblemName = getMapFormProblemName(route);
  const buildPayloadParameters = hasLegacyBodyInput(route)
    ? `values: ${formValuesTypeName}`
    : `context: Omit<${inputTypeName}, 'body'>, values: ${formValuesTypeName}`;
  const payloadExpression = hasLegacyBodyInput(route)
    ? `{ ${submitFields} }`
    : `{ ...context, body: { ${submitFields} } }`;

  return `export type ${getFormFieldNameTypeName(route)} = ${fieldNameType};
export type ${formValuesTypeName} = { ${valueFields.join(" ")} };
export type ${submitPayloadTypeName} = ${inputTypeName};
export type ${validationProblemTypeName} = RpcValidationProblem<${getProblemTypeName(route)}>;
export type ${domainProblemTypeName} = RpcDomainProblem<${getProblemTypeName(route)}>;
export type ${formProblemTypeName} = RpcFormFieldProblem<${getFormFieldNameTypeName(route)}, ${validationProblemTypeName}> | RpcFormGlobalProblem<${domainProblemTypeName}>;

export const ${formModelName} = {
  routeId: ${literalValueToTypeScript(getRouteId(route))},
  operationId: ${literalValueToTypeScript(getOperationId(route))},
  methodName: ${literalValueToTypeScript(route.methodName)},
  method: ${literalValueToTypeScript(route.httpMethod.toUpperCase())},
  path: ${literalValueToTypeScript(route.path)},
  fieldNames: [${fieldNames}],
  fields: [
    ${fieldEntries.join(",\n    ")}
  ],
  initialValues: { ${initialValues} },
} as const satisfies RpcFormModel<${formValuesTypeName}, ${getFormFieldNameTypeName(route)}>;

export function ${buildPayloadName}(${buildPayloadParameters}): ${submitPayloadTypeName} {
  return ${payloadExpression};
}

export function ${mapProblemName}(failure: Extract<${getResultTypeName(route)}, { ok: false; kind: 'problem' }>): ${formProblemTypeName} {
  return toRpcFormProblem<${getFormFieldNameTypeName(route)}, ${getProblemTypeName(route)}>(failure, ${formModelName}.fieldNames);
}`;
}

function getFormBodyObjectSchema(route: GeneratedClientRoute): unknown | undefined {
  if (!route.inputSchemas.body) {
    return undefined;
  }

  const analysis = analyzeFormFieldSchema(route.inputSchemas.body);
  const schemaName = getSchemaName(analysis.schema);

  if (schemaName !== "ZodObject") {
    throw new RpcCodegenUnsupportedFormSchemaProblem(
      route,
      `body uses unsupported form schema ${schemaName || "unknown schema"}.`,
    );
  }

  const unsupportedObjectMode = getUnsupportedFormBodyObjectMode(analysis.schema);

  if (unsupportedObjectMode) {
    throw new RpcCodegenUnsupportedFormSchemaProblem(
      route,
      `body object accepts unsupported ${unsupportedObjectMode} keys; generated form fields must cover every accepted body key.`,
    );
  }

  return analysis.schema;
}

function getUnsupportedFormBodyObjectMode(schema: unknown): string | undefined {
  return getZodObjectUnsupportedDynamicKeyMode(schema);
}

function generateFormField(
  route: GeneratedClientRoute,
  name: string,
  schema: unknown,
): GeneratedFormField {
  const analysis = analyzeFormFieldSchema(schema);
  const schemaName = getSchemaName(analysis.schema);
  const required = !analysis.optional && !analysis.nullable && analysis.defaultValue === undefined;
  const baseValueType = getFormFieldBaseValueType(route, name, analysis.schema);
  const valueType =
    analysis.optional || analysis.nullable ? `${baseValueType} | null` : baseValueType;
  const initialValueExpression = getFormFieldInitialValueExpression(route, name, analysis);
  const payloadValueExpression =
    analysis.optional && !analysis.nullable
      ? `${getFormValuesAccessor(name)} === null ? undefined : ${getFormValuesAccessor(name)}`
      : getFormValuesAccessor(name);

  if (schemaName === "ZodString") {
    return {
      name,
      label: toFormLabel(name),
      control: "text",
      valueKind: "string",
      required,
      valueType,
      initialValueExpression,
      payloadValueExpression,
      options: [],
    };
  }

  if (schemaName === "ZodNumber") {
    return {
      name,
      label: toFormLabel(name),
      control: "number",
      valueKind: "number",
      required,
      valueType,
      initialValueExpression,
      payloadValueExpression,
      options: [],
    };
  }

  if (schemaName === "ZodBoolean") {
    return {
      name,
      label: toFormLabel(name),
      control: "checkbox",
      valueKind: "boolean",
      required,
      valueType,
      initialValueExpression,
      payloadValueExpression,
      options: [],
    };
  }

  const options = getFormFieldOptions(analysis.schema);

  if (options.length > 0) {
    return {
      name,
      label: toFormLabel(name),
      control: "select",
      valueKind: "enum",
      required,
      valueType,
      initialValueExpression,
      payloadValueExpression,
      options,
    };
  }

  if (schemaName === "ZodArray") {
    const elementAnalysis = analyzeFormFieldSchema(getZodArrayElementSchema(analysis.schema));
    const elementSchemaName = getSchemaName(elementAnalysis.schema);
    const elementOptions = getFormFieldOptions(elementAnalysis.schema);

    if (
      elementSchemaName !== "ZodString" &&
      elementSchemaName !== "ZodNumber" &&
      elementSchemaName !== "ZodBoolean" &&
      elementOptions.length === 0
    ) {
      throw new RpcCodegenUnsupportedFormSchemaProblem(
        route,
        `field '${name}' uses unsupported array element schema ${elementSchemaName || "unknown schema"}.`,
      );
    }

    return {
      name,
      label: toFormLabel(name),
      control: elementOptions.length > 0 ? "multi-select" : "list",
      valueKind: "array",
      required,
      valueType,
      initialValueExpression,
      payloadValueExpression,
      options: elementOptions,
    };
  }

  throw new RpcCodegenUnsupportedFormSchemaProblem(
    route,
    `field '${name}' uses unsupported form field schema ${schemaName || "unknown schema"}.`,
  );
}

function analyzeFormFieldSchema(schema: unknown): FormFieldSchemaAnalysis {
  let current = schema;
  let optional = false;
  let nullable = false;
  let defaultValue: unknown;

  while (true) {
    const schemaName = getSchemaName(current);

    if (schemaName === "ZodOptional") {
      optional = true;
      current = getZodInnerSchema(current);
      continue;
    }

    if (schemaName === "ZodNullable") {
      nullable = true;
      current = getZodInnerSchema(current);
      continue;
    }

    if (schemaName === "ZodDefault") {
      optional = true;
      defaultValue = getZodDefaultValue(current);
      current = getZodInnerSchema(current);
      continue;
    }

    if (schemaName === "ZodBranded" || schemaName === "ZodReadonly") {
      current = getZodInnerSchema(current);
      continue;
    }

    return {
      schema: current,
      optional,
      nullable,
      ...(defaultValue !== undefined ? { defaultValue } : {}),
    };
  }
}

function getFormFieldBaseValueType(
  route: GeneratedClientRoute,
  name: string,
  schema: unknown,
): string {
  try {
    return zodTypeToTypeScript(schema);
  } catch (error) {
    if (error instanceof RpcCodegenContractProblem) {
      throw new RpcCodegenUnsupportedFormSchemaProblem(
        route,
        `field '${name}' uses unsupported form field schema ${getSchemaName(schema) || "unknown schema"}.`,
      );
    }

    throw error;
  }
}

function getFormFieldInitialValueExpression(
  route: GeneratedClientRoute,
  name: string,
  analysis: FormFieldSchemaAnalysis,
): string {
  if (analysis.defaultValue !== undefined) {
    return formLiteralValueToTypeScript(route, name, analysis.defaultValue);
  }

  if (analysis.optional || analysis.nullable) {
    return "null";
  }

  const schemaName = getSchemaName(analysis.schema);

  if (schemaName === "ZodString") {
    return "''";
  }

  if (schemaName === "ZodNumber") {
    return "0";
  }

  if (schemaName === "ZodBoolean") {
    return "false";
  }

  const options = getFormFieldOptions(analysis.schema);

  if (options.length > 0) {
    return formLiteralValueToTypeScript(route, name, options[0]?.value);
  }

  if (schemaName === "ZodArray") {
    return "[]";
  }

  throw new RpcCodegenUnsupportedFormSchemaProblem(
    route,
    `field '${name}' uses unsupported form field schema ${schemaName || "unknown schema"}.`,
  );
}

function getFormFieldOptions(schema: unknown): FormFieldOption[] {
  const descriptor = describeZodSchema(schema as never);

  if (!descriptor?.jsonSafe) {
    return [];
  }

  if (descriptor.kind === "enum") {
    return (descriptor.values ?? []).map(toFormFieldOption);
  }

  if (descriptor.kind === "literal") {
    const value = descriptor.value;

    return isLiteralTypeValue(value) ? [toFormFieldOption(value)] : [];
  }

  if (descriptor.kind === "union") {
    const literalValues = (descriptor.options ?? []).map(getLiteralFormOptionValue);

    return literalValues.every(isLiteralTypeValue) ? literalValues.map(toFormFieldOption) : [];
  }

  return [];
}

function getLiteralFormOptionValue(descriptor: ContractSchemaDescriptor): unknown {
  return descriptor.kind === "literal" ? descriptor.value : undefined;
}

function toFormFieldOption(value: string | number | boolean | null): FormFieldOption {
  return {
    label: String(value),
    value,
  };
}

function isLiteralTypeValue(value: unknown): value is string | number | boolean | null {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    value === null ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function formatFormFieldOptions(options: readonly FormFieldOption[]): string {
  if (options.length === 0) {
    return "";
  }

  const entries = options
    .map(
      (option) =>
        `{ label: ${literalValueToTypeScript(option.label)}, value: ${literalValueToTypeScript(option.value)} }`,
    )
    .join(", ");

  return `, options: [${entries}]`;
}

function formLiteralValueToTypeScript(
  route: GeneratedClientRoute,
  name: string,
  value: unknown,
): string {
  if (isLiteralTypeValue(value)) {
    return literalValueToTypeScript(value);
  }

  if (Array.isArray(value) && value.every(isLiteralTypeValue)) {
    return `[${value.map(literalValueToTypeScript).join(", ")}]`;
  }

  throw new RpcCodegenUnsupportedFormSchemaProblem(
    route,
    `field '${name}' has a non-JSON-safe default value.`,
  );
}

function getFormValuesAccessor(name: string): string {
  return isJavaScriptIdentifier(name) ? `values.${name}` : `values[${formatObjectKey(name)}]`;
}

function toFormLabel(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  if (spaced.length === 0) {
    return name;
  }

  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

function generateClientMethod(route: GeneratedClientRoute): string {
  const input = needsInput(route)
    ? `input${hasRequiredInput(route) ? "" : "?"}: ${getInputTypeName(route)}`
    : "";
  const fetchOptions = getFetchOptions(route);
  const response = getResponseExpression(route);
  const resultResponse = getResultResponseExpression(route);
  const returnType = getReturnType(route);
  const resultReturnType = getResultReturnType(route);

  if (hasStructuredInput(route)) {
    return `  ${route.methodName}: (${input}): ${returnType} => {
    const path = ${getPathExpression(route)};
${getQueryStatements(route)}    return fetch(${getUrlExpression(route)}, ${fetchOptions}).then((response) => ${response});
  },
  ${getResultMethodName(route)}: (${input}): ${resultReturnType} => {
    const path = ${getPathExpression(route)};
${getQueryStatements(route)}    return fetch(${getUrlExpression(route)}, ${fetchOptions}).then((response) => ${resultResponse});
  },`;
  }

  return `  ${route.methodName}: (${input}): ${returnType} => fetch(${getPathExpression(route)}, ${fetchOptions}).then((response) => ${response}),
  ${getResultMethodName(route)}: (${input}): ${resultReturnType} => fetch(${getPathExpression(route)}, ${fetchOptions}).then((response) => ${resultResponse}),`;
}

function getFetchOptions(route: GeneratedClientRoute): string {
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

function getHeadersExpression(route: GeneratedClientRoute): string {
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

function getResponseExpression(route: GeneratedClientRoute): string {
  if (!route.outputSchema) {
    return "readOptionalJsonResponse(response)";
  }

  return `handleJsonResponse<${getOutputTypeName(route)}>(response)`;
}

function getResultResponseExpression(route: GeneratedClientRoute): string {
  const problemDeclarations = getProblemDeclarationsName(route);
  const problemType = getProblemTypeName(route);

  if (!route.outputSchema) {
    return `readOptionalJsonResult<${problemType}>(response, ${problemDeclarations})`;
  }

  return `handleJsonResult<${getOutputTypeName(route)}, ${problemType}>(response, ${problemDeclarations})`;
}

function getReturnType(route: GeneratedClientRoute): string {
  if (!route.outputSchema) {
    return "Promise<unknown | undefined>";
  }

  return `Promise<${getOutputTypeName(route)}>`;
}

function getResultReturnType(route: GeneratedClientRoute): string {
  return `Promise<${getResultTypeName(route)}>`;
}

function getSuccessType(route: GeneratedClientRoute): string {
  if (!route.outputSchema) {
    return "unknown | undefined";
  }

  return getOutputTypeName(route);
}

function generateReactQueryImports(domainRoutes: DomainRoutes): string {
  const hasQueryRoutes = domainRoutes.routes.some(isReactQueryQueryRoute);
  const hasMutationRoutes = domainRoutes.routes.some((route) => !isReactQueryQueryRoute(route));
  const valueImports = [
    ...(hasMutationRoutes ? ["useMutation"] : []),
    ...(hasQueryRoutes ? ["useQuery"] : []),
  ];
  const typeImports = [
    ...(hasMutationRoutes ? ["UseMutationOptions"] : []),
    ...(hasQueryRoutes ? ["UseQueryOptions"] : []),
  ];
  const imports = [
    ...(valueImports.length > 0
      ? [`import { ${valueImports.join(", ")} } from '@tanstack/react-query';`]
      : []),
    ...(typeImports.length > 0
      ? [`import type { ${typeImports.join(", ")} } from '@tanstack/react-query';`]
      : []),
  ];

  return `${imports.join("\n")}\n`;
}

function generateReactQueryHooks(domainRoutes: DomainRoutes, clientName: string): string {
  const queries = domainRoutes.routes.filter(isReactQueryQueryRoute);
  const mutations = domainRoutes.routes.filter((route) => !isReactQueryQueryRoute(route));
  const typeArtifacts = domainRoutes.routes.map(generateReactQueryTypeArtifacts).join("\n");
  const queryFactories = generateReactQueryFactories(domainRoutes.domain, queries, clientName);
  const mutationFactories = generateReactMutationFactories(
    domainRoutes.domain,
    mutations,
    clientName,
  );
  const hooks = domainRoutes.routes.map((route) => generateReactQueryHook(route)).join("\n");

  return [typeArtifacts, queryFactories, mutationFactories, hooks]
    .filter((artifact) => artifact.length > 0)
    .join("\n");
}

function generateReactQueryTypeArtifacts(route: GeneratedClientRoute): string {
  if (isReactQueryQueryRoute(route)) {
    return `export type ${getQueryKeyTypeName(route)} = ${getReactQueryKeyType(route, false)};
export type ${getResultQueryKeyTypeName(route)} = ${getReactQueryKeyType(route, true)};
export type ${getQueryFactoryTypeName(route)} = {
  readonly queryKey: ${getQueryKeyTypeName(route)};
  readonly queryFn: () => Promise<${getSuccessType(route)}>;
};
export type ${getResultQueryFactoryTypeName(route)} = {
  readonly queryKey: ${getResultQueryKeyTypeName(route)};
  readonly queryFn: () => Promise<${getResultTypeName(route)}>;
};
export type ${getQueryOptionsTypeName(route)}<TData = ${getSuccessType(route)}> = Omit<UseQueryOptions<${getSuccessType(route)}, Error, TData, ${getQueryKeyTypeName(route)}>, 'queryKey' | 'queryFn'>${getReactQueryCacheScopeOptionsType(route)};
export type ${getResultQueryOptionsTypeName(route)}<TData = ${getResultTypeName(route)}> = Omit<UseQueryOptions<${getResultTypeName(route)}, Error, TData, ${getResultQueryKeyTypeName(route)}>, 'queryKey' | 'queryFn'>${getReactQueryCacheScopeOptionsType(route)};`;
  }

  return `export type ${getMutationVariablesTypeName(route)} = ${getMutationVariablesType(route)};
export type ${getMutationFactoryTypeName(route)} = {
  readonly mutationFn: ${getMutationFnType(route, getSuccessType(route))};
};
export type ${getResultMutationFactoryTypeName(route)} = {
  readonly mutationFn: ${getMutationFnType(route, getResultTypeName(route))};
};
export type ${getMutationOptionsTypeName(route)}<TContext = unknown> = Omit<UseMutationOptions<${getSuccessType(route)}, Error, ${getMutationVariablesTypeName(route)}, TContext>, 'mutationFn'>;
export type ${getResultMutationOptionsTypeName(route)}<TContext = unknown> = Omit<UseMutationOptions<${getResultTypeName(route)}, Error, ${getMutationVariablesTypeName(route)}, TContext>, 'mutationFn'>;`;
}

function generateReactQueryFactories(
  domain: string,
  routes: readonly GeneratedClientRoute[],
  clientName: string,
): string {
  if (routes.length === 0) {
    return "";
  }

  const entries = routes.map((route) => generateReactQueryFactoryEntry(domain, route, clientName));

  return `export const ${domain}Queries = {
${entries.join("\n")}
};`;
}

function generateReactQueryFactoryEntry(
  domain: string,
  route: GeneratedClientRoute,
  clientName: string,
): string {
  const input = getReactQueryFactoryParameters(route);
  const callInput = needsInput(route) ? "input" : "";
  const queryKey = getReactQueryKeyExpression(domain, route, false);
  const resultQueryKey = getReactQueryKeyExpression(domain, route, true);

  return `  ${route.methodName}: (${input}): ${getQueryFactoryTypeName(route)} => ({
    queryKey: ${queryKey},
    queryFn: () => ${clientName}.${route.methodName}(${callInput}),
  }),
  ${getResultMethodName(route)}: (${input}): ${getResultQueryFactoryTypeName(route)} => ({
    queryKey: ${resultQueryKey},
    queryFn: () => ${clientName}.${getResultMethodName(route)}(${callInput}),
  }),`;
}

function generateReactMutationFactories(
  domain: string,
  routes: readonly GeneratedClientRoute[],
  clientName: string,
): string {
  if (routes.length === 0) {
    return "";
  }

  const entries = routes.map((route) => generateReactMutationFactoryEntry(route, clientName));

  return `export const ${domain}Mutations = {
${entries.join("\n")}
};`;
}

function generateReactMutationFactoryEntry(
  route: GeneratedClientRoute,
  clientName: string,
): string {
  const input = getMutationFnParameter(route);
  const callInput = needsInput(route) ? "input" : "";

  return `  ${route.methodName}: (): ${getMutationFactoryTypeName(route)} => ({
    mutationFn: (${input}) => ${clientName}.${route.methodName}(${callInput}),
  }),
  ${getResultMethodName(route)}: (): ${getResultMutationFactoryTypeName(route)} => ({
    mutationFn: (${input}) => ${clientName}.${getResultMethodName(route)}(${callInput}),
  }),`;
}

function generateReactQueryHook(route: GeneratedClientRoute): string {
  const hookName = `use${toPascalCase(route.methodName)}`;
  const resultHookName = `use${toPascalCase(getResultMethodName(route))}`;

  if (!isReactQueryQueryRoute(route)) {
    return `export function ${hookName}<TContext = unknown>(options?: ${getMutationOptionsTypeName(route)}<TContext>) {
  return useMutation<${getSuccessType(route)}, Error, ${getMutationVariablesTypeName(route)}, TContext>({ ...${getDomainName(route)}Mutations.${route.methodName}(), ...options });
}

export function ${resultHookName}<TContext = unknown>(options?: ${getResultMutationOptionsTypeName(route)}<TContext>) {
  return useMutation<${getResultTypeName(route)}, Error, ${getMutationVariablesTypeName(route)}, TContext>({ ...${getDomainName(route)}Mutations.${getResultMethodName(route)}(), ...options });
}`;
  }

  const input = getInputParameter(route);
  const callInput = needsInput(route) ? "input" : "";
  const factoryCallArguments = getReactQueryFactoryCallArguments(route);

  if (hasReactQueryCacheScope(route)) {
    return `export function ${hookName}<TData = ${getSuccessType(route)}>(${input}, options?: ${getQueryOptionsTypeName(route)}<TData>) {
  const { cacheScope, ...queryOptions } = options ?? {};

  return useQuery<${getSuccessType(route)}, Error, TData, ${getQueryKeyTypeName(route)}>({ ...${getDomainName(route)}Queries.${route.methodName}(${factoryCallArguments}), ...queryOptions });
}

export function ${resultHookName}<TData = ${getResultTypeName(route)}>(${input}, options?: ${getResultQueryOptionsTypeName(route)}<TData>) {
  const { cacheScope, ...queryOptions } = options ?? {};

  return useQuery<${getResultTypeName(route)}, Error, TData, ${getResultQueryKeyTypeName(route)}>({ ...${getDomainName(route)}Queries.${getResultMethodName(route)}(${factoryCallArguments}), ...queryOptions });
}`;
  }

  return `export function ${hookName}<TData = ${getSuccessType(route)}>(${input}${needsInput(route) ? ", " : ""}options?: ${getQueryOptionsTypeName(route)}<TData>) {
  return useQuery<${getSuccessType(route)}, Error, TData, ${getQueryKeyTypeName(route)}>({ ...${getDomainName(route)}Queries.${route.methodName}(${callInput}), ...options });
}

export function ${resultHookName}<TData = ${getResultTypeName(route)}>(${input}${needsInput(route) ? ", " : ""}options?: ${getResultQueryOptionsTypeName(route)}<TData>) {
  return useQuery<${getResultTypeName(route)}, Error, TData, ${getResultQueryKeyTypeName(route)}>({ ...${getDomainName(route)}Queries.${getResultMethodName(route)}(${callInput}), ...options });
}`;
}

function isReactQueryQueryRoute(route: GeneratedClientRoute): boolean {
  return route.httpMethod.toUpperCase() === "GET";
}

function getInputParameter(route: GeneratedClientRoute): string {
  if (!needsInput(route)) {
    return "";
  }

  return `input${hasRequiredInput(route) ? "" : "?"}: ${getInputTypeName(route)}`;
}

function getMutationFnParameter(route: GeneratedClientRoute): string {
  if (!needsInput(route)) {
    return "";
  }

  return `input${hasRequiredInput(route) ? "" : "?"}: ${getInputTypeName(route)}`;
}

function getMutationFnType(route: GeneratedClientRoute, returnType: string): string {
  if (!needsInput(route)) {
    return `() => Promise<${returnType}>`;
  }

  return `(input${hasRequiredInput(route) ? "" : "?"}: ${getInputTypeName(route)}) => Promise<${returnType}>`;
}

function getMutationVariablesType(route: GeneratedClientRoute): string {
  if (!needsInput(route)) {
    return "void";
  }

  return hasRequiredInput(route)
    ? getInputTypeName(route)
    : `${getInputTypeName(route)} | undefined`;
}

function getReactQueryFactoryParameters(route: GeneratedClientRoute): string {
  const parameters = [
    ...(needsInput(route) ? [getInputParameter(route)] : []),
    ...(hasReactQueryCacheScope(route) ? ["cacheScope?: unknown"] : []),
  ];

  return parameters.join(", ");
}

function getReactQueryFactoryCallArguments(route: GeneratedClientRoute): string {
  const parameters = [
    ...(needsInput(route) ? ["input"] : []),
    ...(hasReactQueryCacheScope(route) ? ["cacheScope"] : []),
  ];

  return parameters.join(", ");
}

function getReactQueryCacheScopeOptionsType(route: GeneratedClientRoute): string {
  return hasReactQueryCacheScope(route) ? " & { readonly cacheScope?: unknown }" : "";
}

function hasReactQueryCacheScope(route: GeneratedClientRoute): boolean {
  return isReactQueryQueryRoute(route) && hasReactQueryUnsafeKeyInput(route);
}

function hasReactQueryUnsafeKeyInput(route: GeneratedClientRoute): boolean {
  return Boolean(route.inputSchemas.body || route.inputSchemas.headers);
}

function getReactQueryCacheSafeInputFieldNames(route: GeneratedClientRoute): readonly string[] {
  return [
    ...(route.inputSchemas.path ? ["path"] : []),
    ...(route.inputSchemas.query ? ["query"] : []),
  ];
}

function getQueryKeyFactoryParameters(route: GeneratedClientRoute): string {
  const parameters = [
    ...(hasQueryKeyFactoryInput(route) ? [getInputParameter(route)] : []),
    ...(hasReactQueryCacheScope(route) ? ["cacheScope?: unknown"] : []),
  ];

  return parameters.join(", ");
}

function getQueryKeyFactoryCallArguments(route: GeneratedClientRoute): string {
  const parameters = [
    ...(hasQueryKeyFactoryInput(route) ? ["input"] : []),
    ...(hasReactQueryCacheScope(route) ? ["cacheScope"] : []),
  ];

  return parameters.join(", ");
}

function hasQueryKeyFactoryInput(route: GeneratedClientRoute): boolean {
  return getQueryKeyInputExpression(route) !== null;
}

function getQueryKeyInputExpression(route: GeneratedClientRoute): string | null {
  if (!isReactQueryQueryRoute(route) || !hasReactQueryUnsafeKeyInput(route)) {
    return needsInput(route) ? "input" : null;
  }

  const fieldNames = getReactQueryCacheSafeInputFieldNames(route);

  if (fieldNames.length === 0) {
    return null;
  }

  return `{ ${fieldNames.map((fieldName) => `${fieldName}: input.${fieldName}`).join(", ")} }`;
}

function getReactQueryKeyType(route: GeneratedClientRoute, result: boolean): string {
  const keyType = `ReturnType<typeof ${getDomainName(route)}Keys${getQueryKeyFactoryAccessor(route)}>`;

  return result ? `readonly [...${keyType}, 'result']` : keyType;
}

function getReactQueryKeyExpression(
  domain: string,
  route: GeneratedClientRoute,
  result: boolean,
): string {
  const keyExpression = `${domain}Keys${getQueryKeyFactoryAccessor(route)}(${getQueryKeyFactoryCallArguments(route)})`;

  return result ? `[...${keyExpression}, 'result'] as const` : keyExpression;
}

function zodTypeToTypeScript(schema: unknown): string {
  const descriptor = describeZodSchema(schema as never);

  if (!descriptor) {
    throw new RpcCodegenContractProblem(
      "Cannot generate RPC client type for missing schema. Use a JSON-safe Zod schema supported by @croco/protocols-core or remove the schema from generated contracts.",
    );
  }

  const unsafeDiagnostic = getSchemaDescriptorDiagnostics(descriptor).find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (unsafeDiagnostic) {
    throw new RpcCodegenContractProblem(formatSchemaDiagnostic(unsafeDiagnostic));
  }

  return schemaDescriptorToTypeScript(descriptor);
}

function schemaDescriptorToTypeScript(descriptor: ContractSchemaDescriptor): string {
  if (descriptor.kind === "string") {
    return "string";
  }

  if (descriptor.kind === "number") {
    return "number";
  }

  if (descriptor.kind === "boolean") {
    return "boolean";
  }

  if (descriptor.kind === "unknown" || descriptor.kind === "any") {
    return "unknown";
  }

  if (descriptor.kind === "never") {
    return "never";
  }

  if (descriptor.kind === "null") {
    return "null";
  }

  if (descriptor.kind === "undefined" || descriptor.kind === "void") {
    return "undefined";
  }

  if (descriptor.kind === "literal") {
    return literalValueToTypeScript(descriptor.value);
  }

  if (descriptor.kind === "enum") {
    return unionTypes((descriptor.values ?? []).map(literalValueToTypeScript));
  }

  if (descriptor.kind === "union") {
    return unionTypes((descriptor.options ?? []).map(schemaDescriptorToTypeScript));
  }

  if (descriptor.kind === "optional") {
    return `${schemaDescriptorToTypeScript(getRequiredChildDescriptor(descriptor, "inner"))} | undefined`;
  }

  if (descriptor.kind === "nullable") {
    return `${schemaDescriptorToTypeScript(getRequiredChildDescriptor(descriptor, "inner"))} | null`;
  }

  if (descriptor.kind === "default") {
    return schemaDescriptorToTypeScript(getRequiredChildDescriptor(descriptor, "inner"));
  }

  if (
    descriptor.kind === "effects" ||
    descriptor.kind === "branded" ||
    descriptor.kind === "readonly"
  ) {
    return schemaDescriptorToTypeScript(getRequiredChildDescriptor(descriptor, "inner"));
  }

  if (descriptor.kind === "array") {
    return `${schemaDescriptorToTypeScript(getRequiredChildDescriptor(descriptor, "element"))}[]`;
  }

  if (descriptor.kind === "record") {
    return `Record<string, ${descriptor.element ? schemaDescriptorToTypeScript(descriptor.element) : "unknown"}>`;
  }

  if (descriptor.kind === "object") {
    return getObjectTypeScript(descriptor);
  }

  throw new RpcCodegenContractProblem(
    `Cannot generate RPC client type for unsupported schema ${descriptor.typeName}. Use a JSON-safe Zod schema supported by @croco/protocols-core or remove the schema from generated contracts.`,
  );
}

function getRequiredChildDescriptor(
  descriptor: ContractSchemaDescriptor,
  key: "element" | "inner",
): ContractSchemaDescriptor {
  const child = descriptor[key];

  if (!child) {
    throw new RpcCodegenContractProblem(
      `Cannot generate RPC client type for malformed schema ${descriptor.typeName}: missing ${key} schema descriptor.`,
    );
  }

  return child;
}

function getSchemaName(schema: unknown): string {
  return getZodSchemaTypeName(schema);
}

function unionTypes(types: readonly string[]): string {
  const uniqueTypes = [...new Set(types)];

  return uniqueTypes.length === 0 ? "never" : uniqueTypes.join(" | ");
}

function literalValueToTypeScript(value: unknown): string {
  if (typeof value === "string") {
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  throw new RpcCodegenContractProblem(
    `Cannot generate RPC client type for unsupported literal value ${String(value)}.`,
  );
}

function getObjectTypeScript(descriptor: ContractSchemaDescriptor): string {
  const fields = (descriptor.fields ?? []).map(
    (field) => `${formatObjectKey(field.name)}: ${schemaDescriptorToTypeScript(field.schema)};`,
  );

  return `{ ${fields.join(" ")} }`;
}

function getObjectFieldNames(schema: unknown): string[] {
  const descriptor = describeZodSchema(schema as never);

  return descriptor?.kind === "object" ? (descriptor.fields ?? []).map((field) => field.name) : [];
}

function formatObjectKey(key: string): string {
  if (isJavaScriptIdentifier(key)) {
    return key;
  }

  return `'${key.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function isJavaScriptIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

function getPathExpression(route: GeneratedClientRoute): string {
  const pathParams = getContractPathParams(route.path);

  if (pathParams.length === 0) {
    return `'${route.path}'`;
  }

  const paramsByToken = new Map(pathParams.map((param) => [param.token, param.name]));
  const pathExpression = route.path.replace(/:([^/]+)/g, (tokenWithPrefix, token: string) => {
    const name = paramsByToken.get(token);

    return name ? `\${encodeURIComponent(String(${getPathInputAccessor(name)}))}` : tokenWithPrefix;
  });

  return `\`${pathExpression}\``;
}

function getPathInputAccessor(name: string): string {
  return isJavaScriptIdentifier(name)
    ? `input.path.${name}`
    : `input.path[${formatObjectKey(name)}]`;
}

function getQueryStatements(route: GeneratedClientRoute): string {
  if (!route.inputSchemas.query) {
    return "";
  }

  return `    const query = serializeQueryParams(input.query);
    const url = query ? \`${"${path}"}?${"${query}"}\` : path;
`;
}

function getUrlExpression(route: GeneratedClientRoute): string {
  return route.inputSchemas.query ? "url" : "path";
}

function getInputSchemaEntries(route: GeneratedClientRoute): [string, unknown][] {
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

function needsInput(route: GeneratedClientRoute): boolean {
  return getInputSchemaEntries(route).length > 0;
}

function hasRequiredInput(route: GeneratedClientRoute): boolean {
  return needsInput(route);
}

function hasBody(route: GeneratedClientRoute): boolean {
  return route.inputSchemas.body !== null && route.inputSchemas.body !== undefined;
}

function hasStructuredInput(route: GeneratedClientRoute): boolean {
  return Boolean(route.inputSchemas.path || route.inputSchemas.query || route.inputSchemas.headers);
}

function hasLegacyBodyInput(route: GeneratedClientRoute): boolean {
  return Boolean(
    route.inputSchemas.body &&
    !route.inputSchemas.path &&
    !route.inputSchemas.query &&
    !route.inputSchemas.headers,
  );
}

function isMutationRoute(route: GeneratedClientRoute): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(route.httpMethod.toUpperCase());
}

function getDomainName(route: GeneratedClientRoute): string {
  const rawName = route.domain ?? route.controllerName.replace(/Controller$/, "");

  return toCamelCase(rawName);
}

function getInputTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}Input`;
}

function getFormFieldNameTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}FormFieldName`;
}

function getFormValuesTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}FormValues`;
}

function getSubmitPayloadTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}SubmitPayload`;
}

function getValidationProblemTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}ValidationProblem`;
}

function getDomainProblemTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}DomainProblem`;
}

function getFormProblemTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}FormProblem`;
}

function getFormModelName(route: GeneratedClientRoute): string {
  return `${route.methodName}FormModel`;
}

function getBuildFormPayloadName(route: GeneratedClientRoute): string {
  return `build${toPascalCase(route.methodName)}FormPayload`;
}

function getMapFormProblemName(route: GeneratedClientRoute): string {
  return `map${toPascalCase(route.methodName)}FormProblem`;
}

function getOutputTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}Output`;
}

function getProblemTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}Problem`;
}

function getProblemDetailsTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}ProblemDetails`;
}

function getResultTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}Result`;
}

function getQueryKeyTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}QueryKey`;
}

function getResultQueryKeyTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}ResultQueryKey`;
}

function getQueryFactoryTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}QueryFactory`;
}

function getResultQueryFactoryTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}ResultQueryFactory`;
}

function getQueryOptionsTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}QueryOptions`;
}

function getResultQueryOptionsTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}ResultQueryOptions`;
}

function getMutationVariablesTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}MutationVariables`;
}

function getMutationFactoryTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}MutationFactory`;
}

function getResultMutationFactoryTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}ResultMutationFactory`;
}

function getMutationOptionsTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}MutationOptions`;
}

function getResultMutationOptionsTypeName(route: GeneratedClientRoute): string {
  return `${toPascalCase(route.methodName)}ResultMutationOptions`;
}

function getProblemDeclarationsName(route: GeneratedClientRoute): string {
  return `${route.methodName}ProblemDeclarations`;
}

function getResultMethodName(route: GeneratedClientRoute): string {
  return `${route.methodName}Result`;
}

function getQueryKeysName(domainRoutes: DomainRoutes): string {
  return `${domainRoutes.domain}Keys`;
}

function getQueryKeyFactoryProperty(route: GeneratedClientRoute): string {
  const name = route.methodName === "all" ? "allRoute" : route.methodName;

  return isJavaScriptIdentifier(name) ? name : formatObjectKey(name);
}

function getQueryKeyFactoryAccessor(route: GeneratedClientRoute): string {
  const name = route.methodName === "all" ? "allRoute" : route.methodName;

  return isJavaScriptIdentifier(name) ? `.${name}` : `[${formatObjectKey(name)}]`;
}

function formatRoute(route: GeneratedClientRoute): string {
  return `${route.controllerName}.${route.methodName} (${route.path})`;
}

function getRouteId(route: GeneratedClientRoute): string {
  return route.routeId ?? `${route.controllerName}.${route.methodName}`;
}

function getOperationId(route: GeneratedClientRoute): string {
  return route.operationId ?? getRouteId(route).replace(/[^A-Za-z0-9_]+/g, "_");
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
