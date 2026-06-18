import "reflect-metadata";
import { ProblemCategoryMapper } from "@croco/problems-core";
import { PROBLEM_RESPONSES_KEY } from "../constants";
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

function toProblemResponseMetadata(response: ProblemResponseOptions): ProblemResponseMetadata {
  return {
    ...response,
    status: ProblemCategoryMapper.toHttpStatus(response.category),
  };
}
