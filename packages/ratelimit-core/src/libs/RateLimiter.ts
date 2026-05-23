import type { KeyContext, RateLimitKeyBuilder } from "./RateLimitKeyBuilder";
import type { RateLimitStore } from "./RateLimitStore";
import type {
  FixedWindowPolicy,
  RateLimitPolicy,
  RateLimitResult,
  RateLimitStats,
  SlidingWindowPolicy,
  TokenBucketPolicy,
} from "./types";

export type RateLimiterKeyBuilder<TContext> = (context: TContext, policyName?: string) => string;

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

  async check(context: TContext, policy: RateLimitPolicy): Promise<RateLimitResult> {
    const key = this.keyBuilder(context, policy.name);

    try {
      const result = await this.store.check(key, policy);
      return { ...result, policyName: policy.algorithm };
    } catch (error) {
      return this.handleStoreError(error as Error, policy);
    }
  }

  async checkWithKey(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    try {
      const result = await this.store.check(key, policy);
      return { ...result, policyName: policy.algorithm };
    } catch (error) {
      return this.handleStoreError(error as Error, policy);
    }
  }

  async getStats(key?: string): Promise<RateLimitStats> {
    try {
      return await this.store.getStats(key);
    } catch (error) {
      this.onStoreError?.(error as Error);
      return { allowed: 0, denied: 0, total: 0 };
    }
  }

  private handleStoreError(error: Error, policy: RateLimitPolicy): RateLimitResult {
    this.onStoreError?.(error);

    const limit =
      policy.algorithm === "token-bucket" ? (policy as TokenBucketPolicy).capacity : policy.limit;

    if (this.failOpen) {
      return {
        success: true,
        degraded: true,
        limit,
        remaining: limit,
        resetAtMs: Date.now() + 60000,
        policyName: policy.algorithm,
      };
    }

    return {
      success: false,
      degraded: true,
      limit,
      remaining: 0,
      resetAtMs: Date.now() + 60000,
      policyName: policy.algorithm,
    };
  }
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
