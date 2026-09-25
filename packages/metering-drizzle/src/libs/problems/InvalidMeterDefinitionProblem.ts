import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * A meter definition's billing, aggregation, or unit value is outside the meter contract, so it cannot be stored or
 * restored.
 */
export class InvalidMeterDefinitionProblem extends Problem {
  constructor(
    meter: { readonly tenantId: string; readonly meterId: string },
    field: "billing" | "aggregation" | "unit",
    receivedValue: unknown,
  ) {
    super(
      "metering-drizzle/invalid-meter-definition",
      ProblemCategory.InternalServerError,
      `Meter '${meter.meterId}' for tenant '${meter.tenantId}' has an unsupported ${field} value '${String(receivedValue)}'`,
      {
        extensions: {
          tenantId: meter.tenantId,
          meterId: meter.meterId,
          field,
          receivedValue: String(receivedValue),
        },
      },
    );
  }
}
