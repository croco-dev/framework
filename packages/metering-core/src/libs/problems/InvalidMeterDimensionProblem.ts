import { Problem, ProblemCategory } from "@croco/problems-core";

/** A meter definition contains an invalid dimension name or enum value. */
export class InvalidMeterDimensionProblem extends Problem {
  constructor(reason: string) {
    super(
      "metering/invalid-meter-dimension",
      ProblemCategory.ValidationError,
      `Invalid meter dimension: ${reason}`,
      {
        extensions: {
          reason,
        },
      },
    );
  }
}
