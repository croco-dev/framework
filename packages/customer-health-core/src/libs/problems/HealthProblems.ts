import { Problem, ProblemCategory } from "@croco/problems-core";

export class HealthScoreNotFoundProblem extends Problem {
  readonly code = "HEALTH_SCORE_NOT_FOUND";
  readonly category = ProblemCategory.NotFound;
  constructor(tenantId: string) {
    super(undefined, undefined, `Health score not found for tenant '${tenantId}'`);
  }
}
