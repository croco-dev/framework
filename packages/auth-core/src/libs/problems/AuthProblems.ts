import { Problem, ProblemCategory } from "@croco/problems-core";

export class UnauthorizedProblem extends Problem {
  readonly code = "UNAUTHORIZED";
  readonly category = ProblemCategory.Unauthorized;
  constructor(detail = "Authentication required") {
    super(detail);
  }
}

export class ForbiddenProblem extends Problem {
  readonly code = "FORBIDDEN";
  readonly category = ProblemCategory.Forbidden;
  constructor(detail = "Insufficient permissions") {
    super(detail);
  }
}

export class ApiKeyExpiredProblem extends Problem {
  readonly code = "API_KEY_EXPIRED";
  readonly category = ProblemCategory.Unauthorized;
  constructor(detail = "API key has expired") {
    super(detail);
  }
}

export class ApiKeyRevokedProblem extends Problem {
  readonly code = "API_KEY_REVOKED";
  readonly category = ProblemCategory.Unauthorized;
  constructor(detail = "API key has been revoked") {
    super(detail);
  }
}

export class InvalidPermissionFormatProblem extends Problem {
  readonly code = "auth-core/invalid-permission-format";
  readonly category = ProblemCategory.ValidationError;
  constructor(permission: string) {
    super(undefined, undefined, `Invalid permission format: '${permission}'`);
  }
}

export class InvalidPermissionActionProblem extends Problem {
  readonly code = "auth-core/invalid-permission-action";
  readonly category = ProblemCategory.ValidationError;
  constructor(action: string) {
    super(undefined, undefined, `Invalid permission action: '${action}'`);
  }
}

export class ApiKeyCreationFailedProblem extends Problem {
  readonly code = "auth-core/api-key-creation-failed";
  readonly category = ProblemCategory.InternalServerError;
  constructor(detail = "Failed to create API key") {
    super(detail);
  }
}
