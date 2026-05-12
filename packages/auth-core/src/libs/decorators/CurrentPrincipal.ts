import "reflect-metadata";
import { ROUTE_PARAMS_METADATA_KEY } from "../constants";

export function CurrentPrincipal(): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingParams: Map<string | symbol, any[]> =
      Reflect.getMetadata(ROUTE_PARAMS_METADATA_KEY, target.constructor) || new Map();

    const methodParams = existingParams.get(propertyKey) || [];

    methodParams.push({
      type: "principal",
      index: parameterIndex,
      name: undefined,
    });

    existingParams.set(propertyKey, methodParams);
    Reflect.defineMetadata(ROUTE_PARAMS_METADATA_KEY, existingParams, target.constructor);
  };
}
