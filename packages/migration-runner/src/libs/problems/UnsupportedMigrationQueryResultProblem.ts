import { Problem, ProblemCategory } from "@croco/problems-core";

export class UnsupportedMigrationQueryResultProblem extends Problem {
  readonly code = "migration-runner/unsupported-query-result";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super(undefined, undefined, "Migration query returned an unsupported result shape");
  }
}
