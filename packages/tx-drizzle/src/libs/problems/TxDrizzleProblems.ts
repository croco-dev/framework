import { Problem, ProblemCategory } from '@croco/problems-core';

export class TenantContextRequiredProblem extends Problem {
  constructor() {
    super('tx-drizzle/tenant-context-required', ProblemCategory.InternalServerError, 'Tenant context is required');
  }
}
