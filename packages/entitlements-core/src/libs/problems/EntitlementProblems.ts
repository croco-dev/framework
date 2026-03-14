import { Problem, ProblemCategory } from '@croco/problems-core';

export class EntitlementDeniedProblem extends Problem {
  constructor(feature: string, reason?: string) {
    const detail = reason ? `Entitlement '${feature}' denied: ${reason}` : `Entitlement '${feature}' denied`;
    super('ENTITLEMENT_DENIED', ProblemCategory.Forbidden, detail);
  }
}

export class EntitlementNotFoundProblem extends Problem {
  constructor(feature: string) {
    super('ENTITLEMENT_NOT_FOUND', ProblemCategory.NotFound, `Entitlement '${feature}' not found`);
  }
}
