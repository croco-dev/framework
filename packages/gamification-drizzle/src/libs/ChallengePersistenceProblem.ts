import { Problem, ProblemCategory } from "@croco/problems-core";
export class ChallengePersistenceProblem extends Problem {
  constructor(operation: string, cause: unknown) {
    super(
      "gamification-drizzle/persistence",
      ProblemCategory.InternalServerError,
      `Challenge persistence failed: ${operation}`,
      { cause: cause instanceof Error ? cause : new Error(String(cause)) },
    );
  }
}
