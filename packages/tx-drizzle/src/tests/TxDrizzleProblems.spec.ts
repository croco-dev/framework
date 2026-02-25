import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { TenantContextRequiredProblem } from '../libs/problems/TxDrizzleProblems';

describe('TxDrizzleProblems', () => {
  it('should create TenantContextRequiredProblem with expected metadata', () => {
    const problem = new TenantContextRequiredProblem();

    expect(problem.code).toBe('tx-drizzle/tenant-context-required');
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe('Tenant context is required');
  });
});
