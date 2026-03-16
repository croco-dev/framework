import { Problem, ProblemCategory } from '@croco/problems-core';

export class SelfImpersonationProblem extends Problem {
  readonly code = 'SELF_IMPERSONATION_NOT_ALLOWED';
  readonly category = ProblemCategory.Forbidden;

  constructor() {
    super(undefined, undefined, 'Cannot impersonate yourself');
  }
}

export class NestedImpersonationProblem extends Problem {
  readonly code = 'NESTED_IMPERSONATION_NOT_ALLOWED';
  readonly category = ProblemCategory.Forbidden;

  constructor() {
    super(undefined, undefined, 'Nested impersonation is not allowed');
  }
}

export class ImpersonationReasonRequiredProblem extends Problem {
  readonly code = 'IMPERSONATION_REASON_REQUIRED';
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super(undefined, undefined, 'Impersonation reason is required');
  }
}

export class BlockedDuringImpersonationProblem extends Problem {
  readonly code = 'BLOCKED_DURING_IMPERSONATION';
  readonly category = ProblemCategory.Forbidden;

  constructor(action: string) {
    super(undefined, undefined, `Action '${action}' is blocked during impersonation`);
  }
}

export class ImpersonationSessionNotFoundProblem extends Problem {
  readonly code = 'IMPERSONATION_SESSION_NOT_FOUND';
  readonly category = ProblemCategory.NotFound;

  constructor(sessionId: string) {
    super(undefined, undefined, `Impersonation session not found: ${sessionId}`);
  }
}
