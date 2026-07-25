import { Problem, ProblemCategory } from "@croco/problems-core";

export class InvalidMeterDefinitionProblem extends Problem {
  constructor(field: string, constraint: string) {
    super(
      "metering/invalid-meter-definition",
      ProblemCategory.ValidationError,
      `Meter definition field '${field}' ${constraint}`,
      {
        extensions: {
          constraint,
          field,
        },
      },
    );
  }
}
