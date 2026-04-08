import { Problem, ProblemCategory } from '@croco/problems-core';

export class InvalidWebhookSignatureProblem extends Problem {
  readonly code = 'auth-better-auth/invalid-webhook-signature';
  readonly category = ProblemCategory.Unauthorized;

  constructor() {
    super(undefined, undefined, 'Invalid webhook signature');
  }
}

export class InvalidWebhookPayloadProblem extends Problem {
  readonly code = 'auth-better-auth/invalid-webhook-payload';
  readonly category = ProblemCategory.BadRequest;

  constructor() {
    super(undefined, undefined, 'Invalid webhook payload');
  }
}
