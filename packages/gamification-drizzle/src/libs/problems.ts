import { Problem, ProblemCategory } from "@croco/problems-core";
export class RewardPersistenceProblem extends Problem {
  readonly code = "gamification-drizzle/persistence-failure";
  readonly category = ProblemCategory.InternalServerError;
  constructor(operation: string, cause?: Error) {
    super(undefined, undefined, `Reward persistence failed during '${operation}'.`, { cause });
  }
}
