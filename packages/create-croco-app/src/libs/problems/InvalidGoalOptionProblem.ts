import { Problem, ProblemCategory } from "@croco/problems-core";
import type { AppGoal } from "../../types.js";

export class InvalidGoalOptionProblem extends Problem {
  readonly code = "create-croco-app/invalid-goal-option";
  readonly category = ProblemCategory.ValidationError;

  constructor(goal: AppGoal | string, detail: string, recovery: string) {
    super(undefined, undefined, detail, {
      extensions: {
        goal,
        recovery,
      },
    });
  }
}
