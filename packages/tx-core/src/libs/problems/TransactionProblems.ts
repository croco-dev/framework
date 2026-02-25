import { Problem, ProblemCategory } from '@croco/problems-core';

export class TransactionDecoratorProblem extends Problem {
  constructor() {
    super(
      'tx-core/decorator-misuse',
      ProblemCategory.InternalServerError,
      '@Transactional can only be applied to methods'
    );
  }
}

export class TransactionContextProblem extends Problem {
  constructor() {
    super(
      'tx-core/missing-transaction-context',
      ProblemCategory.InternalServerError,
      'onAfterCommit must be called within a transaction'
    );
  }
}
