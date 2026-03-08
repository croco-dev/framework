import type { KeyContext, RateLimitKeyBuilder } from './RateLimitKeyBuilder';
import type { RateLimitStore } from './RateLimitStore';
import type { RateLimiterOptions, RateLimitPolicy, RateLimitResult } from './types';

/**
 * Core rate limiter service.
 * Orchestrates key building, store access, and error handling.
 */
export class RateLimiter {
  private readonly store: RateLimitStore;
  private readonly keyBuilder: RateLimitKeyBuilder;
  private readonly failOpen: boolean;
  private readonly onStoreError?: (error: Error) => void;

  constructor(
    store: RateLimitStore,
    keyBuilder: RateLimitKeyBuilder,
    options: Omit<RateLimiterOptions, 'keySegments'> = {}
  ) {
    this.store = store;
    this.keyBuilder = keyBuilder;
    this.failOpen = options.failOpen ?? true;
    this.onStoreError = options.onStoreError;
  }

  /**
   * Check rate limit for the given context and policy.
   * @param context - Request context containing key segments
   * @param policy - Rate limit policy to apply
   * @returns Rate limit result
   */
  async check(context: KeyContext, policy: RateLimitPolicy): Promise<RateLimitResult> {
    const key = this.keyBuilder.build(context, policy.name);

    try {
      return await this.store.check(key, policy);
    } catch (error) {
      return this.handleStoreError(error as Error, policy);
    }
  }

  /**
   * Check rate limit with a pre-built key (for middleware use).
   * @param key - Pre-built rate limit key
   * @param policy - Rate limit policy to apply
   * @returns Rate limit result
   */
  async checkWithKey(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    try {
      return await this.store.check(key, policy);
    } catch (error) {
      return this.handleStoreError(error as Error, policy);
    }
  }

  private handleStoreError(error: Error, policy: RateLimitPolicy): RateLimitResult {
    this.onStoreError?.(error);

    if (this.failOpen) {
      // Allow request when store fails
      return {
        success: true,
        degraded: true,
        limit: policy.limit,
        remaining: policy.limit,
        resetAtMs: Date.now() + policy.windowMs,
      };
    }

    // Fail-closed: reject request when store fails
    return {
      success: false,
      degraded: true,
      limit: policy.limit,
      remaining: 0,
      resetAtMs: Date.now() + policy.windowMs,
    };
  }
}
