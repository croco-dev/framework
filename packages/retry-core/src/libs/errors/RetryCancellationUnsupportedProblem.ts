import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 취소 신호를 지원하지 않는 사용자 백오프 정책으로 재시도를 구성했을 때 발생하는 Problem입니다.
 */
export class RetryCancellationUnsupportedProblem extends Problem {
  readonly code = "retry-core/backoff-cancellation-unsupported";
  readonly category = ProblemCategory.ValidationError;

  constructor(methodName: string) {
    super(
      "retry-core/backoff-cancellation-unsupported",
      ProblemCategory.ValidationError,
      `Backoff policy for method '${methodName}' must declare AbortSignal support`,
      { extensions: { methodName } },
    );
  }
}
