import { Problem, ProblemCategory } from '@croco/problems-core';

export class CircuitBreakerStateProblem extends Problem {
  readonly code = 'RETRY_CIRCUIT_BREAKER_INVALID_STATE';
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string) {
    super(detail);
  }
}

export class CircuitBreakerLockProblem extends Problem {
  readonly code = 'RETRY_CIRCUIT_BREAKER_LOCK_FAILED';
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string) {
    super(detail);
  }
}

export class LambdaTimeoutProblem extends Problem {
  readonly code = 'LAMBDA_TIMEOUT_GUARD';
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string) {
    super(detail);
  }
}
