import { Problem, ProblemCategory } from '@croco/problems-core';

export class TenantTokenNotConfiguredProblem extends Problem {
  readonly code = 'search-meilisearch/tenant-token-not-configured';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, 'Tenant token options are not configured');
  }
}
