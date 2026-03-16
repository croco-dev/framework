import { Problem, ProblemCategory } from '@croco/problems-core';

export class TransactionStateProblem extends Problem {
  readonly code = 'events-tx/transaction-state-error';
  readonly category = ProblemCategory.InternalServerError;
  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}
