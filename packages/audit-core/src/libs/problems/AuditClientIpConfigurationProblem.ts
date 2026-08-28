import { Problem, ProblemCategory } from "@croco/problems-core";

export class AuditClientIpConfigurationProblem extends Problem {
  readonly code = "audit-core/client-ip-policy-invalid";
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}
