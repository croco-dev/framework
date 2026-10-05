import { Problem, ProblemCategory } from "@croco/problems-core";

export class BillingStatusMappingProblem extends Problem {
  readonly code = "BILLING_STATUS_MAPPING_FAILED";
  readonly category = ProblemCategory.InternalServerError;
  constructor(status: string, eventType?: string) {
    super(undefined, undefined, `Unsupported billing status: ${status}`, {
      extensions: {
        rawStatus: status,
        ...(eventType !== undefined && { eventType }),
        retryable: false,
      },
    });
  }
}
