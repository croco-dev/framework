import 'reflect-metadata';
import type { z } from 'zod';
import { type ControllerMetadata, ParamType, REST_CONTROLLER_KEY, REST_PARAMS_KEY, REST_ROUTES_KEY, type RouteMetadata } from '../../libs/sharedTypes';

export function Controller(path: string): ClassDecorator {
  return (target) => {
    const metadata: ControllerMetadata = { path, target };

    Reflect.defineMetadata(REST_CONTROLLER_KEY, metadata, target);
  };
}

export function Get(path = ''): MethodDecorator {
  return createRouteDecorator('GET', path);
}

export function Post(path = ''): MethodDecorator {
  return createRouteDecorator('POST', path);
}

export function Param(name: string, schema?: z.ZodType): ParameterDecorator {
  return createParamDecorator(ParamType.PARAM, name, schema);
}

export function Query(name: string, schema?: z.ZodType): ParameterDecorator {
  return createParamDecorator(ParamType.QUERY, name, schema);
}

export function Body(schema?: z.ZodType): ParameterDecorator {
  return createParamDecorator(ParamType.BODY, undefined, schema);
}

export function Header(name: string, schema?: z.ZodType): ParameterDecorator {
  return createParamDecorator(ParamType.HEADER, name, schema);
}

function createRouteDecorator(method: string, path: string): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const routes = (Reflect.getMetadata(REST_ROUTES_KEY, ctor) as RouteMetadata[] | undefined) ?? [];
    const route: RouteMetadata = { method, path, methodName: propertyKey };

    Reflect.defineMetadata(REST_ROUTES_KEY, [...routes, route], ctor);
  };
}

function createParamDecorator(
  type: ParamType,
  name: string | undefined,
  schema: z.ZodType | undefined
): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const paramCtor = target.constructor;
    const paramsMap =
      (Reflect.getMetadata(REST_PARAMS_KEY, paramCtor) as Map<string | symbol, unknown[]> | undefined) ?? new Map();
    const methodParams = paramsMap.get(propertyKey) ?? [];

    methodParams.push({ type, index: parameterIndex, name, pipes: schema ? [{ schema }] : undefined });

    Reflect.defineMetadata(REST_PARAMS_KEY, paramsMap, paramCtor);
  };
}
