/**
 * Cache store interface for caching values with optional TTL.
 */
export interface CacheStore<V = unknown> {
  /**
   * Get a value from the cache.
   * Returns undefined if the key does not exist or has expired.
   */
  get(key: string): Promise<V | undefined>;

  /**
   * Set a value in the cache with optional TTL.
   * @param key - The cache key
   * @param value - The value to cache
   * @param ttlMs - Time to live in milliseconds (optional)
   */
  set(key: string, value: V, ttlMs?: number): Promise<void>;

  /**
   * Delete a value from the cache.
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a key exists in the cache.
   */
  has(key: string): Promise<boolean>;

  /**
   * Clear all values from the cache.
   */
  clear(): Promise<void>;

  /**
   * Delete all keys matching a pattern.
   * @param pattern - The pattern to match (supports * as wildcard)
   */
  deleteByPattern?(pattern: string): Promise<number>;

  pruneExpired?(): Promise<number>;
}
