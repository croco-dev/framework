import 'reflect-metadata';
import { REST_PARAMS_KEY } from '@croco/protocols-rest';

export function CurrentPrincipal(): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingParams: Map<string | symbol, any[]> =
      Reflect.getMetadata(REST_PARAMS_KEY, target.constructor) || new Map();

    const methodParams = existingParams.get(propertyKey) || [];

    methodParams.push({
      type: 'principal',
      index: parameterIndex,
      name: undefined,
    });

    existingParams.set(propertyKey, methodParams);
    Reflect.defineMetadata(REST_PARAMS_KEY, existingParams, target.constructor);
  };
}
