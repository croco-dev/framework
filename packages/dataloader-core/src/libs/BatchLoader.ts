import type { ILogger } from "@croco/framework-context";
import { recordError } from "@croco/telemetry-api";
import { context, SpanStatusCode, trace } from "@opentelemetry/api";
import {
  BatchResultLengthMismatchProblem,
  InvalidBatchLoaderConfigurationError,
} from "./problems/BatchLoaderProblems";
import type { BatchLoader, BatchLoaderOptions } from "./types";

type BatchCallback<V> = {
  resolve: (value: V | null) => void;
  reject: (error: Error) => void;
};

type BatchItem<K, V> = {
  key: K;
  callbacks: Array<BatchCallback<V>>;
};

const noopLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => noopLogger,
};

export class BatchLoaderImpl<K, V> implements BatchLoader<K, V> {
  private queue: Array<BatchItem<K, V>> = [];
  private queuedKeyMap = new Map<K, BatchItem<K, V>>();
  private cache = new Map<K, Promise<V | null>>();
  private readonly options: BatchLoaderOptions<K, V>;
  private readonly logger: ILogger;
  private scheduled = false;

  constructor(options: BatchLoaderOptions<K, V>, logger: ILogger = noopLogger) {
    const maxBatchSize = options.maxBatchSize ?? Infinity;
    if (maxBatchSize !== Infinity && (!Number.isSafeInteger(maxBatchSize) || maxBatchSize <= 0)) {
      throw new InvalidBatchLoaderConfigurationError(
        `maxBatchSize must be a positive safe integer or Infinity, got ${maxBatchSize}`,
      );
    }
    this.options = {
      cache: true,
      ...options,
      maxBatchSize,
    };
    this.logger = logger.child({ component: "BatchLoader", loader: this.options.name });
  }

  async load(key: K): Promise<V | null> {
    if (this.options.cache) {
      const cached = this.cache.get(key);
      if (cached) {
        return cached;
      }
    }

    const promise = new Promise<V | null>((resolve, reject) => {
      const existingBatchItem = this.queuedKeyMap.get(key);
      if (existingBatchItem) {
        existingBatchItem.callbacks.push({ resolve, reject });
      } else {
        const item: BatchItem<K, V> = {
          key,
          callbacks: [{ resolve, reject }],
        };
        this.queuedKeyMap.set(key, item);
        this.queue.push(item);

        if (this.queue.length === 1) {
          this.scheduleDispatch();
        }
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
        this.logger.warn("Prime rejected error cached", { key, error: error as Error });
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
      const batchItems = this.queue.splice(0, batchSize);
      for (const item of batchItems) {
        this.queuedKeyMap.delete(item.key);
      }

      await this.executeBatch(batchItems);
    }
  }

  private async executeBatch(batchItems: Array<BatchItem<K, V>>): Promise<void> {
    const keys = batchItems.map((item) => item.key);
    const tracer = trace.getTracer("dataloader-core");

    // Create a span for the batch execution
    await tracer.startActiveSpan(`dataloader:${this.options.name}:batch`, async (span) => {
      try {
        span.setAttribute("batch.size", keys.length);

        const results = await this.options.batchFn(keys);

        if (results.length !== keys.length) {
          throw new BatchResultLengthMismatchProblem(keys.length, results.length);
        }

        let populatedResultCount = 0;
        for (let index = 0; index < results.length; index += 1) {
          if (Object.prototype.hasOwnProperty.call(results, index)) {
            populatedResultCount += 1;
          }
        }

        if (populatedResultCount !== keys.length) {
          throw new BatchResultLengthMismatchProblem(keys.length, populatedResultCount);
        }

        for (let index = 0; index < results.length; index += 1) {
          const result = results[index];
          const item = batchItems[index];
          if (result instanceof Error) {
            span.recordException(result);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: result.message,
            });
            this.clear(item.key);
            for (const callback of item.callbacks) {
              callback.reject(result);
            }
          } else {
            for (const callback of item.callbacks) {
              callback.resolve(result);
            }
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        span.recordException(err);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err.message,
        });

        batchItems.forEach((item) => {
          this.clear(item.key);
          item.callbacks.forEach((callback) => {
            callback.reject(err);
          });
        });
      } finally {
        span.end();
      }
    });
  }
}
