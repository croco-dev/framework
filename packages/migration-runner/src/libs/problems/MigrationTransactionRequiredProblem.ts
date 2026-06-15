import { Problem, ProblemCategory } from "@croco/problems-core";

export class MigrationTransactionRequiredProblem extends Problem {
  readonly code = "migration-runner/transaction-required";
  readonly category = ProblemCategory.ValidationError;

  constructor(direction: "up" | "down") {
    super(
      undefined,
      undefined,
      `Migration ${direction} requires a database client with transaction support`,
    );
  }
}
