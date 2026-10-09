import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * Personalized cache policy declarations must stay within supported shapes.
 * PII or credential-bearing dimension values must never reach this layer
 * because keys are derived only from allow-listed region-local dimensions.
 */
export class PersonalizedCachePolicyProblem extends Problem {
  readonly code = "cache-core/personalized-cache-policy-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(detail: string) {
    super("cache-core/personalized-cache-policy-invalid", ProblemCategory.ValidationError, detail);
  }
}
