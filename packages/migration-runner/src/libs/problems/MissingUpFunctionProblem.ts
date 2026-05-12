import { Problem, ProblemCategory } from "@croco/problems-core";

export class MissingUpFunctionProblem extends Problem {
  readonly code = "migration-runner/missing-up-function";
  readonly category = ProblemCategory.ValidationError;

  constructor(fileId: string, fileName: string) {
    super(undefined, undefined, `Migration ${fileId}_${fileName} has no up function`);
  }
}
