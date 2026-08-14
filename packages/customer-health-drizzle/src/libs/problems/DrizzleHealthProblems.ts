import { Problem, ProblemCategory } from "@croco/problems-core";

/** Indicates that a persisted health-score transition did not return its required sequence. */
export class HealthTransitionSequenceMissingProblem extends Problem {
  readonly code = "customer-health-drizzle/transition-sequence-missing";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super("Health score insert did not return a transition sequence");
  }
}
