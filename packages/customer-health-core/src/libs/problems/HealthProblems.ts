import { Problem, ProblemCategory } from '@croco/problems-core';

export class HealthScoreNotFoundProblem extends Problem {
  constructor(tenantId: string) {
    super('HEALTH_SCORE_NOT_FOUND', ProblemCategory.NotFound, `Health score not found for tenant '${tenantId}'`);
  }
}
