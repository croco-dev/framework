import 'reflect-metadata';
import { HttpMethod as HttpMethodEnum, REST_ROUTES_KEY } from '../constants';
import type { RouteMetadata } from '../types';

function createMethodDecorator(method: HttpMethodEnum) {
  return (path: string = ''): MethodDecorator => {
    return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;

      const existingRoutes: RouteMetadata[] =
        Reflect.getOwnMetadata(REST_ROUTES_KEY, target.constructor) ??
        Reflect.getMetadata(REST_ROUTES_KEY, target.constructor) ??
        [];

      const routeMetadata: RouteMetadata = {
        method,
        path: normalizedPath === '/' ? '' : normalizedPath,
        methodName: propertyKey,
      };

      Reflect.defineMetadata(REST_ROUTES_KEY, [...existingRoutes, routeMetadata], target.constructor);

      return descriptor;
    };
  };
}

export const Get = createMethodDecorator(HttpMethodEnum.GET);
export const Post = createMethodDecorator(HttpMethodEnum.POST);
export const Put = createMethodDecorator(HttpMethodEnum.PUT);
export const Patch = createMethodDecorator(HttpMethodEnum.PATCH);
export const Delete = createMethodDecorator(HttpMethodEnum.DELETE);
export const Options = createMethodDecorator(HttpMethodEnum.OPTIONS);
export const Head = createMethodDecorator(HttpMethodEnum.HEAD);
export const All = createMethodDecorator(HttpMethodEnum.ALL);
