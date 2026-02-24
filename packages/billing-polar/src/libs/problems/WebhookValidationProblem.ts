import { Problem, ProblemCategory } from '@croco/problems-core';

export class WebhookValidationProblem extends Problem {
  constructor(reason: string) {
    super('WEBHOOK_VALIDATION_FAILED', ProblemCategory.BadRequest, `Webhook validation failed: ${reason}`);
  }
}
