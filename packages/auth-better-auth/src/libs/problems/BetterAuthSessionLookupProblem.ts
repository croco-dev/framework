import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * Better Auth 세션 조회 중 예기치 않은 오류가 발생했을 때 발생하는 문제입니다.
 */
export class BetterAuthSessionLookupProblem extends Problem {
  readonly code = "auth-better-auth/session-lookup-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(cause: Error) {
    super(
      "auth-better-auth/session-lookup-failed",
      ProblemCategory.InternalServerError,
      "Better Auth session lookup failed",
      { cause },
    );
  }
}
