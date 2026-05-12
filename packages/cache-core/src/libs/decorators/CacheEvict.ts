import type { CacheStore } from "../CacheStore";
import { CacheDecoratorConfigProblem } from "../problems/CacheDecoratorProblems";

export interface CacheEvictOptions<V = unknown> {
  store: CacheStore<string, V>;
  namespace?: string;
  key?: string;
  allEntries?: boolean;
}

function resolveEvictionPattern(options: CacheEvictOptions<unknown>, methodName: string): string {
  if (options.namespace === undefined) {
    throw new CacheDecoratorConfigProblem(
      `@CacheEvict requires "namespace" when "key" is not provided (method: ${methodName})`,
    );
  }

  return `${options.namespace}:${methodName}:*`;
}

export function CacheEvict<V = unknown>(options: CacheEvictOptions<V>): MethodDecorator {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;
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
        if (options.key.includes("*")) {
          await options.store.invalidatePattern(options.key);
        } else {
          await options.store.delete(options.key);
        }

        return result;
      }

      if (pattern !== undefined) {
        await options.store.invalidatePattern(pattern);
      }

      return result;
    };

    return descriptor;
  };
}
