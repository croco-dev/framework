import { Problem, ProblemCategory } from '@croco/problems-core';

export class UnauthorizedProblem extends Problem {
  readonly code = 'UNAUTHORIZED';
  readonly category = ProblemCategory.Unauthorized;
  constructor(detail = 'Authentication required') {
    super(detail);
  }
}

export class ForbiddenProblem extends Problem {
  readonly code = 'FORBIDDEN';
  readonly category = ProblemCategory.Forbidden;
  constructor(detail = 'Insufficient permissions') {
    super(detail);
  }
}

export class ApiKeyExpiredProblem extends Problem {
  readonly code = 'API_KEY_EXPIRED';
  readonly category = ProblemCategory.Unauthorized;
  constructor(detail = 'API key has expired') {
    super(detail);
  }
}

export class ApiKeyRevokedProblem extends Problem {
  readonly code = 'API_KEY_REVOKED';
  readonly category = ProblemCategory.Unauthorized;
  constructor(detail = 'API key has been revoked') {
    super(detail);
  }
}

export class InvalidPermissionFormatProblem extends Problem {
  readonly code = 'auth-core/invalid-permission-format';
  readonly category = ProblemCategory.ValidationError;
  constructor(permission: string) {
    super(`Invalid permission format: '${permission}'`);
  }
}

export class InvalidPermissionActionProblem extends Problem {
  readonly code = 'auth-core/invalid-permission-action';
  readonly category = ProblemCategory.ValidationError;
  constructor(action: string) {
    super(`Invalid permission action: '${action}'`);
  }
}
