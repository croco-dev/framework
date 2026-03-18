import { Problem, ProblemCategory } from '@croco/problems-core';

export class CircuitBreakerStateProblem extends Problem {
  readonly code = 'RETRY_CIRCUIT_BREAKER_INVALID_STATE';
  readonly category = ProblemCategory.InternalServerError;

  // biome-ignore lint/complexity/noUselessConstructor: Problem 클래스의 protected constructor 호출 필요
  constructor(detail: string) {
    super(detail);
  }
}

export class CircuitBreakerLockProblem extends Problem {
  readonly code = 'RETRY_CIRCUIT_BREAKER_LOCK_FAILED';
  readonly category = ProblemCategory.InternalServerError;

  // biome-ignore lint/complexity/noUselessConstructor: Problem 클래스의 protected constructor 호출 필요
  constructor(detail: string) {
    super(detail);
  }
}

export class LambdaTimeoutProblem extends Problem {
  readonly code = 'LAMBDA_TIMEOUT_GUARD';
  readonly category = ProblemCategory.InternalServerError;

  // biome-ignore lint/complexity/noUselessConstructor: Problem 클래스의 protected constructor 호출 필요
  constructor(detail: string) {
    super(detail);
  }
}
