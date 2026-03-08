import { Problem, ProblemCategory } from '@croco/problems-core';

export class DuplicateTenantManagerRegistrationProblem extends Problem {
  constructor(key: string | undefined) {
    super(
      'tenant-core/duplicate-tenant-manager-registration',
      ProblemCategory.InternalServerError,
      `TenantManager is already registered for key: '${String(key ?? 'default')}'`
    );
  }
}
