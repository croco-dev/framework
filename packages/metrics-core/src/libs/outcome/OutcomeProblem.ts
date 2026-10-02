import { Problem, ProblemCategory } from "@croco/problems-core";

export class OutcomeProblem extends Problem {
  readonly code = "metrics-core/invalid-outcome";
  readonly category = ProblemCategory.ValidationError;
  constructor(readonly reason: string) {
    super("metrics-core/invalid-outcome", ProblemCategory.ValidationError, reason);
  }
}
