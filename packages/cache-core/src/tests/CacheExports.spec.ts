import { describe, expect, it } from "vitest";
import {
  assertCacheInvalidatesForEvent,
  assertCacheInvalidationGraphValid,
  Cache,
  CacheKeyArgumentProblem,
  CacheStore,
  createCacheAdapterCapabilityManifest,
  createCacheInvalidationManifest,
  createCacheStoreInvalidationAdapter,
  defineCacheInvalidationEvent,
  defineCacheInvalidationGraph,
  defineCacheInvalidationRule,
  defineCacheKey,
  defineCacheTag,
  DistributedCacheStore,
  invalidateCacheForEvent,
  invalidateCacheKey,
  invalidateCacheTag,
  InMemoryCacheStore,
  InvalidCacheConfigurationProblem,
  InvalidCacheTtlProblem,
  MAX_CACHE_ENTRIES,
  MAX_CACHE_TIMER_DELAY_MS,
  serializeCacheInvalidationManifest,
} from "../index";
import type {
  CacheGetOrSetOptions,
  CacheInvalidationAdapter,
  CacheInvalidationManifest,
  CacheNumericOption,
  CachePattern,
  CacheStats,
  CacheWarmupEntry,
  DistributedCacheLock,
} from "../index";

class RootCache extends Cache<string, string> {
  async get(_key: string): Promise<string | undefined> {
    return undefined;
  }

  async set(_key: string, _value: string, _ttlMs?: number): Promise<void> {}

  async delete(_key: string): Promise<void> {}

  async has(_key: string): Promise<boolean> {
    return false;
  }

  async clear(): Promise<void> {}

  async invalidatePattern(_pattern: CachePattern): Promise<number> {
    return 0;
  }

  async pruneExpired(): Promise<number> {
    return 0;
  }

  async getOrSet(
    key: string,
    loader: () => Promise<string | undefined>,
    _options?: CacheGetOrSetOptions,
  ): Promise<string | undefined> {
    const value = await this.get(key);

    if (value !== undefined) {
      return value;
    }

    const loaded = await loader();

    if (loaded !== undefined) {
      await this.set(key, loaded);
    }

    return loaded;
  }

  async warmup(entries: ReadonlyArray<CacheWarmupEntry<string, string>>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttlMs);
    }
  }

  getStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
    };
  }
}

describe("cache-core public exports", () => {
  it("exports README-documented cache contracts from the package root", async () => {
    const cache = new RootCache();
    const numericOption: CacheNumericOption = "maxEntries";
    const distributedLock: DistributedCacheLock | undefined = undefined;

    expect(cache).toBeInstanceOf(Cache);
    expect(DistributedCacheStore.prototype).toBeInstanceOf(CacheStore);
    expect(new InMemoryCacheStore<string>()).toBeInstanceOf(CacheStore);
    expect(new InvalidCacheConfigurationProblem("maxEntries", 0).code).toBe(
      "cache-core/invalid-configuration",
    );
    expect(new InvalidCacheTtlProblem(-1).code).toBe("cache-core/invalid-ttl");
    expect(MAX_CACHE_ENTRIES).toBe(Number.MAX_SAFE_INTEGER);
    expect(MAX_CACHE_TIMER_DELAY_MS).toBe(2_147_483_647);
    expect(numericOption).toBe("maxEntries");
    expect(distributedLock).toBeUndefined();
  });

  it("exports the complete CacheKeyArgumentProblem contract", () => {
    const problem = new CacheKeyArgumentProblem("arguments[0]", "is unsupported");

    expect(problem.code).toBe("cache-core/cache-key-argument-unsupported");
    expect(problem.detail).toBe("Cache key argument at 'arguments[0]' is unsupported.");
    expect(problem.path).toBe("arguments[0]");
    expect(problem.reason).toBe("is unsupported");
    expect(problem.extensions).toEqual({ path: "arguments[0]", reason: "is unsupported" });
    expect(problem.toJSON()).toMatchObject({
      code: "cache-core/cache-key-argument-unsupported",
      detail: "Cache key argument at 'arguments[0]' is unsupported.",
      path: "arguments[0]",
      reason: "is unsupported",
    });
  });

  it("exports cache invalidation graph contracts from the package root", () => {
    const cache = new InMemoryCacheStore<string>();
    const adapter: CacheInvalidationAdapter = createCacheStoreInvalidationAdapter(cache);
    const manifest: CacheInvalidationManifest = assertCacheInvalidationGraphValid(
      createCacheInvalidationManifest(
        defineCacheInvalidationGraph({
          events: [defineCacheInvalidationEvent({ eventName: "user.updated" })],
          keys: [defineCacheKey({ id: "users", pattern: "user:*" })],
          rules: [
            defineCacheInvalidationRule({
              eventName: "user.updated",
              invalidates: [invalidateCacheKey("users")],
            }),
          ],
          tags: [defineCacheTag({ id: "tenant-users", tag: "tenant:users" })],
        }),
      ),
    );

    expect(adapter.capabilities.pattern).toBe(true);
    expect(createCacheAdapterCapabilityManifest(adapter).schemaVersion).toBe(
      "croco.cache-adapter-capabilities.v1",
    );
    expect(serializeCacheInvalidationManifest(manifest)).toContain(
      "croco.cache-invalidation-graph.manifest.v1",
    );
    expect(() =>
      assertCacheInvalidatesForEvent({
        eventName: "user.updated",
        expectedInvalidations: [{ id: "users", kind: "pattern", pattern: "user:*" }],
        manifest,
      }),
    ).not.toThrow();
    expect(typeof invalidateCacheForEvent).toBe("function");
    expect(invalidateCacheTag("tenant-users")).toEqual({ id: "tenant-users", kind: "tag" });
  });
});
