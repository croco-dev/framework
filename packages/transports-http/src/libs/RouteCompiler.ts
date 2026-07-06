import type { Guard, ILogger } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import {
  extractRouteIR,
  type RouteContractSourceLocation,
  type RouteIR,
} from "@croco/protocols-core";
import {
  type Constructor,
  type ExceptionFilter,
  type ExecutionContext,
  getFilters,
  getGuards,
  getInterceptors,
  type Interceptor,
} from "@croco/protocols-rest";
import { HttpExecutionContext } from "./HttpExecutionContext";
import { ParamResolver } from "./ParamResolver";
import type { PipelineRunner } from "./PipelineRunner";
import type {
  CompiledRoute,
  CrocoHttpContext,
  FilterProvider,
  GuardProvider,
  InterceptorProvider,
  PipeProvider,
} from "./types";

type RouteDiagnosticMetadata = {
  readonly controllerName: string;
  readonly methodName: string;
  readonly httpMethod: string;
  readonly path: string;
  readonly sourceLocation?: RouteContractSourceLocation;
};

type RouteCompilerEntry = {
  readonly route: CompiledRoute;
  readonly diagnosticMetadata: RouteDiagnosticMetadata;
};

export interface CompileOptions {
  container?: { get<T>(type: Constructor<T>): T };
  globalGuards?: GuardProvider[];
  globalInterceptors?: InterceptorProvider[];
  globalFilters?: FilterProvider[];
  globalPipes?: PipeProvider[];
}

function instantiateProvider<T>(
  provider: Constructor<T> | T,
  container?: { get<T>(type: Constructor<T>): T },
): T {
  // If it's already an instance (not a constructor function)
  if (typeof provider !== "function") {
    return provider;
  }
  // If it's a constructor, instantiate it
  const Ctor = provider as Constructor<T>;

  if (!container) {
    return new Ctor();
  }

  const resolved = container.get(Ctor) as T | null | undefined;
  if (resolved == null) {
    throw ProblemFactory.internalServerError(
      "transports-http/provider-resolution-failed",
      `Container did not return an instance for provider ${Ctor.name}`,
    );
  }

  return resolved;
}

/**
 * REST 컨트롤러 메타데이터를 실행 가능한 라우트 정의로 컴파일합니다.
 */
export class RouteCompiler {
  constructor(
    private readonly logger: ILogger,
    private readonly pipelineRunner: PipelineRunner,
  ) {}

  compile(controllers: Constructor[], options: CompileOptions = {}): CompiledRoute[] {
    const routeEntries: RouteCompilerEntry[] = [];

    for (const controller of controllers) {
      const routeIRs = extractRouteIR(controller);
      if (routeIRs.length === 0) {
        this.logger.warn(`[RouteCompiler] ${controller.name} is not decorated with @Controller`);
        continue;
      }

      for (const routeIR of routeIRs) {
        const compiledRoute = this.compileRouteFromIR(controller, routeIR, options);
        routeEntries.push(compiledRoute);
      }
    }

    this.assertNoDuplicateRoutes(routeEntries);

    return routeEntries.map((entry) => entry.route);
  }

  private assertNoDuplicateRoutes(routeEntries: RouteCompilerEntry[]): void {
    const seenRoutes = new Map<string, RouteCompilerEntry>();

    for (const entry of routeEntries) {
      const route = entry.route;
      const routeKey = `${route.method.toUpperCase()} ${route.path}`;
      const existingRoute = seenRoutes.get(routeKey);

      if (existingRoute) {
        throw ProblemFactory.internalServerError(
          "transports-http/duplicate-route-definition",
          this.formatDuplicateRouteDetail(routeKey, existingRoute, entry),
        );
      }

      seenRoutes.set(routeKey, entry);
    }
  }

  private compileRouteFromIR(
    controller: Constructor,
    routeIR: RouteIR,
    options: CompileOptions,
  ): RouteCompilerEntry {
    const fullPath = this.toRuntimeRoutePath(this.joinPaths("", routeIR.path));
    const paramResolver = new ParamResolver((pipe) => instantiateProvider(pipe, options.container));

    // Instantiate guards/interceptors/filters once at compile time (not per-request)
    const globalGuards = (options.globalGuards || []) as GuardProvider<Guard<ExecutionContext>>[];
    const globalInterceptors = (options.globalInterceptors || []) as InterceptorProvider<
      Interceptor<ExecutionContext>
    >[];
    const globalFilters = (options.globalFilters || []) as FilterProvider<
      ExceptionFilter<unknown, HttpExecutionContext>
    >[];

    const routeGuards = getGuards(controller, routeIR.methodName);
    const routeInterceptors = getInterceptors(controller, routeIR.methodName);
    const routeFilters = getFilters(controller, routeIR.methodName);

    const handler = async (ctx: CrocoHttpContext): Promise<unknown> => {
      const instance = (
        options.container
          ? options.container.get(controller)
          : new (controller as new (...args: unknown[]) => unknown)()
      ) as object;

      const execContext = new HttpExecutionContext(ctx, controller, routeIR.methodName);
      const guards = [
        ...globalGuards.map((guard) => instantiateProvider(guard, options.container)),
        ...routeGuards.map((guard) => instantiateProvider(guard, options.container)),
      ] as Guard<ExecutionContext>[];
      const interceptors = [
        ...globalInterceptors.map((interceptor) =>
          instantiateProvider(interceptor, options.container),
        ),
        ...routeInterceptors.map((interceptor) =>
          instantiateProvider(interceptor, options.container),
        ),
      ] as Interceptor<ExecutionContext>[];
      const filters = [
        ...globalFilters.map((filter) => instantiateProvider(filter, options.container)),
        ...routeFilters.map((filter) => instantiateProvider(filter, options.container)),
      ] as ExceptionFilter<unknown, HttpExecutionContext>[];

      const controllerHandler = async (): Promise<unknown> => {
        const args = await paramResolver.resolveParams(ctx, controller, routeIR.methodName);
        const method = (instance as Record<PropertyKey, unknown>)[routeIR.methodName];
        if (typeof method !== "function") {
          throw ProblemFactory.internalServerError(
            "transports-http/route-method-not-function",
            `Method ${String(routeIR.methodName)} is not a function`,
          );
        }
        const typedMethod = method as (...args: unknown[]) => unknown;
        return typedMethod.apply(instance, args);
      };

      return this.pipelineRunner.run(execContext, controllerHandler, {
        guards,
        interceptors,
        filters,
      });
    };

    const route: CompiledRoute = {
      method: routeIR.httpMethod,
      path: fullPath,
      handler,
      controllerInstance: undefined,
      methodName: routeIR.methodName,
      pipelineGraphConfig: {
        target: `${routeIR.httpMethod.toUpperCase()} ${fullPath}`,
        handlerId: `handler:${controller.name}.${String(routeIR.methodName)}`,
        handlerLabel: `${controller.name}.${String(routeIR.methodName)}`,
        guards: [...globalGuards, ...routeGuards],
        interceptors: [...globalInterceptors, ...routeInterceptors],
        filters: [...globalFilters, ...routeFilters],
      },
    };

    return {
      route,
      diagnosticMetadata: {
        controllerName: routeIR.controllerName,
        methodName: routeIR.methodName,
        httpMethod: routeIR.httpMethod.toUpperCase(),
        path: fullPath,
        ...(routeIR.sourceLocation ? { sourceLocation: routeIR.sourceLocation } : {}),
      },
    };
  }

  private joinPaths(base: string, path: string): string {
    const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
    // 빈 path는 빈 문자열로 유지
    const cleanPath = path === "" ? "" : path.startsWith("/") ? path : `/${path}`;
    const result = `${cleanBase}${cleanPath}`.replace(/\/+/g, "/");
    // trailing slash 제거 (루트 제외)
    return result.length > 1 && result.endsWith("/") ? result.slice(0, -1) : result || "/";
  }

  private toRuntimeRoutePath(path: string): string {
    return path.replace(/:([^/]+)/g, (token, paramToken: string) => {
      const name = paramToken.replace(/^\.\.\./, "");

      return name === paramToken || name.length === 0 ? token : `:${name}{.+}`;
    });
  }

  private formatDuplicateRouteDetail(
    routeKey: string,
    existingEntry: RouteCompilerEntry,
    conflictingEntry: RouteCompilerEntry,
  ): string {
    return [
      `Duplicate route definition detected for ${routeKey}.`,
      `Existing route: ${this.formatRouteDiagnostic(existingEntry.diagnosticMetadata)}.`,
      `Conflicting route: ${this.formatRouteDiagnostic(conflictingEntry.diagnosticMetadata)}.`,
      "Recovery: give one route decorator a unique HTTP method or path before starting the HTTP transport.",
    ].join(" ");
  }

  private formatRouteDiagnostic(metadata: RouteDiagnosticMetadata): string {
    const routeLabel = `${metadata.controllerName}.${metadata.methodName} (${metadata.httpMethod} ${metadata.path})`;
    const sourceLocation = this.formatRouteSourceLocation(metadata.sourceLocation);

    return sourceLocation
      ? `${routeLabel} at ${sourceLocation}`
      : `${routeLabel} (route decorator source unavailable)`;
  }

  private formatRouteSourceLocation(
    sourceLocation: RouteContractSourceLocation | undefined,
  ): string | null {
    if (!sourceLocation) {
      return null;
    }

    const line = sourceLocation.line === undefined ? "" : `:${sourceLocation.line}`;
    const column = sourceLocation.column === undefined ? "" : `:${sourceLocation.column}`;

    return `${sourceLocation.path}${line}${column}`;
  }
}
