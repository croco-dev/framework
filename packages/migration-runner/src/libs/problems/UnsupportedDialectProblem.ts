import { Problem, ProblemCategory } from '@croco/problems-core';

export class UnsupportedDialectProblem extends Problem {
  readonly code = 'migration-runner/unsupported-dialect';
  readonly category = ProblemCategory.BadRequest;

  constructor(dialect: string) {
    super(undefined, undefined, `Unsupported dialect: ${dialect}`);
  }
}
