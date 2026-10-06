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
   *
   * Within one request, every `create()` call with the same name shares one
   * request loader, but installation timing and `batchFn` selection depend
   * on the implementation. `BatchLoaderFactory` installs the loader when the
   * wrapper whose `load()` (or `loadMany()`/`clear()`/`clearAll()`/`prime()`)
   * first touches the request cache runs, and the other wrapper delegates to
   * that loader from then on. A different `batchFn` passed by another
   * same-name call is therefore ignored once a loader is installed. Callers
   * using `BatchLoaderFactory` must pass the same `batchFn` for a shared
   * name, or use a unique name (or scope, where supported) per batch
   * function. Sharing a name across different `batchFn`s does not fail:
   * the installed loader keeps serving its own data.
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
 * Same-name `create()` calls share one request loader, but installation
 * timing and `batchFn` selection depend on the implementation.
 * `BatchLoaderFactory` installs the loader when a wrapper first uses it, so
 * callers using it must pass the same `batchFn` for a shared name or choose
 * a unique name per batch function.
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
   * Within one request, same-name calls share one request loader, but
   * installation timing and `batchFn` selection depend on the implementation.
   * `BatchLoaderFactory` installs the loader when a wrapper first uses it and
   * ignores a different `batchFn` from later same-name calls. Callers using
   * `BatchLoaderFactory` must use the same `batchFn` for a shared name or a
   * unique name per batch function.
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
 * constructor(@Inject(BATCH_LOADER_FACTORY_TOKEN) readonly batchLoaderFactory: IBatchLoaderFactory) {}
 * ```
 */
export const BATCH_LOADER_FACTORY_TOKEN = new Token<IBatchLoaderFactory>("IBatchLoaderFactory");
