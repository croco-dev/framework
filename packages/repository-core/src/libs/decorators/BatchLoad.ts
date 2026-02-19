import { createBatchLoader } from '@croco/dataloader-core';

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

export function BatchLoad(options: BatchLoadOptions): MethodDecorator {
  return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const loaderName = options.name || `${className}:${methodName}`;

    descriptor.value = async function (this: any, arg: any) {
      const batchFn = async (keys: readonly any[]) => {
        // 1. Try to use findByIds if it exists (Optimization)
        if (typeof this.findByIds === 'function') {
          try {
            // Assume findByIds returns T[]
            const results = await this.findByIds(keys as any[]);

            // Map results by the 'by' key to ensure order matches 'keys'
            // We cast results to any[] to access the 'by' property dynamically
            const resultMap = new Map();
            for (const item of results) {
              if (item && typeof item === 'object' && options.by in item) {
                resultMap.set(item[options.by], item);
              }
            }

            // Return results in the same order as keys
            return keys.map((key) => resultMap.get(key) || null);
          } catch (error) {
            // If findByIds fails, we propagate the error.
            // In a batch context, this fails the entire batch.
            // Alternatively, we could fallback to individual calls,
            // but if findByIds exists, it's expected to work.
            throw error;
          }
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
      const loader = createBatchLoader({
        name: loaderName,
        batchFn,
      });

      // Delegate the call to the loader
      return loader.load(arg);
    };

    return descriptor;
  };
}
