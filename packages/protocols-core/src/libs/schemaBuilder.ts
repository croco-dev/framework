import { z } from 'zod';
import type { ParamIR } from './RouteIR';

export function buildPathSchema(params: ParamIR[]): z.ZodObject<Record<string, z.ZodType>> | null {
  const pathParams = params.filter((param) => param.kind === 'path' && param.name.length > 0);

  if (pathParams.length === 0) {
    return null;
  }

  const shape: Record<string, z.ZodType> = {};

  for (const param of pathParams) {
    shape[param.name] = param.schema ?? z.string();
  }

  return z.object(shape);
}

export function buildQuerySchema(params: ParamIR[]): z.ZodObject<Record<string, z.ZodType>> | null {
  const queryParams = params.filter((param) => param.kind === 'query' && param.name.length > 0);

  if (queryParams.length === 0) {
    return null;
  }

  const shape: Record<string, z.ZodType> = {};

  for (const param of queryParams) {
    shape[param.name] = param.schema ?? z.string();
  }

  return z.object(shape);
}
