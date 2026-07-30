import { Problem, ProblemCategory } from "@croco/problems-core";

/** A usage query range cannot be evaluated safely or unambiguously. */
export class InvalidUsageQueryProblem extends Problem {
  constructor(reason: string) {
    super(
      "metering/invalid-usage-query",
      ProblemCategory.ValidationError,
      `Invalid usage query: ${reason}`,
      {
        extensions: {
          reason,
        },
      },
    );
  }
}
