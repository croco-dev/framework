import "reflect-metadata";
import { ProblemCategoryMapper } from "@croco/problems-core";
import { PROBLEM_RESPONSES_KEY } from "../constants";
import { getRouteContractProblems } from "../internal/routeContractProblemMetadata";
import type { ProblemResponseMetadata, ProblemResponseOptions } from "../types";

export function ProblemResponse<
  const Code extends string,
  const Category extends ProblemResponseOptions["category"],
>(response: ProblemResponseOptions<Code, Category>): MethodDecorator {
  return ProblemResponses(response);
}

export function ProblemResponses<const Responses extends readonly ProblemResponseOptions[]>(
  ...responses: Responses
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const existing =
      (Reflect.getMetadata(PROBLEM_RESPONSES_KEY, target.constructor, propertyKey) as
        | ProblemResponseMetadata[]
        | undefined) ?? [];
    const normalized = responses.map(toProblemResponseMetadata);

    Reflect.defineMetadata(
      PROBLEM_RESPONSES_KEY,
      [...existing, ...normalized],
      target.constructor,
      propertyKey,
    );

    return descriptor;
  };
}

type NormalizedProblemResponseMetadata = ProblemResponseMetadata & {
  readonly routeContractProblems?: readonly ProblemResponseMetadata[];
};

function toProblemResponseMetadata(
  response: ProblemResponseOptions,
): NormalizedProblemResponseMetadata {
  const routeContractProblems = getRouteContractProblems(response)?.map(toContractProblemMetadata);

  return {
    code: response.code,
    category: response.category,
    status: response.status ?? ProblemCategoryMapper.toHttpStatus(response.category),
    ...(response.description ? { description: response.description } : {}),
    ...(response.type ? { type: response.type } : {}),
    ...(routeContractProblems ? { routeContractProblems } : {}),
  };
}

function toContractProblemMetadata(response: ProblemResponseMetadata): ProblemResponseMetadata {
  return {
    code: response.code,
    category: response.category,
    status: response.status,
    ...(response.description ? { description: response.description } : {}),
    ...(response.type ? { type: response.type } : {}),
  };
}
