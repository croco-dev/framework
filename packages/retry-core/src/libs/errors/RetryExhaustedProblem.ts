import { Problem, ProblemCategory } from '@croco/problems-core';

export class RetryExhaustedProblem extends Problem {
  readonly code = 'RETRY_EXHAUSTED';
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    message: string,
    public readonly lastError: Error | null = null,
    public readonly attempts: number = 0,
    public readonly methodName?: string
  ) {
    super('RETRY_EXHAUSTED', ProblemCategory.InternalServerError, message);

    Object.setPrototypeOf(this, RetryExhaustedProblem.prototype);

    if (lastError?.stack) {
      this.stack = `${this.stack}\n\nCaused by: ${lastError.stack}`;
    }
  }

  static fromContext(methodName: string, attempts: number, lastError: Error | null): RetryExhaustedProblem {
    const message = `Retry exhausted after ${attempts} attempts for method '${methodName}'`;
    return new RetryExhaustedProblem(message, lastError, attempts, methodName);
  }

  getOriginalError(): Error {
    return this.lastError ?? this;
  }
}
