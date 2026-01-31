import { Problem, ProblemCategory } from '@croco/problems-core';

/**
 * Thrown when an operation requires a tenant context but none is available.
 */
export class TenantRequiredProblem extends Problem {
  constructor(operation?: string) {
    super(
      'tenant/required',
      ProblemCategory.Unauthorized,
      operation ? `Tenant context is required for: ${operation}` : 'Tenant context is required'
    );
  }
}
