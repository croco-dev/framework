export type BatchFn<K, V> = (keys: ReadonlyArray<K>) => Promise<ReadonlyArray<V | Error | null>>;

export type BatchLoaderOptions<K, V> = {
  /**
   * Unique name for the loader.
   * Used for caching the loader instance in the request context.
   */
  name: string;

  /**
   * The batch function that loads data for a list of keys.
   * Must return an array of values of the same length as the keys.
   */
  batchFn: BatchFn<K, V>;

  /**
   * Maximum number of items to batch in a single request.
   * Defaults to Infinity.
   */
  maxBatchSize?: number;

  /**
   * Whether to cache results for individual keys.
   * Defaults to true.
   */
  cache?: boolean;

  /**
   * Scope for the loader instance (e.g. tenantId).
   * Used to isolate caches between different scopes within the same request if needed.
   */
  scope?: string;

  /**
   * Function to resolve a dynamic scope for cache isolation.
   * Useful for transaction-aware caching where the loader should be isolated per transaction.
   * If the returned value changes, a new loader instance (and cache) is used.
   */
  resolveScope?: () => string | null | undefined;
};

export interface BatchLoader<K, V> {
  load(key: K): Promise<V | null>;
  loadMany(keys: K[]): Promise<Array<V | Error | null>>;
  clear(key: K): void;
  clearAll(): void;
  prime(key: K, value: V | Error): void;
}
