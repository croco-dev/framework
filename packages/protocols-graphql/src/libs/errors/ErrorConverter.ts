import {
  createProblemResponseDetail,
  createProblemResponseExtensions,
  Problem,
  resolveProblemResponseRedactionPolicy,
} from "@croco/problems-core";
import { GraphQLError } from "graphql";

export function problemToGraphQLError(
  problem: Problem,
  path?: readonly (string | number)[],
): GraphQLError {
  const redactionPolicy = resolveProblemResponseRedactionPolicy(problem);

  return new GraphQLError(
    createProblemResponseDetail(problem.detail, redactionPolicy) ?? problem.code,
    {
      extensions: {
        code: problem.code,
        status: problem.status,
        title: problem.title,
        type: problem.type,
        ...createProblemResponseExtensions(problem.extensions, redactionPolicy),
      },
      path,
    },
  );
}

export function isProblem(error: unknown): error is Problem {
  return error instanceof Problem;
}
