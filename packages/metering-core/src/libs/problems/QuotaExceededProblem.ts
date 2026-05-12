import { Problem, ProblemCategory } from "@croco/problems-core";

export class QuotaExceededProblem extends Problem {
  constructor(meterId: string, currentUsage: number, quota: number) {
    super(
      "metering/quota-exceeded",
      ProblemCategory.Forbidden,
      `Quota exceeded for meter '${meterId}': current usage ${currentUsage} exceeds quota ${quota}`,
      {
        extensions: {
          meterId,
          currentUsage,
          quota,
        },
      },
    );
  }
}
