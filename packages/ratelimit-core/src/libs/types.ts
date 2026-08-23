import { RateLimitWindowProblem } from "./problems/RateLimitConfigProblems";

export type FixedWindowPolicy = {
  name: string;
  algorithm: "fixed";
  limit: number;
  windowMs: number;
  capacity?: never;
  refillRate?: never;
  refillIntervalMs?: never;
};

export type SlidingWindowPolicy = {
  name: string;
  algorithm: "sliding";
  limit: number;
  windowMs: number;
  capacity?: never;
  refillRate?: never;
  refillIntervalMs?: never;
};

export type TokenBucketPolicy = {
  name: string;
  algorithm: "token-bucket";
  capacity: number;
  refillRate: number;
  refillIntervalMs: number;
  limit?: never;
  windowMs?: never;
};

export type LegacyFixedWindowPolicy = {
  name: string;
  algorithm?: never;
  limit: number;
  windowMs: number;
  capacity?: never;
  refillRate?: never;
  refillIntervalMs?: never;
};

export type RateLimitPolicy =
  | FixedWindowPolicy
  | SlidingWindowPolicy
  | TokenBucketPolicy
  | LegacyFixedWindowPolicy;

export type RateLimitAlgorithm = Exclude<RateLimitPolicy["algorithm"], undefined>;

export type FixedWindowRefundReceipt = {
  algorithm: "fixed";
  id: string;
  windowStart: number;
};

export type SlidingWindowRefundReceipt = {
  algorithm: "sliding";
  id: string;
  timestamp: number;
};

export type TokenBucketRefundReceipt = {
  algorithm: "token-bucket";
  id: string;
  expiresAtMs: number;
};

export type RateLimitRefundReceipt =
  | FixedWindowRefundReceipt
  | SlidingWindowRefundReceipt
  | TokenBucketRefundReceipt;

export type RateLimitResult = {
  success: boolean;
  degraded?: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  policyName?: string;
  refundReceipt?: RateLimitRefundReceipt;
};

export type RateLimitRefundResult = RateLimitResult & {
  refunded: boolean;
};

export type RateLimitStatsError = {
  name: string;
  message: string;
};

export type RateLimitStats = {
  allowed: number;
  denied: number;
  total: number;
  degraded?: boolean;
  error?: RateLimitStatsError;
};

export type KeySegment = "tenant" | "user" | "ip" | "apiKey" | "route" | "custom";

export type RateLimiterOptions = {
  keySegments: KeySegment[];
  failOpen?: boolean;
  onStoreError?: (error: Error) => void;
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
