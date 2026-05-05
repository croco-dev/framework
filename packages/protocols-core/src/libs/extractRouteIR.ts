import 'reflect-metadata';
import {
  type Constructor,
  ParamType,
  type ControllerMetadata,
  type ParamMetadata,
  REST_CONTROLLER_KEY,
  REST_PARAMS_KEY,
  REST_ROUTES_KEY,
  type RouteMetadata,
  ValidationPipe,
} from '@croco/protocols-rest';
import type { z } from 'zod';
import type { ParamIR, RouteIR } from './RouteIR';

export function extractRouteIR(controllerCtor: Constructor): RouteIR[] {
  const controllerMeta = Reflect.getMetadata(REST_CONTROLLER_KEY, controllerCtor) as ControllerMetadata | undefined;
  const routesMeta = Reflect.getMetadata(REST_ROUTES_KEY, controllerCtor) as RouteMetadata[] | undefined;
  const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, controllerCtor) as
    | Map<string | symbol, ParamMetadata[]>
    | undefined;

  if (!controllerMeta || !routesMeta) {
    return [];
  }

  return routesMeta.map((routeMeta) => {
    const params = extractParams(paramsMap?.get(routeMeta.methodName) ?? []);
    const bodyParam = params.find((param) => param.kind === 'body');

    return {
      controllerName: controllerCtor.name,
      methodName: String(routeMeta.methodName),
      httpMethod: routeMeta.method,
      path: joinPaths(controllerMeta.path, routeMeta.path),
      params,
      inputSchema: bodyParam?.schema ?? null,
      outputSchema: null,
      domain: null,
    };
  });
}

function extractParams(paramsMeta: ParamMetadata[]): ParamIR[] {
  return paramsMeta
    .filter((paramMeta) => paramMeta.type !== ParamType.RAW)
    .sort((left, right) => left.index - right.index)
    .map((paramMeta) => ({
      kind: mapParamKind(paramMeta.type),
      name: paramMeta.name ?? '',
      schema: extractSchema(paramMeta),
    }));
}

function mapParamKind(type: ParamType): ParamIR['kind'] {
  switch (type) {
    case ParamType.PARAM:
      return 'path';
    case ParamType.QUERY:
      return 'query';
    case ParamType.BODY:
      return 'body';
    case ParamType.HEADER:
      return 'header';
    case ParamType.CTX:
      return 'ctx';
    case ParamType.RAW:
      return 'ctx';
  }
}

function extractSchema(paramMeta: ParamMetadata): z.ZodType | null {
  const pipe = paramMeta.pipes?.find((candidate) => candidate instanceof ValidationPipe);

  if (!pipe) {
    return null;
  }

  return Reflect.get(pipe, 'schema') as z.ZodType;
}

function joinPaths(base: string, path: string): string {
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path === '' ? '' : path.startsWith('/') ? path : `/${path}`;
  const result = `${cleanBase}${cleanPath}`.replace(/\/+/g, '/');

  return result.length > 1 && result.endsWith('/') ? result.slice(0, -1) : result || '/';
}
