import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type RouteConfig,
} from "@asteasolutions/zod-to-openapi";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  assertContractGraphConsumerRouteCoverage,
  assertContractGraphHasNoErrors,
  buildContractGraph,
  createProjectManifestBundleArtifactPaths,
  type ContractGraph,
  type ContractGraphConsumerRouteField,
  type ContractEntitlementRequirement,
  type ContractGraphObservedConsumerRoute,
  type ContractGraphRoute,
  getContractPathParams,
  normalizeProjectManifestBundlePath,
  type ParamIR,
  type ProjectManifestBundleArtifactKey,
  unwrapZodEffectsSchema,
} from "@croco/protocols-core";
import { type ZodType, z } from "zod";

extendZodWithOpenApi(z);

const HTTP_METHODS = ["get", "post", "put", "delete", "patch", "head", "options", "trace"] as const;

type OpenAPIDocument = ReturnType<OpenApiGeneratorV31["generateDocument"]>;
type OpenAPIConfig = Parameters<OpenApiGeneratorV31["generateDocument"]>[0];
type OpenAPIComponents = NonNullable<OpenAPIDocument["components"]>;
type HttpMethod = (typeof HTTP_METHODS)[number];
type ControllerConstructor = new (...args: unknown[]) => unknown;
type OpenAPIParamLocation = "path" | "query" | "header";
type OpenAPIReference = { $ref: string };
type RouteResponses = RouteConfig["responses"];
type DeclaredProblemOpenAPIResponse = {
  readonly description: string;
  readonly content: {
    readonly "application/problem+json": {
      readonly schema: OpenAPIReference;
    };
  };
  readonly "x-croco-problems": readonly DeclaredProblemOpenAPI[];
};
type DeclaredProblemOpenAPI = {
  readonly code: string;
  readonly category: string;
  readonly status: number;
  readonly cookbookPath?: string;
  readonly description?: string;
  readonly type?: string;
};
type DeclaredEntitlementOpenAPI = {
  readonly feature: string;
  readonly description?: string;
  readonly resource?: ContractEntitlementRequirement["resource"];
};
type CrocoManifestBundleReference = {
  readonly schemaVersion: "croco.openapi.manifest-source.v1";
  readonly directory: string;
  readonly artifacts: Record<ProjectManifestBundleArtifactKey, string>;
};
type CrocoOpenAPIDocument = OpenAPIDocument & {
  readonly "x-croco-manifest-bundle"?: CrocoManifestBundleReference;
};

export type ProblemResponseConfig = {
  readonly status: number | `${number}` | "default";
  readonly description: string;
};

export type EmitOpenAPIOptions = {
  readonly info?: Partial<OpenAPIConfig["info"]>;
  readonly servers?: OpenAPIConfig["servers"];
  readonly security?: OpenAPIConfig["security"];
  readonly securitySchemes?: OpenAPIComponents["securitySchemes"];
  readonly tags?: OpenAPIConfig["tags"];
  readonly defaultResponses?: RouteResponses;
  readonly problemResponses?: readonly ProblemResponseConfig[];
  readonly manifestBundlePath?: string;
};

const DEFAULT_INFO: OpenAPIConfig["info"] = {
  title: "Croco API",
  version: "1.0.0",
  license: {
    name: "MIT",
    identifier: "MIT",
  },
};

const DEFAULT_SERVERS: OpenAPIConfig["servers"] = [{ url: "/" }];

const DEFAULT_PROBLEM_RESPONSES = [
  { status: 400, description: "Bad request" },
  { status: 422, description: "Validation error" },
  { status: 500, description: "Internal server error" },
] as const satisfies readonly ProblemResponseConfig[];

class OpenAPIContractProblem extends Problem {
  constructor(detail: string) {
    super("openapi-spec/invalid-contract", ProblemCategory.ValidationError, detail);
  }
}

export function emitOpenAPI(
  controllers: Function[],
  options: EmitOpenAPIOptions = {},
): CrocoOpenAPIDocument {
  return emitOpenAPIFromContractGraph(
    buildContractGraph(controllers as ControllerConstructor[]),
    options,
  );
}

export function emitOpenAPIFromContractGraph(
  graph: ContractGraph,
  options: EmitOpenAPIOptions = {},
): CrocoOpenAPIDocument {
  assertContractGraphHasNoErrors(graph);

  const registry = new OpenAPIRegistry();
  const routes = [...graph.routes];
  const problemDetailsRef = registerProblemDetailsSchema(registry);
  const defaultResponses = toDefaultResponses(options, problemDetailsRef);

  registerSecuritySchemes(registry, options.securitySchemes);

  routes.forEach((route) => {
    registry.registerPath(toRouteConfig(route, defaultResponses, problemDetailsRef));
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  const document: CrocoOpenAPIDocument = {
    ...generator.generateDocument({
      openapi: "3.1.0",
      info: { ...DEFAULT_INFO, ...options.info },
      servers: options.servers ?? DEFAULT_SERVERS,
      security: options.security ?? [],
      tags: options.tags ?? toTags(routes),
    }),
    ...(options.manifestBundlePath
      ? {
          "x-croco-manifest-bundle": createManifestBundleReference(options.manifestBundlePath),
        }
      : {}),
  };

  assertContractGraphConsumerRouteCoverage(graph, "openapi", collectOpenAPICoveredRoutes(document));

  return document;
}

function createManifestBundleReference(manifestBundlePath: string): CrocoManifestBundleReference {
  const directory = normalizeProjectManifestBundlePath(manifestBundlePath);

  return {
    schemaVersion: "croco.openapi.manifest-source.v1",
    directory,
    artifacts: createProjectManifestBundleArtifactPaths(directory),
  };
}

function registerProblemDetailsSchema(registry: OpenAPIRegistry): OpenAPIReference {
  const { ref } = registry.registerComponent("schemas", "ProblemDetails", {
    type: "object",
    description: "RFC 7807 Problem Details response body.",
    required: ["type", "title", "status", "code"],
    properties: {
      type: {
        type: "string",
        description: "A URI reference that identifies the problem type.",
        example: "about:blank",
      },
      title: {
        type: "string",
        description: "A short, human-readable summary of the problem type.",
        example: "Bad Request",
      },
      status: {
        type: "integer",
        description: "The HTTP status code generated by the origin server.",
        example: 400,
      },
      code: {
        type: "string",
        description: "Croco domain-specific problem code.",
        example: "validation/request-invalid",
      },
      detail: {
        type: "string",
        description: "A human-readable explanation specific to this occurrence.",
      },
      instance: {
        type: "string",
        description: "A URI reference that identifies this occurrence of the problem.",
      },
    },
    additionalProperties: true,
  });

  return ref;
}

function registerSecuritySchemes(
  registry: OpenAPIRegistry,
  securitySchemes: EmitOpenAPIOptions["securitySchemes"],
): void {
  if (!securitySchemes) {
    return;
  }

  for (const [name, securityScheme] of Object.entries(securitySchemes)) {
    registry.registerComponent("securitySchemes", name, securityScheme);
  }
}

function toDefaultResponses(
  options: EmitOpenAPIOptions,
  problemDetailsRef: OpenAPIReference,
): RouteResponses {
  return {
    ...toProblemResponseConfig(
      options.problemResponses ?? DEFAULT_PROBLEM_RESPONSES,
      problemDetailsRef,
    ),
    ...options.defaultResponses,
  };
}

function toProblemResponseConfig(
  responses: readonly ProblemResponseConfig[],
  problemDetailsRef: OpenAPIReference,
): RouteResponses {
  return Object.fromEntries(
    responses.map((response) => [
      String(response.status),
      {
        description: response.description,
        content: {
          "application/problem+json": {
            schema: problemDetailsRef,
          },
        },
      },
    ]),
  );
}

function toRouteConfig(
  route: ContractGraphRoute,
  defaultResponses: RouteResponses,
  problemDetailsRef: OpenAPIReference,
): RouteConfig {
  return {
    method: toHttpMethod(route),
    path: toOpenAPIPath(route.path),
    operationId: route.operationId,
    summary: route.routeId,
    tags: [route.domain ?? route.controllerName],
    responses: toResponseConfig(route, defaultResponses, problemDetailsRef),
    ...(route.entitlements.length > 0
      ? { "x-croco-entitlements": toOpenAPIEntitlements(route.entitlements) }
      : {}),
    ...(route.params.length > 0 || route.inputSchema ? { request: toRequestConfig(route) } : {}),
  };
}

function toOpenAPIEntitlements(
  entitlements: readonly ContractEntitlementRequirement[],
): readonly DeclaredEntitlementOpenAPI[] {
  return entitlements
    .map((entitlement) => ({
      feature: entitlement.feature,
      ...(entitlement.description ? { description: entitlement.description } : {}),
      ...(entitlement.resource ? { resource: entitlement.resource } : {}),
    }))
    .sort(compareDeclaredEntitlements);
}

function toResponseConfig(
  route: ContractGraphRoute,
  defaultResponses: RouteResponses,
  problemDetailsRef: OpenAPIReference,
): RouteResponses {
  const outputSchema = unwrapZodEffectsSchema(route.outputSchema);

  return {
    ...defaultResponses,
    ...toDeclaredProblemResponseConfig(route, problemDetailsRef),
    200: {
      description: "Successful response",
      ...(outputSchema
        ? {
            content: {
              "application/json": {
                schema: outputSchema,
              },
            },
          }
        : {}),
    },
  };
}

function toDeclaredProblemResponseConfig(
  route: ContractGraphRoute,
  problemDetailsRef: OpenAPIReference,
): RouteResponses {
  const responsesByStatus = new Map<number, string[]>();
  const problemsByStatus = new Map<number, DeclaredProblemOpenAPI[]>();

  for (const problem of route.problemResponses ?? []) {
    const labels = responsesByStatus.get(problem.status) ?? [];
    const problems = problemsByStatus.get(problem.status) ?? [];
    const description = problem.description
      ? `${problem.code} (${problem.category}): ${problem.description}`
      : `${problem.code} (${problem.category})`;
    const declaration = {
      code: problem.code,
      category: problem.category,
      status: problem.status,
      ...(problem.cookbookPath ? { cookbookPath: problem.cookbookPath } : {}),
      ...(problem.description ? { description: problem.description } : {}),
      ...(problem.type ? { type: problem.type } : {}),
    };

    responsesByStatus.set(problem.status, [...labels, description].sort());
    problemsByStatus.set(problem.status, [...problems, declaration].sort(compareDeclaredProblems));
  }

  return Object.fromEntries(
    [...responsesByStatus.entries()].map(
      ([status, descriptions]): [number, DeclaredProblemOpenAPIResponse] => {
        const problems = problemsByStatus.get(status) ?? [];

        return [
          status,
          {
            description: `Declared Problems: ${descriptions.join(", ")}`,
            content: {
              "application/problem+json": {
                schema: problemDetailsRef,
              },
            },
            "x-croco-problems": problems,
          },
        ];
      },
    ),
  );
}

function compareDeclaredProblems(
  left: DeclaredProblemOpenAPI,
  right: DeclaredProblemOpenAPI,
): number {
  return left.code.localeCompare(right.code) || left.status - right.status;
}

function compareDeclaredEntitlements(
  left: DeclaredEntitlementOpenAPI,
  right: DeclaredEntitlementOpenAPI,
): number {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

function toTags(routes: ContractGraphRoute[]): { name: string; description: string }[] {
  const tagNames = new Set(routes.map((route) => route.domain ?? route.controllerName));

  return [...tagNames].map((name) => ({
    name,
    description: `${name} operations`,
  }));
}

function toRequestConfig(route: ContractGraphRoute): RouteConfig["request"] {
  const params = toZodObject(route.params.filter((param) => param.kind === "path"));
  const query = toZodObject(route.params.filter((param) => param.kind === "query"));
  const headers = toZodObject(route.params.filter((param) => param.kind === "header"));
  const bodySchema = unwrapZodEffectsSchema(
    route.inputSchema ?? route.params.find((param) => param.kind === "body")?.schema,
  );

  return {
    ...(bodySchema
      ? {
          body: {
            required: true,
            content: {
              "application/json": {
                schema: bodySchema,
              },
            },
          },
        }
      : {}),
    ...(params ? { params } : {}),
    ...(query ? { query } : {}),
    ...(headers ? { headers } : {}),
  };
}

function toZodObject(params: ParamIR[]): z.ZodObject<Record<string, ZodType>> | undefined {
  if (params.length === 0) {
    return undefined;
  }

  const shape = Object.fromEntries(
    params.map((param) => [param.name, withParameterMetadata(param)]),
  );

  return z.object(shape);
}

function withParameterMetadata(param: ParamIR): ZodType {
  const schema = unwrapZodEffectsSchema(param.schema) ?? z.string();
  const location = toOpenAPIParamLocation(param.kind);

  return schema.openapi({
    param: {
      name: param.name,
      in: location,
      required: param.kind === "path",
    },
  });
}

function toOpenAPIParamLocation(kind: ParamIR["kind"]): OpenAPIParamLocation {
  if (kind === "path" || kind === "query" || kind === "header") {
    return kind;
  }

  throw new OpenAPIContractProblem(`Unsupported OpenAPI parameter kind: ${kind}`);
}

function toOpenAPIPath(path: string): string {
  const paramsByToken = new Map(
    getContractPathParams(path).map((param) => [param.token, param.name]),
  );

  return path.replace(/:([^/]+)/g, (tokenWithPrefix, token: string) => {
    const name = paramsByToken.get(token);

    return name ? `{${name}}` : tokenWithPrefix;
  });
}

function toHttpMethod(route: ContractGraphRoute): HttpMethod {
  const method = route.httpMethod;
  const normalizedMethod = method.toLowerCase();
  const httpMethod = HTTP_METHODS.find((candidate) => candidate === normalizedMethod);

  if (httpMethod) {
    return httpMethod;
  }

  if (normalizedMethod === "all") {
    throw new OpenAPIContractProblem(
      `Cannot emit OpenAPI operation for @All route ${formatRoute(route)}: @All is runtime-only and cannot be represented as a concrete OpenAPI operation. Use explicit HTTP method decorators for generated contracts.`,
    );
  }

  throw new OpenAPIContractProblem(`Unsupported HTTP method: ${method}`);
}

function formatRoute(route: ContractGraphRoute): string {
  return `${route.controllerName}.${route.methodName} (${route.path})`;
}

function collectOpenAPICoveredRoutes(
  document: OpenAPIDocument,
): ContractGraphObservedConsumerRoute[] {
  const coveredRoutes: ContractGraphObservedConsumerRoute[] = [];

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    if (!isRecord(pathItem)) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];

      if (!isRecord(operation) || typeof operation.summary !== "string") {
        continue;
      }

      const operationId =
        typeof operation.operationId === "string" ? operation.operationId : undefined;

      coveredRoutes.push({
        routeId: operation.summary,
        ...(operationId ? { operationId } : {}),
        consumedFields: collectOpenAPIConsumedFields(operation),
        fieldFingerprints: {
          routeId: operation.summary,
          ...(operationId ? { operationId } : {}),
          httpMethod: method.toUpperCase(),
          path: toContractComparablePath(path),
          "request.body": hasOpenAPIRequestBody(operation) ? "present" : "absent",
          "request.path": hasOpenAPIParameters(operation, "path") ? "present" : "absent",
          "request.query": hasOpenAPIParameters(operation, "query") ? "present" : "absent",
          "request.headers": hasOpenAPIParameters(operation, "header") ? "present" : "absent",
          response: hasOpenAPIJsonSuccessResponse(operation) ? "present" : "absent",
          problems: openAPIProblemsFingerprint(operation),
          entitlements: openAPIEntitlementsFingerprint(operation),
        },
      });
    }
  }

  return coveredRoutes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectOpenAPIConsumedFields(
  operation: Record<string, unknown>,
): ContractGraphConsumerRouteField[] {
  return [
    "routeId",
    ...(typeof operation.operationId === "string" ? (["operationId"] as const) : []),
    "httpMethod",
    "path",
    "request.body",
    "request.path",
    "request.query",
    "request.headers",
    "response",
    "problems",
    "entitlements",
  ];
}

function toContractComparablePath(path: string): string {
  return path.replace(/\{([^}]+)\}/g, ":$1");
}

function hasOpenAPIRequestBody(operation: Record<string, unknown>): boolean {
  return isRecord(operation.requestBody);
}

function hasOpenAPIParameters(
  operation: Record<string, unknown>,
  location: OpenAPIParamLocation,
): boolean {
  const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];

  return parameters
    .filter(isRecord)
    .some((parameter) => parameter.in === location && typeof parameter.name === "string");
}

function hasOpenAPIJsonSuccessResponse(operation: Record<string, unknown>): boolean {
  const responses = isRecord(operation.responses) ? operation.responses : {};
  const successResponse = responses["200"];

  if (!isRecord(successResponse) || !isRecord(successResponse.content)) {
    return false;
  }

  const jsonContent = successResponse.content["application/json"];

  return isRecord(jsonContent) && isRecord(jsonContent.schema);
}

function openAPIProblemsFingerprint(operation: Record<string, unknown>): string {
  const responses = isRecord(operation.responses) ? operation.responses : {};
  const problems = Object.values(responses).flatMap((response) => {
    if (!isRecord(response) || !Array.isArray(response["x-croco-problems"])) {
      return [];
    }

    return response["x-croco-problems"].filter(isRecord).map(toOpenAPIProblemFingerprint);
  });

  return JSON.stringify(problems.sort(compareOpenAPIProblemFingerprints));
}

function openAPIEntitlementsFingerprint(operation: Record<string, unknown>): string {
  const entitlements = Array.isArray(operation["x-croco-entitlements"])
    ? operation["x-croco-entitlements"].filter(isRecord).map(toOpenAPIEntitlementFingerprint)
    : [];

  return JSON.stringify(entitlements.sort(compareOpenAPIEntitlementFingerprints));
}

function toOpenAPIProblemFingerprint(problem: Record<string, unknown>): DeclaredProblemOpenAPI {
  return {
    code: String(problem.code),
    category: String(problem.category),
    status: typeof problem.status === "number" ? problem.status : Number(problem.status),
    ...(typeof problem.description === "string" ? { description: problem.description } : {}),
    ...(typeof problem.type === "string" ? { type: problem.type } : {}),
  };
}

function compareOpenAPIProblemFingerprints(
  left: DeclaredProblemOpenAPI,
  right: DeclaredProblemOpenAPI,
): number {
  return (
    left.code.localeCompare(right.code) ||
    left.category.localeCompare(right.category) ||
    left.status - right.status
  );
}

function toOpenAPIEntitlementFingerprint(
  entitlement: Record<string, unknown>,
): DeclaredEntitlementOpenAPI {
  return {
    feature: String(entitlement.feature),
    ...(typeof entitlement.description === "string"
      ? { description: entitlement.description }
      : {}),
    ...(isRecord(entitlement.resource)
      ? { resource: toOpenAPIEntitlementResourceFingerprint(entitlement.resource) }
      : {}),
  };
}

function toOpenAPIEntitlementResourceFingerprint(
  resource: Record<string, unknown>,
): NonNullable<DeclaredEntitlementOpenAPI["resource"]> {
  return {
    type: String(resource.type),
    ...(typeof resource.id === "string" ? { id: resource.id } : {}),
    ...(typeof resource.idParam === "string" ? { idParam: resource.idParam } : {}),
  };
}

function compareOpenAPIEntitlementFingerprints(
  left: DeclaredEntitlementOpenAPI,
  right: DeclaredEntitlementOpenAPI,
): number {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}
