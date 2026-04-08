import { Problem, ProblemCategory } from '@croco/problems-core';

export class InvalidWebhookSignatureProblem extends Problem {
  readonly code = 'auth-better-auth/invalid-webhook-signature';
  readonly category = ProblemCategory.Unauthorized;

  constructor() {
    super('auth-better-auth/invalid-webhook-signature', ProblemCategory.Unauthorized, 'Invalid webhook signature');
  }
}

export class InvalidWebhookPayloadProblem extends Problem {
  readonly code = 'auth-better-auth/invalid-webhook-payload';
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super('auth-better-auth/invalid-webhook-payload', ProblemCategory.BadRequest, 'Invalid webhook payload');
  }
}
