import { Problem, ProblemCategory } from "@croco/problems-core";

export class InvalidUsageEnvelopeProblem extends Problem {
  constructor(meterKey: string, field: string, constraint: string) {
    super(
      "metering/invalid-usage-envelope",
      ProblemCategory.ValidationError,
      `Usage for meter '${meterKey}' has invalid field '${field}': ${constraint}`,
      {
        extensions: {
          constraint,
          field,
          meterKey,
        },
      },
    );
  }
}
