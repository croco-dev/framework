import type { RateLimitPolicy, RateLimitResult } from './types';

/**
 * Abstract storage interface for rate limiting.
 * Implementations: InMemoryRateLimitStore, UpstashRateLimitStore
 */
export interface RateLimitStore {
  /**
   * Check and increment the rate limit counter for a key.
   * @param key - Unique identifier for the rate limit bucket
   * @param policy - Rate limit policy to apply
   * @returns Rate limit result with success status and metadata
   */
  check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult>;
}
