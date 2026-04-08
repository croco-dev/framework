import { Problem, ProblemCategory } from '@croco/problems-core';

export class GuardDeniedProblem extends Problem {
  readonly code = 'protocols-graphql/guard-denied';
  readonly category = ProblemCategory.Forbidden;

  constructor() {
    super(undefined, undefined, 'Access denied by guard');
  }
}
