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

export class ApiKeyExpiredProblem extends Problem {
  constructor(detail = 'API key has expired') {
    super('API_KEY_EXPIRED', ProblemCategory.Unauthorized, detail);
  }
}

export class ApiKeyRevokedProblem extends Problem {
  constructor(detail = 'API key has been revoked') {
    super('API_KEY_REVOKED', ProblemCategory.Unauthorized, detail);
  }
}
