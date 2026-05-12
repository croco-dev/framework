import { Problem, ProblemCategory } from "@croco/problems-core";

export class DatabaseUrlRequiredProblem extends Problem {
  readonly code = "migration-runner/database-url-required";
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super(
      undefined,
      undefined,
      "Database connection URL required. Use --connection or set DATABASE_URL",
    );
  }
}
