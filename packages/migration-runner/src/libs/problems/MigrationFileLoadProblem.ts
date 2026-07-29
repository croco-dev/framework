import { Problem, ProblemCategory } from "@croco/problems-core";
import type { ProblemOptions } from "@croco/problems-core";

export class MigrationFileLoadProblem extends Problem {
  readonly code = "migration-runner/file-load-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(moduleUrl: string, cause: unknown) {
    const normalizedCause = cause instanceof Error ? cause : new Error(String(cause));
    const options = { cause: normalizedCause } satisfies ProblemOptions;
    super(undefined, undefined, `Failed to load migration file '${moduleUrl}'`, options);
  }
}
