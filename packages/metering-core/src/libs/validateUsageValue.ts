import { InvalidUsageValueProblem } from "./problems/InvalidUsageValueProblem";
import { MAX_USAGE_VALUE } from "./usageValueLimits";

export function validateUsageValue(value: number): void {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_USAGE_VALUE) {
    throw new InvalidUsageValueProblem(value);
  }
}
