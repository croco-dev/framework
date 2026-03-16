import { Problem, ProblemCategory } from '@croco/problems-core';

export class TransactionDecoratorProblem extends Problem {
  readonly code = 'tx-core/decorator-misuse';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super('@Transactional can only be applied to methods');
  }
}

export class TransactionContextProblem extends Problem {
  readonly code = 'tx-core/missing-transaction-context';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super('onAfterCommit must be called within a transaction');
  }
}
