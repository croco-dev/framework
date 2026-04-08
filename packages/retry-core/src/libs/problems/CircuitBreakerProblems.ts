import { Problem, ProblemCategory } from '@croco/problems-core';

export class CircuitBreakerUnexpectedStateProblem extends Problem {
  readonly code = 'retry-core/circuit-breaker-unexpected-state';
  readonly category = ProblemCategory.InternalServerError;

  constructor(state: never) {
    super(undefined, undefined, `Unexpected circuit breaker state: ${String(state)}`);
  }
}
