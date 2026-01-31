import type { RateLimitPolicy, RateLimitResult } from '@croco/ratelimit-core';
import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';

/**
 * Options for UpstashRateLimitStore.
 */
export type UpstashRateLimitStoreOptions = {
  /** Upstash Redis client instance */
  redis: Redis;
  /** Key prefix for rate limit entries (default: 'ratelimit') */
  prefix?: string;
  /** Enable analytics (default: false) */
  analytics?: boolean;
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Enable ephemeral cache for local rate limiting (default: true in Lambda) */
  ephemeralCache?: boolean | Map<string, number>;
};

/**
 * Rate limit store implementation using Upstash Ratelimit.
 * Suitable for serverless and edge deployments.
 *
 * @example
 * ```typescript
 * import { Redis } from '@upstash/redis';
 *
 * const redis = Redis.fromEnv();
 * const store = new UpstashRateLimitStore({ redis });
 * const rateLimiter = new RateLimiter(store, keyBuilder);
 * ```
 */
export class UpstashRateLimitStore {
  private readonly redis: Redis;
  private readonly prefix: string;
  private readonly analytics: boolean;
  private readonly timeout: number;
  private readonly ephemeralCache?: Map<string, number>;

  // Cache of Ratelimit instances by policy name
  private readonly limiters = new Map<string, Ratelimit>();

  constructor(options: UpstashRateLimitStoreOptions) {
    this.redis = options.redis;
    this.prefix = options.prefix ?? 'ratelimit';
    this.analytics = options.analytics ?? false;
    this.timeout = options.timeout ?? 5000;

    // Enable ephemeral cache by default (good for Lambda)
    if (options.ephemeralCache === true) {
      this.ephemeralCache = new Map<string, number>();
    } else if (options.ephemeralCache instanceof Map) {
      this.ephemeralCache = options.ephemeralCache;
    }
  }

  async check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    const limiter = this.getLimiter(policy);
    const response = await limiter.limit(key);

    return {
      success: response.success,
      limit: response.limit,
      remaining: response.remaining,
      resetAtMs: response.reset,
    };
  }

  /**
   * Get or create a Ratelimit instance for the given policy.
   * Instances are cached by policy name for reuse.
   */
  private getLimiter(policy: RateLimitPolicy): Ratelimit {
    const cacheKey = `${policy.name}:${policy.limit}:${policy.windowMs}`;

    let limiter = this.limiters.get(cacheKey);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowMs} ms`),
        prefix: `${this.prefix}:${policy.name}`,
        analytics: this.analytics,
        timeout: this.timeout,
        ephemeralCache: this.ephemeralCache,
      });
      this.limiters.set(cacheKey, limiter);
    }

    return limiter;
  }
}
