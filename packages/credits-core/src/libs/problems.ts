import { Problem, ProblemCategory } from "@croco/problems-core";

/** Reports a non-canonical, non-positive, or otherwise invalid credit amount. */
export class InvalidCreditAmountProblem extends Problem {
  readonly code = "credits-core/invalid-amount";
  readonly category = ProblemCategory.ValidationError;

  constructor(reason: string) {
    super(undefined, undefined, `Credit amount is invalid: ${reason}.`);
  }
}

/** Reports that a requested credit account does not exist. */
export class CreditAccountNotFoundProblem extends Problem {
  readonly code = "credits-core/account-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(accountId: string) {
    super(undefined, undefined, `Credit account '${accountId}' was not found.`);
  }
}

/** Reports that eligible available credits cannot fund the requested operation. */
export class InsufficientCreditsProblem extends Problem {
  readonly code = "credits-core/insufficient-credits";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(accountId: string, requested: string, available: string) {
    super(
      undefined,
      undefined,
      `Credit account '${accountId}' has ${available} eligible credits but ${requested} were requested.`,
    );
  }
}

/** Reports that expired grant lots would otherwise have funded the requested operation. */
export class ExpiredGrantProblem extends Problem {
  readonly code = "credits-core/expired-grant";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(accountId: string) {
    super(
      undefined,
      undefined,
      `Expired grant lots cannot fund the requested consumption on account '${accountId}'.`,
    );
  }
}

/** Reports that a reservation cannot be settled using the requested intent. */
export class CreditReservationMismatchProblem extends Problem {
  readonly code = "credits-core/reservation-mismatch";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(reservationId: string, reason: string) {
    super(
      undefined,
      undefined,
      `Credit reservation '${reservationId}' cannot be settled: ${reason}.`,
    );
  }
}

/** Reports reuse of an idempotency key for a different semantic command. */
export class CreditDuplicateConflictProblem extends Problem {
  readonly code = "credits-core/duplicate-conflict";
  readonly category = ProblemCategory.Conflict;

  constructor(idempotencyKey: string) {
    super(
      undefined,
      undefined,
      `Idempotency key '${idempotencyKey}' was already used for a different semantic command.`,
    );
  }
}

/** Reports that a referenced credit resource belongs to another account. */
export class CreditAccountMismatchProblem extends Problem {
  readonly code = "credits-core/account-mismatch";
  readonly category = ProblemCategory.Conflict;

  constructor(resourceId: string, expectedAccountId: string, actualAccountId: string) {
    super(
      undefined,
      undefined,
      `Credit resource '${resourceId}' belongs to account '${actualAccountId}', not '${expectedAccountId}'.`,
    );
  }
}

/** Reports an optimistic-concurrency mismatch at the credit ledger head. */
export class StaleLedgerPositionProblem extends Problem {
  readonly code = "credits-core/stale-ledger-position";
  readonly category = ProblemCategory.Conflict;

  constructor(accountId: string, expected: number, actual: number) {
    super(
      undefined,
      undefined,
      `Credit account '${accountId}' is at ledger position ${actual}, not expected position ${expected}.`,
    );
  }
}

/** Reports an invalid credit ledger command or malformed command metadata. */
export class InvalidCreditCommandProblem extends Problem {
  readonly code = "credits-core/invalid-command";
  readonly category = ProblemCategory.ValidationError;

  constructor(reason: string) {
    super(undefined, undefined, `Credit command is invalid: ${reason}.`);
  }
}

/** Reports that a referenced credit transaction does not exist. */
export class CreditTransactionNotFoundProblem extends Problem {
  readonly code = "credits-core/transaction-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(transactionId: string) {
    super(undefined, undefined, `Credit transaction '${transactionId}' was not found.`);
  }
}

/** Reports a refund that does not match the referenced consumption transaction. */
export class CreditRefundMismatchProblem extends Problem {
  readonly code = "credits-core/refund-mismatch";
  readonly category = ProblemCategory.BusinessRuleViolation;

  constructor(transactionId: string, reason: string) {
    super(
      undefined,
      undefined,
      `Credit transaction '${transactionId}' cannot be refunded: ${reason}.`,
    );
  }
}

/** Reports a committed credit command whose domain event could not be published. */
export class CreditEventPublicationProblem extends Problem {
  readonly code = "credits-core/event-publication-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(idempotencyKey: string, cause: Error) {
    super(
      undefined,
      undefined,
      `Credit ledger command '${idempotencyKey}' committed, but its event could not be published.`,
      { cause },
    );
  }
}
