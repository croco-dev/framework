import { Problem, ProblemCategory } from '@croco/problems-core';

export class DuplicateRecordProblem extends Problem {
  constructor(idempotencyKey: string) {
    super(
      'metering/duplicate-record',
      ProblemCategory.Conflict,
      `Record with idempotency key '${idempotencyKey}' already exists`,
      {
        extensions: {
          idempotencyKey,
        },
      }
    );
  }
}
