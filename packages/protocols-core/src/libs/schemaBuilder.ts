import { z } from "zod";
import type { ParamIR } from "./RouteIR";

const PATH_PARAM_FALLBACK_SCHEMA = z.string();
const OPTIONAL_PARAM_FALLBACK_SCHEMA = z.string().optional();

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
    shape[param.name] = param.schema ?? getHttpParamFallbackSchema(kind);
  }

  return z.object(shape);
}

export function getHttpParamFallbackSchema(kind: "path" | "query" | "header"): z.ZodType {
  if (kind === "path") {
    return PATH_PARAM_FALLBACK_SCHEMA;
  }

  return OPTIONAL_PARAM_FALLBACK_SCHEMA;
}
