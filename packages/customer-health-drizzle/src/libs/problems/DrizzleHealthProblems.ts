import { Problem, ProblemCategory } from "@croco/problems-core";

export class HealthTransitionSequenceMissingProblem extends Problem {
  readonly code = "customer-health-drizzle/transition-sequence-missing";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super("Health score insert did not return a transition sequence");
  }
}
