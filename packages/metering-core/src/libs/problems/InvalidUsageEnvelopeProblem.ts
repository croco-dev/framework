import { Problem, ProblemCategory } from "@croco/problems-core";

/** A typed usage envelope violates its meter's billing or dimension contract. */
export class InvalidUsageEnvelopeProblem extends Problem {
  constructor(meterKey: string, reason: string) {
    super(
      "metering/invalid-usage-envelope",
      ProblemCategory.ValidationError,
      `Invalid usage envelope for meter '${meterKey}': ${reason}`,
      {
        extensions: {
          meterKey,
          reason,
        },
      },
    );
  }
}
