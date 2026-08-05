import { Problem, ProblemCategory } from "@croco/problems-core";

export const MAX_HEALTH_CHECK_TIMEOUT_MS = 2_147_483_647;

export type HealthCheckTimeoutSource = "default" | "indicator";

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
