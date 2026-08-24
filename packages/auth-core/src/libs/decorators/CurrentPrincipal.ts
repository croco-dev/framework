import { appendAuthRouteParamMetadata } from "./routeParamMetadata";

export function CurrentPrincipal(): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) return;

    appendAuthRouteParamMetadata(target, propertyKey, {
      type: "principal",
      index: parameterIndex,
      name: undefined,
    });
  };
}
