import type { ProblemResponseMetadata } from "../types";

export const ROUTE_CONTRACT_PROBLEMS_KEY = Symbol.for("croco:rest:routeContractProblems");

export function attachRouteContractProblems<TResponse extends object>(
  response: TResponse,
  problems: readonly ProblemResponseMetadata[],
): TResponse {
  Object.defineProperty(response, ROUTE_CONTRACT_PROBLEMS_KEY, {
    enumerable: false,
    value: problems,
  });

  return response;
}

export function getRouteContractProblems(
  response: object,
): readonly ProblemResponseMetadata[] | undefined {
  const value = Reflect.get(response, ROUTE_CONTRACT_PROBLEMS_KEY);

  return Array.isArray(value) ? value.filter(isProblemResponseMetadata) : undefined;
}

function isProblemResponseMetadata(value: unknown): value is ProblemResponseMetadata {
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
