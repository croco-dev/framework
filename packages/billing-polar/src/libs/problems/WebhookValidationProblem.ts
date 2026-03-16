import { Problem, ProblemCategory } from '@croco/problems-core';

export class WebhookValidationProblem extends Problem { readonly code = 'WEBHOOK_VALIDATION_FAILED'; readonly category = ProblemCategory.BadRequest; constructor(reason: string) { super(`Webhook validation failed: ${reason}`); } }
