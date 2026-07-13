import { Problem, ProblemCategory } from "@croco/problems-core";

export type MigrationQueryResultField = "row" | "id" | "name" | "executedAt";

export type UnsupportedMigrationQueryResultContext = {
  readonly rowIndex?: number;
  readonly field?: MigrationQueryResultField;
};

export class UnsupportedMigrationQueryResultProblem extends Problem {
  readonly code = "migration-runner/unsupported-query-result";
  readonly category = ProblemCategory.InternalServerError;

  constructor(context?: UnsupportedMigrationQueryResultContext) {
    const detail = context
      ? `Migration query row ${context.rowIndex ?? "unknown"} has invalid ${context.field ?? "row"} metadata; normalize the adapter result and repair the persisted migration row before retrying`
      : "Migration query returned an unsupported result shape";

    super(undefined, undefined, detail, {
      extensions: context,
    });
  }
}
