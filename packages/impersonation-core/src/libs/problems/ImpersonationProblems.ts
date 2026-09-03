import { Problem, ProblemCategory } from "@croco/problems-core";

export type ImpersonationConfigurationField =
  | "blockedActions"
  | "clock"
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
  | "valid-date"
  | "unique-action-identifiers";

export type InvalidImpersonationConfigurationProblemOptions = {
  readonly field: ImpersonationConfigurationField;
  readonly constraint: ImpersonationConfigurationConstraint;
  readonly receivedValue: number | string;
};

/**
 * 런타임 초기화 또는 저장소 작업 중 유효하지 않은 impersonation 설정이 발견될 때 발생합니다.
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

/**
 * Indicates that an authorized caller tried to end an impersonation session started by another actor.
 *
 * This Forbidden problem preserves the session so only its original impersonator can terminate it.
 */
export class ImpersonationSessionActorMismatchProblem extends Problem {
  readonly code = "IMPERSONATION_SESSION_ACTOR_MISMATCH";
  readonly category = ProblemCategory.Forbidden;

  constructor() {
    super(undefined, undefined, "Authenticated actor cannot end this impersonation session");
  }
}

export type ImpersonationLifecyclePublicationStage = "publish" | "acknowledge" | "predecessor";

export class ImpersonationLifecyclePublicationProblem extends Problem {
  readonly code = "IMPERSONATION_LIFECYCLE_PUBLICATION_PENDING";
  readonly category = ProblemCategory.InternalServerError;
  readonly reconciliationState = "pending" as const;

  constructor(
    readonly sessionId: string,
    readonly eventId: string,
    readonly lifecycle: "started" | "ended",
    readonly stage: ImpersonationLifecyclePublicationStage,
    cause: Error,
  ) {
    super(
      undefined,
      undefined,
      `Impersonation session '${sessionId}' committed, but lifecycle event '${eventId}' requires reconciliation`,
      {
        cause,
        extensions: {
          eventId,
          lifecycle,
          reconciliationState: "pending",
          sessionId,
          stage,
        },
      },
    );
  }
}

export class ImpersonationEventIntentConflictProblem extends Problem {
  readonly code = "impersonation-core/event-intent-conflict";
  readonly category = ProblemCategory.Conflict;

  constructor(eventId: string) {
    super(
      undefined,
      undefined,
      `Impersonation lifecycle event intent '${eventId}' conflicts with the stored session state`,
    );
  }
}

export class InvalidImpersonationEventIntentLimitProblem extends Problem {
  readonly code = "impersonation-core/event-intent-limit-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(limit: number) {
    super(
      undefined,
      undefined,
      `Impersonation lifecycle event intent limit must be an integer between 1 and 1000; received ${limit}`,
    );
  }
}
