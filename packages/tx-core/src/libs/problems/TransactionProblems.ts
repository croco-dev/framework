import { Problem, ProblemCategory } from '@croco/problems-core';

type AfterCommitFailureSummary = {
  name: string;
  message: string;
};

export class TransactionDecoratorProblem extends Problem {
  readonly code = 'tx-core/decorator-misuse';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, '@Transactional can only be applied to methods');
  }
}

export class TransactionContextProblem extends Problem {
  readonly code = 'tx-core/missing-transaction-context';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, 'onAfterCommit must be called within a transaction');
  }
}

export class AfterCommitHooksProblem extends Problem {
  readonly code = 'tx-core/after-commit-hooks-failed';
  readonly category = ProblemCategory.InternalServerError;

  constructor(failures: AfterCommitFailureSummary[], cause: Error) {
    super(undefined, undefined, `${failures.length} afterCommit hook(s) failed after transaction commit`, {
      cause,
      extensions: {
        committed: true,
        failureCount: failures.length,
        failures,
      },
    });
  }
}
