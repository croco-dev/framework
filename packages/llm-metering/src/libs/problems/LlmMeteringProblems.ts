import { Problem, ProblemCategory } from '@croco/problems-core';

export class LlmQuotaExceededProblem extends Problem {
  constructor(meterId: string, currentUsage: number, quota: number) {
    super(
      'llm-metering/quota-exceeded',
      ProblemCategory.Forbidden,
      `LLM quota exceeded for meter '${meterId}': current usage ${currentUsage} exceeds quota ${quota}`,
      {
        extensions: {
          meterId,
          currentUsage,
          quota,
        },
      }
    );
  }
}

export class LlmCostLimitExceededProblem extends Problem {
  constructor(tenantId: string, currentCost: number, limit: number, period: 'daily' | 'monthly') {
    super(
      'llm-metering/cost-limit-exceeded',
      ProblemCategory.Forbidden,
      `LLM cost limit exceeded for tenant '${tenantId}': current cost $${currentCost.toFixed(2)} exceeds $${limit.toFixed(2)} ${period} limit`,
      {
        extensions: {
          tenantId,
          currentCost,
          limit,
          period,
        },
      }
    );
  }
}

export class PricingNotFoundProblem extends Problem {
  constructor(provider: string, modelId: string) {
    super(
      'llm-metering/pricing-not-found',
      ProblemCategory.NotFound,
      `Pricing not found for provider '${provider}' and model '${modelId}'`
    );
  }
}
