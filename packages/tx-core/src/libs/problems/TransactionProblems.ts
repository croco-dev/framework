import { Problem, ProblemCategory } from "@croco/problems-core";

type AfterCommitFailureSummary = {
  name: string;
  message: string;
};

export const MAX_TRANSACTION_TIMEOUT_MS = 2_147_483_647;

export type TransactionTimeoutSource = "default" | "run";

/**
 * `@Transactional`이 메서드가 아닌 대상에 적용되면 발생하는 Problem입니다.
 */
export class TransactionDecoratorProblem extends Problem {
  readonly code = "tx-core/decorator-misuse";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, "@Transactional can only be applied to methods");
  }
}

/**
 * 활성 트랜잭션 없이 트랜잭션 컨텍스트를 요구할 때 발생하는 Problem입니다.
 */
export class TransactionContextProblem extends Problem {
  readonly code = "tx-core/missing-transaction-context";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, "onAfterCommit must be called within a transaction");
  }
}

/**
 * 설정된 트랜잭션 제한 시간이 지원 범위를 벗어나면 발생하는 Problem입니다.
 */
export class InvalidTransactionTimeoutProblem extends Problem {
  readonly code = "tx-core/invalid-transaction-timeout";
  readonly category = ProblemCategory.ValidationError;

  constructor(source: TransactionTimeoutSource, timeoutMs: number) {
    super(
      undefined,
      undefined,
      `Transaction ${source} timeout must be an integer between 1 and ${MAX_TRANSACTION_TIMEOUT_MS} milliseconds; received ${timeoutMs}`,
    );
  }
}

/**
 * after-commit 훅 중 하나 이상이 실패했을 때 발생하는 Problem입니다.
 */
export class AfterCommitHooksProblem extends Problem {
  readonly code = "tx-core/after-commit-hooks-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(failures: AfterCommitFailureSummary[], cause: Error) {
    super(
      undefined,
      undefined,
      `${failures.length} afterCommit hook(s) failed after transaction commit`,
      {
        cause,
        extensions: {
          committed: true,
          failureCount: failures.length,
          failures,
        },
      },
    );
  }
}

/**
 * 트랜잭션 실행 시간이 제한 시간을 초과했을 때 발생하는 Problem입니다.
 */
export class TransactionTimeoutProblem extends Problem {
  readonly code = "tx-core/transaction-timeout";
  readonly category = ProblemCategory.InternalServerError;

  constructor(timeoutMs: number, cause?: Error) {
    super(
      undefined,
      undefined,
      `Transaction timed out after ${timeoutMs}ms`,
      cause ? { cause } : undefined,
    );
  }
}
