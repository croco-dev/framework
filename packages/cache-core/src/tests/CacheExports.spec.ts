import { describe, expect, it } from "vitest";
import {
  Cache,
  CacheStore,
  DistributedCacheStore,
  InMemoryCacheStore,
  type CacheGetOrSetOptions,
  type CachePattern,
  type CacheStats,
  type CacheWarmupEntry,
  type DistributedCacheLock,
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
    const distributedLock: DistributedCacheLock | undefined = undefined;

    expect(cache).toBeInstanceOf(Cache);
    expect(DistributedCacheStore.prototype).toBeInstanceOf(CacheStore);
    expect(new InMemoryCacheStore<string>()).toBeInstanceOf(CacheStore);
    expect(distributedLock).toBeUndefined();
  });
});
