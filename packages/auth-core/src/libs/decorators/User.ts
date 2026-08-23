import { appendAuthRouteParamMetadata } from "./routeParamMetadata";

export function User(): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) return;

    appendAuthRouteParamMetadata(target, propertyKey, {
      type: "user",
      index: parameterIndex,
      name: undefined,
    });
  };
}
