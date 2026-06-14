import { z } from "zod";
import type { ParamIR } from "./RouteIR";

export function buildPathSchema(params: ParamIR[]): z.ZodObject<Record<string, z.ZodType>> | null {
  return buildNamedParamSchema(params, "path");
}

export function buildQuerySchema(params: ParamIR[]): z.ZodObject<Record<string, z.ZodType>> | null {
  return buildNamedParamSchema(params, "query");
}

export function buildHeaderSchema(
  params: ParamIR[],
): z.ZodObject<Record<string, z.ZodType>> | null {
  return buildNamedParamSchema(params, "header");
}

function buildNamedParamSchema(
  params: ParamIR[],
  kind: "path" | "query" | "header",
): z.ZodObject<Record<string, z.ZodType>> | null {
  const namedParams = params.filter((param) => param.kind === kind && param.name.length > 0);

  if (namedParams.length === 0) {
    return null;
  }

  const shape: Record<string, z.ZodType> = {};

  for (const param of namedParams) {
    shape[param.name] = param.schema ?? z.string();
  }

  return z.object(shape);
}
