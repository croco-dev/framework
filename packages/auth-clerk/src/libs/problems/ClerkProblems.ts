import { Problem, ProblemCategory } from '@croco/problems-core';

export class WebhookVerificationProblem extends Problem {
  constructor() {
    super('auth-clerk/webhook-verification-failed', ProblemCategory.Unauthorized, 'Webhook verification failed');
  }
}
