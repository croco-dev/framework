import { Problem, ProblemCategory } from '@croco/problems-core';

/**
 * Better Auth 팩토리가 초기화되지 않았을 때 발생하는 문제입니다.
 */
export class BetterAuthNotInitializedProblem extends Problem {
  readonly code = 'auth-better-auth/not-initialized';
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super('auth-better-auth/not-initialized', ProblemCategory.InternalServerError, 'Better Auth is not initialized');
  }
}

/**
 * 요청한 Better Auth 세션을 찾지 못했을 때 발생하는 문제입니다.
 */
export class BetterAuthSessionNotFoundProblem extends Problem {
  readonly code = 'auth-better-auth/session-not-found';
  readonly category = ProblemCategory.NotFound;

  constructor(sessionId: string) {
    super('auth-better-auth/session-not-found', ProblemCategory.NotFound, `Session with id '${sessionId}' not found`);
  }
}

/**
 * 요청한 Better Auth 사용자를 찾지 못했을 때 발생하는 문제입니다.
 */
export class BetterAuthUserNotFoundProblem extends Problem {
  readonly code = 'auth-better-auth/user-not-found';
  readonly category = ProblemCategory.NotFound;

  constructor(userId: string) {
    super('auth-better-auth/user-not-found', ProblemCategory.NotFound, `User with id '${userId}' not found`);
  }
}
