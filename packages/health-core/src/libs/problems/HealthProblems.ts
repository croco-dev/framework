import { Problem, ProblemCategory } from "@croco/problems-core";

export const MAX_HEALTH_CHECK_TIMEOUT_MS = 2_147_483_647;

export type HealthCheckTimeoutSource = "default" | "indicator";
/** Source-safe identity classification used by health indicator registration diagnostics. */
export type HealthIndicatorIdentityKind = "explicit-id" | "inferred-name" | "indicator-reference";
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

/** A supplied or inferred health indicator identity must be non-empty and trimmed. */
export class InvalidHealthIndicatorIdProblem extends Problem {
  readonly code = "health-core/invalid-indicator-id";
  readonly category = ProblemCategory.ValidationError;

  constructor(
    namespace: HealthIndicatorNamespace,
    indicatorId: string,
    identityKind: Exclude<HealthIndicatorIdentityKind, "indicator-reference"> = "explicit-id",
  ) {
    super(
      undefined,
      undefined,
      `Health ${namespace} indicator identity must be non-empty and contain no surrounding whitespace`,
      {
        extensions: {
          namespace,
          identityKind,
          retryable: false,
        },
      },
    );
    void indicatorId;
  }
}

/** A health indicator identity is already registered in the same namespace. */
export class DuplicateHealthIndicatorProblem extends Problem {
  readonly code = "health-core/duplicate-indicator-id";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    namespace: HealthIndicatorNamespace,
    indicatorId?: string,
    identityKind: HealthIndicatorIdentityKind = indicatorId === undefined
      ? "indicator-reference"
      : "explicit-id",
  ) {
    super(undefined, undefined, `Health ${namespace} indicator identity is already registered`, {
      extensions: {
        namespace,
        identityKind,
        retryable: false,
      },
    });
  }
}
