import { Problem, ProblemCategory } from "@croco/problems-core";

export class SubscriptionNotFoundProblem extends Problem {
  readonly code = "billing/subscription-not-found";
  readonly category = ProblemCategory.NotFound;
  constructor(tenantId: string) {
    super(undefined, undefined, `No subscription found for tenant '${tenantId}'`);
  }
}

export class BillingAccountNotFoundProblem extends Problem {
  readonly code = "billing/account-not-found";
  readonly category = ProblemCategory.NotFound;
  constructor(tenantId: string) {
    super(undefined, undefined, `No billing account found for tenant '${tenantId}'`);
  }
}

export class WebhookAlreadyProcessedProblem extends Problem {
  readonly code = "billing/webhook-already-processed";
  readonly category = ProblemCategory.Conflict;
  constructor(eventId: string) {
    super(undefined, undefined, `Webhook '${eventId}' has already been processed`);
  }
}

export class BillingCheckoutCreationProblem extends Problem {
  readonly code = "billing/checkout-creation-failed";
  readonly category = ProblemCategory.InternalServerError;
  constructor(billingAccountId: string, detail?: string) {
    super(detail ?? `Failed to create checkout for tenant ${billingAccountId}: unknown error`);
  }
}

export class InvalidMoneyAmountProblem extends Problem {
  readonly code = "billing/invalid-money-amount";
  readonly category = ProblemCategory.BadRequest;
  constructor(amount: number) {
    super(undefined, undefined, `Money amount must be a safe integer minor unit value: ${amount}`);
  }
}

export class InvalidMoneyCurrencyProblem extends Problem {
  readonly code = "billing/invalid-money-currency";
  readonly category = ProblemCategory.BadRequest;
  constructor(currency: string) {
    super(undefined, undefined, `Money currency must be a 3-letter ISO code: '${currency}'`);
  }
}

export class MoneyCurrencyMismatchProblem extends Problem {
  readonly code = "billing/money-currency-mismatch";
  readonly category = ProblemCategory.BusinessRuleViolation;
  constructor(expectedCurrency: string, actualCurrency: string) {
    super(
      undefined,
      undefined,
      `Money currency mismatch: expected '${expectedCurrency}', received '${actualCurrency}'`,
    );
  }
}

export class MoneyDivisionByZeroProblem extends Problem {
  readonly code = "billing/money-division-by-zero";
  readonly category = ProblemCategory.BadRequest;
  constructor() {
    super(undefined, undefined, "Money division requires a non-zero divisor");
  }
}
