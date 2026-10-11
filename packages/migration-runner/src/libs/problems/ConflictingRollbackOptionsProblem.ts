import { Problem, ProblemCategory } from "@croco/problems-core";

export class ConflictingRollbackOptionsProblem extends Problem {
  readonly code = "migration-runner/conflicting-rollback-options";
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super(
      undefined,
      undefined,
      "Migration rollback target and count cannot be supplied together. Choose either target or count.",
    );
  }
}
