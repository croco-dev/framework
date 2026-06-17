import { Problem, ProblemCategory } from "@croco/problems-core";

export class AiTenantRequiredProblem extends Problem {
  readonly code = "ai-saas/tenant-required";
  readonly category = ProblemCategory.ValidationError;

  constructor() {
    super(undefined, undefined, "AI requests require an x-tenant-id header.");
  }
}

export class AiTenantNotFoundProblem extends Problem {
  readonly code = "ai-saas/tenant-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(tenantId: string) {
    super(undefined, undefined, `Tenant ${tenantId} was not found for the AI request.`);
  }
}

export class AiModelRequiredProblem extends Problem {
  readonly code = "ai-saas/model-required";
  readonly category = ProblemCategory.ValidationError;

  constructor() {
    super(undefined, undefined, "AI requests require a model id.");
  }
}

export class AiModelNotFoundProblem extends Problem {
  readonly code = "ai-saas/model-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(modelId: string) {
    super(undefined, undefined, `AI model ${modelId} is not registered in this app.`);
  }
}

export class AiQuotaExceededProblem extends Problem {
  readonly code = "ai-saas/quota-exceeded";
  readonly category = ProblemCategory.TooManyRequests;

  constructor(meterId: string, projectedUsage: number, quota: number) {
    super(
      undefined,
      undefined,
      `AI quota exceeded for ${meterId}: projected usage ${projectedUsage} exceeds quota ${quota}.`,
    );
  }
}

export class AiRateLimitExceededProblem extends Problem {
  readonly code = "ai-saas/rate-limit-exceeded";
  readonly category = ProblemCategory.TooManyRequests;

  constructor(limit: number) {
    super(undefined, undefined, `AI rate limit exceeded. Retry after the ${limit}/minute window.`);
  }
}

export class AiProviderUnavailableProblem extends Problem {
  readonly code = "ai-saas/provider-unavailable";
  readonly category = ProblemCategory.InternalServerError;

  constructor(modelId: string, cause?: unknown) {
    const message =
      cause instanceof Error
        ? `AI provider for ${modelId} is unavailable: ${cause.message}`
        : `AI provider for ${modelId} is unavailable.`;
    super(undefined, undefined, message);
  }
}

export class AiSaasSmokeProblem extends Problem {
  readonly code = "ai-saas/smoke-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(failures: readonly string[]) {
    super(undefined, undefined, `AI SaaS smoke failed: ${failures.join("; ")}`);
  }
}
