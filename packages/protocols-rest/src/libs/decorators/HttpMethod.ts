import "reflect-metadata";
import { HttpMethod as HttpMethodEnum, REST_ROUTES_KEY } from "../constants";
import type { RouteMetadata } from "../types";

function createMethodDecorator(method: HttpMethodEnum) {
  return (path: string = ""): MethodDecorator => {
    return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;

      const existingRoutes: RouteMetadata[] =
        Reflect.getOwnMetadata(REST_ROUTES_KEY, target.constructor) ??
        Reflect.getMetadata(REST_ROUTES_KEY, target.constructor) ??
        [];

      const routeMetadata: RouteMetadata = {
        method,
        path: normalizedPath === "/" ? "" : normalizedPath,
        methodName: propertyKey,
      };

      Reflect.defineMetadata(
        REST_ROUTES_KEY,
        [...existingRoutes, routeMetadata],
        target.constructor,
      );

      return descriptor;
    };
  };
}

/**
 * 메서드를 GET 라우트로 등록합니다.
 */
export const Get = createMethodDecorator(HttpMethodEnum.GET);

/**
 * 메서드를 POST 라우트로 등록합니다.
 */
export const Post = createMethodDecorator(HttpMethodEnum.POST);

/**
 * 메서드를 PUT 라우트로 등록합니다.
 */
export const Put = createMethodDecorator(HttpMethodEnum.PUT);

/**
 * 메서드를 PATCH 라우트로 등록합니다.
 */
export const Patch = createMethodDecorator(HttpMethodEnum.PATCH);

/**
 * 메서드를 DELETE 라우트로 등록합니다.
 */
export const Delete = createMethodDecorator(HttpMethodEnum.DELETE);

/**
 * 메서드를 OPTIONS 라우트로 등록합니다.
 */
export const Options = createMethodDecorator(HttpMethodEnum.OPTIONS);

/**
 * 메서드를 HEAD 라우트로 등록합니다.
 */
export const Head = createMethodDecorator(HttpMethodEnum.HEAD);

/**
 * 메서드를 모든 HTTP 메서드에 응답하는 라우트로 등록합니다.
 */
export const All = createMethodDecorator(HttpMethodEnum.ALL);
