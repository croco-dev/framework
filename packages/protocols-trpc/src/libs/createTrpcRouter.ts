import { Problem, ProblemCategory } from "@croco/problems-core";
import type { RouteIR } from "@croco/protocols-core";
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

export type TrpcRouterOptions = {
  readonly container?: {
    get<T>(type: Constructor<T>): T;
  };
};

const t = initTRPC.context<Record<string, unknown>>().create({
  errorFormatter({ error, shape }) {
    const problem = getTrpcProblem(error);

    if (!problem) {
      return shape;
    }

    const details = createTrpcProblemDetails(problem);

    return {
      ...shape,
      message: details.detail ?? problem.code,
      data: {
        ...shape.data,
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

  for (const controller of controllers) {
    const controllerCtor = controller as ControllerConstructor;
    const controllerInstance = instantiateProvider(controllerCtor, options);

    for (const route of extractRouteIR(controllerCtor)) {
      const domain = getDomainName(route);
      domains[domain] ??= {};
      domains[domain][route.methodName] = createProcedure(
        controllerInstance,
        controllerCtor,
        route,
        options,
      );
    }
  }

  const routerRecord: TRPCCreateRouterOptions = {};

  for (const [domain, procedures] of Object.entries(domains)) {
    routerRecord[domain] = t.router(procedures);
  }

  return t.router(routerRecord);
}

function createProcedure(
  controllerInstance: object,
  controller: ControllerConstructor,
  route: RouteIR,
  options: TrpcRouterOptions,
): AnyProcedure {
  const createExecutionContext = (ctx: Record<string, unknown>) =>
    new TrpcExecutionContext(ctx, controller, route.methodName, route.path, route.httpMethod);
  const createGuardAndFilterConfig = (): Pick<TrpcPipelineConfig, "guards" | "filters"> => ({
    guards: getGuards(controller, route.methodName).map((provider) =>
      instantiateProvider(provider, options),
    ),
    filters: getFilters(controller, route.methodName).map((provider) =>
      instantiateProvider(provider, options),
    ),
  });
  const createInterceptors = (): TrpcPipelineConfig["interceptors"] =>
    getInterceptors(controller, route.methodName).map((provider) =>
      instantiateProvider(provider, options),
    );
  const inputSchema = createTrpcInputSchema(route);
  const lifecycleProcedure = t.procedure.use(async ({ ctx, next }) => {
    const context = createExecutionContext(ctx);
    const config = createGuardAndFilterConfig();

    try {
      await executionPipeline.runGuards(context, config.guards);
    } catch (error) {
      return executionPipeline.rethrowFiltered(error, context, config.filters);
    }

    const result = await next();
    if (!result.ok) {
      return executionPipeline.rethrowFiltered(result.error, context, config.filters);
    }

    return result;
  });
  const procedureWithInput = inputSchema ? lifecycleProcedure.input(inputSchema) : lifecycleProcedure;
  const procedure = route.outputSchema
    ? procedureWithInput.output(route.outputSchema)
    : procedureWithInput;
  const resolver = ({
    ctx,
    input,
  }: {
    readonly ctx: Record<string, unknown>;
    readonly input: unknown;
  }) =>
    executionPipeline.runInterceptors(
      createExecutionContext(ctx),
      async () => callRoute(controllerInstance, route, input, ctx),
      createInterceptors(),
    );

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

function isRouteHandler(value: unknown): value is RouteHandler {
  return typeof value === "function";
}

function instantiateProvider<T>(provider: Constructor<T>, options: TrpcRouterOptions): T {
  if (options.container) {
    return options.container.get(provider);
  }

  const Provider = provider as new () => T;

  return new Provider();
}
