import { Problem, ProblemCategory } from "@croco/problems-core";

export class InvitationCreationFailedProblem extends Problem {
  readonly code = "INVITATION_CREATION_FAILED";
  readonly category = ProblemCategory.InternalServerError;

  constructor(invitationId: string, phase: "persistence" | "notification" | "event") {
    super(undefined, undefined, "Invitation creation did not complete; retry with the same key", {
      extensions: {
        invitationId,
        phase,
        retrySafe: true,
      },
    });
  }
}

export class InvitationIdempotencyConflictProblem extends Problem {
  readonly code = "INVITATION_IDEMPOTENCY_CONFLICT";
  readonly category = ProblemCategory.Conflict;

  constructor(idempotencyKey: string) {
    super(undefined, undefined, "Invitation idempotency key was reused for different input", {
      extensions: {
        idempotencyKey,
      },
    });
  }
}

export class InvalidInvitationExpiryDurationProblem extends Problem {
  readonly code = "INVALID_INVITATION_EXPIRY_DURATION";
  readonly category = ProblemCategory.ValidationError;

  constructor(received: number) {
    super(
      "INVALID_INVITATION_EXPIRY_DURATION",
      ProblemCategory.ValidationError,
      "Invitation expiry duration must be a positive integer number of days that produces a valid date",
      {
        extensions: {
          constraint: "positive-integer-days-with-valid-date",
          received: String(received),
        },
      },
    );
  }
}

export class InvitationNotFoundProblem extends Problem {
  readonly code = "INVITATION_NOT_FOUND";
  readonly category = ProblemCategory.NotFound;

  constructor(tokenOrId: string) {
    // Preserve the legacy constructor shape while deliberately discarding all identifier input.
    void tokenOrId;
    super(undefined, undefined, "Invitation not found");
  }
}

export class InvitationExpiredProblem extends Problem {
  readonly code = "INVITATION_EXPIRED";
  readonly category = ProblemCategory.Gone;

  constructor(invitationId: string) {
    super(undefined, undefined, `Invitation '${invitationId}' has expired`, {
      extensions: { invitationId },
    });
  }
}

export class InvitationAlreadyAcceptedProblem extends Problem {
  readonly code = "INVITATION_ALREADY_ACCEPTED";
  readonly category = ProblemCategory.Conflict;

  constructor(invitationId: string) {
    super(undefined, undefined, `Invitation '${invitationId}' is already accepted`, {
      extensions: { invitationId },
    });
  }
}

export class InvitationEmailMismatchProblem extends Problem {
  readonly code = "INVITATION_EMAIL_MISMATCH";
  readonly category = ProblemCategory.Forbidden;

  constructor(invitationId: string, expectedEmail: string | null, providedEmail: string | null) {
    super(undefined, undefined, `Invitation '${invitationId}' email does not match`, {
      extensions: { invitationId, expectedEmail, providedEmail },
    });
  }
}

export class InvitationInvalidStatusProblem extends Problem {
  readonly code = "INVITATION_INVALID_STATUS";
  readonly category = ProblemCategory.Conflict;

  constructor(invitationId: string, status: string, operation: string) {
    super(
      undefined,
      undefined,
      `Cannot ${operation} invitation '${invitationId}' with status '${status}'`,
      {
        extensions: { invitationId, invitationStatus: status, operation },
      },
    );
  }
}
