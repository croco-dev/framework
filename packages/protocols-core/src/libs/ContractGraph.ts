import "reflect-metadata";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { z } from "zod";
import { extractRouteIR } from "./extractRouteIR";
import type { RouteIR } from "./RouteIR";
import {
  type Constructor,
  type ControllerMetadata,
  REST_CONTROLLER_KEY,
  REST_GUARDS_KEY,
  REST_ROLES_KEY,
} from "./sharedTypes";

export type ContractGraphVersion = "croco.contract-graph.v1";
export type ContractDiagnosticSeverity = "error" | "warning";
export type ContractDiagnosticTarget = "graph" | "controller" | "route" | "param" | "schema";

export type ContractDiagnostic = {
  readonly code: string;
  readonly severity: ContractDiagnosticSeverity;
  readonly target: ContractDiagnosticTarget;
  readonly message: string;
  readonly routeId?: string;
  readonly controllerName?: string;
  readonly methodName?: string;
  readonly path?: string;
};

export type ContractGraphController = {
  readonly name: string;
  readonly path: string;
  readonly guards: readonly ContractMetadataReference[];
  readonly roles: readonly string[];
  readonly routeIds: readonly string[];
};

export type ContractMetadataReference = {
  readonly type: "rest.guard";
  readonly id: string;
  readonly kind: "constructor" | "instance";
  readonly name: string;
  readonly declaredAt: "controller" | "route";
  readonly owner: ContractMetadataOwner;
  readonly index: number;
};

export type ContractMetadataOwner = {
  readonly controllerName: string;
  readonly routeId?: string;
  readonly methodName?: string;
};

export type ContractAccessMetadata = {
  readonly guards: readonly ContractMetadataReference[];
  readonly roles: readonly string[];
};

export type ContractPathParam = {
  readonly token: string;
  readonly name: string;
};

export type ContractGraphRoute = RouteIR & {
  readonly routeId: string;
  readonly operationId: string;
  readonly controllerPath: string;
  readonly access: ContractAccessMetadata;
};

export type ContractGraph = {
  readonly version: ContractGraphVersion;
  readonly controllers: readonly ContractGraphController[];
  readonly routes: readonly ContractGraphRoute[];
  readonly diagnostics: readonly ContractDiagnostic[];
};

export class ContractGraphDiagnosticError extends Problem {
  readonly diagnostics: readonly ContractDiagnostic[];

  constructor(diagnostics: readonly ContractDiagnostic[]) {
    super(
      "protocols-core/contract-graph-diagnostics",
      ProblemCategory.ValidationError,
      formatContractDiagnostics(diagnostics),
      { extensions: { diagnostics } },
    );
    this.diagnostics = diagnostics;
  }
}

export function buildContractGraph(controllers: readonly Constructor[]): ContractGraph {
  const graphControllers: ContractGraphController[] = [];
  const graphRoutes: ContractGraphRoute[] = [];
  const diagnostics: ContractDiagnostic[] = [];

  for (const controller of controllers) {
    const controllerMeta = Reflect.getMetadata(REST_CONTROLLER_KEY, controller) as
      | ControllerMetadata
      | undefined;

    if (!controllerMeta) {
      continue;
    }

    const routes = extractRouteIR(controller).map((route) =>
      toContractGraphRoute(route, controllerMeta.path, controller),
    );

    graphControllers.push({
      name: controller.name,
      path: controllerMeta.path,
      guards: getMetadataReferences(
        Reflect.getMetadata(REST_GUARDS_KEY, controller),
        "controller",
        {
          controllerName: controller.name,
        },
      ),
      roles: getMetadataStrings(Reflect.getMetadata(REST_ROLES_KEY, controller)),
      routeIds: routes.map((route) => route.routeId),
    });
    graphRoutes.push(...routes);

    for (const route of routes) {
      diagnostics.push(...validateRoute(route));
    }
  }

  diagnostics.push(...validateUniqueControllerNames(graphControllers));
  diagnostics.push(...validateUniqueRouteIds(graphRoutes));
  diagnostics.push(...validateUniqueOperationIds(graphRoutes));

  return {
    version: "croco.contract-graph.v1",
    controllers: graphControllers,
    routes: graphRoutes,
    diagnostics,
  };
}

export function getContractGraphErrors(graph: ContractGraph): readonly ContractDiagnostic[] {
  return graph.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
}

export function assertContractGraphHasNoErrors(graph: ContractGraph): void {
  const errors = getContractGraphErrors(graph);

  if (errors.length > 0) {
    throw new ContractGraphDiagnosticError(errors);
  }
}

export function formatContractDiagnostics(diagnostics: readonly ContractDiagnostic[]): string {
  return diagnostics.map(formatContractDiagnostic).join("\n");
}

export function formatContractDiagnostic(diagnostic: ContractDiagnostic): string {
  const route = diagnostic.routeId ? ` ${diagnostic.routeId}` : "";

  return `${diagnostic.severity.toUpperCase()} ${diagnostic.code}${route}: ${diagnostic.message}`;
}

export function getContractPathParamNames(path: string): string[] {
  return getContractPathParams(path).map((param) => param.name);
}

export function getContractPathParams(path: string): ContractPathParam[] {
  return [...path.matchAll(/:([^/]+)/g)]
    .map((match) => {
      const token = match[1];

      return { token, name: token.replace(/^\.\.\./, "") };
    })
    .filter((param) => param.name.length > 0);
}

function toContractGraphRoute(
  route: RouteIR,
  controllerPath: string,
  controllerCtor: Constructor,
): ContractGraphRoute {
  const routeId = `${route.controllerName}.${route.methodName}`;

  return {
    ...route,
    routeId,
    operationId: routeId.replace(/[^A-Za-z0-9_]+/g, "_"),
    controllerPath,
    access: {
      guards: [
        ...getMetadataReferences(
          Reflect.getMetadata(REST_GUARDS_KEY, controllerCtor),
          "controller",
          { controllerName: route.controllerName },
        ),
        ...getMetadataReferences(
          Reflect.getMetadata(REST_GUARDS_KEY, controllerCtor, route.methodName),
          "route",
          {
            controllerName: route.controllerName,
            methodName: route.methodName,
            routeId,
          },
        ),
      ],
      roles: [
        ...getMetadataStrings(Reflect.getMetadata(REST_ROLES_KEY, controllerCtor)),
        ...getMetadataStrings(
          Reflect.getMetadata(REST_ROLES_KEY, controllerCtor, route.methodName),
        ),
      ],
    },
  };
}

function validateRoute(route: ContractGraphRoute): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];

  if (route.httpMethod.toUpperCase() === "ALL") {
    diagnostics.push(
      createRouteDiagnostic(
        route,
        "contract-route-unsupported-all-method",
        "error",
        "@All is runtime-only and cannot be represented as a concrete generated contract. Use explicit HTTP method decorators for OpenAPI and typed clients.",
      ),
    );
  }

  diagnostics.push(...validatePathParams(route));
  diagnostics.push(...validateNamedParams(route));
  diagnostics.push(...validateBodyParams(route));
  diagnostics.push(...validateSchemaEffects(route));
  diagnostics.push(...validateProblemResponses(route));

  return diagnostics;
}

function validateProblemResponses(route: ContractGraphRoute): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];
  const seenCodes = new Set<string>();

  for (const response of route.problemResponses ?? []) {
    if (seenCodes.has(response.code)) {
      diagnostics.push(
        createRouteDiagnostic(
          route,
          "contract-route-duplicate-problem-code",
          "error",
          `Route declares duplicate Problem code '${response.code}'. Problem response codes must be unique per route so generated clients can exhaustively discriminate failures.`,
        ),
      );
      continue;
    }

    seenCodes.add(response.code);
  }

  return diagnostics;
}

function validatePathParams(route: ContractGraphRoute): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];
  const pathParamNames = new Set(getContractPathParamNames(route.path));
  const declaredParamNames = new Set(
    route.params.filter((param) => param.kind === "path").map((param) => param.name),
  );

  for (const name of pathParamNames) {
    if (!declaredParamNames.has(name)) {
      diagnostics.push(
        createRouteDiagnostic(
          route,
          "contract-route-missing-path-param",
          "error",
          `Route path declares ':${name}' but no @Param("${name}") metadata was found.`,
        ),
      );
    }
  }

  for (const name of declaredParamNames) {
    if (name.length > 0 && !pathParamNames.has(name)) {
      diagnostics.push(
        createRouteDiagnostic(
          route,
          "contract-route-unbound-path-param",
          "error",
          `@Param("${name}") is not present in route path '${route.path}'.`,
        ),
      );
    }
  }

  return diagnostics;
}

function validateNamedParams(route: ContractGraphRoute): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];

  for (const kind of ["path", "query", "header"] as const) {
    const params = route.params.filter((param) => param.kind === kind);
    const seenNames = new Set<string>();

    for (const param of params) {
      if (param.name.length === 0) {
        diagnostics.push(
          createRouteDiagnostic(
            route,
            "contract-param-missing-name",
            "error",
            `${kind} parameters must include a metadata name for generated contracts.`,
          ),
        );
        continue;
      }

      if (seenNames.has(param.name)) {
        diagnostics.push(
          createRouteDiagnostic(
            route,
            "contract-param-duplicate-name",
            "error",
            `Duplicate ${kind} parameter '${param.name}' cannot be represented unambiguously.`,
          ),
        );
      }

      seenNames.add(param.name);
    }
  }

  return diagnostics;
}

function validateBodyParams(route: ContractGraphRoute): ContractDiagnostic[] {
  const bodyParams = route.params.filter((param) => param.kind === "body");

  if (bodyParams.length <= 1) {
    return [];
  }

  return [
    createRouteDiagnostic(
      route,
      "contract-route-multiple-body-params",
      "error",
      `Generated contracts support one request body per route, but ${bodyParams.length} @Body() parameters were found.`,
    ),
  ];
}

function validateSchemaEffects(route: ContractGraphRoute): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];

  for (const schema of getRouteSchemas(route)) {
    const effectsCount = countZodEffects(schema);

    for (let index = 0; index < effectsCount; index += 1) {
      diagnostics.push(
        createRouteDiagnostic(
          route,
          "contract-schema-zod-effects-unwrapped",
          "warning",
          "Zod effects are represented from their inner schema in generated contracts; runtime transforms/refinements still run on the server.",
        ),
      );
    }
  }

  return diagnostics;
}

function validateUniqueRouteIds(routes: readonly ContractGraphRoute[]): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];
  const routeIds = new Map<string, ContractGraphRoute>();

  for (const route of routes) {
    const existingRoute = routeIds.get(route.routeId);

    if (existingRoute) {
      diagnostics.push(
        createRouteDiagnostic(
          route,
          "contract-route-duplicate-id",
          "error",
          `Route id '${route.routeId}' is already used by ${existingRoute.controllerName}.${existingRoute.methodName}.`,
        ),
      );
      continue;
    }

    routeIds.set(route.routeId, route);
  }

  return diagnostics;
}

function validateUniqueControllerNames(
  controllers: readonly ContractGraphController[],
): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];
  const controllerNames = new Map<string, ContractGraphController>();

  for (const controller of controllers) {
    const existingController = controllerNames.get(controller.name);

    if (existingController) {
      diagnostics.push({
        code: "contract-controller-duplicate-name",
        severity: "error",
        target: "controller",
        controllerName: controller.name,
        path: controller.path,
        message: `Controller name '${controller.name}' is already used for path '${existingController.path}'. Controller names must be unique because route ids and access metadata references use them as contract identity.`,
      });
      continue;
    }

    controllerNames.set(controller.name, controller);
  }

  return diagnostics;
}

function validateUniqueOperationIds(routes: readonly ContractGraphRoute[]): ContractDiagnostic[] {
  const diagnostics: ContractDiagnostic[] = [];
  const operationIds = new Map<string, ContractGraphRoute>();

  for (const route of routes) {
    const existingRoute = operationIds.get(route.operationId);

    if (existingRoute) {
      diagnostics.push(
        createRouteDiagnostic(
          route,
          "contract-route-duplicate-operation-id",
          "error",
          `Operation id '${route.operationId}' is already used by ${existingRoute.controllerName}.${existingRoute.methodName}.`,
        ),
      );
      continue;
    }

    operationIds.set(route.operationId, route);
  }

  return diagnostics;
}

function getRouteSchemas(route: ContractGraphRoute): z.ZodType[] {
  const schemas = [
    route.inputSchemas.body,
    route.inputSchemas.path,
    route.inputSchemas.query,
    route.inputSchemas.headers,
    route.outputSchema,
    ...route.params.map((param) => param.schema),
  ].filter((schema): schema is z.ZodType => Boolean(schema));

  return [...new Set(schemas)];
}

function isZodEffects(schema: z.ZodType): boolean {
  return schema.constructor.name === "ZodEffects";
}

function countZodEffects(schema: z.ZodType, seen = new Set<z.ZodType>()): number {
  if (seen.has(schema)) {
    return 0;
  }

  seen.add(schema);

  const currentCount = isZodEffects(schema) ? 1 : 0;
  const nestedCount = getNestedZodSchemas(schema).reduce(
    (count, nestedSchema) => count + countZodEffects(nestedSchema, seen),
    0,
  );

  return currentCount + nestedCount;
}

function getNestedZodSchemas(schema: z.ZodType): z.ZodType[] {
  const definition = getZodDefinition(schema);

  if (!definition) {
    return [];
  }

  const nestedSchemas = [
    ...Object.values(getZodObjectShape(definition)),
    definition.innerType,
    definition.schema,
    definition.type,
    definition.element,
    ...(Array.isArray(definition.options) ? definition.options : []),
  ];

  return nestedSchemas.filter(isZodType);
}

type ZodDefinition = {
  readonly shape?: unknown;
  readonly innerType?: unknown;
  readonly schema?: unknown;
  readonly type?: unknown;
  readonly element?: unknown;
  readonly options?: unknown;
};

function getZodDefinition(schema: z.ZodType): ZodDefinition | undefined {
  if (!schema || typeof schema !== "object" || !("_def" in schema)) {
    return undefined;
  }

  return schema._def as ZodDefinition;
}

function getZodObjectShape(definition: ZodDefinition): Record<string, unknown> {
  const shape = typeof definition.shape === "function" ? definition.shape() : definition.shape;

  return shape && typeof shape === "object" ? (shape as Record<string, unknown>) : {};
}

function isZodType(value: unknown): value is z.ZodType {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { readonly safeParse?: unknown };

  return typeof candidate.safeParse === "function";
}

function createRouteDiagnostic(
  route: ContractGraphRoute,
  code: string,
  severity: ContractDiagnosticSeverity,
  message: string,
): ContractDiagnostic {
  return {
    code,
    severity,
    target: getDiagnosticTarget(code),
    message,
    routeId: route.routeId,
    controllerName: route.controllerName,
    methodName: route.methodName,
    path: route.path,
  };
}

function getDiagnosticTarget(code: string): ContractDiagnosticTarget {
  if (code.includes("param")) {
    return "param";
  }

  if (code.includes("schema")) {
    return "schema";
  }

  return "route";
}

function getMetadataReferences(
  value: unknown,
  declaredAt: ContractMetadataReference["declaredAt"],
  owner: ContractMetadataOwner,
): ContractMetadataReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => getMetadataReference(item, declaredAt, owner, index))
    .filter((reference): reference is ContractMetadataReference => reference !== null);
}

function getMetadataReference(
  value: unknown,
  declaredAt: ContractMetadataReference["declaredAt"],
  owner: ContractMetadataOwner,
  index: number,
): ContractMetadataReference | null {
  if (typeof value === "function") {
    return createGuardReference("constructor", getMetadataName(value), declaredAt, owner, index);
  }

  if (value && typeof value === "object" && "constructor" in value) {
    const constructor = value.constructor;

    if (typeof constructor === "function") {
      return createGuardReference(
        "instance",
        getMetadataName(constructor),
        declaredAt,
        owner,
        index,
      );
    }
  }

  return null;
}

function getMetadataName(value: { readonly name: string }): string {
  return value.name.length > 0 ? value.name : "anonymous";
}

function createGuardReference(
  kind: ContractMetadataReference["kind"],
  name: string,
  declaredAt: ContractMetadataReference["declaredAt"],
  owner: ContractMetadataOwner,
  index: number,
): ContractMetadataReference {
  const ownerId = owner.routeId ?? owner.controllerName;

  return {
    type: "rest.guard",
    id: `rest.guard:${declaredAt}:${ownerId}:${index}:${kind}:${name}`,
    kind,
    name,
    declaredAt,
    owner,
    index,
  };
}

function getMetadataStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
