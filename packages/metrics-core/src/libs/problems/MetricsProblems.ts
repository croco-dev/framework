import { Problem, ProblemCategory } from "@croco/problems-core";

export class CarryingCapacitySimulationProblem extends Problem {
  readonly code = "metrics-core/carrying-capacity-simulation-error";
  readonly category = ProblemCategory.BusinessRuleViolation;
  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}

export class CarryingCapacityTenantRequiredProblem extends Problem {
  readonly code = "metrics-core/carrying-capacity-tenant-required";
  readonly category = ProblemCategory.ValidationError;
  constructor() {
    super(undefined, undefined, "tenantId is required for carrying capacity calculations");
  }
}

export class RetentionMetricsUnavailableProblem extends Problem {
  readonly code = "metrics-core/retention-metrics-unavailable";
  readonly category = ProblemCategory.NotImplemented;
  constructor(
    detail = "Retention metrics are not available until full retention calculation is implemented",
  ) {
    super(undefined, undefined, detail);
  }
}

export class InvalidRetentionMovementProblem extends Problem {
  readonly code = "metrics-core/invalid-retention-movement";
  readonly category = ProblemCategory.ValidationError;
  constructor(field: "churned" | "contraction", amount: number) {
    super(
      undefined,
      undefined,
      `Retention movement '${field}' amount must be a finite non-negative number: ${String(amount)}`,
    );
  }
}

export class GrossMarginRequiredProblem extends Problem {
  readonly code = "metrics-core/gross-margin-required";
  readonly category = ProblemCategory.ValidationError;
  constructor() {
    super(undefined, undefined, "grossMargin is required when includeMargin is true");
  }
}

export class MixedCurrencyMRRProblem extends Problem {
  readonly code = "metrics-core/mixed-currency-mrr";
  readonly category = ProblemCategory.ValidationError;
  constructor(expectedCurrency: string, actualCurrency: string) {
    super(
      `Cannot aggregate MRR across multiple currencies: expected '${expectedCurrency}' but received '${actualCurrency}'`,
    );
  }
}
