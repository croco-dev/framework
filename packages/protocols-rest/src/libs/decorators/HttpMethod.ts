import "reflect-metadata";
import { HttpMethod as HttpMethodEnum, REST_ROUTES_KEY } from "../constants";
import { captureRestDecoratorSourceLocation } from "../sourceLocation";
import type { RouteMetadata } from "../types";
import type {
  RouteContractSpec,
  RouteContractWithResponse,
  RouteHandlerReturn,
} from "../types/RouteContract";
import type { ContractMethodDecorator } from "./contractDecoratorSignature";

type RouteContractForMethod<Method extends HttpMethodEnum> = RouteContractSpec<Method>;
type ResponseContractMember<TContract extends RouteContractSpec> =
  TContract extends RouteContractWithResponse ? TContract : never;
type ContractRouteDecorator<TContract extends RouteContractSpec> = [
  ResponseContractMember<TContract>,
] extends [never]
  ? MethodDecorator
  : ContractMethodDecorator<RouteHandlerReturn<ResponseContractMember<TContract>>>;

type HttpMethodDecoratorFactory<Method extends HttpMethodEnum> = {
  (path?: string): MethodDecorator;
  <const TContract extends RouteContractForMethod<Method>>(
    contract: TContract,
  ): ContractRouteDecorator<TContract>;
};

function createMethodDecorator<const Method extends HttpMethodEnum>(
  method: Method,
): HttpMethodDecoratorFactory<Method> {
  return ((pathOrContract: string | RouteContractForMethod<Method> = ""): MethodDecorator => {
    const sourceLocation = captureRestDecoratorSourceLocation();

    return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      const contract = typeof pathOrContract === "string" ? undefined : pathOrContract;
      const path = typeof pathOrContract === "string" ? pathOrContract : pathOrContract.path;
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;

      const existingRoutes: RouteMetadata[] =
        Reflect.getOwnMetadata(REST_ROUTES_KEY, target.constructor) ??
        Reflect.getMetadata(REST_ROUTES_KEY, target.constructor) ??
        [];

      const routeMetadata: RouteMetadata = {
        method,
        path: normalizedPath === "/" ? "" : normalizedPath,
        methodName: propertyKey,
        ...(contract ? { contract } : {}),
        ...(sourceLocation ? { sourceLocation } : {}),
      };

      Reflect.defineMetadata(
        REST_ROUTES_KEY,
        [...existingRoutes, routeMetadata],
        target.constructor,
      );

      return descriptor;
    };
  }) as HttpMethodDecoratorFactory<Method>;
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
