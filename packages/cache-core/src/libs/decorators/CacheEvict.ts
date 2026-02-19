import type { CacheStore } from '../CacheStore';

export interface CacheEvictOptions<V = unknown> {
  /** Cache store instance */
  store: CacheStore<V>;

  /** Specific key to evict (supports * wildcard at the end) */
  key?: string;

  /** Evict all entries (calls clear()) */
  allEntries?: boolean;
}

export function CacheEvict<V = unknown>(options: CacheEvictOptions<V>): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);

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

      const className = (this as object).constructor.name;
      const pattern = `${className}:${methodName}:*`;

      if (options.store.deleteByPattern) {
        await options.store.deleteByPattern(pattern);
      }

      return result;
    };

    return descriptor;
  };
}
