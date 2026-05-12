import { Problem, ProblemCategory } from "@croco/problems-core";

export class AtomicQuotaNotSupportedProblem extends Problem {
  readonly code = "metering/atomic-quota-not-supported";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(
      undefined,
      undefined,
      "UsageStorage must implement atomic quota checks for quota-enabled meters",
    );
  }
}
