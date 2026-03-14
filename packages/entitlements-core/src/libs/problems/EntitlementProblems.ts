import { Problem, ProblemCategory } from '@croco/problems-core';

export class EntitlementDeniedProblem extends Problem {
  constructor(feature: string, reason?: string) {
    const detail = reason ? `Entitlement '${feature}' denied: ${reason}` : `Entitlement '${feature}' denied`;
    super('ENTITLEMENT_DENIED', ProblemCategory.Forbidden, detail);
  }
}
