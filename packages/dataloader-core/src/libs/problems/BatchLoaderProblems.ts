import { Problem, ProblemCategory } from '@croco/problems-core';

export class BatchResultLengthMismatchProblem extends Problem {
  readonly code = 'dataloader-core/batch-result-length-mismatch';
  readonly category = ProblemCategory.InternalServerError;
  constructor(expected: number, actual: number) {
    super(`BatchLoader: batch function returned ${actual} results, expected ${expected}`);
  }
}
