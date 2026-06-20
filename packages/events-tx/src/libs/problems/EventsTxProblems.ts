import { Problem, ProblemCategory } from "@croco/problems-core";

export class TransactionStateProblem extends Problem {
  readonly code = "events-tx/transaction-state-error";
  readonly category = ProblemCategory.InternalServerError;
  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}

export class OutboxTransactionRequiredProblem extends Problem {
  readonly code = "events-tx/outbox-transaction-required";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super(undefined, undefined, "Outbox append requires an active transaction context.");
  }
}

export class OutboxStorageProblem extends Problem {
  readonly code = "events-tx/storage-error";
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string, cause?: Error) {
    super(undefined, undefined, detail, cause ? { cause } : undefined);
  }
}

export class OutboxPublishExhaustedProblem extends Problem {
  readonly code = "events-tx/outbox-publish-exhausted";
  readonly category = ProblemCategory.InternalServerError;

  constructor(messageId: string, attempts: number, cause?: Error) {
    super(
      undefined,
      undefined,
      `Outbox message '${messageId}' exhausted ${attempts} publish attempt(s).`,
      cause ? { cause } : undefined,
    );
  }
}
