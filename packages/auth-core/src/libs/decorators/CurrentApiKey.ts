import { appendAuthRouteParamMetadata } from "./routeParamMetadata";

export function CurrentApiKey(): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) return;

    appendAuthRouteParamMetadata(target, propertyKey, {
      type: "apikey",
      index: parameterIndex,
      name: undefined,
    });
  };
}
