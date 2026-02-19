import type { CacheStore } from '../CacheStore';

export interface CacheableOptions<V = unknown> {
  /** Cache store instance */
  store: CacheStore<V>;

  /** Time to live in milliseconds */
  ttl?: number;

  /** Key prefix (default: className:methodName) */
  keyPrefix?: string;
}

function generateCacheKey(className: string, methodName: string, args: unknown[], keyPrefix?: string): string {
  const prefix = keyPrefix ?? `${className}:${methodName}`;
  const argsKey = JSON.stringify(args);
  return `${prefix}:${argsKey}`;
}

export function Cacheable<V = unknown>(options: CacheableOptions<V>): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const className = (this as object).constructor.name;
      const cacheKey = generateCacheKey(className, methodName, args, options.keyPrefix);

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
