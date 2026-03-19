import { Container } from '@croco/framework-context';
import { BATCH_LOADER_FACTORY_TOKEN, type IBatchLoaderFactory } from '../IBatchLoaderFactory';
import {
  BatchLoaderFactoryNotRegisteredProblem,
  BatchLoaderFactoryResolutionProblem,
} from '../problems/BatchLoadProblems';

type BatchKeyedRecord = Record<string, unknown>;

type BatchLoadableRepository<TKey, TValue extends BatchKeyedRecord> = {
  findByIds?: (ids: TKey[]) => Promise<ReadonlyArray<TValue>>;
};

type BatchLoadMethod<TKey, TValue> = (this: object, arg: TKey) => Promise<TValue | null>;

function hasBatchKey(value: unknown, key: string): value is BatchKeyedRecord {
  return typeof value === 'object' && value !== null && key in value;
}

export type BatchLoadOptions = {
  /**
   * The field name to use as the key for mapping results.
   * This is required to ensure the order of results matches the order of keys.
   * Example: 'id'
   */
  by: string;

  /**
   * The name of the DataLoader.
   * If not provided, it defaults to `${ClassName}:${methodName}`.
   */
  name?: string;
};

function getBatchLoaderFactory(): IBatchLoaderFactory {
  if (!Container.has(BATCH_LOADER_FACTORY_TOKEN)) {
    throw new BatchLoaderFactoryNotRegisteredProblem();
  }

  try {
    return Container.get(BATCH_LOADER_FACTORY_TOKEN);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BatchLoaderFactoryResolutionProblem(message);
  }
}

export function BatchLoad(options: BatchLoadOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value as BatchLoadMethod<unknown, unknown>;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const loaderName = options.name || `${className}:${methodName}`;

    descriptor.value = async function (this: BatchLoadableRepository<unknown, BatchKeyedRecord>, arg: unknown) {
      const batchLoaderFactory = getBatchLoaderFactory();
      const batchFn = async (keys: ReadonlyArray<unknown>) => {
        // 1. Try to use findByIds if it exists (Optimization)
        if (typeof this.findByIds === 'function') {
          const results = await this.findByIds([...keys]);

          // Map results by the 'by' key to ensure order matches 'keys'
          const resultMap = new Map<unknown, BatchKeyedRecord>();
          for (const item of results) {
            if (hasBatchKey(item, options.by)) {
              resultMap.set(item[options.by], item);
            }
          }

          // Return results in the same order as keys
          return keys.map((key) => resultMap.get(key) || null);
        }

        // 2. Fallback: Call original method for each key in parallel
        // This is useful when the class doesn't implement findByIds
        // or for methods other than findById.
        return Promise.all(
          keys.map(async (key) => {
            try {
              // Call the original method
              return await originalMethod.call(this, key);
            } catch (error) {
              // DataLoader expects Errors to be returned, not thrown, for partial failures
              return error instanceof Error ? error : new Error(String(error));
            }
          })
        );
      };

      // Create (or retrieve context-scoped) DataLoader
      const loader = batchLoaderFactory.create({
        name: loaderName,
        batchFn,
      });

      // Delegate the call to the loader
      return loader.load(arg);
    };

    return descriptor;
  };
}
