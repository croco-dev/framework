import { Container, Context } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BatchLoad, type BatchLoadScope } from "../../libs/decorators/BatchLoad";
import type {
  BatchLoaderFactoryOptions,
  BatchLoaderLike,
  IBatchLoaderFactory,
} from "../../libs/IBatchLoaderFactory";
import { BATCH_LOADER_FACTORY_TOKEN } from "../../libs/IBatchLoaderFactory";
import {
  BatchLoaderFactoryNotRegisteredProblem,
  BatchLoaderScopeCollisionProblem,
} from "../../libs/problems/BatchLoadProblems";

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
  readonly createSpy = vi.fn<(name: string) => void>();

  create<K, V>(options: BatchLoaderFactoryOptions<K, V>): BatchLoaderLike<K, V> {
    this.createSpy(options.name);

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

class StoreRepository {
  findByIds = vi.fn(async (ids: string[]): Promise<ReadonlyArray<Entity>> => {
    return ids.flatMap((id) => {
      const value = this.store.get(id);
      return value === undefined ? [] : [{ id, value }];
    });
  });

  constructor(private readonly store: ReadonlyMap<string, string>) {}

  @BatchLoad({ by: "id" })
  async findById(id: string): Promise<Entity | null> {
    const value = this.store.get(id);
    return value === undefined ? null : { id, value };
  }
}

class ScopedStoreRepository {
  findByIds = vi.fn(async (ids: string[]): Promise<ReadonlyArray<Entity>> => {
    return ids.flatMap((id) => {
      const value = this.store.get(id);
      return value === undefined ? [] : [{ id, value }];
    });
  });

  constructor(
    readonly scopeToken: BatchLoadScope,
    private readonly store: ReadonlyMap<string, string>,
  ) {}

  @BatchLoad<ScopedStoreRepository>({
    by: "id",
    scope: (repository) => repository.scopeToken,
  })
  async findById(id: string): Promise<Entity | null> {
    const value = this.store.get(id);
    return value === undefined ? null : { id, value };
  }
}

class ExplicitlyNamedScopedRepository {
  findByIds = vi.fn(async (ids: string[]): Promise<ReadonlyArray<Entity>> => {
    return ids.flatMap((id) => {
      const value = this.store.get(id);
      return value === undefined ? [] : [{ id, value }];
    });
  });

  constructor(
    readonly scopeToken: BatchLoadScope,
    private readonly store: ReadonlyMap<string, string>,
  ) {}

  @BatchLoad<ExplicitlyNamedScopedRepository>({
    by: "id",
    name: "shared-store",
    scope: (repository) => repository.scopeToken,
  })
  async findById(id: string): Promise<Entity | null> {
    const value = this.store.get(id);
    return value === undefined ? null : { id, value };
  }
}

class TransactionScopedRepository {
  readonly stores = new Map<BatchLoadScope, ReadonlyMap<string, string>>();
  findByIds = vi.fn(async (ids: string[]): Promise<ReadonlyArray<Entity>> => {
    const store = this.stores.get(this.currentScope);
    return ids.flatMap((id) => {
      const value = store?.get(id);
      return value === undefined ? [] : [{ id, value }];
    });
  });

  constructor(public currentScope: BatchLoadScope) {}

  @BatchLoad<TransactionScopedRepository>({
    by: "id",
    scope: (repository) => repository.currentScope,
  })
  async findById(id: string): Promise<Entity | null> {
    const value = this.stores.get(this.currentScope)?.get(id);
    return value === undefined ? null : { id, value };
  }
}

const SHARED_DEFINITION_SCOPE = Symbol("shared-definition-scope");

class FirstExplicitDefinition {
  @BatchLoad({
    by: "id",
    name: "definition-alias",
    scope: () => SHARED_DEFINITION_SCOPE,
  })
  async findById(id: string): Promise<Entity> {
    return { id, value: `first-${id}` };
  }
}

class SecondExplicitDefinition {
  @BatchLoad({
    by: "id",
    name: "definition-alias",
    scope: () => SHARED_DEFINITION_SCOPE,
  })
  async findById(id: string): Promise<Entity> {
    return { id, value: `second-${id}` };
  }
}

const IDENTICAL_DISPLAY_SCOPE = Symbol("identical-display-scope");

function createFirstIdenticalRepository() {
  class IdenticalRepository {
    @BatchLoad({ by: "id", scope: () => IDENTICAL_DISPLAY_SCOPE })
    async findById(id: string): Promise<Entity> {
      return { id, value: "first-definition" };
    }
  }

  return IdenticalRepository;
}

function createSecondIdenticalRepository() {
  class IdenticalRepository {
    @BatchLoad({ by: "id", scope: () => IDENTICAL_DISPLAY_SCOPE })
    async findById(id: string): Promise<Entity> {
      return { id, value: "second-definition" };
    }
  }

  return IdenticalRepository;
}

const FirstIdenticalRepository = createFirstIdenticalRepository();
const SecondIdenticalRepository = createSecondIdenticalRepository();

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

  it("isolates same-class repository instances backed by different stores", async () => {
    await Context.run({ requestId: "scope-instance-isolation" }, async () => {
      const firstRepository = new StoreRepository(new Map([["same", "first-store"]]));
      const secondRepository = new StoreRepository(new Map([["same", "second-store"]]));

      const [first, second] = await Promise.all([
        firstRepository.findById("same"),
        secondRepository.findById("same"),
      ]);

      expect(first).toEqual({ id: "same", value: "first-store" });
      expect(second).toEqual({ id: "same", value: "second-store" });
      expect(firstRepository.findByIds).toHaveBeenCalledTimes(1);
      expect(secondRepository.findByIds).toHaveBeenCalledTimes(1);
      expect(factory.createSpy.mock.calls[0][0]).not.toBe(factory.createSpy.mock.calls[1][0]);
    });
  });

  it("isolates loaders when one repository changes its transaction scope", async () => {
    await Context.run({ requestId: "scope-transaction-isolation" }, async () => {
      const firstTransaction = Symbol("transaction");
      const secondTransaction = Symbol("transaction");
      const repository = new TransactionScopedRepository(firstTransaction);
      repository.stores.set(firstTransaction, new Map([["same", "first-transaction"]]));
      repository.stores.set(secondTransaction, new Map([["same", "second-transaction"]]));

      const first = await repository.findById("same");
      repository.currentScope = secondTransaction;
      const second = await repository.findById("same");

      expect(first).toEqual({ id: "same", value: "first-transaction" });
      expect(second).toEqual({ id: "same", value: "second-transaction" });
      expect(repository.findByIds).toHaveBeenCalledTimes(2);
      expect(factory.createSpy.mock.calls[0][0]).not.toBe(factory.createSpy.mock.calls[1][0]);
    });
  });

  it("shares an explicit name only for the same definition and safe scope", async () => {
    await Context.run({ requestId: "scope-safe-sharing" }, async () => {
      const scopeToken = { dataSource: "shared" };
      const store = new Map([
        ["1", "shared-one"],
        ["2", "shared-two"],
      ]);
      const firstRepository = new ExplicitlyNamedScopedRepository(scopeToken, store);
      const secondRepository = new ExplicitlyNamedScopedRepository(scopeToken, store);

      const [first, second] = await Promise.all([
        firstRepository.findById("1"),
        secondRepository.findById("2"),
      ]);

      expect(first).toEqual({ id: "1", value: "shared-one" });
      expect(second).toEqual({ id: "2", value: "shared-two" });
      expect(factory.createSpy.mock.calls[0][0]).toBe(factory.createSpy.mock.calls[1][0]);
      expect(firstRepository.findByIds).toHaveBeenCalledTimes(1);
      expect(secondRepository.findByIds).not.toHaveBeenCalled();
    });
  });

  it("rejects an explicit name claimed by an incompatible scope before factory creation", async () => {
    await Context.run({ requestId: "scope-name-collision" }, async () => {
      const firstRepository = new ExplicitlyNamedScopedRepository(
        Symbol("first-scope"),
        new Map([["same", "first"]]),
      );
      const secondRepository = new ExplicitlyNamedScopedRepository(
        Symbol("second-scope"),
        new Map([["same", "second"]]),
      );

      await expect(firstRepository.findById("same")).resolves.toEqual({
        id: "same",
        value: "first",
      });
      await expect(secondRepository.findById("same")).rejects.toBeInstanceOf(
        BatchLoaderScopeCollisionProblem,
      );
      expect(factory.createSpy).toHaveBeenCalledTimes(1);
      expect(secondRepository.findByIds).not.toHaveBeenCalled();
    });
  });

  it("rejects an explicit name claimed by a different decorated definition", async () => {
    await Context.run({ requestId: "scope-definition-collision" }, async () => {
      const firstRepository = new FirstExplicitDefinition();
      const secondRepository = new SecondExplicitDefinition();

      await expect(firstRepository.findById("same")).resolves.toEqual({
        id: "same",
        value: "first-same",
      });
      await expect(secondRepository.findById("same")).rejects.toBeInstanceOf(
        BatchLoaderScopeCollisionProblem,
      );
      expect(factory.createSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("uses opaque definition identity when constructor and method display names match", async () => {
    await Context.run({ requestId: "scope-identical-display-names" }, async () => {
      const firstRepository = new FirstIdenticalRepository();
      const secondRepository = new SecondIdenticalRepository();

      const [first, second] = await Promise.all([
        firstRepository.findById("same"),
        secondRepository.findById("same"),
      ]);

      expect(first).toEqual({ id: "same", value: "first-definition" });
      expect(second).toEqual({ id: "same", value: "second-definition" });
      expect(FirstIdenticalRepository.name).toBe(SecondIdenticalRepository.name);
      expect(factory.createSpy.mock.calls[0][0]).not.toBe(factory.createSpy.mock.calls[1][0]);
    });
  });

  it("resets identity and explicit name claims for each Context", async () => {
    const firstRepository = new ExplicitlyNamedScopedRepository(
      Symbol("first-request"),
      new Map([["same", "first-request"]]),
    );
    const secondRepository = new ExplicitlyNamedScopedRepository(
      Symbol("second-request"),
      new Map([["same", "second-request"]]),
    );

    const first = await Context.run({ requestId: "scope-request-one" }, () =>
      firstRepository.findById("same"),
    );
    const second = await Context.run({ requestId: "scope-request-two" }, () =>
      secondRepository.findById("same"),
    );

    expect(first).toEqual({ id: "same", value: "first-request" });
    expect(second).toEqual({ id: "same", value: "second-request" });
    expect(factory.createSpy).toHaveBeenCalledTimes(2);
    expect(factory.createSpy.mock.calls[0][0]).toBe(factory.createSpy.mock.calls[1][0]);
  });

  it("preserves uncached loader behavior outside an active Context", async () => {
    const repository = new StoreRepository(
      new Map([
        ["1", "outside-one"],
        ["2", "outside-two"],
      ]),
    );

    const [first, second] = await Promise.all([repository.findById("1"), repository.findById("2")]);

    expect(first).toEqual({ id: "1", value: "outside-one" });
    expect(second).toEqual({ id: "2", value: "outside-two" });
    expect(factory.createSpy).toHaveBeenCalledTimes(2);
    expect(factory.createSpy.mock.calls[0][0]).toBe("StoreRepository:findById");
    expect(factory.createSpy.mock.calls[1][0]).toBe("StoreRepository:findById");
    expect(repository.findByIds).toHaveBeenCalledTimes(2);
  });

  it("uses Map identity semantics for primitive, object, and symbol scope tokens", async () => {
    await Context.run({ requestId: "scope-token-identity" }, async () => {
      const sharedObject = { scope: "object" };
      const distinctObject = { scope: "object" };
      const sharedSymbol = Symbol("scope");
      const distinctSymbol = Symbol("scope");
      const repositories = [
        new ScopedStoreRepository("tenant-secret", new Map([["1", "primitive-one"]])),
        new ScopedStoreRepository("tenant-secret", new Map([["2", "primitive-two"]])),
        new ScopedStoreRepository(sharedObject, new Map([["3", "object-one"]])),
        new ScopedStoreRepository(sharedObject, new Map([["4", "object-two"]])),
        new ScopedStoreRepository(distinctObject, new Map([["5", "object-distinct"]])),
        new ScopedStoreRepository(sharedSymbol, new Map([["6", "symbol-one"]])),
        new ScopedStoreRepository(sharedSymbol, new Map([["7", "symbol-two"]])),
        new ScopedStoreRepository(distinctSymbol, new Map([["8", "symbol-distinct"]])),
      ];

      for (const [index, repository] of repositories.entries()) {
        await repository.findById(String(index + 1));
      }

      const names = factory.createSpy.mock.calls.map(([name]) => name);
      expect(names[0]).toBe(names[1]);
      expect(names[2]).toBe(names[3]);
      expect(names[2]).not.toBe(names[4]);
      expect(names[5]).toBe(names[6]);
      expect(names[5]).not.toBe(names[7]);
      expect(names.every((name) => !name.includes("tenant-secret"))).toBe(true);
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
