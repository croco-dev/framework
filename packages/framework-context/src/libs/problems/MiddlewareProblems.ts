import { Problem, ProblemCategory } from '@croco/problems-core';

export class MiddlewareProblem extends Problem {
  readonly code = 'MIDDLEWARE_EXECUTION_ERROR';
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}
