import { Problem, ProblemCategory } from '@croco/problems-core';

export class TenantManagerNotRegisteredProblem extends Problem {
  constructor(key: string | undefined) {
    super(
      'tenant-core/tenant-manager-not-registered',
      ProblemCategory.InternalServerError,
      `TenantManager not registered for key: '${String(key ?? 'default')}'`
    );
  }
}
