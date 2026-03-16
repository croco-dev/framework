import { Problem, ProblemCategory } from '@croco/problems-core';

export class WebhookProcessingProblem extends Problem { readonly code = 'WEBHOOK_PROCESSING_FAILED'; readonly category = ProblemCategory.InternalServerError; constructor(reason: string) { super(`Webhook processing failed: ${reason}`); } }
