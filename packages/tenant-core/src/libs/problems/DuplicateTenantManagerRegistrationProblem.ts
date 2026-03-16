import { Problem, ProblemCategory } from '@croco/problems-core';

export class DuplicateTenantManagerRegistrationProblem extends Problem {  readonly code = 'tenant-core/duplicate-tenant-manager-registration'; readonly category = ProblemCategory.InternalServerError; constructor(key: string | undefined) { super(`TenantManager is already registered for key: '${String(key ?? 'default')}'`);  }  }
