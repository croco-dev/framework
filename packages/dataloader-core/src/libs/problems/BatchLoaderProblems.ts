import { Problem, ProblemCategory } from '@croco/problems-core';

export class BatchResultLengthMismatchProblem extends Problem {
  constructor(expected: number, actual: number) {
    super(
      'dataloader-core/batch-result-length-mismatch',
      ProblemCategory.InternalServerError,
      `BatchLoader: batch function returned ${actual} results, expected ${expected}`
    );
  }
}
