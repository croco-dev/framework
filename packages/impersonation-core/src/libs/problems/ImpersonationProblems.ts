import { Problem, ProblemCategory } from '@croco/problems-core';

export class SelfImpersonationProblem extends Problem {
  constructor() {
    super('SELF_IMPERSONATION_NOT_ALLOWED', ProblemCategory.Forbidden, 'Cannot impersonate yourself');
  }
}

export class NestedImpersonationProblem extends Problem {
  constructor() {
    super('NESTED_IMPERSONATION_NOT_ALLOWED', ProblemCategory.Forbidden, 'Nested impersonation is not allowed');
  }
}

export class ImpersonationReasonRequiredProblem extends Problem {
  constructor() {
    super('IMPERSONATION_REASON_REQUIRED', ProblemCategory.BadRequest, 'Impersonation reason is required');
  }
}

export class BlockedDuringImpersonationProblem extends Problem {
  constructor(action: string) {
    super(
      'BLOCKED_DURING_IMPERSONATION',
      ProblemCategory.Forbidden,
      `Action '${action}' is blocked during impersonation`
    );
  }
}
