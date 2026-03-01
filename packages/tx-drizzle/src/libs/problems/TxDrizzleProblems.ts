import { Problem, ProblemCategory } from '@croco/problems-core';

export class TenantContextRequiredProblem extends Problem {
  constructor() {
    super('tx-drizzle/tenant-context-required', ProblemCategory.InternalServerError, 'Tenant context is required');
  }
}

export class RlsExecuteUnsupportedProblem extends Problem {
  constructor(configKey: string) {
    super(
      'tx-drizzle/rls-execute-unsupported',
      ProblemCategory.InternalServerError,
      `Transaction client does not support execute(), cannot set RLS key '${configKey}'`
    );
  }
}
