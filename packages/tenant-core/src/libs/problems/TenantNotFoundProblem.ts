import { Problem, ProblemCategory } from '@croco/problems-core';

/**
 * Thrown when the resolved tenant ID does not exist in the system.
 */
export class TenantNotFoundProblem extends Problem {
  constructor(tenantId: string) {
    super('tenant/not-found', ProblemCategory.NotFound, `Tenant '${tenantId}' not found`);
  }
}
