import { Problem, ProblemCategory } from '@croco/problems-core';

export class CircuitBreakerOpenProblem extends Problem {
  readonly code = 'CIRCUIT_BREAKER_OPEN';
  readonly category = ProblemCategory.TooManyRequests;

  constructor(circuitId: string) {
    super('CIRCUIT_BREAKER_OPEN', ProblemCategory.TooManyRequests, `Circuit breaker '${circuitId}' is OPEN`);
  }
}
