import type { RateLimitPolicy, RateLimitResult } from './types';

/**
 * Abstract storage for rate limiting.
 * Implementations: InMemoryRateLimitStore, UpstashRateLimitStore
 */
export abstract class RateLimitStore {
  /**
   * Check and increment the rate limit counter for a key.
   * @param key - Unique identifier for the rate limit bucket
   * @param policy - Rate limit policy to apply
   * @returns Rate limit result with success status and metadata
   */
  abstract check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult>;

  abstract pruneExpired(): Promise<number>;
}
