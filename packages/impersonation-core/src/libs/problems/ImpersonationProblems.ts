import { Problem, ProblemCategory } from "@croco/problems-core";

export type ImpersonationConfigurationField =
  | "blockedActions"
  | "configuration"
  | "maxDurationMs"
  | "requireReason";

export type ImpersonationConfigurationConstraint =
  | "array-of-non-blank-strings"
  | "boolean"
  | "normalized-action-identifiers"
  | "object"
  | "positive-safe-integer-with-representable-expiration"
  | "registered"
  | "unique-action-identifiers";

export type InvalidImpersonationConfigurationProblemOptions = {
  readonly field: ImpersonationConfigurationField;
  readonly constraint: ImpersonationConfigurationConstraint;
  readonly receivedValue: number | string;
};

/**
 * 유효하지 않은 impersonation 설정으로 런타임 초기화를 진행할 수 없을 때 발생합니다.
 */
export class InvalidImpersonationConfigurationProblem extends Problem {
  readonly code = "IMPERSONATION_CONFIGURATION_INVALID";
  readonly category = ProblemCategory.InternalServerError;
  readonly field: ImpersonationConfigurationField;
  readonly constraint: ImpersonationConfigurationConstraint;
  readonly receivedValue: number | string;

  constructor(options: InvalidImpersonationConfigurationProblemOptions) {
    super(
      undefined,
      undefined,
      `Invalid impersonation configuration: ${options.field} must satisfy ${options.constraint}`,
      { extensions: options },
    );
    this.field = options.field;
    this.constraint = options.constraint;
    this.receivedValue = options.receivedValue;
  }
}

export class SelfImpersonationProblem extends Problem {
  readonly code = "SELF_IMPERSONATION_NOT_ALLOWED";
  readonly category = ProblemCategory.Forbidden;

  constructor() {
    super(undefined, undefined, "Cannot impersonate yourself");
  }
}

export class ImpersonationIdentityConflictProblem extends Problem {
  readonly code = "IMPERSONATION_IDENTITY_CONFLICT";
  readonly category = ProblemCategory.Forbidden;

  constructor() {
    super(undefined, undefined, "Request context identity does not match authenticated identity");
  }
}

export class ImpersonationTargetNotFoundProblem extends Problem {
  readonly code = "IMPERSONATION_TARGET_NOT_FOUND";
  readonly category = ProblemCategory.NotFound;

  constructor(targetUserId: string) {
    super(undefined, undefined, `Impersonation target not found: ${targetUserId}`);
  }
}

export class NestedImpersonationProblem extends Problem {
  readonly code = "NESTED_IMPERSONATION_NOT_ALLOWED";
  readonly category = ProblemCategory.Forbidden;

  constructor() {
    super(undefined, undefined, "Nested impersonation is not allowed");
  }
}

export class ImpersonationReasonRequiredProblem extends Problem {
  readonly code = "IMPERSONATION_REASON_REQUIRED";
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super(undefined, undefined, "Impersonation reason is required");
  }
}

export class BlockedDuringImpersonationProblem extends Problem {
  readonly code = "BLOCKED_DURING_IMPERSONATION";
  readonly category = ProblemCategory.Forbidden;

  constructor(action: string) {
    super(undefined, undefined, `Action '${action}' is blocked during impersonation`);
  }
}

export class ImpersonationSessionNotFoundProblem extends Problem {
  readonly code = "IMPERSONATION_SESSION_NOT_FOUND";
  readonly category = ProblemCategory.NotFound;

  constructor(sessionId: string) {
    super(undefined, undefined, `Impersonation session not found: ${sessionId}`);
  }
}

export class ImpersonationSessionActorMismatchProblem extends Problem {
  readonly code = "IMPERSONATION_SESSION_ACTOR_MISMATCH";
  readonly category = ProblemCategory.Forbidden;

  constructor() {
    super(undefined, undefined, "Authenticated actor cannot end this impersonation session");
  }
}
