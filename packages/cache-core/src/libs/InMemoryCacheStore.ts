import { CacheStore } from './CacheStore';

/**
 * Internal cache entry with optional expiration.
 */
type CacheEntry<V> = {
  value: V;
  expiresAt: number | null;
};

export type InMemoryCacheStoreOptions = {
  maxEntries?: number;
};

/**
 * In-memory cache store implementation with TTL support.
 * Uses lazy expiration - entries are checked for expiration on get/has operations.
 *
 * @example
 * ```typescript
 * const cache = new InMemoryCacheStore<string>();
 * await cache.set('key', 'value', 5000); // 5 second TTL
 * const value = await cache.get('key'); // 'value'
 * // After 5 seconds...
 * const expired = await cache.get('key'); // undefined
 * ```
 */
export class InMemoryCacheStore<V = unknown> extends CacheStore<V> {
  private readonly store: Map<string, CacheEntry<V>> = new Map();
  private readonly maxEntries: number | null;

  constructor(options: InMemoryCacheStoreOptions = {}) {
    super();
    this.maxEntries = options.maxEntries ?? null;
  }

  async get(key: string): Promise<V | undefined> {
    const entry = this.store.get(key);

    if (entry === undefined) {
      return undefined;
    }

    // Lazy expiration check
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  async set(key: string, value: V, ttlMs?: number): Promise<void> {
    this.pruneExpiredSync();

    const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : null;

    this.store.set(key, {
      value,
      expiresAt,
    });

    this.evictOverflow();
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);

    if (entry === undefined) {
      return false;
    }

    // Lazy expiration check
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async pruneExpired(): Promise<number> {
    return this.pruneExpiredSync();
  }

  /**
   * Delete all keys matching a pattern.
   * Supports * as wildcard at the end of the pattern.
   * @param pattern - The pattern to match (e.g., "User:*" or "User:getUser:*")
   * @returns The number of deleted keys
   */
  async deleteByPattern(pattern: string): Promise<number> {
    let deletedCount = 0;

    // Convert pattern to regex
    // Only support * as wildcard at the end
    const isPrefixMatch = pattern.endsWith('*');
    const prefix = isPrefixMatch ? pattern.slice(0, -1) : pattern;

    for (const key of this.store.keys()) {
      if (isPrefixMatch) {
        if (key.startsWith(prefix)) {
          this.store.delete(key);
          deletedCount++;
        }
      } else {
        if (key === prefix) {
          this.store.delete(key);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }

  private pruneExpiredSync(): number {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  private evictOverflow(): void {
    if (this.maxEntries === null) {
      return;
    }

    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value;

      if (oldestKey === undefined) {
        return;
      }

      this.store.delete(oldestKey);
    }
  }
}
