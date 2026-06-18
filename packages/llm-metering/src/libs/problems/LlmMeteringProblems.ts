import { Problem, ProblemCategory } from "@croco/problems-core";

export class LlmMeteringRecordFailedProblem extends Problem {
  constructor(operation: string, meterIds: string[], cause: unknown) {
    const causeError = cause instanceof Error ? cause : new Error(String(cause));

    super(
      "llm-metering/record-failed",
      ProblemCategory.InternalServerError,
      `Failed to record LLM metering for operation '${operation}'`,
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

export class LlmQuotaExceededProblem extends Problem {
  constructor(meterId: string, currentUsage: number, quota: number) {
    super(
      "llm-metering/quota-exceeded",
      ProblemCategory.Forbidden,
      `LLM quota exceeded for meter '${meterId}': current usage ${currentUsage} exceeds quota ${quota}`,
      {
        extensions: {
          meterId,
          currentUsage,
          quota,
        },
      },
    );
  }
}

export class LlmCostLimitExceededProblem extends Problem {
  constructor(tenantId: string, currentCost: number, limit: number, period: "daily" | "monthly") {
    super(
      "llm-metering/cost-limit-exceeded",
      ProblemCategory.Forbidden,
      `LLM cost limit exceeded for tenant '${tenantId}': current cost $${currentCost.toFixed(2)} exceeds $${limit.toFixed(2)} ${period} limit`,
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

export class PricingNotFoundProblem extends Problem {
  readonly code = "llm-metering/pricing-not-found";
  readonly category = ProblemCategory.NotFound;
  constructor(provider: string, modelId: string) {
    super(
      undefined,
      undefined,
      `Pricing not found for provider '${provider}' and model '${modelId}'`,
    );
  }
}

export class PricingRegistryConflictProblem extends Problem {
  constructor(provider: string, modelId: string, version: string) {
    super(
      "llm-metering/pricing-registry-conflict",
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
