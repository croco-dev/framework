import { Problem, ProblemCategory } from "@croco/problems-core";

export class LlmProblem extends Problem {}

export class LlmProviderNotFoundProblem extends Problem {
  static readonly CODE = "LLM_PROVIDER_NOT_FOUND";

  constructor(provider: string) {
    super(
      LlmProviderNotFoundProblem.CODE,
      ProblemCategory.NotFound,
      `LLM provider not found: ${provider}`,
    );
  }
}

export class LlmTokenLimitExceededProblem extends Problem {
  static readonly CODE = "TOKEN_LIMIT_EXCEEDED";

  constructor(limit: number, requested: number) {
    super(
      LlmTokenLimitExceededProblem.CODE,
      ProblemCategory.BadRequest,
      `Token limit exceeded: ${limit} (limit) < ${requested} (requested)`,
      {
        extensions: {
          limit,
          requested,
        },
      },
    );
  }
}

export class LlmRateLimitProblem extends Problem {
  static readonly CODE = "RATE_LIMIT_EXCEEDED";

  constructor(retryAfter: number, retryAt?: string) {
    const detail = retryAt
      ? `Rate limit exceeded. Retry after ${retryAfter} seconds (${retryAt})`
      : `Rate limit exceeded. Retry after ${retryAfter} seconds`;

    super(
      LlmRateLimitProblem.CODE,
      ProblemCategory.TooManyRequests,
      detail,
      retryAt
        ? {
            extensions: {
              retryAfter,
              retryAt,
            },
          }
        : {
            extensions: {
              retryAfter,
            },
          },
    );
  }
}

export class InvalidLlmResponseProblem extends Problem {
  constructor(response: string) {
    super(
      "llm-core/invalid-llm-response",
      ProblemCategory.InternalServerError,
      `Invalid JSON response: ${response}`,
    );
  }
}

export class LlmServiceNotInitializedProblem extends Problem {
  constructor() {
    super(
      "llm-core/llm-service-not-initialized",
      ProblemCategory.InternalServerError,
      "LlmService not initialized. Call setLlmService() first.",
    );
  }
}

export class InvalidLlmPromptProblem extends Problem {
  constructor(actualType: string) {
    super(
      "llm-core/invalid-llm-prompt",
      ProblemCategory.BadRequest,
      `@Llm decorated methods require the first argument to be a string prompt, received: ${actualType}`,
    );
  }
}
