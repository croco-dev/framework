import { Problem, ProblemCategory } from '@croco/problems-core';

export class MiddlewareProblem extends Problem {
  readonly code = 'MIDDLEWARE_EXECUTION_ERROR';
  readonly category = ProblemCategory.InternalServerError;
}

export class DurationParseProblem extends Problem {
  readonly code = 'DURATION_PARSE_ERROR';
  readonly category = ProblemCategory.BadRequest;
}
