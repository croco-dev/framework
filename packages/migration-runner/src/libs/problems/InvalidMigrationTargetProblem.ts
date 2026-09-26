import { Problem, ProblemCategory } from "@croco/problems-core";

type InvalidMigrationTargetReason = "malformed" | "not-applied";

export class InvalidMigrationTargetProblem extends Problem {
  readonly code = "migration-runner/invalid-target";
  readonly category = ProblemCategory.BadRequest;

  constructor(target: string, reason: InvalidMigrationTargetReason) {
    super(
      undefined,
      undefined,
      reason === "malformed"
        ? `Migration rollback target must be a 14-digit timestamp id: ${target}`
        : `Migration rollback target is not in the applied history: ${target}`,
      { extensions: { target, reason } },
    );
  }
}
