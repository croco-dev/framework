import { Problem, ProblemCategory } from '@croco/problems-core';

export class TenantTokenNotConfiguredProblem extends Problem {
  constructor() {
    super(
      'search-meilisearch/tenant-token-not-configured',
      ProblemCategory.InternalServerError,
      'Tenant token options are not configured'
    );
  }
}
