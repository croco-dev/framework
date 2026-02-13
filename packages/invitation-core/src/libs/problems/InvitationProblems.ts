import { Problem, ProblemCategory } from '@croco/problems-core';

export class InvitationNotFoundProblem extends Problem {
  constructor(tokenOrId: string) {
    super('INVITATION_NOT_FOUND', ProblemCategory.NotFound, `Invitation not found for identifier '${tokenOrId}'`, {
      extensions: { tokenOrId },
    });
  }
}

export class InvitationExpiredProblem extends Problem {
  constructor(invitationId: string) {
    super('INVITATION_EXPIRED', ProblemCategory.Gone, `Invitation '${invitationId}' has expired`, {
      extensions: { invitationId },
    });
  }
}

export class InvitationAlreadyAcceptedProblem extends Problem {
  constructor(invitationId: string) {
    super('INVITATION_ALREADY_ACCEPTED', ProblemCategory.Conflict, `Invitation '${invitationId}' is already accepted`, {
      extensions: { invitationId },
    });
  }
}

export class InvitationEmailMismatchProblem extends Problem {
  constructor(invitationId: string, expectedEmail: string | null, providedEmail: string | null) {
    super('INVITATION_EMAIL_MISMATCH', ProblemCategory.Forbidden, `Invitation '${invitationId}' email does not match`, {
      extensions: { invitationId, expectedEmail, providedEmail },
    });
  }
}

export class InvitationInvalidStatusProblem extends Problem {
  constructor(invitationId: string, status: string, operation: string) {
    super(
      'INVITATION_INVALID_STATUS',
      ProblemCategory.Conflict,
      `Cannot ${operation} invitation '${invitationId}' with status '${status}'`,
      {
        extensions: { invitationId, status, operation },
      }
    );
  }
}
