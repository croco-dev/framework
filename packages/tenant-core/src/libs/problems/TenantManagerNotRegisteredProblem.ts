import { Problem, ProblemCategory } from '@croco/problems-core';

export class TenantManagerNotRegisteredProblem extends Problem {  readonly code = 'tenant-core/tenant-manager-not-registered'; readonly category = ProblemCategory.InternalServerError; constructor(key: string | undefined) { super(`TenantManager not registered for key: '${String(key ?? 'default')}'`);  }  }
