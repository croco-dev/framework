import { OutboxClaimConfigurationProblem } from "./problems/OutboxProblems";
import type { ClaimBatchOptions } from "./types";

/** Validates the visibility lease before a store reads or mutates claim state. */
export function assertValidClaimBatchOptions(
  options: Pick<ClaimBatchOptions, "now" | "visibilityTimeoutMs">,
): void {
  const expiresAt = new Date(options.now.getTime() + options.visibilityTimeoutMs);
  if (
    !Number.isSafeInteger(options.visibilityTimeoutMs) ||
    options.visibilityTimeoutMs <= 0 ||
    !Number.isFinite(expiresAt.getTime())
  ) {
    throw new OutboxClaimConfigurationProblem(options.visibilityTimeoutMs);
  }
}
