import { Problem, ProblemCategory, readExplicitRetryability } from "@croco/problems-core";
import type { CircuitState } from "../CircuitBreakerState";

/**
 * 작업 실패 후 서킷 상태 기록도 실패했을 때 두 원인을 함께 보존하는 Problem입니다.
 */
export class CircuitBreakerBookkeepingProblem extends Problem {
  readonly code = "retry-core/circuit-bookkeeping-failed";
  readonly category = ProblemCategory.InternalServerError;
  readonly retryable: boolean | undefined;

  constructor(
    public readonly circuitId: string,
    public readonly state: CircuitState,
    public readonly operationError: unknown,
    public readonly bookkeepingError: unknown,
  ) {
    const retryable = readExplicitRetryability(operationError);
    super(undefined, undefined, "Circuit state recording failed after an operation failure", {
      ...(operationError instanceof Error ? { cause: operationError } : {}),
      extensions: {
        circuitId,
        state,
        operationSucceeded: false,
        bookkeepingRecorded: false,
        ...(retryable === undefined ? {} : { retryable }),
      },
    });
    this.retryable = retryable;
    // Raw failures remain available for diagnosis without entering object spreads or public JSON.
    Object.defineProperties(this, {
      operationError: { enumerable: false, writable: false, configurable: false },
      bookkeepingError: { enumerable: false, writable: false, configurable: false },
    });
  }
}

/** Keep retry classification with the operation, including nested circuit failures. */
export function unwrapCircuitBreakerBookkeepingError(error: unknown): unknown {
  while (error instanceof CircuitBreakerBookkeepingProblem) {
    error = error.operationError;
  }
  return error;
}
