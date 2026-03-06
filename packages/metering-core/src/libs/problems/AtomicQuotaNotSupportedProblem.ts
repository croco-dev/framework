import { Problem, ProblemCategory } from '@croco/problems-core';

export class AtomicQuotaNotSupportedProblem extends Problem {
  constructor() {
    super(
      'metering/atomic-quota-not-supported',
      ProblemCategory.InternalServerError,
      'UsageStorage must implement atomic quota checks for quota-enabled meters'
    );
  }
}
