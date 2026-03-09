import { Problem, ProblemCategory } from '@croco/problems-core';

export class RetryAbortedProblem extends Problem {
  readonly code = 'RETRY_ABORTED';
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    message: string,
    public readonly methodName?: string
  ) {
    super('RETRY_ABORTED', ProblemCategory.InternalServerError, message);
  }

  static fromContext(methodName: string): RetryAbortedProblem {
    return new RetryAbortedProblem(`Retry aborted by listener for method '${methodName}'`, methodName);
  }
}
