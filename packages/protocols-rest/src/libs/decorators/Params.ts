import 'reflect-metadata';
import type { z } from 'zod';
import { ParamType, REST_PARAMS_KEY } from '../constants';
import type { ParamMetadata } from '../types';
import { ValidationPipe } from '../validators/ValidationPipe';

function createParamDecorator(type: ParamType) {
  return (name?: string, schema?: z.ZodType): ParameterDecorator => {
    return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
      if (!propertyKey) return;

      const existingParams: Map<string | symbol, ParamMetadata[]> =
        Reflect.getMetadata(REST_PARAMS_KEY, target.constructor) || new Map();

      const methodParams = existingParams.get(propertyKey) || [];

      const param: ParamMetadata = {
        type,
        index: parameterIndex,
        name,
      };

      if (schema) {
        param.pipes = [new ValidationPipe(schema)];
      }

      methodParams.push(param);

      existingParams.set(propertyKey, methodParams);
      Reflect.defineMetadata(REST_PARAMS_KEY, existingParams, target.constructor);
    };
  };
}

export const Param = (name: string, schema?: z.ZodType) => createParamDecorator(ParamType.PARAM)(name, schema);
export const Query = (name: string, schema?: z.ZodType) => createParamDecorator(ParamType.QUERY)(name, schema);
export const Header = (name: string, schema?: z.ZodType) => createParamDecorator(ParamType.HEADER)(name, schema);
export const Body = (schema?: z.ZodType): ParameterDecorator => createParamDecorator(ParamType.BODY)(undefined, schema);
export const Ctx = (): ParameterDecorator => createParamDecorator(ParamType.CTX)();
export const Raw = (): ParameterDecorator => createParamDecorator(ParamType.RAW)();
