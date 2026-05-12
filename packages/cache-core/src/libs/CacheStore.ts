/**
 * Cache runtime statistics.
 */
export type CacheStats = {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
};

/**
 * Options for cache-backed loading.
 */
export type CacheGetOrSetOptions = {
  ttlMs?: number;
};

/**
 * Preloaded cache entry.
 */
export type CacheWarmupEntry<K extends string, V> = {
  key: K;
  value: V;
  ttlMs?: number;
};

export type CachePattern = string;

/**
 * Generic cache contract.
 */
export abstract class Cache<K extends string = string, V = unknown> {
  abstract get(key: K): Promise<V | undefined>;

  abstract set(key: K, value: V, ttlMs?: number): Promise<void>;

  abstract delete(key: K): Promise<void>;

  abstract has(key: K): Promise<boolean>;

  abstract clear(): Promise<void>;

  abstract invalidatePattern(pattern: CachePattern): Promise<number>;

  abstract pruneExpired(): Promise<number>;

  abstract getOrSet(
    key: K,
    loader: () => Promise<V | undefined>,
    options?: CacheGetOrSetOptions,
  ): Promise<V | undefined>;

  abstract warmup(entries: ReadonlyArray<CacheWarmupEntry<K, V>>): Promise<void>;

  abstract getStats(): CacheStats;
}

/**
 * Backward-compatible cache store base class.
 */
export abstract class CacheStore<K extends string = string, V = unknown> extends Cache<K, V> {}
