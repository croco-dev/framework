import { Problem, ProblemCategory } from '@croco/problems-core';

export class WebhookProcessingProblem extends Problem {
  constructor(reason: string) {
    super('WEBHOOK_PROCESSING_FAILED', ProblemCategory.InternalServerError, `Webhook processing failed: ${reason}`);
  }
}
