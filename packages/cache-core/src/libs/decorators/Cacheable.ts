import type { CacheStore } from "../CacheStore";
import { createCacheKey } from "../cacheKey";
import { CacheDecoratorConfigProblem } from "../problems/CacheDecoratorProblems";

export interface CacheableOptions<V = unknown> {
  store: CacheStore<string, V>;
  namespace?: string;
  ttl?: number;
  keyPrefix?: string;
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

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<V | undefined> {
      const cacheKey = createCacheKey(prefix, args);

      return options.store.getOrSet(
        cacheKey,
        async () => {
          const result = await originalMethod.apply(this, args);
          return result;
        },
        { ttlMs: options.ttl },
      );
    };

    return descriptor;
  };
}
