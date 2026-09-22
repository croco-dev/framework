import { Problem, ProblemCategory } from "@croco/problems-core";

export class AiUsageRecordFailedProblem extends Problem {
  constructor(operation: string, meterIds: string[], cause: unknown) {
    const causeError = cause instanceof Error ? cause : new Error(String(cause));

    super(
      "ai-usage/record-failed",
      ProblemCategory.InternalServerError,
      `Failed to record AI metering for operation '${operation}'`,
      {
        cause: causeError,
        extensions: {
          operation,
          meterIds,
        },
      },
    );
  }
}

export class AiUsageQuotaExceededProblem extends Problem {
  constructor(meterId: string, currentUsage: number, quota: number) {
    super(
      "ai-usage/quota-exceeded",
      ProblemCategory.Forbidden,
      `AI quota exceeded for meter '${meterId}': current usage ${currentUsage} exceeds quota ${quota}`,
      {
        extensions: {
          meterId,
          currentUsage: numberEvidence(currentUsage),
          quota: numberEvidence(quota),
        },
      },
    );
  }
}

function numberEvidence(value: number): number | string {
  return Number.isFinite(value) ? value : String(value);
}

export class AiCostLimitExceededProblem extends Problem {
  constructor(tenantId: string, currentCost: number, limit: number, period: "daily" | "monthly") {
    super(
      "ai-usage/cost-limit-exceeded",
      ProblemCategory.Forbidden,
      `AI cost limit exceeded for tenant '${tenantId}': current cost $${currentCost.toFixed(2)} exceeds $${limit.toFixed(2)} ${period} limit`,
      {
        extensions: {
          tenantId,
          currentCost,
          limit,
          period,
        },
      },
    );
  }
}

export class AiPricingNotFoundProblem extends Problem {
  readonly code = "ai-usage/pricing-not-found";
  readonly category = ProblemCategory.NotFound;
  constructor(provider: string, modelId: string) {
    super(
      undefined,
      undefined,
      `Pricing not found for provider '${provider}' and model '${modelId}'`,
    );
  }
}

export class AiPricingRegistryConflictProblem extends Problem {
  constructor(provider: string, modelId: string, version: string) {
    super(
      "ai-usage/pricing-registry-conflict",
      ProblemCategory.Conflict,
      `Duplicate pricing entry for provider '${provider}' and model '${modelId}' in registry '${version}'`,
      {
        extensions: {
          provider,
          modelId,
          version,
        },
      },
    );
  }
}
