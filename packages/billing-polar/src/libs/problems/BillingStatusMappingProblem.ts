import { Problem, ProblemCategory } from "@croco/problems-core";

export class BillingStatusMappingProblem extends Problem {
  readonly code = "BILLING_STATUS_MAPPING_FAILED";
  readonly category = ProblemCategory.InternalServerError;
  constructor(status: string) {
    super(undefined, undefined, `Unknown billing status: ${status}`);
  }
}
