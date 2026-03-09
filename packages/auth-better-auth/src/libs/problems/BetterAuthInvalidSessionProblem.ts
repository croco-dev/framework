import { Problem, ProblemCategory } from '@croco/problems-core';

export class BetterAuthInvalidSessionProblem extends Problem {
  constructor() {
    super(
      'auth-better-auth/invalid-session-payload',
      ProblemCategory.InternalServerError,
      'Better Auth session did not include a valid user payload'
    );
  }
}
