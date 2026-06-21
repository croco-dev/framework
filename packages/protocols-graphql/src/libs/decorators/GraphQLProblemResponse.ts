import "reflect-metadata";
import type { ProblemCategory } from "@croco/problems-core";
import { ProblemCategoryMapper } from "@croco/problems-core";
import { GRAPHQL_PROBLEM_RESPONSES_KEY } from "../constants";

export type GraphQLProblemResponseOptions<
  Code extends string = string,
  Category extends ProblemCategory = ProblemCategory,
> = {
  readonly code: Code;
  readonly category: Category;
  readonly status?: number;
  readonly description?: string;
  readonly type?: string;
};

export type GraphQLProblemResponseMetadata = {
  readonly code: string;
  readonly category: ProblemCategory;
  readonly status: number;
  readonly description?: string;
  readonly type?: string;
};

export function GraphQLProblemResponse<
  const Code extends string,
  const Category extends ProblemCategory,
>(response: GraphQLProblemResponseOptions<Code, Category>): MethodDecorator {
  return GraphQLProblemResponses(response);
}

export function GraphQLProblemResponses<
  const Responses extends readonly GraphQLProblemResponseOptions[],
>(...responses: Responses): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const existing =
      (Reflect.getMetadata(GRAPHQL_PROBLEM_RESPONSES_KEY, target.constructor, propertyKey) as
        | GraphQLProblemResponseMetadata[]
        | undefined) ?? [];
    const normalized = responses.map(toGraphQLProblemResponseMetadata);

    Reflect.defineMetadata(
      GRAPHQL_PROBLEM_RESPONSES_KEY,
      [...existing, ...normalized],
      target.constructor,
      propertyKey,
    );

    return descriptor;
  };
}

function toGraphQLProblemResponseMetadata(
  response: GraphQLProblemResponseOptions,
): GraphQLProblemResponseMetadata {
  return {
    code: response.code,
    category: response.category,
    status: response.status ?? ProblemCategoryMapper.toHttpStatus(response.category),
    ...(response.description ? { description: response.description } : {}),
    ...(response.type ? { type: response.type } : {}),
  };
}
