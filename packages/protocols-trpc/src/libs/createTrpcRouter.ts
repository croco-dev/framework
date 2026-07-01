import { Problem, ProblemCategory } from "@croco/problems-core";
import type { RouteIR } from "@croco/protocols-core";
import { extractRouteIR } from "@croco/protocols-core";
import {
  type AnyProcedure,
  type AnyRouter,
  initTRPC,
  type TRPCCreateRouterOptions,
} from "@trpc/server";

type ControllerConstructor = (new () => object) & Function;
type RouteHandler = (input?: unknown) => unknown;

const t = initTRPC.create();

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

export function createTrpcRouter(controllers: Function[]): AnyRouter {
  const domains: Record<string, TRPCCreateRouterOptions> = {};

  for (const controller of controllers) {
    const controllerCtor = controller as ControllerConstructor;
    const controllerInstance = new controllerCtor();

    for (const route of extractRouteIR(controllerCtor)) {
      const domain = getDomainName(route);
      domains[domain] ??= {};
      domains[domain][route.methodName] = createProcedure(controllerInstance, route);
    }
  }

  const routerRecord: TRPCCreateRouterOptions = {};

  for (const [domain, procedures] of Object.entries(domains)) {
    routerRecord[domain] = t.router(procedures);
  }

  return t.router(routerRecord);
}

function createProcedure(controllerInstance: object, route: RouteIR): AnyProcedure {
  const procedureWithInput = route.inputSchema ? t.procedure.input(route.inputSchema) : t.procedure;
  const procedure = route.outputSchema
    ? procedureWithInput.output(route.outputSchema)
    : procedureWithInput;
  const resolver = ({ input }: { readonly input: unknown }) =>
    callRoute(controllerInstance, route.methodName, input);

  if (route.httpMethod === "GET") {
    return procedure.query(resolver);
  }

  return procedure.mutation(resolver);
}

function callRoute(controllerInstance: object, methodName: string, input: unknown): unknown {
  const handler = Reflect.get(controllerInstance, methodName);

  if (!isRouteHandler(handler)) {
    throw new TrpcRouteHandlerError(methodName);
  }

  return handler.call(controllerInstance, input);
}

function getDomainName(route: RouteIR): string {
  const domain = route.domain ?? route.controllerName.replace(/Controller$/, "");

  return domain.charAt(0).toLowerCase() + domain.slice(1);
}

function isRouteHandler(value: unknown): value is RouteHandler {
  return typeof value === "function";
}
