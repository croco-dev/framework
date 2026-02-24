import { Problem, ProblemCategory } from '@croco/problems-core';

export class BillingStatusMappingProblem extends Problem {
  constructor(status: string) {
    super('BILLING_STATUS_MAPPING_FAILED', ProblemCategory.InternalServerError, `Unknown billing status: ${status}`);
  }
}
