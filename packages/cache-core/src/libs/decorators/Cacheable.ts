import type { CacheStore } from '../CacheStore';

export interface CacheableOptions<V = unknown> {
  /** Cache store instance */
  store: CacheStore<V>;

  namespace?: string;

  /** Time to live in milliseconds */
  ttl?: number;

  keyPrefix?: string;
}

function resolveCachePrefix(options: CacheableOptions<unknown>, methodName: string): string {
  if (options.keyPrefix !== undefined) {
    return options.keyPrefix;
  }

  if (options.namespace === undefined) {
    throw new Error(`@Cacheable requires "namespace" when "keyPrefix" is not provided (method: ${methodName})`);
  }

  return `${options.namespace}:${methodName}`;
}

function generateCacheKey(prefix: string, args: unknown[]): string {
  const argsKey = JSON.stringify(args);
  return `${prefix}:${argsKey}`;
}

export function Cacheable<V = unknown>(options: CacheableOptions<V>): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);
    const prefix = resolveCachePrefix(options, methodName);

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const cacheKey = generateCacheKey(prefix, args);

      const cachedValue = await options.store.get(cacheKey);
      if (cachedValue !== undefined) {
        return cachedValue;
      }

      const result = await originalMethod.apply(this, args);

      if (result !== undefined) {
        await options.store.set(cacheKey, result as V, options.ttl);
      }

      return result;
    };

    return descriptor;
  };
}
