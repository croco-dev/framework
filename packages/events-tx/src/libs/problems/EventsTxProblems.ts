import { Problem, ProblemCategory } from '@croco/problems-core';

export class TransactionStateProblem extends Problem {
  constructor(detail: string) {
    super('events-tx/transaction-state-error', ProblemCategory.InternalServerError, detail);
  }
}
