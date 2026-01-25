import { Problem, ProblemCategory } from '@croco/problems-core';

/**
 * Circuit Breaker가 OPEN 상태일 때 발생하는 에러.
 *
 * 실패 임계값을 초과하여 회로가 열린 경우 요청을 거부합니다.
 * HTTP 429 Too Many Requests 상태 코드로 매핑됩니다.
 */
export class CircuitBreakerOpenException extends Problem {
  constructor(circuitId: string) {
    super(`Circuit breaker '${circuitId}' is OPEN`, ProblemCategory.TooManyRequests);
  }
}
