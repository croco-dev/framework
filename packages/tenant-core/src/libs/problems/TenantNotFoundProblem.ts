import { Problem, ProblemCategory } from '@croco/problems-core';

/**
 * Thrown when the resolved tenant ID does not exist in the system.
 */
export class TenantNotFoundProblem extends Problem {
  readonly code = 'tenant/not-found';
  readonly category = ProblemCategory.NotFound;
  constructor(tenantId: string) {
    super(undefined, undefined, `Tenant '${tenantId}' not found`);
  }
}
