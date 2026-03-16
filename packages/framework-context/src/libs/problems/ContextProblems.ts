import { Problem, ProblemCategory } from '@croco/problems-core';

export class MiddlewareProblem extends Problem {
  readonly code = 'MIDDLEWARE_EXECUTION_ERROR';
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string) {
    super(detail);
  }
}

export class DurationParseProblem extends Problem {
  readonly code = 'DURATION_PARSE_ERROR';
  readonly category = ProblemCategory.BadRequest;

  constructor(detail: string) {
    super(detail);
  }
}
