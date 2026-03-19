import type { ILogger } from '@croco/framework-context';
import { recordError } from '@croco/telemetry-api';
import { context, trace } from '@opentelemetry/api';
import { BatchResultLengthMismatchProblem } from './problems/BatchLoaderProblems';
import type { BatchLoader, BatchLoaderOptions } from './types';

const noopLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
};

export class BatchLoaderImpl<K, V> implements BatchLoader<K, V> {
  private queue: K[] = [];
  private callbacks: Array<{
    resolve: (value: V | null) => void;
    reject: (error: Error) => void;
  }> = [];
  private cache = new Map<K, Promise<V | null>>();
  private readonly options: BatchLoaderOptions<K, V>;
  private readonly logger: ILogger;
  private scheduled = false;

  constructor(options: BatchLoaderOptions<K, V>, logger: ILogger = noopLogger) {
    this.options = {
      cache: true,
      maxBatchSize: Infinity,
      ...options,
    };
    this.logger = logger.child({ component: 'BatchLoader', loader: this.options.name });
  }

  async load(key: K): Promise<V | null> {
    if (this.options.cache) {
      const cached = this.cache.get(key);
      if (cached) {
        return cached;
      }
    }

    const promise = new Promise<V | null>((resolve, reject) => {
      this.queue.push(key);
      this.callbacks.push({ resolve, reject });

      if (this.queue.length === 1) {
        this.scheduleDispatch();
      }
    });

    if (this.options.cache) {
      this.cache.set(key, promise);
    }

    return promise;
  }

  async loadMany(keys: K[]): Promise<Array<V | Error | null>> {
    return Promise.all(keys.map((key) => this.load(key).catch((error) => error)));
  }

  clear(key: K): void {
    this.cache.delete(key);
  }

  clearAll(): void {
    this.cache.clear();
  }

  prime(key: K, value: V | Error): void {
    if (value instanceof Error) {
      const rejected = Promise.reject<V | null>(value);
      void rejected.catch((error) => {
        this.logger.warn('Prime rejected error cached', { key, error: error as Error });
        recordError(error);
      });
      this.cache.set(key, rejected);
    } else {
      this.cache.set(key, Promise.resolve(value));
    }
  }

  private scheduleDispatch(): void {
    if (this.scheduled) return;

    this.scheduled = true;
    const activeContext = context.active();

    process.nextTick(() => {
      void context.with(activeContext, () => this.dispatch());
    });
  }

  private async dispatch(): Promise<void> {
    this.scheduled = false;

    if (this.queue.length === 0) return;

    const batchSize = this.options.maxBatchSize ?? Infinity;

    // Process queue in chunks if maxBatchSize is set
    while (this.queue.length > 0) {
      const keys = this.queue.splice(0, batchSize);
      const callbacks = this.callbacks.splice(0, batchSize);

      await this.executeBatch(keys, callbacks);
    }
  }

  private async executeBatch(
    keys: K[],
    callbacks: Array<{ resolve: (value: V | null) => void; reject: (error: Error) => void }>
  ): Promise<void> {
    const tracer = trace.getTracer('dataloader-core');

    // Create a span for the batch execution
    await tracer.startActiveSpan(`dataloader:${this.options.name}:batch`, async (span) => {
      try {
        span.setAttribute('batch.size', keys.length);

        const results = await this.options.batchFn(keys);

        if (results.length !== keys.length) {
          throw new BatchResultLengthMismatchProblem(keys.length, results.length);
        }

        results.forEach((result, index) => {
          const callback = callbacks[index];
          if (result instanceof Error) {
            this.clear(keys[index]);
            callback.reject(result);
          } else {
            callback.resolve(result);
          }
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        span.recordException(err);

        keys.forEach((key) => {
          this.clear(key);
        });

        callbacks.forEach((callback) => {
          callback.reject(err);
        });
      } finally {
        span.end();
      }
    });
  }
}
