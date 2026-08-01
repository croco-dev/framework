import { z } from "zod";
import { ProblemFactory } from "@croco/problems-core";
import type { ParamIR, RouteIR } from "@croco/protocols-core";

type TrpcRouteInputEnvelope = {
  readonly body?: unknown;
  readonly path?: unknown;
  readonly query?: unknown;
  readonly headers?: unknown;
};

const LOCATION_KEYS = ["path", "query", "headers"] as const;

/**
 * Builds a tRPC input schema that keeps body-only procedures compatible while
 * making every additional Croco request location explicit.
 */
export function createTrpcInputSchema(route: RouteIR): z.ZodType | null {
  if (!hasEnvelopeLocations(route)) {
    return route.inputSchemas.body;
  }

  const shape: z.ZodRawShape = {};

  if (hasBodyParam(route)) {
    shape.body = route.inputSchemas.body ?? z.unknown();
  }

  for (const key of LOCATION_KEYS) {
    const schema = route.inputSchemas[key];
    if (schema) {
      shape[key] = z.preprocess((value) => (value === undefined ? {} : value), schema);
    }
  }

  return z.preprocess((value) => (value === undefined ? {} : value), z.object(shape).strict());
}

/**
 * Resolves Croco route parameter metadata into the positional argument array
 * expected by the controller method.
 */
export function resolveTrpcRouteParams(
  route: RouteIR,
  input: unknown,
  context: unknown,
): unknown[] {
  if (route.params.length === 0) {
    return [];
  }

  const parameterIndexes = route.params.map((param, position) => param.index ?? position);
  assertUniqueParameterIndexes(route, parameterIndexes);

  const envelope = toEnvelope(route, input);
  const maxIndex = Math.max(...parameterIndexes);
  const args: unknown[] = Array.from({ length: maxIndex + 1 }).fill(undefined) as unknown[];

  for (const [position, param] of route.params.entries()) {
    args[param.index ?? position] = resolveParam(param, envelope, context);
  }

  return args;
}

function assertUniqueParameterIndexes(route: RouteIR, indexes: number[]): void {
  const seenIndexes = new Set<number>();

  for (const index of indexes) {
    if (seenIndexes.has(index)) {
      throw ProblemFactory.internalServerError(
        "protocols-trpc/duplicate-parameter-index",
        `Duplicate parameter metadata detected for ${route.methodName} at index ${index}`,
      );
    }

    seenIndexes.add(index);
  }
}

function hasEnvelopeLocations(route: RouteIR): boolean {
  return LOCATION_KEYS.some((key) => route.inputSchemas[key] !== null);
}

function hasBodyParam(route: RouteIR): boolean {
  return route.params.some((param) => param.kind === "body");
}

function toEnvelope(route: RouteIR, input: unknown): TrpcRouteInputEnvelope {
  if (!hasEnvelopeLocations(route)) {
    return { body: input };
  }

  return input as TrpcRouteInputEnvelope;
}

function resolveParam(param: ParamIR, envelope: TrpcRouteInputEnvelope, context: unknown): unknown {
  switch (param.kind) {
    case "body":
      return envelope.body;
    case "path":
      return getNamedLocationValue(envelope.path, param.name);
    case "query":
      return getNamedLocationValue(envelope.query, param.name);
    case "header":
      return getNamedLocationValue(envelope.headers, param.name);
    case "ctx":
      return context;
  }
}

function getNamedLocationValue(location: unknown, name: string): unknown {
  if (typeof location !== "object" || location === null) {
    return undefined;
  }

  return Reflect.get(location, name);
}
