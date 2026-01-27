import 'reflect-metadata';
import { ParamType, REST_PARAMS_KEY } from '../constants';
import type { ParamMetadata } from '../types';

function createParamDecorator(type: ParamType) {
  return (name?: string): ParameterDecorator => {
    return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
      if (!propertyKey) return;

      const existingParams: Map<string | symbol, ParamMetadata[]> =
        Reflect.getMetadata(REST_PARAMS_KEY, target.constructor) || new Map();

      const methodParams = existingParams.get(propertyKey) || [];

      methodParams.push({
        type,
        index: parameterIndex,
        name,
      });

      existingParams.set(propertyKey, methodParams);
      Reflect.defineMetadata(REST_PARAMS_KEY, existingParams, target.constructor);
    };
  };
}

export const Param = createParamDecorator(ParamType.PARAM);
export const Query = createParamDecorator(ParamType.QUERY);
export const Header = createParamDecorator(ParamType.HEADER);
export const Body = (): ParameterDecorator => createParamDecorator(ParamType.BODY)();
export const Ctx = (): ParameterDecorator => createParamDecorator(ParamType.CTX)();
export const Raw = (): ParameterDecorator => createParamDecorator(ParamType.RAW)();
