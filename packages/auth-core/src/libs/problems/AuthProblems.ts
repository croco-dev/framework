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

export class InvalidPermissionFormatProblem extends Problem {
  constructor(permission: string) {
    super(
      'auth-core/invalid-permission-format',
      ProblemCategory.ValidationError,
      `Invalid permission format: '${permission}'`
    );
  }
}

export class InvalidPermissionActionProblem extends Problem {
  constructor(action: string) {
    super(
      'auth-core/invalid-permission-action',
      ProblemCategory.ValidationError,
      `Invalid permission action: '${action}'`
    );
  }
}
