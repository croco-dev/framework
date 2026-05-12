import { RateLimitWindowProblem } from "./problems/RateLimitConfigProblems";

export type RateLimitAlgorithm = "fixed" | "sliding" | "token-bucket";

export type FixedWindowPolicy = {
  name: string;
  algorithm: "fixed";
  limit: number;
  windowMs: number;
};

export type SlidingWindowPolicy = {
  name: string;
  algorithm: "sliding";
  limit: number;
  windowMs: number;
};

export type TokenBucketPolicy = {
  name: string;
  algorithm: "token-bucket";
  capacity: number;
  refillRate: number;
  refillIntervalMs: number;
};

export type RateLimitPolicy =
  | FixedWindowPolicy
  | SlidingWindowPolicy
  | TokenBucketPolicy
  | {
      name: string;
      limit: number;
      windowMs: number;
      algorithm?: RateLimitAlgorithm;
    };

export type RateLimitResult = {
  success: boolean;
  degraded?: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  policyName?: string;
};

export type RateLimitStats = {
  allowed: number;
  denied: number;
  total: number;
};

export type KeySegment = "tenant" | "user" | "ip" | "apiKey" | "route" | "custom";

export type RateLimiterOptions = {
  keySegments: KeySegment[];
  failOpen?: boolean;
  onStoreError?: (error: Error) => void;
};

export type RateLimitDecoratorOptions = {
  limit?: number;
  window?: string;
  policy?: string;
  algorithm?: RateLimitAlgorithm;
  key?: (context: unknown) => string;
};

export type RateLimitMiddlewareOptions = {
  policy: RateLimitPolicy;
  keySegments?: KeySegment[];
  failOpen?: boolean;
};

export type PolicyResult<T extends RateLimitPolicy> = {
  policy: T;
  success: boolean;
  remaining: number;
  resetAtMs: number;
};

export function parseWindowMs(window: string): number {
  const match = window.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new RateLimitWindowProblem(
      `Invalid window format: ${window}. Use format like '1m', '1h', '1d'`,
    );
  }

  const value = parseInt(match[1], 10);
  if (value <= 0) {
    throw new RateLimitWindowProblem(
      `Invalid window value: ${window}. Window must be greater than 0`,
    );
  }

  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}

export function isFixedWindowPolicy(policy: RateLimitPolicy): policy is FixedWindowPolicy {
  return policy.algorithm === "fixed";
}

export function isSlidingWindowPolicy(policy: RateLimitPolicy): policy is SlidingWindowPolicy {
  return policy.algorithm === "sliding";
}

export function isTokenBucketPolicy(policy: RateLimitPolicy): policy is TokenBucketPolicy {
  return policy.algorithm === "token-bucket";
}
