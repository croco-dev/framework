import type { Problem } from '@croco/problems-core';
import { GraphQLError } from 'graphql';

export function problemToGraphQLError(problem: Problem, path?: (string | number)[]): GraphQLError {
  return new GraphQLError(problem.detail ?? problem.code, {
    extensions: {
      code: problem.code,
      status: problem.status,
      title: problem.title,
      type: problem.type,
      ...problem.extensions,
    },
    path,
  });
}

export function isProblem(error: unknown): error is Problem {
  return error instanceof Error && 'code' in error && 'category' in error;
}
