import type { KeyContext, RateLimitKeyBuilder } from "./RateLimitKeyBuilder";
import type { RateLimitStore } from "./RateLimitStore";
import type {
  FixedWindowPolicy,
  RateLimitPolicy,
  RateLimitRefundReceipt,
  RateLimitRefundResult,
  RateLimitResult,
  RateLimitStats,
  RateLimitStatsError,
  SlidingWindowPolicy,
  TokenBucketPolicy,
} from "./types";

export type RateLimiterKeyBuilder<TContext> = (context: TContext, policyName?: string) => string;

export type RateLimitCheckOptions = {
  failOpen?: boolean;
};

export class RateLimiter<TContext = KeyContext> {
  private readonly store: RateLimitStore;
  private readonly keyBuilder: RateLimiterKeyBuilder<TContext>;
  private readonly failOpen: boolean;
  private readonly onStoreError?: (error: Error) => void;

  constructor(
    store: RateLimitStore,
    keyBuilder: RateLimiterKeyBuilder<TContext> | RateLimitKeyBuilder,
    options?: { failOpen?: boolean; onStoreError?: (error: Error) => void },
  ) {
    this.store = store;
    this.keyBuilder = (ctx: TContext, policyName?: string) => {
      if (typeof keyBuilder === "function") {
        return keyBuilder(ctx, policyName);
      }
      return keyBuilder.build(ctx as KeyContext, policyName ?? "default");
    };
    this.failOpen = options?.failOpen ?? true;
    this.onStoreError = options?.onStoreError;
  }

  async check(
    context: TContext,
    policy: RateLimitPolicy,
    options?: RateLimitCheckOptions,
  ): Promise<RateLimitResult> {
    const key = this.keyBuilder(context, policy.name);

    try {
      const result = await this.store.check(key, policy);
      return { ...result, policyName: policy.name };
    } catch (error) {
      return this.handleStoreError(error, policy, options?.failOpen);
    }
  }

  async checkWithKey(
    key: string,
    policy: RateLimitPolicy,
    options?: RateLimitCheckOptions,
  ): Promise<RateLimitResult> {
    try {
      const result = await this.store.check(key, policy);
      return { ...result, policyName: policy.name };
    } catch (error) {
      return this.handleStoreError(error, policy, options?.failOpen);
    }
  }

  async refund(
    context: TContext,
    policy: RateLimitPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    const key = this.keyBuilder(context, policy.name);
    return this.refundWithKey(key, policy, receipt);
  }

  async refundWithKey(
    key: string,
    policy: RateLimitPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    try {
      const result = await this.store.refund(key, policy, receipt);
      return { ...result, policyName: policy.name };
    } catch (error) {
      const storeError = normalizeStoreError(error);
      this.onStoreError?.(storeError);
      throw storeError;
    }
  }

  async getStats(key?: string): Promise<RateLimitStats> {
    try {
      return await this.store.getStats(key);
    } catch (error) {
      const storeError = normalizeStoreError(error);
      this.onStoreError?.(storeError);

      return {
        allowed: 0,
        denied: 0,
        total: 0,
        degraded: true,
        error: toRateLimitStatsError(storeError),
      };
    }
  }

  private handleStoreError(
    error: unknown,
    policy: RateLimitPolicy,
    failOpen = this.failOpen,
  ): RateLimitResult {
    const now = Date.now();
    const storeError = normalizeStoreError(error);
    this.onStoreError?.(storeError);

    const limit =
      policy.algorithm === "token-bucket" ? (policy as TokenBucketPolicy).capacity : policy.limit;
    const resetAtMs = now + getDegradedResetIntervalMs(policy);

    if (failOpen) {
      return {
        success: true,
        degraded: true,
        limit,
        remaining: limit,
        resetAtMs,
        policyName: policy.name,
      };
    }

    return {
      success: false,
      degraded: true,
      limit,
      remaining: 0,
      resetAtMs,
      policyName: policy.name,
    };
  }
}

function getDegradedResetIntervalMs(policy: RateLimitPolicy): number {
  if (policy.algorithm === "token-bucket") {
    const tokenBucketPolicy = policy as TokenBucketPolicy;
    return tokenBucketPolicy.refillIntervalMs / tokenBucketPolicy.refillRate;
  }

  return policy.windowMs;
}

function normalizeStoreError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function toRateLimitStatsError(error: Error): RateLimitStatsError {
  return {
    name: error.name,
    message: error.message,
  };
}

export type RateLimiterContext<T> = T extends RateLimiter<infer C> ? C : never;

export function createFixedWindowPolicy(
  name: string,
  limit: number,
  windowMs: number,
): FixedWindowPolicy {
  return {
    name,
    algorithm: "fixed",
    limit,
    windowMs,
  };
}

export function createSlidingWindowPolicy(
  name: string,
  limit: number,
  windowMs: number,
): SlidingWindowPolicy {
  return {
    name,
    algorithm: "sliding",
    limit,
    windowMs,
  };
}

export function createTokenBucketPolicy(
  name: string,
  capacity: number,
  refillRate: number,
  refillIntervalMs = 1000,
): TokenBucketPolicy {
  return {
    name,
    algorithm: "token-bucket",
    capacity,
    refillRate,
    refillIntervalMs,
  };
}
