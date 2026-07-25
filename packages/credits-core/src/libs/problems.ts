import { Problem, ProblemCategory } from "@croco/problems-core";

export class InvalidCreditAmountProblem extends Problem {
  readonly code = "credits-core/invalid-amount";
  readonly category = ProblemCategory.ValidationError;

  constructor(reason: string) {
    super(undefined, undefined, `Credit amount is invalid: ${reason}.`);
  }
}

export class CreditAccountNotFoundProblem extends Problem {
  readonly code = "credits-core/account-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(accountId: string) {
    super(undefined, undefined, `Credit account '${accountId}' was not found.`);
  }
}

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

export class InvalidCreditCommandProblem extends Problem {
  readonly code = "credits-core/invalid-command";
  readonly category = ProblemCategory.ValidationError;

  constructor(reason: string) {
    super(undefined, undefined, `Credit command is invalid: ${reason}.`);
  }
}

export class CreditTransactionNotFoundProblem extends Problem {
  readonly code = "credits-core/transaction-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(transactionId: string) {
    super(undefined, undefined, `Credit transaction '${transactionId}' was not found.`);
  }
}

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
