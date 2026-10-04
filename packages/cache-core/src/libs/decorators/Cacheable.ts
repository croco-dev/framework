import type { CacheStore } from "../CacheStore";
import { createCacheKey } from "../cacheKey";
import { CacheDecoratorConfigProblem } from "../problems/CacheDecoratorProblems";

export interface CacheableOptions<V = unknown> {
  store: CacheStore<string, V>;
  namespace?: string;
  ttl?: number;
  keyPrefix?: string;
  scope?: "tenant" | "global";
}

function resolveCachePrefix(options: CacheableOptions<unknown>, methodName: string): string {
  if (options.keyPrefix !== undefined) {
    return options.keyPrefix;
  }

  if (options.namespace === undefined) {
    throw new CacheDecoratorConfigProblem(
      `@Cacheable requires "namespace" when "keyPrefix" is not provided (method: ${methodName})`,
    );
  }

  return `${options.namespace}:${methodName}`;
}

export function Cacheable<V = unknown>(options: CacheableOptions<V>): MethodDecorator {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<V | undefined>;
    const methodName = String(propertyKey);
    const prefix = resolveCachePrefix(options, methodName);
    const inFlightAttempts = new Map<string, Promise<V | undefined>>();

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<V | undefined> {
      const cacheKey = createCacheKey(prefix, args, options.scope);
      const invokeOriginal = (): Promise<V | undefined> => originalMethod.apply(this, args);

      const runLoad = async (): Promise<V | undefined> => {
        let loaderRan = false;
        let loadedValue: V | undefined;

        const result = await options.store.getOrSet(
          cacheKey,
          async () => {
            loaderRan = true;
            loadedValue = await invokeOriginal();
            return loadedValue;
          },
          { ttlMs: options.ttl },
        );

        if (result !== undefined) {
          return result;
        }

        if (loaderRan) {
          // The store suppressed this load after an overlapping invalidation:
          // return the method result without restoring the cache.
          return loadedValue;
        }

        return undefined;
      };

      if (options.ttl === 0) {
        return runLoad();
      }

      const pending = inFlightAttempts.get(cacheKey);
      if (pending !== undefined) {
        return pending;
      }

      const attempt = runLoad();
      inFlightAttempts.set(cacheKey, attempt);

      try {
        return await attempt;
      } finally {
        if (inFlightAttempts.get(cacheKey) === attempt) {
          inFlightAttempts.delete(cacheKey);
        }
      }
    };

    return descriptor;
  };
}
