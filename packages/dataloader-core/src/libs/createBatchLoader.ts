import { Context } from '@croco/framework-context';
import { BatchLoaderImpl } from './BatchLoader';
import type { BatchLoader, BatchLoaderOptions } from './types';

/**
 * Creates a factory that returns a BatchLoader instance.
 * The instance is scoped to the current request context using AsyncLocalStorage.
 *
 * @param options Configuration options for the BatchLoader
 * @returns An object with the same interface as BatchLoader, but delegating to a context-scoped instance
 */
export function createBatchLoader<K, V>(options: BatchLoaderOptions<K, V>): BatchLoader<K, V> {
  const getLoader = (): BatchLoader<K, V> => {
    const contextCache = Context.getCache();

    // If no context is active, create a new instance.
    // This allows usage outside of a request scope (e.g. tests),
    // but caching/batching will only apply to that single call chain if the instance isn't reused.
    if (!contextCache) {
      return new BatchLoaderImpl(options);
    }

    const scope = options.scope ? `:${options.scope}` : '';
    const cacheKey = `dataloader:${options.name}:v1${scope}`;

    let loader = contextCache.get(cacheKey) as BatchLoaderImpl<K, V> | undefined;

    if (!loader) {
      loader = new BatchLoaderImpl(options);
      contextCache.set(cacheKey, loader);
    }

    return loader;
  };

  return {
    load: (key: K) => getLoader().load(key),
    loadMany: (keys: K[]) => getLoader().loadMany(keys),
    clear: (key: K) => getLoader().clear(key),
    clearAll: () => getLoader().clearAll(),
    prime: (key: K, value: V | Error) => getLoader().prime(key, value),
  };
}
