import { Problem, ProblemCategory } from "@croco/problems-core";

import type { BillingProviderCapability } from "../BillingProviderCapabilities";

export class ProviderCapabilityUnavailableProblem extends Problem {
  readonly code = "billing/provider-capability-unavailable";
  readonly category = ProblemCategory.NotImplemented;
  constructor(providerName: string, capability: BillingProviderCapability) {
    super(
      undefined,
      undefined,
      `Billing provider '${providerName}' does not support capability '${capability}'`,
      {
        extensions: {
          capability,
          providerName,
        },
      },
    );
  }
}

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

export class BillingLifecycleCommandConflictProblem extends Problem {
  readonly code = "billing/lifecycle-command-conflict";
  readonly category = ProblemCategory.Conflict;
  constructor(idempotencyKey: string) {
    super(
      undefined,
      undefined,
      `Billing lifecycle idempotency key '${idempotencyKey}' is already bound to another command`,
    );
  }
}

export class BillingLifecycleCommandInProgressProblem extends Problem {
  readonly code = "billing/lifecycle-command-in-progress";
  readonly category = ProblemCategory.Conflict;
  constructor(tenantId: string, idempotencyKey: string) {
    super(
      undefined,
      undefined,
      `Tenant '${tenantId}' already has incomplete billing lifecycle command '${idempotencyKey}'`,
    );
  }
}

export class BillingLifecycleCommandNotFoundProblem extends Problem {
  readonly code = "billing/lifecycle-command-not-found";
  readonly category = ProblemCategory.NotFound;
  constructor(idempotencyKey: string) {
    super(undefined, undefined, `Billing lifecycle command '${idempotencyKey}' was not found`);
  }
}

export class InvalidBillingLifecycleIdempotencyKeyProblem extends Problem {
  readonly code = "billing/invalid-lifecycle-idempotency-key";
  readonly category = ProblemCategory.BadRequest;
  constructor() {
    super(
      undefined,
      undefined,
      "Billing lifecycle idempotency key must contain 1-200 printable ASCII characters",
    );
  }
}

export class BillingCheckoutCreationProblem extends Problem {
  readonly code = "billing/checkout-creation-failed";
  readonly category = ProblemCategory.InternalServerError;
  constructor(billingAccountId: string, detail?: string) {
    super(detail ?? `Failed to create checkout for tenant ${billingAccountId}: unknown error`);
  }
}

export class BillingCheckoutInProgressProblem extends Problem {
  readonly code = "billing/checkout-in-progress";
  readonly category = ProblemCategory.Conflict;
  constructor(tenantId: string, cause?: Error) {
    super(
      undefined,
      undefined,
      `An equivalent checkout is already in progress for tenant '${tenantId}'`,
      cause === undefined ? undefined : { cause },
    );
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

/** Reports why a licensed subscription quantity or quantity policy is invalid. */
export class InvalidSubscriptionQuantityProblem extends Problem {
  readonly code = "billing/invalid-subscription-quantity";
  readonly category = ProblemCategory.BadRequest;
  constructor(reason: string) {
    super(undefined, undefined, `Subscription quantity is invalid: ${reason}`);
  }
}

export class SubscriptionQuantitySourceMismatchProblem extends Problem {
  readonly code = "billing/subscription-quantity-source-mismatch";
  readonly category = ProblemCategory.Conflict;
  constructor(
    expectedPlanVersionRef: string,
    actualPlanVersionRef: string,
    expectedSeatQuota: number,
    actualSeatQuota: number,
  ) {
    super(
      undefined,
      undefined,
      `Quantity source resolved plan '${actualPlanVersionRef}' with seat quota ${actualSeatQuota}; expected plan '${expectedPlanVersionRef}' with seat quota ${expectedSeatQuota}`,
    );
  }
}

export class SubscriptionQuantityReconciliationConflictProblem extends Problem {
  readonly code = "billing/subscription-quantity-reconciliation-conflict";
  readonly category = ProblemCategory.Conflict;
  constructor(externalSubscriptionId: string, sourceVersion: number) {
    super(undefined, undefined, "Source version resolved to conflicting quantity intents", {
      extensions: { externalSubscriptionId, sourceVersion },
    });
  }
}

export class SubscriptionQuantityReconciliationFailedProblem extends Problem {
  readonly code = "billing/subscription-quantity-reconciliation-failed";
  readonly category = ProblemCategory.InternalServerError;
  constructor(externalSubscriptionId: string, cause?: Error) {
    super(undefined, undefined, "Licensed quantity reconciliation failed", {
      ...(cause ? { cause } : {}),
      extensions: { externalSubscriptionId },
    });
  }
}

export class SubscriptionQuantityProviderMismatchProblem extends Problem {
  readonly code = "billing/subscription-quantity-provider-mismatch";
  readonly category = ProblemCategory.InternalServerError;
  constructor(externalSubscriptionId: string, expectedQuantity: number, actualQuantity: number) {
    super(
      undefined,
      undefined,
      `Provider quantity ${actualQuantity} did not match expected quantity ${expectedQuantity}`,
      { extensions: { externalSubscriptionId } },
    );
  }
}

export class SubscriptionQuantityProviderSourceAheadProblem extends Problem {
  readonly code = "billing/subscription-quantity-provider-source-ahead";
  readonly category = ProblemCategory.Conflict;
  constructor(
    externalSubscriptionId: string,
    localSourceVersion: number,
    providerSourceVersion: number,
  ) {
    super(
      undefined,
      undefined,
      "Provider accepted a source version ahead of the local source version",
      { extensions: { externalSubscriptionId, localSourceVersion, providerSourceVersion } },
    );
  }
}
