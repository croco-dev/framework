import type { ProblemCategory } from "@croco/problems-core";

export const ROUTE_CONTRACT_PROBLEMS_KEY = Symbol.for("croco:rest:routeContractProblems");

type RouteContractProblemMetadata = {
  readonly code: string;
  readonly category: ProblemCategory;
  readonly status: number;
  readonly description?: string;
  readonly type?: string;
};

export function attachRouteContractProblems<TResponse extends object>(
  response: TResponse,
  problems: readonly RouteContractProblemMetadata[],
): TResponse {
  Object.defineProperty(response, ROUTE_CONTRACT_PROBLEMS_KEY, {
    enumerable: false,
    value: problems,
  });

  return response;
}

export function getRouteContractProblems(
  response: object,
): readonly RouteContractProblemMetadata[] | undefined {
  const value = Reflect.get(response, ROUTE_CONTRACT_PROBLEMS_KEY);

  return Array.isArray(value) ? value.filter(isRouteContractProblemMetadata) : undefined;
}

function isRouteContractProblemMetadata(value: unknown): value is RouteContractProblemMetadata {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "category" in value &&
    "status" in value &&
    typeof value.code === "string" &&
    typeof value.category === "string" &&
    typeof value.status === "number"
  );
}
