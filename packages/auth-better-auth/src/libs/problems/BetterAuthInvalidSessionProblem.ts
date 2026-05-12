import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * Better Auth 세션에서 사용자 정보를 복구할 수 없을 때 발생하는 문제입니다.
 */
export class BetterAuthInvalidSessionProblem extends Problem {
  readonly code = "auth-better-auth/invalid-session-payload";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(
      "auth-better-auth/invalid-session-payload",
      ProblemCategory.InternalServerError,
      "Better Auth session did not include a valid user payload",
    );
  }
}
