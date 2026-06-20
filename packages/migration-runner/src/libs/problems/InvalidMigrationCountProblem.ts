import { Problem, ProblemCategory } from "@croco/problems-core";

export class InvalidMigrationCountProblem extends Problem {
  readonly code = "migration-runner/invalid-count";
  readonly category = ProblemCategory.BadRequest;

  constructor(count: unknown) {
    super(
      undefined,
      undefined,
      `Migration rollback count must be a positive integer greater than 0: ${formatMigrationCount(
        count,
      )}`,
    );
  }
}

function formatMigrationCount(count: unknown): string {
  if (typeof count === "number" && Number.isNaN(count)) {
    return "NaN";
  }

  if (count === "") {
    return "empty string";
  }

  return String(count);
}
