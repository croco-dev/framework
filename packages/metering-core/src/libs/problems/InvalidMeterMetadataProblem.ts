import { Problem, ProblemCategory } from "@croco/problems-core";

/** A meter definition contains metadata outside the JSON and Date data contract. */
export class InvalidMeterMetadataProblem extends Problem {
  constructor(meter: { tenantId: string; meterId: string }, path: string, reason: string) {
    super(
      "metering/invalid-meter-metadata",
      ProblemCategory.ValidationError,
      `Invalid metadata for meter '${meter.meterId}': ${reason}`,
      { extensions: { tenantId: meter.tenantId, meterId: meter.meterId, path, reason } },
    );
  }
}
