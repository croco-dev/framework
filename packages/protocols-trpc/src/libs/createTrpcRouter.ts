import { Container, Context } from "@croco/framework-context";
import type { RequestContext } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { RouteContractSourceLocation, RouteIR } from "@croco/protocols-core";
import { extractRouteIR } from "@croco/protocols-core";
import { getFilters, getGuards, getInterceptors, type Constructor } from "@croco/protocols-rest";
import {
  type AnyProcedure,
  type AnyRouter,
  initTRPC,
  type TRPCCreateRouterOptions,
} from "@trpc/server";
import { createTrpcInputSchema, resolveTrpcRouteParams } from "./TrpcParamResolver";
import { createTrpcProblemDetails, getTrpcProblem } from "./TrpcProblemError";
import { TrpcExecutionContext } from "./TrpcExecutionContext";
import { TrpcExecutionPipeline, type TrpcPipelineConfig } from "./TrpcExecutionPipeline";

type ControllerConstructor = (new () => object) & Function;
type RouteHandler = (...args: unknown[]) => unknown;
type TrpcRouteDiagnostic = {
  readonly controllerName: string;
  readonly methodName: string;
  readonly httpMethod: string;
  readonly path: string;
  readonly sourceLocation?: RouteContractSourceLocation;
};

export type TrpcRouterOptions = {
  readonly container?: {
    get<T>(type: Constructor<T>): T;
  };
  readonly createRequestContext?: (context: Record<string, unknown>) => RequestContext;
};

const t = initTRPC.context<Record<string, unknown>>().create({
  errorFormatter({ error, shape }) {
    const data = { ...shape.data };
    Reflect.deleteProperty(data, "stack");
    const problem = getTrpcProblem(error);

    if (!problem) {
      return { ...shape, data };
    }

    const details = createTrpcProblemDetails(problem);

    return {
      ...shape,
      message: details.detail ?? problem.code,
      data: {
        ...data,
        croco: details,
      },
    };
  },
});

const executionPipeline = new TrpcExecutionPipeline();

/**
 * Problem thrown when a generated tRPC route resolves to a non-callable controller member.
 */
export class TrpcRouteHandlerError extends Problem {
  readonly code = "protocols-trpc/route-handler-not-callable";
  readonly category = ProblemCategory.InternalServerError;
  readonly methodName: string;

  constructor(methodName: string) {
    super(undefined, undefined, `Route handler '${methodName}' is not callable`, {
      extensions: { methodName },
    });
    this.methodName = methodName;
  }
}

class TrpcProviderContainerProblem extends Problem {
  readonly code = "protocols-trpc/provider-container-required";
  readonly category = ProblemCategory.InternalServerError;

  constructor(providerName: string) {
    super(
      undefined,
      undefined,
      `Provider '${providerName}' requires a container for constructor injection`,
      {
        extensions: { providerName },
      },
    );
  }
}

class TrpcDuplicateProcedureProblem extends Problem {
  readonly code = "protocols-trpc/duplicate-procedure-name";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    domain: string,
    procedureName: string,
    existingRoute: TrpcRouteDiagnostic,
    conflictingRoute: TrpcRouteDiagnostic,
  ) {
    super(
      undefined,
      undefined,
      formatDuplicateProcedureDetail(domain, procedureName, existingRoute, conflictingRoute),
      {
        extensions: { domain, procedureName, existingRoute, conflictingRoute },
      },
    );
  }
}

/**
 * Creates a tRPC router whose procedures run Croco guards before input parsing, then interceptors around handlers.
 *
 * Class lifecycle metadata runs before method metadata. Filters run in the same order for any guard, validation,
 * interceptor, or handler failure. A filter must return RFC 7807 Problem Details with a 4xx or 5xx status; other
 * filter response shapes leave the original failure intact and emit `CROCO_TRPC_FILTER_001` to the runtime inspector.
 */
export function createTrpcRouter(
  controllers: Function[],
  options: TrpcRouterOptions = {},
): AnyRouter {
  const domains: Record<string, TRPCCreateRouterOptions> = {};
  const procedureSources = new Map<string, Map<string, TrpcRouteDiagnostic>>();

  for (const controller of controllers) {
    const controllerCtor = controller as ControllerConstructor;

    for (const route of extractRouteIR(controllerCtor)) {
      const domain = getDomainName(route);
      const routeDiagnostic = toRouteDiagnostic(route);
      const domainSources = procedureSources.get(domain) ?? new Map();
      const existingRoute = domainSources.get(route.methodName);

      if (existingRoute) {
        throw new TrpcDuplicateProcedureProblem(
          domain,
          route.methodName,
          existingRoute,
          routeDiagnostic,
        );
      }

      domainSources.set(route.methodName, routeDiagnostic);
      procedureSources.set(domain, domainSources);
      domains[domain] ??= {};
      domains[domain][route.methodName] = createProcedure(controllerCtor, route, options);
    }
  }

  const routerRecord: TRPCCreateRouterOptions = {};

  for (const [domain, procedures] of Object.entries(domains)) {
    routerRecord[domain] = t.router(procedures);
  }

  return t.router(routerRecord);
}

function createProcedure(
  controller: ControllerConstructor,
  route: RouteIR,
  options: TrpcRouterOptions,
): AnyProcedure {
  const createExecutionContext = (ctx: Record<string, unknown>) =>
    new TrpcExecutionContext(ctx, controller, route.methodName, route.path, route.httpMethod);
  const guardProviders = getGuards(controller, route.methodName);
  const filterProviders = getFilters(controller, route.methodName);
  const interceptorProviders = getInterceptors(controller, route.methodName);
  const createFilters = (): TrpcPipelineConfig["filters"] =>
    filterProviders.map((provider) => instantiateProvider(provider, options));
  const createGuards = (): TrpcPipelineConfig["guards"] =>
    guardProviders.map((provider) => instantiateProvider(provider, options));
  const createInterceptors = (): TrpcPipelineConfig["interceptors"] =>
    interceptorProviders.map((provider) => instantiateProvider(provider, options));
  const inputSchema = createTrpcInputSchema(route);
  const lifecycleProcedure = t.procedure.use(async ({ ctx, next }) =>
    Context.run(createCrocoRequestContext(ctx, options), async () => {
      const context = createExecutionContext(ctx);
      const filters = createFilters();

      try {
        await executionPipeline.runGuards(context, createGuards());
      } catch (error) {
        return executionPipeline.rethrowFiltered(error, context, filters);
      }

      const result = await next();
      if (!result.ok) {
        return executionPipeline.rethrowFiltered(result.error, context, filters);
      }

      return result;
    }),
  );
  const procedureWithInput = inputSchema
    ? lifecycleProcedure.input(inputSchema)
    : lifecycleProcedure;
  const procedure = route.outputSchema
    ? procedureWithInput.output(route.outputSchema)
    : procedureWithInput;
  const resolver = ({
    ctx,
    input,
  }: {
    readonly ctx: Record<string, unknown>;
    readonly input: unknown;
  }) => {
    const controllerInstance = instantiateProvider(controller, options);

    return executionPipeline.runInterceptors(
      createExecutionContext(ctx),
      async () => callRoute(controllerInstance, route, input, ctx),
      createInterceptors(),
    );
  };

  if (route.httpMethod === "GET") {
    return procedure.query(resolver);
  }

  return procedure.mutation(resolver);
}

function callRoute(
  controllerInstance: object,
  route: RouteIR,
  input: unknown,
  context: unknown,
): unknown {
  const handler = Reflect.get(controllerInstance, route.methodName);

  if (!isRouteHandler(handler)) {
    throw new TrpcRouteHandlerError(route.methodName);
  }

  return handler.apply(controllerInstance, resolveTrpcRouteParams(route, input, context));
}

function getDomainName(route: RouteIR): string {
  const domain = route.domain ?? route.controllerName.replace(/Controller$/, "");

  return domain.charAt(0).toLowerCase() + domain.slice(1);
}

function toRouteDiagnostic(route: RouteIR): TrpcRouteDiagnostic {
  return {
    controllerName: route.controllerName,
    methodName: route.methodName,
    httpMethod: route.httpMethod,
    path: route.path,
    ...(route.sourceLocation ? { sourceLocation: route.sourceLocation } : {}),
  };
}

function formatDuplicateProcedureDetail(
  domain: string,
  procedureName: string,
  existingRoute: TrpcRouteDiagnostic,
  conflictingRoute: TrpcRouteDiagnostic,
): string {
  return [
    `Duplicate tRPC procedure detected for ${domain}.${procedureName}.`,
    `Existing route: ${formatRouteDiagnostic(existingRoute)}.`,
    `Conflicting route: ${formatRouteDiagnostic(conflictingRoute)}.`,
    "Recovery: give one route a unique tRPC domain or controller method name before constructing the router.",
  ].join(" ");
}

function formatRouteDiagnostic(route: TrpcRouteDiagnostic): string {
  const routeLabel = `${route.controllerName}.${route.methodName} (${route.httpMethod} ${route.path})`;
  const sourceLocation = formatSourceLocation(route.sourceLocation);

  return sourceLocation
    ? `${routeLabel} at ${sourceLocation}`
    : `${routeLabel} (route decorator source unavailable)`;
}

function formatSourceLocation(
  sourceLocation: RouteContractSourceLocation | undefined,
): string | null {
  if (!sourceLocation) {
    return null;
  }

  const line = sourceLocation.line === undefined ? "" : `:${sourceLocation.line}`;
  const column = sourceLocation.column === undefined ? "" : `:${sourceLocation.column}`;

  return `${sourceLocation.path}${line}${column}`;
}

function isRouteHandler(value: unknown): value is RouteHandler {
  return typeof value === "function";
}

function instantiateProvider<T>(provider: Constructor<T>, options: TrpcRouterOptions): T {
  if (options.container) {
    return options.container.get(provider);
  }

  if (Container.getComponentMetadata(provider) !== undefined || Container.has(provider)) {
    return Container.get(provider);
  }

  if (provider.length > 0) {
    throw new TrpcProviderContainerProblem(getProviderName(provider));
  }

  const Provider = provider as new () => T;

  return new Provider();
}

function createCrocoRequestContext(context: unknown, options: TrpcRouterOptions): RequestContext {
  const trpcContext = isRecord(context) ? context : {};

  if (options.createRequestContext) {
    return options.createRequestContext(trpcContext);
  }

  const metadata = isRecord(trpcContext.crocoRequestContext)
    ? trpcContext.crocoRequestContext
    : trpcContext;
  const runtime = isRecord(metadata.runtime) ? metadata.runtime : undefined;
  const runtimeTrace = runtime && isRecord(runtime.trace) ? runtime.trace : undefined;
  const traceparent = parseTraceparent(readRequestHeader(trpcContext, "traceparent"));
  const requestId =
    readString(metadata.requestId) ??
    (runtime ? readString(runtime.requestId) : undefined) ??
    readRequestHeader(trpcContext, "x-request-id") ??
    globalThis.crypto.randomUUID();
  const traceId =
    readString(metadata.traceId) ??
    (runtimeTrace ? readString(runtimeTrace.traceId) : undefined) ??
    traceparent?.traceId;
  const spanId =
    readString(metadata.spanId) ??
    (runtimeTrace ? readString(runtimeTrace.spanId) : undefined) ??
    traceparent?.spanId;
  const traceFlags =
    readTraceFlags(metadata.traceFlags) ??
    (runtimeTrace ? readTraceFlags(runtimeTrace.traceFlags) : undefined) ??
    traceparent?.traceFlags;
  const user = isUserContext(metadata.user) ? metadata.user : undefined;

  return {
    requestId,
    ...(readString(metadata.inspectionId)
      ? { inspectionId: readString(metadata.inspectionId) }
      : {}),
    ...(user ? { user } : {}),
    ...(readString(metadata.tenantId) ? { tenantId: readString(metadata.tenantId) } : {}),
    ...(traceId ? { traceId } : {}),
    ...(spanId ? { spanId } : {}),
    ...(traceFlags !== undefined ? { traceFlags } : {}),
    ...(runtime ? { runtime: runtime as unknown as RequestContext["runtime"] } : {}),
    ...(isRecord(metadata.runtimeInspector)
      ? {
          runtimeInspector:
            metadata.runtimeInspector as unknown as RequestContext["runtimeInspector"],
        }
      : {}),
  };
}

function readRequestHeader(context: Record<string, unknown>, name: string): string | undefined {
  const request = context.request ?? context.req;

  if (request instanceof Request) {
    return request.headers.get(name) ?? undefined;
  }

  if (!isRecord(request)) {
    return undefined;
  }

  const headers = request.headers;
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  if (!isRecord(headers)) {
    return undefined;
  }

  const value = Object.entries(headers).find(
    ([headerName]) => headerName.toLowerCase() === name.toLowerCase(),
  )?.[1];
  return Array.isArray(value) ? readString(value[0]) : readString(value);
}

function parseTraceparent(value: string | undefined):
  | {
      readonly traceId: string;
      readonly spanId: string;
      readonly traceFlags: string;
    }
  | undefined {
  const match = value?.match(/^(00|01)-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/i);
  const traceId = match?.[2];
  const spanId = match?.[3];
  const traceFlags = match?.[4];

  if (!traceId || !spanId || !traceFlags || /^0{32}$/.test(traceId) || /^0{16}$/.test(spanId)) {
    return undefined;
  }

  return { traceId, spanId, traceFlags };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readTraceFlags(value: unknown): string | number | undefined {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUserContext(value: unknown): value is NonNullable<RequestContext["user"]> {
  return isRecord(value) && typeof value.id === "string";
}

function getProviderName(provider: Constructor): string {
  return provider.name || "anonymous provider";
}
