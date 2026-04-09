import { Problem, ProblemCategory } from '@croco/problems-core';

export class MissingDownFunctionProblem extends Problem {
  readonly code = 'migration-runner/missing-down-function';
  readonly category = ProblemCategory.ValidationError;

  constructor(fileId: string, fileName: string) {
    super(undefined, undefined, `Migration ${fileId}_${fileName} has no down function`);
  }
}
