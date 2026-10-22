import { RateLimitPolicyProblem } from "./problems/RateLimitConfigProblems";
import type {
  FixedWindowPolicy,
  SlidingWindowPolicy,
  TokenBucketPolicy,
  RateLimitPolicy,
} from "./types";

/** Validates policy numbers before arithmetic or storage access; fractional refill rates are supported. */
export function validateRateLimitPolicy(policy: RateLimitPolicy): void {
  const algorithm = policy.algorithm;
  if (
    algorithm !== undefined &&
    algorithm !== "fixed" &&
    algorithm !== "sliding" &&
    algorithm !== "token-bucket"
  ) {
    throw new RateLimitPolicyProblem(
      "algorithm",
      algorithm,
      "must be fixed, sliding, token-bucket or omitted",
    );
  }
  if (policy.algorithm === "token-bucket") {
    absent("limit", policy.limit);
    absent("windowMs", policy.windowMs);
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
  absent("capacity", policy.capacity);
  absent("refillRate", policy.refillRate);
  absent("refillIntervalMs", policy.refillIntervalMs);
  positiveSafeInteger("limit", policy.limit);
  positiveSafeInteger("windowMs", policy.windowMs);
}

function positiveSafeInteger(field: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RateLimitPolicyProblem(field, value, "must be a positive safe integer");
  }
}

/** Validates public input and makes legacy fixed-window intent explicit without mutating the caller. */
export function normalizeRateLimitPolicy(
  policy: RateLimitPolicy,
): FixedWindowPolicy | SlidingWindowPolicy | TokenBucketPolicy {
  validateRateLimitPolicy(policy);
  return policy.algorithm === undefined
    ? {
        ...policy,
        name: policy.name,
        algorithm: "fixed",
        limit: policy.limit,
        windowMs: policy.windowMs,
      }
    : policy;
}

function absent(field: string, value: unknown): void {
  if (value !== undefined) {
    throw new RateLimitPolicyProblem(field, value, "must be omitted for this algorithm");
  }
}
