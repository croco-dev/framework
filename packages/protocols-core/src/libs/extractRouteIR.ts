import "reflect-metadata";
import { getProblemCookbookPath, ProblemCategoryMapper } from "@croco/problems-core";
import type { z } from "zod";
import type { ParamIR, ProblemResponseIR, RouteInputSchemas, RouteIR } from "./RouteIR";
import { buildHeaderSchema, buildPathSchema, buildQuerySchema } from "./schemaBuilder";
import {
  type Constructor,
  type ControllerMetadata,
  type ParamMetadata,
  ParamType,
  PROBLEM_RESPONSES_KEY,
  type ProblemResponseMetadata,
  REST_CONTROLLER_KEY,
  REST_PARAMS_KEY,
  REST_ROUTES_KEY,
  type RouteMetadata,
} from "./sharedTypes";

const RESPONSE_SCHEMA_KEY = Symbol.for("croco:rest:responseSchema");

export function extractRouteIR(controllerCtor: Constructor): RouteIR[] {
  const controllerMeta = Reflect.getMetadata(REST_CONTROLLER_KEY, controllerCtor) as
    | ControllerMetadata
    | undefined;
  const routesMeta = Reflect.getMetadata(REST_ROUTES_KEY, controllerCtor) as
    | RouteMetadata[]
    | undefined;
  const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, controllerCtor) as
    | Map<string | symbol, ParamMetadata[]>
    | undefined;

  if (!controllerMeta || !routesMeta) {
    return [];
  }

  return routesMeta.map((routeMeta) => {
    const params = extractParams(paramsMap?.get(routeMeta.methodName) ?? []);
    const inputSchemas = extractInputSchemas(params);
    const outputSchema =
      (Reflect.getMetadata(RESPONSE_SCHEMA_KEY, controllerCtor, routeMeta.methodName) as
        | z.ZodType
        | undefined) ?? null;
    const problemResponses = extractProblemResponses(
      Reflect.getMetadata(PROBLEM_RESPONSES_KEY, controllerCtor, routeMeta.methodName),
    );

    return {
      controllerName: controllerCtor.name,
      methodName: String(routeMeta.methodName),
      httpMethod: routeMeta.method,
      path: joinPaths(controllerMeta.path, routeMeta.path),
      params,
      inputSchema: inputSchemas.body,
      inputSchemas,
      outputSchema,
      problemResponses,
      domain: null,
    };
  });
}

function extractProblemResponses(value: unknown): ProblemResponseIR[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isProblemResponseMetadata)
    .map(toProblemResponseIR)
    .sort(compareProblemResponses);
}

function toProblemResponseIR(response: ProblemResponseMetadata): ProblemResponseIR {
  const routeContractProblems = response.routeContractProblems
    ?.filter(isProblemResponseMetadata)
    .map(toContractProblemResponseIR)
    .sort(compareProblemResponses);

  return {
    code: response.code,
    category: response.category,
    status: getProblemResponseStatus(response),
    cookbookPath: getProblemCookbookPath(response.code),
    ...(response.description ? { description: response.description } : {}),
    ...(response.type ? { type: response.type } : {}),
    ...(routeContractProblems ? { routeContractProblems } : {}),
  };
}

function toContractProblemResponseIR(response: ProblemResponseMetadata): ProblemResponseIR {
  return {
    code: response.code,
    category: response.category,
    status: getProblemResponseStatus(response),
    cookbookPath: getProblemCookbookPath(response.code),
    ...(response.description ? { description: response.description } : {}),
    ...(response.type ? { type: response.type } : {}),
  };
}

function isProblemResponseMetadata(value: unknown): value is ProblemResponseMetadata {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "category" in value &&
    typeof value.code === "string" &&
    value.code.length > 0 &&
    typeof value.category === "string" &&
    (!("status" in value) || typeof value.status === "number")
  );
}

function getProblemResponseStatus(response: ProblemResponseMetadata): number {
  return response.status ?? ProblemCategoryMapper.toHttpStatus(response.category);
}

function compareProblemResponses(left: ProblemResponseIR, right: ProblemResponseIR): number {
  return left.code.localeCompare(right.code) || left.status - right.status;
}

function extractParams(paramsMeta: ParamMetadata[]): ParamIR[] {
  return paramsMeta
    .filter((paramMeta) => paramMeta.type !== ParamType.RAW)
    .sort((left, right) => left.index - right.index)
    .map((paramMeta) => ({
      kind: mapParamKind(paramMeta.type),
      name: paramMeta.name ?? "",
      schema: extractSchema(paramMeta),
    }));
}

function extractInputSchemas(params: ParamIR[]): RouteInputSchemas {
  return {
    body: params.find((param) => param.kind === "body")?.schema ?? null,
    path: buildPathSchema(params),
    query: buildQuerySchema(params),
    headers: buildHeaderSchema(params),
  };
}

function mapParamKind(type: ParamType): ParamIR["kind"] {
  switch (type) {
    case ParamType.PARAM:
      return "path";
    case ParamType.QUERY:
      return "query";
    case ParamType.BODY:
      return "body";
    case ParamType.HEADER:
      return "header";
    case ParamType.CTX:
      return "ctx";
    case ParamType.RAW:
      return "ctx";
  }
}

function extractSchema(paramMeta: ParamMetadata): z.ZodType | null {
  const pipe = paramMeta.pipes?.find(
    (candidate) => candidate && typeof candidate === "object" && "schema" in candidate,
  );

  if (!pipe) {
    return null;
  }

  return Reflect.get(pipe, "schema") as z.ZodType;
}

function joinPaths(base: string, path: string): string {
  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const cleanPath = path === "" ? "" : path.startsWith("/") ? path : `/${path}`;
  const result = `${cleanBase}${cleanPath}`.replace(/\/+/g, "/");

  return result.length > 1 && result.endsWith("/") ? result.slice(0, -1) : result || "/";
}
