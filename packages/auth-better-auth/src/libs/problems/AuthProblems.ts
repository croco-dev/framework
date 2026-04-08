import { Problem, ProblemCategory } from '@croco/problems-core';

export class BetterAuthNotInitializedProblem extends Problem {
  readonly code = 'auth-better-auth/not-initialized';
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super('auth-better-auth/not-initialized', ProblemCategory.InternalServerError, 'Better Auth is not initialized');
  }
}

export class BetterAuthSessionNotFoundProblem extends Problem {
  readonly code = 'auth-better-auth/session-not-found';
  readonly category = ProblemCategory.NotFound;

  constructor(sessionId: string) {
    super('auth-better-auth/session-not-found', ProblemCategory.NotFound, `Session with id '${sessionId}' not found`);
  }
}

export class BetterAuthUserNotFoundProblem extends Problem {
  readonly code = 'auth-better-auth/user-not-found';
  readonly category = ProblemCategory.NotFound;

  constructor(userId: string) {
    super('auth-better-auth/user-not-found', ProblemCategory.NotFound, `User with id '${userId}' not found`);
  }
}
