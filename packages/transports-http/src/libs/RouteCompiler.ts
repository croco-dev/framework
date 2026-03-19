import type { Guard, ILogger } from '@croco/framework-context';
import { ProblemFactory } from '@croco/problems-core';
import {
  type Constructor,
  type ControllerMetadata,
  type ExceptionFilter,
  type ExecutionContext,
  getControllerMeta,
  getFilters,
  getGuards,
  getInterceptors,
  getRouteMeta,
  type Interceptor,
  type RouteMetadata,
} from '@croco/protocols-rest';
import { HttpExecutionContext } from './HttpExecutionContext';
import { ParamResolver } from './ParamResolver';
import type { PipelineRunner } from './PipelineRunner';
import type {
  CompiledRoute,
  CrocoHttpContext,
  FilterProvider,
  GuardProvider,
  InterceptorProvider,
  PipeProvider,
} from './types';

export interface CompileOptions {
  container?: { get<T>(type: Constructor<T>): T };
  globalGuards?: GuardProvider[];
  globalInterceptors?: InterceptorProvider[];
  globalFilters?: FilterProvider[];
  globalPipes?: PipeProvider[];
}

function instantiateProvider<T>(provider: Constructor<T> | T, container?: { get<T>(type: Constructor<T>): T }): T {
  // If it's already an instance (not a constructor function)
  if (typeof provider !== 'function') {
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
      'transports-http/provider-resolution-failed',
      `Container did not return an instance for provider ${Ctor.name}`
    );
  }

  return resolved;
}

export class RouteCompiler {
  private paramResolver = new ParamResolver();

  constructor(
    private readonly logger: ILogger,
    private readonly pipelineRunner: PipelineRunner
  ) {}

  compile(controllers: Constructor[], options: CompileOptions = {}): CompiledRoute[] {
    const routes: CompiledRoute[] = [];

    for (const controller of controllers) {
      const controllerMeta = getControllerMeta(controller);
      if (!controllerMeta) {
        this.logger.warn(`[RouteCompiler] ${controller.name} is not decorated with @Controller`);
        continue;
      }

      const routesMeta = getRouteMeta(controller);

      for (const routeMeta of routesMeta) {
        const compiledRoute = this.compileRoute(controller, controllerMeta, routeMeta, options);
        routes.push(compiledRoute);
      }
    }

    this.assertNoDuplicateRoutes(routes);

    return routes;
  }

  private assertNoDuplicateRoutes(routes: CompiledRoute[]): void {
    const seenRoutes = new Map<string, CompiledRoute>();

    for (const route of routes) {
      const routeKey = `${route.method.toUpperCase()} ${route.path}`;
      const existingRoute = seenRoutes.get(routeKey);

      if (existingRoute) {
        throw ProblemFactory.internalServerError(
          'transports-http/duplicate-route-definition',
          `Duplicate route detected for ${routeKey}`
        );
      }

      seenRoutes.set(routeKey, route);
    }
  }

  private compileRoute(
    controller: Constructor,
    controllerMeta: ControllerMetadata,
    routeMeta: RouteMetadata,
    options: CompileOptions
  ): CompiledRoute {
    const fullPath = this.joinPaths(controllerMeta.path, routeMeta.path);

    // Instantiate guards/interceptors/filters once at compile time (not per-request)
    const globalGuards = (options.globalGuards || []) as GuardProvider<Guard<ExecutionContext>>[];
    const globalInterceptors = (options.globalInterceptors || []) as InterceptorProvider<
      Interceptor<ExecutionContext>
    >[];
    const globalFilters = (options.globalFilters || []) as FilterProvider<
      ExceptionFilter<unknown, HttpExecutionContext>
    >[];

    const routeGuards = getGuards(controller, routeMeta.methodName);
    const routeInterceptors = getInterceptors(controller, routeMeta.methodName);
    const routeFilters = getFilters(controller, routeMeta.methodName);

    const handler = async (ctx: CrocoHttpContext): Promise<unknown> => {
      const instance = (
        options.container
          ? options.container.get(controller)
          : new (controller as new (...args: unknown[]) => unknown)()
      ) as object;

      const execContext = new HttpExecutionContext(ctx, controller, routeMeta.methodName);
      const guards = [
        ...globalGuards.map((guard) => instantiateProvider(guard, options.container)),
        ...routeGuards.map((guard) => instantiateProvider(guard, options.container)),
      ] as Guard<ExecutionContext>[];
      const interceptors = [
        ...globalInterceptors.map((interceptor) => instantiateProvider(interceptor, options.container)),
        ...routeInterceptors.map((interceptor) => instantiateProvider(interceptor, options.container)),
      ] as Interceptor<ExecutionContext>[];
      const filters = [
        ...globalFilters.map((filter) => instantiateProvider(filter, options.container)),
        ...routeFilters.map((filter) => instantiateProvider(filter, options.container)),
      ] as ExceptionFilter<unknown, HttpExecutionContext>[];

      const controllerHandler = async (): Promise<unknown> => {
        const args = await this.paramResolver.resolveParams(ctx, controller, routeMeta.methodName);
        const method = (instance as Record<PropertyKey, unknown>)[routeMeta.methodName];
        if (typeof method !== 'function') {
          throw ProblemFactory.internalServerError(
            'transports-http/route-method-not-function',
            `Method ${String(routeMeta.methodName)} is not a function`
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

    return {
      method: routeMeta.method,
      path: fullPath || '/',
      handler,
      controllerInstance: undefined,
      methodName: routeMeta.methodName,
    };
  }

  private joinPaths(base: string, path: string): string {
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    // 빈 path는 빈 문자열로 유지
    const cleanPath = path === '' ? '' : path.startsWith('/') ? path : `/${path}`;
    const result = `${cleanBase}${cleanPath}`.replace(/\/+/g, '/');
    // trailing slash 제거 (루트 제외)
    return result.length > 1 && result.endsWith('/') ? result.slice(0, -1) : result || '/';
  }
}
