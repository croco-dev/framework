import { Problem, ProblemCategory } from "@croco/problems-core";

/** Typed usage cannot be stored because required usage-envelope column mappings are missing. */
export class UsageEnvelopeConfigurationProblem extends Problem {
  constructor(missingMappings: readonly string[]) {
    super(
      "metering-drizzle/usage-envelope-not-configured",
      ProblemCategory.InternalServerError,
      `Usage envelope column mappings are required: ${missingMappings.join(", ")}`,
      {
        extensions: {
          missingMappings: [...missingMappings],
        },
      },
    );
  }
}
