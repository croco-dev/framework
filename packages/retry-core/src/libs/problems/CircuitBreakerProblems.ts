import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 서킷 상태가 예상하지 못한 값일 때 발생하는 Problem입니다.
 */
export class CircuitBreakerUnexpectedStateProblem extends Problem {
  readonly code = "retry-core/circuit-breaker-unexpected-state";
  readonly category = ProblemCategory.InternalServerError;

  constructor(state: never) {
    super(undefined, undefined, `Unexpected circuit breaker state: ${String(state)}`);
  }
}
