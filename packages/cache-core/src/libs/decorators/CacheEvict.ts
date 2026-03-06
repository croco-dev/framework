import type { CacheStore } from '../CacheStore';

export interface CacheEvictOptions<V = unknown> {
  /** Cache store instance */
  store: CacheStore<V>;

  namespace?: string;

  /** Specific key to evict (supports * wildcard at the end) */
  key?: string;

  /** Evict all entries (calls clear()) */
  allEntries?: boolean;
}

function resolveEvictionPattern(options: CacheEvictOptions<unknown>, methodName: string): string {
  if (options.namespace === undefined) {
    throw new Error(`@CacheEvict requires "namespace" when "key" is not provided (method: ${methodName})`);
  }

  return `${options.namespace}:${methodName}:*`;
}

export function CacheEvict<V = unknown>(options: CacheEvictOptions<V>): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);
    const pattern =
      options.key === undefined && options.allEntries !== true
        ? resolveEvictionPattern(options, methodName)
        : undefined;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const result = await originalMethod.apply(this, args);

      if (options.allEntries === true) {
        await options.store.clear();
        return result;
      }

      if (options.key !== undefined) {
        if (options.key.endsWith('*') && options.store.deleteByPattern) {
          await options.store.deleteByPattern(options.key);
        } else {
          await options.store.delete(options.key);
        }
        return result;
      }

      if (pattern !== undefined && options.store.deleteByPattern) {
        await options.store.deleteByPattern(pattern);
      }

      return result;
    };

    return descriptor;
  };
}
