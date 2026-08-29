import { Problem, ProblemCategory } from "@croco/problems-core";

export const MAX_HEALTH_CHECK_TIMEOUT_MS = 2_147_483_647;

export type HealthCheckTimeoutSource = "default" | "indicator";
export type HealthIndicatorNamespace = "health" | "readiness";

/** Health check timeout configuration cannot be represented safely by a Node.js timer. */
export class InvalidHealthCheckTimeoutProblem extends Problem {
  readonly code = "health-core/invalid-timeout";
  readonly category = ProblemCategory.ValidationError;

  constructor(source: HealthCheckTimeoutSource, timeoutMs: number) {
    super(
      undefined,
      undefined,
      `Health check ${source} timeout must be an integer between 1 and ${MAX_HEALTH_CHECK_TIMEOUT_MS} milliseconds; received ${timeoutMs}`,
    );
  }
}

/** An explicit health indicator ID must be non-empty and free of surrounding whitespace. */
export class InvalidHealthIndicatorIdProblem extends Problem {
  readonly code = "health-core/invalid-indicator-id";
  readonly category = ProblemCategory.ValidationError;

  constructor(namespace: HealthIndicatorNamespace, indicatorId: string) {
    super(
      undefined,
      undefined,
      `Health ${namespace} indicator ID must be non-empty and contain no surrounding whitespace; received '${indicatorId}'`,
      {
        extensions: {
          namespace,
          indicatorId,
          retryable: false,
        },
      },
    );
  }
}

/** An explicit health indicator ID is already registered in the same namespace. */
export class DuplicateHealthIndicatorProblem extends Problem {
  readonly code = "health-core/duplicate-indicator-id";
  readonly category = ProblemCategory.InternalServerError;

  constructor(namespace: HealthIndicatorNamespace, indicatorId: string) {
    super(
      undefined,
      undefined,
      `Health ${namespace} indicator '${indicatorId}' is already registered`,
      {
        extensions: {
          namespace,
          indicatorId,
          retryable: false,
        },
      },
    );
  }
}
