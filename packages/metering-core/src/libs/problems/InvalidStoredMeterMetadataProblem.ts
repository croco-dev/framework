import { Problem, ProblemCategory } from "@croco/problems-core";
import type { InvalidMeterMetadataProblem } from "./InvalidMeterMetadataProblem";

/** A repository returned meter metadata outside the supported data contract. */
export class InvalidStoredMeterMetadataProblem extends Problem {
  constructor(meter: { tenantId: string; meterId: string }, invalid: InvalidMeterMetadataProblem) {
    super(
      "metering/invalid-stored-meter-metadata",
      ProblemCategory.InternalServerError,
      `Stored metadata for meter '${meter.meterId}' is invalid`,
      {
        extensions: {
          tenantId: meter.tenantId,
          meterId: meter.meterId,
          path: invalid.extensions?.path ?? "/metadata",
          reason: invalid.extensions?.reason ?? "repository metadata could not be copied",
        },
      },
    );
  }
}
