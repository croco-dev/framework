import { Problem, ProblemCategory } from '@croco/problems-core';

/**
 * 서킷 브레이커가 OPEN 상태라 호출이 차단될 때 발생하는 Problem입니다.
 */
export class CircuitBreakerOpenProblem extends Problem {
  readonly code = 'CIRCUIT_BREAKER_OPEN';
  readonly category = ProblemCategory.TooManyRequests;

  constructor(circuitId: string) {
    super('CIRCUIT_BREAKER_OPEN', ProblemCategory.TooManyRequests, `Circuit breaker '${circuitId}' is OPEN`);
  }
}
