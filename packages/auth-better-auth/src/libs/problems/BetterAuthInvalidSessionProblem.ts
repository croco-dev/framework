import { Problem, ProblemCategory } from '@croco/problems-core';

export class BetterAuthInvalidSessionProblem extends Problem {
  readonly code = 'auth-better-auth/invalid-session-payload';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(
      'auth-better-auth/invalid-session-payload',
      ProblemCategory.InternalServerError,
      'Better Auth session did not include a valid user payload'
    );
  }
}
