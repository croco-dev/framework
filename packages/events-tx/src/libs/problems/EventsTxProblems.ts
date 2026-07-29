import { Problem, ProblemCategory } from "@croco/problems-core";
import type { InboxMessageStatus } from "../TransactionalEventTypes";

export type OutboxIdempotencyField =
  | "eventId"
  | "eventType"
  | "aggregateId"
  | "payload"
  | "metadata"
  | "occurredAt";

export type TransactionalEventConfigurationField =
  | "batchSize"
  | "consumerId"
  | "limit"
  | "maxAttempts"
  | "retry.baseDelayMs"
  | "retry.maxDelayMs"
  | "retry.multiplier"
  | "visibilityTimeoutMs";

export type TransactionalEventConfigurationConstraint =
  | "non-blank-string-at-most-128"
  | "non-negative-int32"
  | "positive-finite-number"
  | "positive-int32";

export type InvalidTransactionalEventConfigurationProblemOptions = {
  readonly field: TransactionalEventConfigurationField;
  readonly constraint: TransactionalEventConfigurationConstraint;
  readonly receivedValue: number | string;
};

/** Raised when a public transactional event option violates its declared boundary. */
export class InvalidTransactionalEventConfigurationProblem extends Problem {
  readonly code = "events-tx/configuration-invalid";
  readonly category = ProblemCategory.InternalServerError;
  readonly field: TransactionalEventConfigurationField;
  readonly constraint: TransactionalEventConfigurationConstraint;
  readonly receivedValue: number | string;

  constructor(options: InvalidTransactionalEventConfigurationProblemOptions) {
    super(
      "events-tx/configuration-invalid",
      ProblemCategory.InternalServerError,
      `${options.field} must satisfy ${options.constraint}; received ${String(options.receivedValue)}.`,
      { extensions: options },
    );
    this.field = options.field;
    this.constraint = options.constraint;
    this.receivedValue = options.receivedValue;
  }
}

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

/** Raised when an outbox idempotency key is reused for a different canonical request. */
export class OutboxIdempotencyConflictProblem extends Problem {
  readonly code = "events-tx/outbox-idempotency-conflict";
  readonly category = ProblemCategory.Conflict;

  constructor(
    readonly idempotencyKey: string,
    readonly conflictingFields: readonly OutboxIdempotencyField[],
  ) {
    super(
      undefined,
      undefined,
      `Outbox idempotency key '${idempotencyKey}' was reused with different canonical request fields: ${conflictingFields.join(", ")}.`,
      {
        extensions: {
          idempotencyKey,
          conflictingFields,
        },
      },
    );
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
