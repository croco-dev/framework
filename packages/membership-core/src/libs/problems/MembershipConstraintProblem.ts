import { Problem, ProblemCategory } from "@croco/problems-core";

export class MembershipConstraintProblem extends Problem {
  constructor(
    detail: string,
    extensions?: Record<string, unknown>,
    code = "MEMBERSHIP_CONSTRAINT",
  ) {
    super(code, ProblemCategory.Forbidden, detail, {
      extensions,
    });
  }
}
