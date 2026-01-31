import type { RateLimitStore } from './RateLimitStore';
import type { RateLimitPolicy, RateLimitResult } from './types';

type BucketEntry = {
  count: number;
  windowStart: number;
};

/**
 * In-memory rate limit store for testing and development.
 * Uses sliding window algorithm.
 * NOT suitable for production multi-instance deployments.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, BucketEntry>();

  async check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - policy.windowMs;

    let bucket = this.buckets.get(key);

    if (!bucket || bucket.windowStart < windowStart) {
      bucket = { count: 0, windowStart: now };
    }

    if (bucket.count >= policy.limit) {
      const resetAtMs = bucket.windowStart + policy.windowMs;
      return {
        success: false,
        limit: policy.limit,
        remaining: 0,
        resetAtMs,
      };
    }

    bucket.count++;
    this.buckets.set(key, bucket);

    return {
      success: true,
      limit: policy.limit,
      remaining: policy.limit - bucket.count,
      resetAtMs: bucket.windowStart + policy.windowMs,
    };
  }

  /**
   * Clear all buckets (for testing)
   */
  reset(): void {
    this.buckets.clear();
  }
}
