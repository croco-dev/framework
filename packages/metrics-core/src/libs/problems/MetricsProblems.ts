import { Problem, ProblemCategory } from '@croco/problems-core';

export class CarryingCapacitySimulationProblem extends Problem {
  constructor(detail: string) {
    super('metrics-core/carrying-capacity-simulation-error', ProblemCategory.BusinessRuleViolation, detail);
  }
}

export class CarryingCapacityTenantRequiredProblem extends Problem {
  constructor() {
    super(
      'metrics-core/carrying-capacity-tenant-required',
      ProblemCategory.ValidationError,
      'tenantId is required for carrying capacity calculations'
    );
  }
}

export class RetentionMetricsUnavailableProblem extends Problem {
  constructor(detail = 'Retention metrics are not available until full retention calculation is implemented') {
    super('metrics-core/retention-metrics-unavailable', ProblemCategory.NotImplemented, detail);
  }
}

export class GrossMarginRequiredProblem extends Problem {
  constructor() {
    super(
      'metrics-core/gross-margin-required',
      ProblemCategory.ValidationError,
      'grossMargin is required when includeMargin is true'
    );
  }
}

export class MixedCurrencyMRRProblem extends Problem {
  constructor(expectedCurrency: string, actualCurrency: string) {
    super(
      'metrics-core/mixed-currency-mrr',
      ProblemCategory.ValidationError,
      `Cannot aggregate MRR across multiple currencies: expected '${expectedCurrency}' but received '${actualCurrency}'`
    );
  }
}
