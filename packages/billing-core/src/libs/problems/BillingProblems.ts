import { Problem, ProblemCategory } from '@croco/problems-core';

export class SubscriptionNotFoundProblem extends Problem { readonly code = 'billing/subscription-not-found'; readonly category = ProblemCategory.NotFound; constructor(tenantId: string) { super(`No subscription found for tenant '${tenantId}'`); } }

export class BillingAccountNotFoundProblem extends Problem { readonly code = 'billing/account-not-found'; readonly category = ProblemCategory.NotFound; constructor(tenantId: string) { super(`No billing account found for tenant '${tenantId}'`); } }

export class WebhookAlreadyProcessedProblem extends Problem { readonly code = 'billing/webhook-already-processed'; readonly category = ProblemCategory.Conflict; constructor(eventId: string) { super(`Webhook '${eventId}' has already been processed`); } }

export class BillingCheckoutCreationProblem extends Problem { readonly code = 'billing/checkout-creation-failed'; readonly category = ProblemCategory.InternalServerError; constructor(billingAccountId: string, detail?: string) { super(detail ?? `Failed to create checkout for tenant ${billingAccountId}: unknown error`); } }
