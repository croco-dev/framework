import { Problem, ProblemCategory } from '@croco/problems-core';

export class BatchSizeExceededProblem extends Problem {
  readonly code = 'invitation-core/batch-size-exceeded';
  readonly category = ProblemCategory.BadRequest;

  constructor(maxBatchSize: number) {
    super(undefined, undefined, `Batch size exceeds maximum of ${maxBatchSize}`);
  }
}
