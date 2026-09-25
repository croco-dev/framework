import { Problem, ProblemCategory } from "@croco/problems-core";

const DETAIL_DUPLICATE_LIMIT = 20;

/** The meters table has several rows for one (tenant_id, meter_id), so its unique index cannot be created. */
export class DuplicateMeterDefinitionsProblem extends Problem {
  constructor(
    duplicates: readonly {
      readonly tenantId: string;
      readonly meterId: string;
      readonly rowCount: number;
    }[],
  ) {
    const diagnostics = duplicates
      .slice(0, DETAIL_DUPLICATE_LIMIT)
      .map(
        (duplicate) =>
          `tenant '${duplicate.tenantId}', meter '${duplicate.meterId}' (${duplicate.rowCount} rows)`,
      );
    const omitted = duplicates.length - diagnostics.length;
    const omittedSuffix = omitted > 0 ? `; ${omitted} more in extensions.duplicates` : "";
    super(
      "metering-drizzle/duplicate-meter-definitions",
      ProblemCategory.InternalServerError,
      `Cannot enforce unique meter definitions because duplicates exist: ${diagnostics.join("; ")}${omittedSuffix}`,
      {
        extensions: {
          duplicates: duplicates.map((duplicate) => ({ ...duplicate })),
        },
      },
    );
  }
}
