import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 최대 재시도 횟수를 모두 소진했을 때 발생하는 Problem입니다.
 */
export class RetryExhaustedProblem extends Problem {
  readonly code = "RETRY_EXHAUSTED";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    message: string,
    public readonly lastError: Error | null = null,
    public readonly attempts: number = 0,
    public readonly methodName?: string,
  ) {
    super(
      "RETRY_EXHAUSTED",
      ProblemCategory.InternalServerError,
      message,
      lastError ? { cause: lastError } : undefined,
    );

    Object.setPrototypeOf(this, RetryExhaustedProblem.prototype);
  }

  static fromContext(
    methodName: string,
    attempts: number,
    lastError: Error | null,
  ): RetryExhaustedProblem {
    const message = `Retry exhausted after ${attempts} attempts for method '${methodName}'`;
    return new RetryExhaustedProblem(message, lastError, attempts, methodName);
  }

  getOriginalError(): Error {
    return this.lastError ?? this;
  }
}
