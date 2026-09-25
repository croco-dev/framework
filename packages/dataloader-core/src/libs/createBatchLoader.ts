import { Context } from "@croco/framework-context";
import { BatchLoaderImpl } from "./BatchLoader";
import { DuplicateBatchLoaderNameProblem } from "./problems/BatchLoaderProblems";
import type { BatchLoader, BatchLoaderOptions } from "./types";

type LoaderCacheEntry<K, V> = {
  readonly owner: symbol;
  readonly loader: BatchLoaderImpl<K, V>;
};

/**
 * Creates a factory that returns a BatchLoader instance.
 * The instance is scoped to the current request context using AsyncLocalStorage.
 *
 * @param options Configuration options for the BatchLoader
 * @returns An object with the same interface as BatchLoader, but delegating to a context-scoped instance
 */
export function createBatchLoader<K, V>(options: BatchLoaderOptions<K, V>): BatchLoader<K, V> {
  return createOwnedBatchLoader(options, Symbol(options.name));
}

export function createOwnedBatchLoader<K, V>(
  options: BatchLoaderOptions<K, V>,
  owner: symbol,
): BatchLoader<K, V> {
  let standaloneCache: Map<string, LoaderCacheEntry<K, V>> | undefined;

  const getLoader = (): BatchLoader<K, V> => {
    const loaderCache = Context.getCache() ?? (standaloneCache ??= new Map());

    const staticScope = options.scope ? `:${options.scope}` : "";
    const dynamicScope = options.resolveScope?.();
    const dynamicScopeKey = dynamicScope ? `:scope:${dynamicScope}` : "";

    const cacheKey = `dataloader:${options.name}:v1${staticScope}${dynamicScopeKey}`;

    const entry = loaderCache.get(cacheKey) as LoaderCacheEntry<K, V> | undefined;

    if (entry) {
      if (entry.owner !== owner) {
        throw new DuplicateBatchLoaderNameProblem(
          options.name,
          options.scope || null,
          dynamicScope || null,
        );
      }
      return entry.loader;
    }

    const loader = new BatchLoaderImpl(options);
    loaderCache.set(cacheKey, { owner, loader });
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
