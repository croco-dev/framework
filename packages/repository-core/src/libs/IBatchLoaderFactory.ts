import { Token } from "@croco/framework-context";

/**
 * Batch loader interface for loading multiple values in a single batch.
 *
 * @template K - The key type
 * @template V - The value type
 */
export interface BatchLoaderLike<K, V> {
  /**
   * Load a single value by key.
   *
   * @param key - The key to load
   * @returns The value if found, null otherwise
   */
  load(key: K): Promise<V | null>;
}

/**
 * Options for creating a batch loader.
 *
 * @template K - The key type
 * @template V - The value type
 */
export type BatchLoaderFactoryOptions<K, V> = {
  /**
   * The name of the loader (used for caching and debugging).
   */
  name: string;

  /**
   * The batch function that loads multiple keys at once.
   *
   * @param keys - The keys to load
   * @returns Array of values (may contain nulls or Errors for partial failures)
   */
  batchFn: (keys: ReadonlyArray<K>) => Promise<ReadonlyArray<V | Error | null>>;
};

/**
 * Factory interface for creating context-scoped batch loaders.
 *
 * Implementations should cache loaders within the current request context
 * to ensure proper batching across multiple calls to the same loader.
 *
 * @example
 * ```typescript
 * class MyBatchLoaderFactory implements IBatchLoaderFactory {
 *   create<K, V>(options: BatchLoaderFactoryOptions<K, V>): BatchLoaderLike<K, V> {
 *     const cache = Context.getCache();
 *     const cacheKey = `loader:${options.name}`;
 *
 *     let loader = cache?.get(cacheKey);
 *     if (!loader) {
 *       loader = new DataLoader(options.batchFn);
 *       cache?.set(cacheKey, loader);
 *     }
 *
 *     return loader;
 *   }
 * }
 * ```
 */
export interface IBatchLoaderFactory {
  /**
   * Create or retrieve a context-scoped batch loader.
   *
   * @param options - The loader options
   * @returns A batch loader instance
   */
  create<K, V>(options: BatchLoaderFactoryOptions<K, V>): BatchLoaderLike<K, V>;
}

/**
 * Dependency injection token for IBatchLoaderFactory.
 *
 * Register your implementation in the DI container:
 * ```typescript
 * Container.set(BATCH_LOADER_FACTORY_TOKEN, new MyBatchLoaderFactory());
 * ```
 */
export const BATCH_LOADER_FACTORY_TOKEN = new Token<IBatchLoaderFactory>("IBatchLoaderFactory");
