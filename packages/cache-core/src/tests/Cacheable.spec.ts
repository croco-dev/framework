import { beforeEach, describe, expect, it, vi } from "vitest";
import { Context } from "@croco/framework-context";
import type { CacheStore } from "../libs/CacheStore";
import { createCacheKey } from "../libs/cacheKey";
import { Cacheable } from "../libs/decorators/Cacheable";
import { CacheEvict } from "../libs/decorators/CacheEvict";
import { InMemoryCacheStore } from "../libs/InMemoryCacheStore";
import type { CacheKeyArgumentProblem } from "../libs/problems/CacheDecoratorProblems";

describe("@Cacheable", () => {
  let cache!: InMemoryCacheStore<string>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });
  });

  it("caches method result", async () => {
    let callCount = 0;

    class TestService {
      @Cacheable({ store: cache, namespace: "test-service" })
      async getData(id: string): Promise<string> {
        callCount++;
        return `data-${id}`;
      }
    }

    const service = new TestService();

    const result1 = await service.getData("123");
    const result2 = await service.getData("123");

    expect(result1).toBe("data-123");
    expect(result2).toBe("data-123");
    expect(callCount).toBe(1);
  });

  it("uses singleflight when concurrent calls share the same key", async () => {
    let callCount = 0;
    let resolveValue!: () => void;

    class TestService {
      @Cacheable({ store: cache, namespace: "test-service" })
      async getData(id: string): Promise<string> {
        callCount++;
        return new Promise<string>((resolve) => {
          resolveValue = () => resolve(`data-${id}`);
        });
      }
    }

    const service = new TestService();

    const pending = Promise.all([
      service.getData("123"),
      service.getData("123"),
      service.getData("123"),
    ]);

    await Promise.resolve();

    expect(callCount).toBe(1);

    resolveValue();

    await expect(pending).resolves.toEqual(["data-123", "data-123", "data-123"]);
  });

  it("uses different cache keys for different arguments", async () => {
    let callCount = 0;

    class TestService {
      @Cacheable({ store: cache, namespace: "test-service" })
      async getData(id: string): Promise<string> {
        callCount++;
        return `data-${id}`;
      }
    }

    const service = new TestService();

    await service.getData("123");
    await service.getData("456");

    expect(callCount).toBe(2);
  });

  it("distinguishes argument values that JSON serialization conflates", async () => {
    let callCount = 0;

    class TestService {
      @Cacheable({ store: cache, namespace: "test-service" })
      async getData(value: unknown): Promise<string> {
        callCount++;
        return `result-${callCount}-${typeof value}`;
      }
    }

    const service = new TestService();
    const sparse: unknown[] = [];
    sparse.length = 1;
    const values = [
      undefined,
      null,
      "1",
      1,
      true,
      0,
      -0,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      {},
      { value: undefined },
      [undefined],
      [null],
      sparse,
    ];

    for (const value of values) {
      const first = await service.getData(value);
      const second = await service.getData(value);

      expect(second).toBe(first);
    }

    expect(callCount).toBe(values.length);
  });

  it("uses one stable key for equivalent objects regardless of insertion order", async () => {
    let callCount = 0;

    class TestService {
      @Cacheable({ store: cache, namespace: "test-service" })
      async getData(value: object): Promise<string> {
        callCount++;
        return JSON.stringify(value);
      }
    }

    const service = new TestService();

    await service.getData({ first: 1, second: 2 });
    await service.getData({ second: 2, first: 1 });

    expect(callCount).toBe(1);
  });

  it("rejects cyclic and unsupported argument graphs with a typed Problem", async () => {
    class TestService {
      @Cacheable({ store: cache, namespace: "test-service" })
      async getData(_value: unknown): Promise<string> {
        return "result";
      }
    }

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const service = new TestService();

    await expect(service.getData(cyclic)).rejects.toMatchObject({
      code: "cache-core/cache-key-argument-unsupported",
      path: 'arguments[0]["self"]',
      reason: "contains a cyclic reference",
    } satisfies Partial<CacheKeyArgumentProblem>);
    await expect(service.getData(new Date("2026-01-01T00:00:00.000Z"))).rejects.toMatchObject({
      code: "cache-core/cache-key-argument-unsupported",
      path: "arguments[0]",
      reason: "is not a plain object",
    } satisfies Partial<CacheKeyArgumentProblem>);

    const accessor: unknown[] = [];
    Object.defineProperty(accessor, 0, { enumerable: true, get: () => "value" });

    await expect(service.getData(accessor)).rejects.toMatchObject({
      code: "cache-core/cache-key-argument-unsupported",
      path: "arguments[0][0]",
      reason: "is not an enumerable data property",
    } satisfies Partial<CacheKeyArgumentProblem>);

    let deep: unknown = "leaf";
    for (let depth = 0; depth < 101; depth++) {
      deep = [deep];
    }

    await expect(service.getData(deep)).rejects.toMatchObject({
      code: "cache-core/cache-key-argument-unsupported",
      reason: "exceeds the maximum supported depth of 100",
    } satisfies Partial<CacheKeyArgumentProblem>);

    const oversizedSparse: unknown[] = [];
    oversizedSparse.length = 10_000;

    await expect(service.getData(oversizedSparse)).rejects.toMatchObject({
      code: "cache-core/cache-key-argument-unsupported",
      path: "arguments[0]",
      reason: "exceeds the maximum supported size of 10000 values",
    } satisfies Partial<CacheKeyArgumentProblem>);

    const firstSparse: unknown[] = [];
    firstSparse.length = 6_000;
    const secondSparse: unknown[] = [];
    secondSparse.length = 6_000;

    await expect(service.getData([firstSparse, secondSparse])).rejects.toMatchObject({
      code: "cache-core/cache-key-argument-unsupported",
      path: "arguments[0][1]",
      reason: "exceeds the maximum supported size of 10000 values",
    } satisfies Partial<CacheKeyArgumentProblem>);
  });

  it("respects TTL", async () => {
    vi.useFakeTimers();
    let callCount = 0;

    class TestService {
      @Cacheable({ store: cache, namespace: "test-service", ttl: 1000 })
      async getData(id: string): Promise<string> {
        callCount++;
        return `data-${id}`;
      }
    }

    const service = new TestService();

    await service.getData("123");
    vi.advanceTimersByTime(1001);
    await service.getData("123");

    expect(callCount).toBe(2);

    vi.useRealTimers();
  });

  it("uses custom key prefix", async () => {
    let callCount = 0;

    class TestService {
      @Cacheable({ store: cache, keyPrefix: "custom:prefix" })
      async getData(id: string): Promise<string> {
        callCount++;
        return `data-${id}`;
      }
    }

    const service = new TestService();
    await service.getData("123");

    const cached = await cache.get(createCacheKey("custom:prefix", ["123"]));
    expect(cached).toBe("data-123");
  });

  it("preserves this context", async () => {
    class TestService {
      private prefix = "result:";

      @Cacheable({ store: cache, namespace: "test-service" })
      async getData(id: string): Promise<string> {
        return `${this.prefix}${id}`;
      }
    }

    const service = new TestService();
    const result = await service.getData("123");

    expect(result).toBe("result:123");
  });

  it("uses namespace for default cache keys", async () => {
    class TestService {
      @Cacheable({ store: cache, namespace: "stable-service" })
      async getData(id: string): Promise<string> {
        return `data-${id}`;
      }
    }

    const service = new TestService();
    await service.getData("123");

    expect(await cache.get(createCacheKey("stable-service:getData", ["123"]))).toBe("data-123");
  });

  it("prefers keyPrefix over namespace", async () => {
    class TestService {
      @Cacheable({ store: cache, namespace: "stable-service", keyPrefix: "custom:prefix" })
      async getData(id: string): Promise<string> {
        return `data-${id}`;
      }
    }

    const service = new TestService();
    await service.getData("123");

    expect(await cache.get(createCacheKey("custom:prefix", ["123"]))).toBe("data-123");
    expect(await cache.get(createCacheKey("stable-service:getData", ["123"]))).toBeUndefined();
  });

  it("returns the loaded value without restoring the cache when invalidated during load", async () => {
    let resolveLoad!: (value: string) => void;
    let loaderStarted!: () => void;
    const loaderStartedPromise = new Promise<void>((resolve) => {
      loaderStarted = resolve;
    });

    class TestService {
      @Cacheable({ store: cache, namespace: "users" })
      async getUser(id: string): Promise<string> {
        loaderStarted();
        return new Promise<string>((resolve) => {
          resolveLoad = resolve;
        });
      }
    }

    const service = new TestService();
    const pending = service.getUser("1");
    await loaderStartedPromise;

    await cache.invalidatePattern("users:getUser:*");
    resolveLoad("alice");

    await expect(pending).resolves.toBe("alice");
    expect(await cache.get(createCacheKey("users:getUser", ["1"]))).toBeUndefined();
  });

  it("returns the loaded value without restoring the cache when cleared during load", async () => {
    let resolveLoad!: (value: string) => void;
    let loaderStarted!: () => void;
    const loaderStartedPromise = new Promise<void>((resolve) => {
      loaderStarted = resolve;
    });

    class TestService {
      @Cacheable({ store: cache, namespace: "users" })
      async getUser(id: string): Promise<string> {
        loaderStarted();
        return new Promise<string>((resolve) => {
          resolveLoad = resolve;
        });
      }
    }

    const service = new TestService();
    const pending = service.getUser("1");
    await loaderStartedPromise;

    await cache.clear();
    resolveLoad("alice");

    await expect(pending).resolves.toBe("alice");
    expect(await cache.get(createCacheKey("users:getUser", ["1"]))).toBeUndefined();
  });

  it("returns the loaded value when a @CacheEvict overlaps the load", async () => {
    let resolveLoad!: (value: string) => void;
    let loaderStarted!: () => void;
    const loaderStartedPromise = new Promise<void>((resolve) => {
      loaderStarted = resolve;
    });

    class UserService {
      @Cacheable({ store: cache, namespace: "users" })
      async getUser(id: string): Promise<string> {
        loaderStarted();
        return new Promise<string>((resolve) => {
          resolveLoad = resolve;
        });
      }

      @CacheEvict({ store: cache, key: "users:getUser:*" })
      async updateUser(_id: string): Promise<void> {}
    }

    const service = new UserService();
    const pending = service.getUser("1");
    await loaderStartedPromise;

    await service.updateUser("1");
    resolveLoad("alice");

    await expect(pending).resolves.toBe("alice");
    expect(await cache.get(createCacheKey("users:getUser", ["1"]))).toBeUndefined();
  });

  it("shares the invalidated load result with singleflight waiters", async () => {
    let resolveLoad!: (value: string) => void;
    let loaderStarted!: () => void;
    const loaderStartedPromise = new Promise<void>((resolve) => {
      loaderStarted = resolve;
    });
    let loads = 0;

    class TestService {
      @Cacheable({ store: cache, namespace: "users" })
      async getUser(_id: string): Promise<string> {
        loads++;
        loaderStarted();
        return new Promise<string>((resolve) => {
          resolveLoad = resolve;
        });
      }
    }

    const service = new TestService();
    const owner = service.getUser("1");
    await loaderStartedPromise;

    const waiters = [service.getUser("1"), service.getUser("1")];
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(loads).toBe(1);

    await cache.delete(createCacheKey("users:getUser", ["1"]));
    resolveLoad("alice");

    await expect(owner).resolves.toBe("alice");
    await expect(Promise.all(waiters)).resolves.toEqual(["alice", "alice"]);
    expect(loads).toBe(1);
    expect(await cache.get(createCacheKey("users:getUser", ["1"]))).toBeUndefined();
  });

  it("returns the loaded value when the same key is deleted during load", async () => {
    let resolveLoad!: (value: string) => void;
    let loaderStarted!: () => void;
    const loaderStartedPromise = new Promise<void>((resolve) => {
      loaderStarted = resolve;
    });

    class TestService {
      @Cacheable({ store: cache, namespace: "users" })
      async getUser(id: string): Promise<string> {
        loaderStarted();
        return new Promise<string>((resolve) => {
          resolveLoad = resolve;
        });
      }
    }

    const service = new TestService();
    const pending = service.getUser("1");
    await loaderStartedPromise;

    await cache.delete(createCacheKey("users:getUser", ["1"]));
    resolveLoad("alice");

    await expect(pending).resolves.toBe("alice");
    expect(await cache.get(createCacheKey("users:getUser", ["1"]))).toBeUndefined();
  });

  it("propagates singleflight load failures to waiters", async () => {
    let rejectLoad!: (reason: unknown) => void;
    let loaderStarted!: () => void;
    const loaderStartedPromise = new Promise<void>((resolve) => {
      loaderStarted = resolve;
    });
    let loads = 0;
    const failure = new Error("load failed");

    class TestService {
      @Cacheable({ store: cache, namespace: "users" })
      async getUser(_id: string): Promise<string> {
        loads++;
        loaderStarted();
        return new Promise<string>((_resolve, reject) => {
          rejectLoad = reject;
        });
      }
    }

    const service = new TestService();
    const owner = service.getUser("1");
    await loaderStartedPromise;

    const waiter = service.getUser("1");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(loads).toBe(1);

    rejectLoad(failure);

    await expect(owner).rejects.toBe(failure);
    await expect(waiter).rejects.toBe(failure);
    expect(loads).toBe(1);
  });

  it("keeps singleflight for concurrent undefined results", async () => {
    let loads = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    class TestService {
      @Cacheable({ store: cache, namespace: "users" })
      async getUser(_id: string): Promise<string | undefined> {
        loads++;
        await gate;
        return undefined;
      }
    }

    const service = new TestService();
    const pending = Promise.all([service.getUser("1"), service.getUser("1")]);
    await Promise.resolve();
    await Promise.resolve();
    release();

    await expect(pending).resolves.toEqual([undefined, undefined]);
    expect(loads).toBe(1);
  });

  it("runs each ttl-0 call independently without coalescing", async () => {
    let loads = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    class TestService {
      @Cacheable({ store: cache, namespace: "users", ttl: 0 })
      async getUser(id: string): Promise<string> {
        loads++;
        const ordinal = loads;
        await gate;
        return `data-${id}-${ordinal}`;
      }
    }

    const service = new TestService();
    const pending = Promise.all([service.getUser("1"), service.getUser("1")]);
    await Promise.resolve();
    await Promise.resolve();
    release();

    const [first, second] = await pending;
    expect(loads).toBe(2);
    expect(first).not.toBe(second);
    expect(await cache.get(createCacheKey("users:getUser", ["1"]))).toBeUndefined();
  });

  it("returns undefined without caching when the method returns undefined", async () => {
    let loads = 0;

    class TestService {
      @Cacheable({ store: cache, namespace: "users" })
      async getUser(_id: string): Promise<string | undefined> {
        loads++;
        return undefined;
      }
    }

    const service = new TestService();

    await expect(service.getUser("1")).resolves.toBeUndefined();
    await expect(service.getUser("1")).resolves.toBeUndefined();
    expect(loads).toBe(2);
  });

  it("throws when neither namespace nor keyPrefix is provided", () => {
    expect(() => {
      class TestService {
        @Cacheable({ store: cache })
        async getData(id: string): Promise<string> {
          return `data-${id}`;
        }
      }

      return TestService;
    }).toThrow(
      '@Cacheable requires "namespace" when "keyPrefix" is not provided (method: getData)',
    );
  });
});

describe("@CacheEvict", () => {
  let cache!: InMemoryCacheStore<string>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });
  });

  it("evicts the cache entry for the method arguments after execution", async () => {
    await cache.set(createCacheKey("test-service:updateData", ["123"]), "cached");
    await cache.set(createCacheKey("test-service:updateData", ["456"]), "cached2");
    await cache.set(createCacheKey("OtherService:getData", ["123"]), "other");

    class TestService {
      @CacheEvict({ store: cache, namespace: "test-service" })
      async updateData(_id: string): Promise<void> {}
    }

    const service = new TestService();
    await service.updateData("123");

    expect(await cache.get(createCacheKey("test-service:updateData", ["123"]))).toBeUndefined();
    expect(await cache.get(createCacheKey("test-service:updateData", ["456"]))).toBe("cached2");
    expect(await cache.get(createCacheKey("OtherService:getData", ["123"]))).toBe("other");
  });

  it("evicts specific key", async () => {
    await cache.set("my-key", "cached");
    await cache.set("other-key", "other");

    class TestService {
      @CacheEvict({ store: cache, key: "my-key" })
      async updateData(): Promise<void> {}
    }

    const service = new TestService();
    await service.updateData();

    expect(await cache.get("my-key")).toBeUndefined();
    expect(await cache.get("other-key")).toBe("other");
  });

  it("evicts by pattern with wildcard", async () => {
    await cache.set("user:123", "data1");
    await cache.set("user:456", "data2");
    await cache.set("order:789", "data3");

    class TestService {
      @CacheEvict({ store: cache, key: "user:*" })
      async clearUserCache(): Promise<void> {}
    }

    const service = new TestService();
    await service.clearUserCache();

    expect(await cache.get("user:123")).toBeUndefined();
    expect(await cache.get("user:456")).toBeUndefined();
    expect(await cache.get("order:789")).toBe("data3");
  });

  it("clears all entries without encoding method arguments", async () => {
    const clearSpy = vi.spyOn(cache, "clear");
    const invalidateSpy = vi.spyOn(cache, "invalidatePattern");
    await cache.set("key1", "value1");
    await cache.set("key2", "value2");

    class TestService {
      @CacheEvict({ store: cache, allEntries: true })
      async clearAll(_unsupported: Date): Promise<void> {}
    }

    const service = new TestService();
    await service.clearAll(new Date("2026-01-01T00:00:00.000Z"));

    expect(await cache.get("key1")).toBeUndefined();
    expect(await cache.get("key2")).toBeUndefined();
    expect(clearSpy).toHaveBeenCalledOnce();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it.each(["users", ""])("evicts all entries only within namespace %j", async (namespace) => {
    await cache.set(`${namespace}:get:1`, "first");
    await cache.set(`${namespace}:list`, "second");
    await cache.set(`${namespace}-archive:1`, "archive");
    await cache.set("sessions:1", "session");
    const clearSpy = vi.spyOn(cache, "clear");

    class TestService {
      @CacheEvict({ store: cache, namespace, allEntries: true })
      async clearNamespace(_unsupported: Date): Promise<string> {
        expect(await cache.get(`${namespace}:get:1`)).toBe("first");
        return "cleared";
      }
    }

    await expect(new TestService().clearNamespace(new Date())).resolves.toBe("cleared");

    expect(await cache.get(`${namespace}:get:1`)).toBeUndefined();
    expect(await cache.get(`${namespace}:list`)).toBeUndefined();
    expect(await cache.get(`${namespace}-archive:1`)).toBe("archive");
    expect(await cache.get("sessions:1")).toBe("session");
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it("propagates namespace invalidation failures without clearing the store", async () => {
    await cache.set("sessions:1", "session");
    const failure = new Error("pattern invalidation failed");
    const invalidateSpy = vi.spyOn(cache, "invalidatePattern").mockRejectedValueOnce(failure);
    const clearSpy = vi.spyOn(cache, "clear");

    class TestService {
      @CacheEvict({ store: cache, namespace: "users", allEntries: true })
      async clearUsers(): Promise<void> {}
    }

    await expect(new TestService().clearUsers()).rejects.toBe(failure);
    expect(invalidateSpy).toHaveBeenCalledWith("users:*");
    expect(clearSpy).not.toHaveBeenCalled();
    expect(await cache.get("sessions:1")).toBe("session");
  });

  it("preserves namespace entries when the decorated method fails", async () => {
    await cache.set("users:1", "user");
    const failure = new Error("update failed");
    const invalidateSpy = vi.spyOn(cache, "invalidatePattern");
    const clearSpy = vi.spyOn(cache, "clear");

    class TestService {
      @CacheEvict({ store: cache, namespace: "users", allEntries: true })
      async clearUsers(): Promise<void> {
        throw failure;
      }
    }

    await expect(new TestService().clearUsers()).rejects.toBe(failure);
    expect(await cache.get("users:1")).toBe("user");
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it("uses namespace for default argument-based eviction keys", async () => {
    await cache.set(createCacheKey("stable-service:updateData", []), "cached");
    await cache.set(createCacheKey("stable-service:updateData", ["456"]), "cached2");

    class TestService {
      @CacheEvict({ store: cache, namespace: "stable-service" })
      async updateData(): Promise<void> {}
    }

    const service = new TestService();
    await service.updateData();

    expect(await cache.get(createCacheKey("stable-service:updateData", []))).toBeUndefined();
    expect(await cache.get(createCacheKey("stable-service:updateData", ["456"]))).toBe("cached2");
  });

  it("throws when namespace, key, and allEntries are all omitted", () => {
    expect(() => {
      class TestService {
        @CacheEvict({ store: cache })
        async updateData(): Promise<void> {}
      }

      return TestService;
    }).toThrow(
      '@CacheEvict requires "namespace" when neither "key" nor "allEntries: true" is provided (method: updateData)',
    );
  });

  it("rejects unsupported argument graphs before executing the method", async () => {
    let methodCalls = 0;

    class TestService {
      @CacheEvict({ store: cache, namespace: "stable-service" })
      async updateData(_unsupported: Date): Promise<void> {
        methodCalls++;
      }
    }

    const service = new TestService();

    await expect(service.updateData(new Date("2026-01-01T00:00:00.000Z"))).rejects.toMatchObject({
      code: "cache-core/cache-key-argument-unsupported",
      path: "arguments[0]",
      reason: "is not a plain object",
    } satisfies Partial<CacheKeyArgumentProblem>);
    expect(methodCalls).toBe(0);
  });

  it("propagates delete errors for argument-based namespace eviction", async () => {
    const unsupportedStore: CacheStore<string> = {
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => undefined,
      has: async () => false,
      clear: async () => undefined,
      invalidatePattern: async () => 0,
      getOrSet: async (_key, loader) => loader(),
      warmup: async () => undefined,
      getStats: () => ({ hits: 0, misses: 0, evictions: 0, size: 0 }),
      pruneExpired: async () => 0,
    };

    const deleteSpy = vi
      .spyOn(unsupportedStore, "delete")
      .mockRejectedValueOnce(new Error("not supported"));

    class TestService {
      @CacheEvict({ store: unsupportedStore, namespace: "stable-service" })
      async updateData(): Promise<void> {}
    }

    const service = new TestService();

    await expect(service.updateData()).rejects.toThrow("not supported");

    deleteSpy.mockRestore();
  });

  it("propagates invalidatePattern errors for wildcard key eviction", async () => {
    const unsupportedStore: CacheStore<string> = {
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => undefined,
      has: async () => false,
      clear: async () => undefined,
      invalidatePattern: async () => 0,
      getOrSet: async (_key, loader) => loader(),
      warmup: async () => undefined,
      getStats: () => ({ hits: 0, misses: 0, evictions: 0, size: 0 }),
      pruneExpired: async () => 0,
    };

    const deleteByPatternSpy = vi
      .spyOn(unsupportedStore, "invalidatePattern")
      .mockRejectedValueOnce(new Error("not supported"));

    class TestService {
      @CacheEvict({ store: unsupportedStore, key: "user:*" })
      async clearUserCache(): Promise<void> {}
    }

    const service = new TestService();

    await expect(service.clearUserCache()).rejects.toThrow("not supported");

    deleteByPatternSpy.mockRestore();
  });

  it("executes method before evicting", async () => {
    let methodCalled = false;

    class TestService {
      @CacheEvict({ store: cache, key: "test-key" })
      async updateData(): Promise<string> {
        methodCalled = true;
        return "result";
      }
    }

    await cache.set("test-key", "cached");

    const service = new TestService();
    const result = await service.updateData();

    expect(methodCalled).toBe(true);
    expect(result).toBe("result");
    expect(await cache.get("test-key")).toBeUndefined();
  });
});

describe("@Cacheable with @CacheEvict integration", () => {
  let cache!: InMemoryCacheStore<string>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });
  });

  it("evicts cache and refetches on next call", async () => {
    let fetchCount = 0;

    class UserService {
      @Cacheable({ store: cache, namespace: "user-service" })
      async getUser(id: string): Promise<string> {
        fetchCount++;
        return `user-${id}`;
      }

      @CacheEvict({ store: cache, key: "user-service:getUser:*" })
      async updateUser(_id: string): Promise<void> {}
    }

    const service = new UserService();

    await service.getUser("123");
    expect(fetchCount).toBe(1);

    await service.getUser("123");
    expect(fetchCount).toBe(1);

    await service.updateUser("123");

    await service.getUser("123");
    expect(fetchCount).toBe(2);
  });

  it("derives the same key for population and argument-based eviction", async () => {
    let fetchCount = 0;

    class CachedService {
      @Cacheable({ store: cache, namespace: "shared-service" })
      async getData(input: object): Promise<string> {
        fetchCount++;
        return `result-${fetchCount}-${JSON.stringify(input)}`;
      }
    }

    class EvictingService {
      @CacheEvict({ store: cache, namespace: "shared-service" })
      async getData(_input: object): Promise<void> {}
    }

    const cached = new CachedService();
    const evicting = new EvictingService();

    await cached.getData({ first: 1, second: 2 });
    await cached.getData({ second: 2, first: 1 });
    expect(fetchCount).toBe(1);

    await evicting.getData({ second: 2, first: 1 });
    await cached.getData({ first: 1, second: 2 });

    expect(fetchCount).toBe(2);
  });
});

describe("tenant-scoped cache decorators", () => {
  let cache!: InMemoryCacheStore<string>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });
  });

  const forTenant = <T>(tenantId: string, operation: () => Promise<T>): Promise<T> =>
    Promise.resolve(Context.run({ requestId: `request-${tenantId}`, tenantId }, operation));

  it("keeps cached results separate when methods read the tenant from context", async () => {
    let loads = 0;

    class SettingsService {
      @Cacheable({ store: cache, namespace: "settings" })
      async getCurrentSettings(): Promise<string> {
        loads++;
        return `${Context.getTenantId()}-settings`;
      }
    }

    const service = new SettingsService();

    expect(await forTenant("tenant-a", () => service.getCurrentSettings())).toBe(
      "tenant-a-settings",
    );
    expect(await forTenant("tenant-b", () => service.getCurrentSettings())).toBe(
      "tenant-b-settings",
    );
    expect(await forTenant("tenant-a", () => service.getCurrentSettings())).toBe(
      "tenant-a-settings",
    );
    expect(await forTenant("tenant-b", () => service.getCurrentSettings())).toBe(
      "tenant-b-settings",
    );
    expect(loads).toBe(2);
  });

  it("does not combine in-flight loads from different tenants", async () => {
    const resolveByTenant = new Map<string, (value: string) => void>();

    class SettingsService {
      @Cacheable({ store: cache, namespace: "settings" })
      async getCurrentSettings(): Promise<string> {
        const tenantId = Context.getTenantId();
        if (tenantId === null) throw new Error("tenant context is required");
        return new Promise<string>((resolve) => resolveByTenant.set(tenantId, resolve));
      }
    }

    const service = new SettingsService();
    const tenantA = forTenant("tenant-a", () => service.getCurrentSettings());
    const tenantB = forTenant("tenant-b", () => service.getCurrentSettings());

    await Promise.resolve();
    const startedTenants = [...resolveByTenant.keys()].sort();

    resolveByTenant.get("tenant-a")?.("tenant-a-settings");
    resolveByTenant.get("tenant-b")?.("tenant-b-settings");
    await expect(Promise.all([tenantA, tenantB])).resolves.toEqual([
      "tenant-a-settings",
      "tenant-b-settings",
    ]);
    expect(startedTenants).toEqual(["tenant-a", "tenant-b"]);
  });

  it("evicts only the current tenant with the default argument-based key", async () => {
    const loadsByTenant = new Map<string, number>();

    class SettingsService {
      @Cacheable({ store: cache, namespace: "settings" })
      async getCurrentSettings(): Promise<string> {
        const tenantId = Context.getTenantId();
        if (tenantId === null) throw new Error("tenant context is required");
        const loads = (loadsByTenant.get(tenantId) ?? 0) + 1;
        loadsByTenant.set(tenantId, loads);
        return `${tenantId}-${loads}`;
      }
    }

    class SettingsEvictionService {
      @CacheEvict({ store: cache, namespace: "settings" })
      async getCurrentSettings(): Promise<void> {}
    }

    const settings = new SettingsService();
    const eviction = new SettingsEvictionService();

    expect(await forTenant("tenant-a", () => settings.getCurrentSettings())).toBe("tenant-a-1");
    expect(await forTenant("tenant-b", () => settings.getCurrentSettings())).toBe("tenant-b-1");
    await forTenant("tenant-a", () => eviction.getCurrentSettings());
    expect(await forTenant("tenant-a", () => settings.getCurrentSettings())).toBe("tenant-a-2");
    expect(await forTenant("tenant-b", () => settings.getCurrentSettings())).toBe("tenant-b-1");
    expect(loadsByTenant.get("tenant-b")).toBe(1);
  });

  it("shares an explicit global cache across tenant and context-free calls", async () => {
    let loads = 0;

    class SettingsService {
      @Cacheable({ store: cache, namespace: "settings", scope: "global" })
      async getSharedSettings(): Promise<string> {
        loads++;
        return `shared-${loads}`;
      }
    }

    const service = new SettingsService();

    expect(await forTenant("tenant-a", () => service.getSharedSettings())).toBe("shared-1");
    expect(await forTenant("tenant-b", () => service.getSharedSettings())).toBe("shared-1");
    expect(await service.getSharedSettings()).toBe("shared-1");
    expect(await cache.get(createCacheKey("settings:getSharedSettings", []))).toBe("shared-1");
    expect(loads).toBe(1);
  });

  it("uses the global key segment without context and for explicit global scope", async () => {
    const contextFreeKey = createCacheKey("settings:getSharedSettings", []);
    const explicitGlobalKey = await forTenant("tenant:a", async () =>
      createCacheKey("settings:getSharedSettings", [], "global"),
    );

    expect(explicitGlobalKey).toBe(contextFreeKey);
    expect(contextFreeKey).toContain('["global"]');
  });

  it("uses the same global key for population and argument-based eviction", async () => {
    let loads = 0;

    class SettingsService {
      @Cacheable({ store: cache, namespace: "settings", scope: "global" })
      async getSharedSettings(): Promise<string> {
        loads++;
        return `shared-${loads}`;
      }
    }

    class SettingsEvictionService {
      @CacheEvict({ store: cache, namespace: "settings", scope: "global" })
      async getSharedSettings(): Promise<void> {}
    }

    const settings = new SettingsService();
    const eviction = new SettingsEvictionService();

    expect(await forTenant("tenant-a", () => settings.getSharedSettings())).toBe("shared-1");
    await forTenant("tenant-b", () => eviction.getSharedSettings());
    expect(await settings.getSharedSettings()).toBe("shared-2");
  });

  it("keeps tenant IDs with separators distinct in encoded key segments", async () => {
    const tenantWithSeparator = await forTenant("a:b", async () =>
      createCacheKey("settings:get", []),
    );
    const otherTenant = await forTenant("a", async () => createCacheKey("settings:get", []));

    expect(tenantWithSeparator).not.toBe(otherTenant);
    expect(tenantWithSeparator).toContain('["string","a:b"]');
  });

  it("rejects an unsupported cache scope instead of sharing tenant values globally", async () => {
    let loads = 0;

    class SettingsService {
      @Cacheable({ store: cache, namespace: "settings", scope: "invalid" as "tenant" })
      async getCurrentSettings(): Promise<string> {
        loads++;
        return "settings";
      }
    }

    await expect(
      forTenant("tenant-a", () => new SettingsService().getCurrentSettings()),
    ).rejects.toMatchObject({
      code: "cache-core/invalid-decorator-config",
    });
    expect(loads).toBe(0);
  });

  it("applies an explicit wildcard key across tenant segments", async () => {
    let loads = 0;

    class SettingsService {
      @Cacheable({ store: cache, namespace: "settings" })
      async getCurrentSettings(): Promise<string> {
        loads++;
        return `${Context.getTenantId()}-${loads}`;
      }

      @CacheEvict({ store: cache, key: "settings:getCurrentSettings:*" })
      async clearSettings(): Promise<void> {}
    }

    const service = new SettingsService();

    expect(await forTenant("tenant-a", () => service.getCurrentSettings())).toBe("tenant-a-1");
    expect(await forTenant("tenant-b", () => service.getCurrentSettings())).toBe("tenant-b-2");
    await forTenant("tenant-a", () => service.clearSettings());
    expect(await forTenant("tenant-a", () => service.getCurrentSettings())).toBe("tenant-a-3");
    expect(await forTenant("tenant-b", () => service.getCurrentSettings())).toBe("tenant-b-4");
  });
});
