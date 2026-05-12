import { Problem, ProblemCategory } from "@croco/problems-core";

export class InvitationRateLimitExceededProblem extends Problem {
  readonly code = "INVITATION_RATE_LIMIT_EXCEEDED";
  readonly category = ProblemCategory.TooManyRequests;

  constructor(limit: string) {
    super(`Invitation rate limit exceeded: ${limit}`);
  }
}

export class DuplicateInvitationProblem extends Problem {
  readonly code = "DUPLICATE_INVITATION";
  readonly category = ProblemCategory.Conflict;

  constructor(tenantId: string, email: string) {
    super(`Invitation already exists for tenant '${tenantId}' and email '${email}'`);
  }
}
