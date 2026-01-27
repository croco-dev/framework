import {
  type Constructor,
  type ControllerMetadata,
  getControllerMeta,
  getRouteMeta,
  type RouteMetadata,
} from '@croco/protocols-rest';
import { ParamResolver } from './ParamResolver';
import type { CompiledRoute, CrocoHttpContext } from './types';

export interface CompileOptions {
  container?: { get<T>(type: Constructor<T>): T };
}

export class RouteCompiler {
  private paramResolver = new ParamResolver();

  compile(controllers: Constructor[], options: CompileOptions = {}): CompiledRoute[] {
    const routes: CompiledRoute[] = [];

    for (const controller of controllers) {
      const controllerMeta = getControllerMeta(controller);
      if (!controllerMeta) {
        console.warn(`[RouteCompiler] ${controller.name} is not decorated with @Controller`);
        continue;
      }

      const routesMeta = getRouteMeta(controller);
      const instance = options.container
        ? options.container.get(controller)
        : new (controller as new (...args: any[]) => any)();

      for (const routeMeta of routesMeta) {
        const compiledRoute = this.compileRoute(controller, controllerMeta, routeMeta, instance);
        routes.push(compiledRoute);
      }
    }

    return routes;
  }

  private compileRoute(
    controller: Constructor,
    controllerMeta: ControllerMetadata,
    routeMeta: RouteMetadata,
    instance: unknown
  ): CompiledRoute {
    const fullPath = this.joinPaths(controllerMeta.path, routeMeta.path);

    const handler = async (ctx: CrocoHttpContext): Promise<unknown> => {
      const args = await this.paramResolver.resolveParams(ctx, controller, routeMeta.methodName);
      const method = (instance as any)[routeMeta.methodName];

      if (typeof method !== 'function') {
        throw new Error(`Method ${String(routeMeta.methodName)} not found on ${controller.name}`);
      }

      return method.apply(instance, args);
    };

    return {
      method: routeMeta.method,
      path: fullPath || '/',
      handler,
      controllerInstance: instance,
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
