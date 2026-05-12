import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 재시도 루프가 정책에 의해 중단되었을 때 발생하는 Problem입니다.
 */
export class RetryAbortedProblem extends Problem {
  readonly code = "RETRY_ABORTED";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    message: string,
    public readonly methodName?: string,
  ) {
    super("RETRY_ABORTED", ProblemCategory.InternalServerError, message);
  }

  static fromContext(methodName: string): RetryAbortedProblem {
    return new RetryAbortedProblem(
      `Retry aborted by listener for method '${methodName}'`,
      methodName,
    );
  }
}
