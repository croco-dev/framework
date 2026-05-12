import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * Thrown when an operation requires a tenant context but none is available.
 */
export class TenantRequiredProblem extends Problem {
  readonly code = "tenant/required";
  readonly category = ProblemCategory.Unauthorized;
  constructor(operation?: string) {
    super(
      operation ? `Tenant context is required for: ${operation}` : "Tenant context is required",
    );
  }
}
