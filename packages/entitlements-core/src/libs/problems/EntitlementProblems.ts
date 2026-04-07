import { Problem, ProblemCategory } from '@croco/problems-core';

export class EntitlementDeniedProblem extends Problem {
  readonly code = 'ENTITLEMENT_DENIED';
  readonly category = ProblemCategory.Forbidden;

  constructor(feature: string, reason?: string) {
    const detail = reason ? `Entitlement '${feature}' denied: ${reason}` : `Entitlement '${feature}' denied`;
    super(undefined, undefined, detail);
  }
}

export class EntitlementNotFoundProblem extends Problem {
  readonly code = 'ENTITLEMENT_NOT_FOUND';
  readonly category = ProblemCategory.NotFound;

  constructor(feature: string) {
    super(undefined, undefined, `Entitlement '${feature}' not found`);
  }
}
