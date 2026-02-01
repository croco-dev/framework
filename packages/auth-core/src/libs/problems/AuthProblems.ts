import { Problem, ProblemCategory } from '@croco/problems-core';

export class UnauthorizedProblem extends Problem {
  constructor(detail = 'Authentication required') {
    super('UNAUTHORIZED', ProblemCategory.Unauthorized, detail);
  }
}

export class ForbiddenProblem extends Problem {
  constructor(detail = 'Insufficient permissions') {
    super('FORBIDDEN', ProblemCategory.Forbidden, detail);
  }
}
