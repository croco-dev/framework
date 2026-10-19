import { RateLimitPolicyProblem } from "./problems/RateLimitConfigProblems";
import type { RateLimitPolicy } from "./types";

/** Validates policy numbers before arithmetic or storage access; fractional refill rates are supported. */
export function validateRateLimitPolicy(policy: RateLimitPolicy): void {
  if (policy.algorithm === "token-bucket") {
    positiveSafeInteger("capacity", policy.capacity);
    positiveSafeInteger("refillIntervalMs", policy.refillIntervalMs);
    if (
      !Number.isFinite(policy.refillRate) ||
      policy.refillRate <= 0 ||
      policy.refillRate > Number.MAX_SAFE_INTEGER
    ) {
      throw new RateLimitPolicyProblem(
        "refillRate",
        policy.refillRate,
        "must be finite, positive and no greater than Number.MAX_SAFE_INTEGER",
      );
    }
    const lifetimeMs = (policy.capacity * policy.refillIntervalMs) / policy.refillRate;
    if (!Number.isFinite(lifetimeMs) || lifetimeMs <= 0 || lifetimeMs > Number.MAX_SAFE_INTEGER) {
      throw new RateLimitPolicyProblem(
        "capacity * refillIntervalMs / refillRate",
        lifetimeMs,
        "must be finite, positive and no greater than Number.MAX_SAFE_INTEGER",
      );
    }
    return;
  }
  positiveSafeInteger("limit", policy.limit);
  positiveSafeInteger("windowMs", policy.windowMs);
}

function positiveSafeInteger(field: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RateLimitPolicyProblem(field, value, "must be a positive safe integer");
  }
}
