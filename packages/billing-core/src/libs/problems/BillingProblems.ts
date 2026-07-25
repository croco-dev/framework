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

export class InvalidPlanVersionRefProblem extends Problem {
  readonly code = "billing/invalid-plan-version-ref";
  readonly category = ProblemCategory.BadRequest;
  constructor() {
    super(undefined, undefined, "Plan version reference must not be empty");
  }
}

export class InvalidPlanVersionDefinitionProblem extends Problem {
  readonly code = "billing/invalid-plan-version-definition";
  readonly category = ProblemCategory.BadRequest;
  constructor(reason: string) {
    super(undefined, undefined, `Plan version definition is invalid: ${reason}`);
  }
}

export class PlanVersionAlreadyPublishedProblem extends Problem {
  readonly code = "billing/plan-version-already-published";
  readonly category = ProblemCategory.Conflict;
  constructor(ref: string) {
    super(undefined, undefined, `Plan version '${ref}' has already been published`);
  }
}

export class PlanVersionConflictProblem extends Problem {
  readonly code = "billing/plan-version-conflict";
  readonly category = ProblemCategory.Conflict;
  constructor(ref: string, reason: string) {
    super(undefined, undefined, `Plan version '${ref}' conflicts with published state: ${reason}`);
  }
}

export class UnknownPlanVersionProblem extends Problem {
  readonly code = "billing/unknown-plan-version";
  readonly category = ProblemCategory.NotFound;
  constructor(ref: string) {
    super(undefined, undefined, `Plan version '${ref}' is not registered`);
  }
}

export class UnknownProviderPlanMappingProblem extends Problem {
  readonly code = "billing/unknown-provider-plan-mapping";
  readonly category = ProblemCategory.NotFound;
  constructor(provider: string, productId: string, priceIds: readonly string[]) {
    const priceEvidence =
      priceIds.length === 0 ? "no price IDs" : `price IDs '${priceIds.join(",")}'`;
    super(
      undefined,
      undefined,
      `No plan version maps provider '${provider}' product '${productId}' with ${priceEvidence}`,
    );
  }
}

export class SubscriptionPlanVersionMismatchProblem extends Problem {
  readonly code = "billing/subscription-plan-version-mismatch";
  readonly category = ProblemCategory.BusinessRuleViolation;
  constructor(subscriptionId: string, subscriptionPlanId: string, versionPlanId: string) {
    super(
      undefined,
      undefined,
      `Subscription '${subscriptionId}' plan '${subscriptionPlanId}' cannot be pinned to plan '${versionPlanId}'`,
    );
  }
}
