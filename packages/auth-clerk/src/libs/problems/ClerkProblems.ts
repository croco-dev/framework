import { Problem, ProblemCategory } from '@croco/problems-core';

export class WebhookVerificationProblem extends Problem {
  constructor() {
    super('auth-clerk/webhook-verification-failed', ProblemCategory.Unauthorized, 'Webhook verification failed');
  }
}

export class InvalidWebhookPayloadProblem extends Problem {
  constructor(eventType?: string) {
    const message =
      typeof eventType === 'string' ? `Invalid webhook payload for event '${eventType}'` : 'Invalid webhook payload';

    super('auth-clerk/invalid-webhook-payload', ProblemCategory.ValidationError, message);
  }
}
