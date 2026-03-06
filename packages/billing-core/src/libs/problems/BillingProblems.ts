import { Problem, ProblemCategory } from '@croco/problems-core';

export class SubscriptionNotFoundProblem extends Problem {
  constructor(tenantId: string) {
    super('billing/subscription-not-found', ProblemCategory.NotFound, `No subscription found for tenant '${tenantId}'`);
  }
}

export class BillingAccountNotFoundProblem extends Problem {
  constructor(tenantId: string) {
    super('billing/account-not-found', ProblemCategory.NotFound, `No billing account found for tenant '${tenantId}'`);
  }
}

export class WebhookAlreadyProcessedProblem extends Problem {
  constructor(eventId: string) {
    super(
      'billing/webhook-already-processed',
      ProblemCategory.Conflict,
      `Webhook '${eventId}' has already been processed`
    );
  }
}
