import { Problem, ProblemCategory } from "@croco/problems-core";
import { MAX_USAGE_VALUE } from "../usageValueLimits";

/** A usage record contains a value that cannot be represented by every supported storage adapter. */
export class InvalidUsageValueProblem extends Problem {
  constructor(value: number, reason = `value must be an integer between 1 and ${MAX_USAGE_VALUE}`) {
    super(
      "metering/invalid-usage-value",
      ProblemCategory.ValidationError,
      `Invalid usage value '${String(value)}': ${reason}`,
      {
        extensions: {
          receivedValue: String(value),
          reason,
        },
      },
    );
  }
}
