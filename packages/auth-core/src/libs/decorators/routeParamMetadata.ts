import "reflect-metadata";
import { ROUTE_PARAMS_METADATA_KEY } from "../constants";

type AuthRouteParamType = "apikey" | "principal" | "user";

type AuthRouteParamMetadata = {
  readonly type: AuthRouteParamType;
  readonly index: number;
  readonly name: undefined;
};

type RouteParamsMetadata = Map<string | symbol, unknown[]>;

export function appendAuthRouteParamMetadata(
  target: object,
  propertyKey: string | symbol,
  metadata: AuthRouteParamMetadata,
): void {
  const ownParams = Reflect.getOwnMetadata(ROUTE_PARAMS_METADATA_KEY, target.constructor) as
    | RouteParamsMetadata
    | undefined;
  const inheritedParams = ownParams
    ? undefined
    : (Reflect.getMetadata(ROUTE_PARAMS_METADATA_KEY, target.constructor) as
        | RouteParamsMetadata
        | undefined);
  const existingParams =
    ownParams ??
    new Map([...(inheritedParams ?? [])].map(([methodName, params]) => [methodName, [...params]]));
  const methodParams = existingParams.get(propertyKey) ?? [];

  existingParams.set(propertyKey, [...methodParams, metadata]);
  Reflect.defineMetadata(ROUTE_PARAMS_METADATA_KEY, existingParams, target.constructor);
}
