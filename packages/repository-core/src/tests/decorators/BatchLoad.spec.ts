import { Container, Context } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BatchLoad } from "../../libs/decorators/BatchLoad";
import type {
  BatchLoaderFactoryOptions,
  BatchLoaderLike,
  IBatchLoaderFactory,
} from "../../libs/IBatchLoaderFactory";
import { BATCH_LOADER_FACTORY_TOKEN } from "../../libs/IBatchLoaderFactory";
import { BatchLoaderFactoryNotRegisteredProblem } from "../../libs/problems/BatchLoadProblems";

type Entity = {
  id: string;
  value: string;
};

class TestBatchLoader<K, V> implements BatchLoaderLike<K, V> {
  private readonly cache = new Map<K, Promise<V | null>>();
  private queue: K[] = [];
  private callbacks: Array<{
    resolve: (value: V | null) => void;
    reject: (error: Error) => void;
  }> = [];
  private scheduled = false;

  constructor(private readonly options: BatchLoaderFactoryOptions<K, V>) {}

  async load(key: K): Promise<V | null> {
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const promise = new Promise<V | null>((resolve, reject) => {
      this.queue.push(key);
      this.callbacks.push({ resolve, reject });

      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => {
          void this.dispatch();
        });
      }
    });

    this.cache.set(key, promise);
    return promise;
  }

  private async dispatch(): Promise<void> {
    this.scheduled = false;

    const keys = [...this.queue];
    const callbacks = [...this.callbacks];

    this.queue = [];
    this.callbacks = [];

    try {
      const results = await this.options.batchFn(keys);

      results.forEach((result, index) => {
        const key = keys[index];
        const callback = callbacks[index];

        if (result instanceof Error) {
          this.cache.delete(key);
          callback.reject(result);
          return;
        }

        callback.resolve(result ?? null);
      });
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));

      keys.forEach((key) => {
        this.cache.delete(key);
      });

      callbacks.forEach((callback) => {
        callback.reject(normalizedError);
      });
    }
  }
}

class TestBatchLoaderFactory implements IBatchLoaderFactory {
  readonly createSpy = vi.fn();

  create<K, V>(options: BatchLoaderFactoryOptions<K, V>): BatchLoaderLike<K, V> {
    this.createSpy(options);

    const contextCache = Context.getCache();
    const cacheKey = `test-batch-loader:${options.name}`;

    if (!contextCache) {
      return new TestBatchLoader(options);
    }

    let loader = contextCache.get(cacheKey) as TestBatchLoader<K, V> | undefined;
    if (!loader) {
      loader = new TestBatchLoader(options);
      contextCache.set(cacheKey, loader);
    }

    return loader;
  }
}

class TestRepository {
  findByIds = vi.fn<(ids: string[]) => Promise<ReadonlyArray<Entity>>>(async (ids: string[]) => {
    return ids.map((id) => ({ id, value: `value-${id}` }));
  });

  @BatchLoad({ by: "id" })
  async findById(id: string) {
    return this.originalFindById(id);
  }

  async originalFindById(id: string) {
    return { id, value: `value-${id}` };
  }
}

class FallbackRepository {
  callCount = 0;

  @BatchLoad({ by: "id" })
  async findById(id: string) {
    this.callCount += 1;
    return { id, value: `value-${id}` };
  }
}

describe("BatchLoad Decorator", () => {
  let factory!: TestBatchLoaderFactory;

  beforeEach(() => {
    Container.reset();
    factory = new TestBatchLoaderFactory();
    Container.set(BATCH_LOADER_FACTORY_TOKEN, factory);
  });

  it("should batch multiple calls into a single findByIds call", async () => {
    await Context.run({ requestId: "test-1" }, async () => {
      const repository = new TestRepository();

      const p1 = repository.findById("1");
      const p2 = repository.findById("2");
      const p3 = repository.findById("1");

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(r1).toEqual({ id: "1", value: "value-1" });
      expect(r2).toEqual({ id: "2", value: "value-2" });
      expect(r3).toEqual({ id: "1", value: "value-1" });

      expect(factory.createSpy).toHaveBeenCalledTimes(3);
      expect(repository.findByIds).toHaveBeenCalledTimes(1);

      const calledIds = repository.findByIds.mock.calls[0][0];
      expect(calledIds).toHaveLength(2);
      expect(calledIds).toContain("1");
      expect(calledIds).toContain("2");
    });
  });

  it("should fallback to parallel calls if findByIds is missing", async () => {
    await Context.run({ requestId: "test-2" }, async () => {
      const fallbackRepo = new FallbackRepository();

      const [r1, r2] = await Promise.all([fallbackRepo.findById("A"), fallbackRepo.findById("B")]);

      expect(r1).toEqual({ id: "A", value: "value-A" });
      expect(r2).toEqual({ id: "B", value: "value-B" });
      expect(fallbackRepo.callCount).toBe(2);
    });
  });

  it("should handle findByIds returning results in different order", async () => {
    await Context.run({ requestId: "test-3" }, async () => {
      const repository = new TestRepository();
      repository.findByIds.mockImplementation(async (_ids: string[]) => {
        return [
          { id: "2", value: "value-2" },
          { id: "1", value: "value-1" },
        ];
      });

      const [r1, r2] = await Promise.all([repository.findById("1"), repository.findById("2")]);

      expect(r1).toEqual({ id: "1", value: "value-1" });
      expect(r2).toEqual({ id: "2", value: "value-2" });
    });
  });

  it("should propagate errors from findByIds", async () => {
    await Context.run({ requestId: "test-4" }, async () => {
      const repository = new TestRepository();
      const error = new Error("DB Error");
      repository.findByIds.mockRejectedValue(error);

      await expect(repository.findById("1")).rejects.toThrow("DB Error");
      await expect(repository.findById("2")).rejects.toThrow("DB Error");
    });
  });

  it("should throw an explicit Problem when batch loader factory is not registered", async () => {
    const hasSpy = vi.spyOn(Container, "has").mockReturnValue(false);

    await Context.run({ requestId: "test-5" }, async () => {
      const repository = new TestRepository();

      await expect(repository.findById("1")).rejects.toThrow(
        BatchLoaderFactoryNotRegisteredProblem,
      );
    });

    hasSpy.mockRestore();
  });
});
