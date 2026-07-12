import { Problem, ProblemCategory } from "@croco/problems-core";
import type { InboxMessageStatus } from "../TransactionalEventTypes";

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

/** Raised when inbox completion no longer owns the processing attempt it started. */
export class InboxClaimConflictProblem extends Problem {
  readonly code = "events-tx/inbox-claim-conflict";
  readonly category = ProblemCategory.Conflict;

  constructor(
    consumerId: string,
    inboxKey: string,
    expectedAttempts: number,
    actualAttempts: number,
    actualStatus: InboxMessageStatus,
  ) {
    super(
      undefined,
      undefined,
      `Inbox claim '${consumerId}:${inboxKey}' expected processing attempt ${expectedAttempts}, but the current record is ${actualStatus} at attempt ${actualAttempts}.`,
      {
        extensions: {
          consumerId,
          inboxKey,
          expectedAttempts,
          actualAttempts,
          actualStatus,
        },
      },
    );
  }
}
