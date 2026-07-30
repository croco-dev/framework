import { Problem, ProblemCategory } from "@croco/problems-core";
import type { ProblemOptions } from "@croco/problems-core";

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

export class AuthProviderUnavailableProblem extends Problem {
  readonly code = "auth-core/auth-provider-unavailable";
  readonly category = ProblemCategory.InternalServerError;
  constructor(detail = "Authentication provider is unavailable", cause?: Error) {
    const options = cause ? ({ cause } satisfies ProblemOptions) : undefined;
    super(
      "auth-core/auth-provider-unavailable",
      ProblemCategory.InternalServerError,
      detail,
      options,
    );
  }
}

export class InvalidRouteMetadataTargetProblem extends Problem {
  readonly code = "auth-core/invalid-route-metadata-target";
  readonly category = ProblemCategory.InternalServerError;
  constructor(target: unknown) {
    const targetType = target === null ? "null" : typeof target;
    super(
      "auth-core/invalid-route-metadata-target",
      ProblemCategory.InternalServerError,
      `Route metadata target must be an object or function; received ${targetType}`,
    );
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

export class ApiKeyRotationConflictProblem extends Problem {
  readonly code = "auth-core/api-key-rotation-conflict";
  readonly category = ProblemCategory.Conflict;
  constructor(detail = "API key rotation conflicts with an existing rotation") {
    super(detail);
  }
}

export class InvalidApiKeyRotationIdempotencyKeyProblem extends Problem {
  readonly code = "auth-core/invalid-api-key-rotation-idempotency-key";
  readonly category = ProblemCategory.ValidationError;
  constructor() {
    super("API key rotation idempotency key must contain between 1 and 255 characters");
  }
}
