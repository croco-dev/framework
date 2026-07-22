import { InvalidRetryConfigurationProblem } from "./errors/RetryInfrastructureProblem";
import type { RetryNumericConstraint } from "./errors/RetryInfrastructureProblem";

export const MAX_TIMER_DELAY_MS = 2_147_483_647;

function isValidRetryNumber(value: number, constraint: RetryNumericConstraint): boolean {
  switch (constraint) {
    case "finite-positive-number":
      return Number.isFinite(value) && value > 0;
    case "non-negative-timer-integer":
      return Number.isSafeInteger(value) && value >= 0 && value <= MAX_TIMER_DELAY_MS;
    case "positive-safe-integer":
      return Number.isSafeInteger(value) && value > 0;
    case "positive-timer-integer":
      return Number.isSafeInteger(value) && value > 0 && value <= MAX_TIMER_DELAY_MS;
  }
}

export function assertValidRetryNumber(
  option: string,
  value: number,
  constraint: RetryNumericConstraint,
): void {
  if (!isValidRetryNumber(value, constraint)) {
    throw new InvalidRetryConfigurationProblem(option, constraint, value);
  }
}
