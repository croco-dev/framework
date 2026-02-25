import { Problem, ProblemCategory } from '@croco/problems-core';

export class LogoChurnDataRequiredProblem extends Problem {
  constructor() {
    super(
      'metrics-core/logo-churn-data-required',
      ProblemCategory.ValidationError,
      'Logo churn calculation requires customer count data'
    );
  }
}

export class CarryingCapacitySimulationProblem extends Problem {
  constructor(detail: string) {
    super('metrics-core/carrying-capacity-simulation-error', ProblemCategory.BusinessRuleViolation, detail);
  }
}
