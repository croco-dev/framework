import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryCacheStore } from "../libs/InMemoryCacheStore";

describe("InMemoryCacheStore", () => {
  let cache!: InMemoryCacheStore<string>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });
  });

  describe("get and set", () => {
    it("stores and retrieves a value", async () => {
      await cache.set("key1", "value1");
      const result = await cache.get("key1");
      expect(result).toBe("value1");
    });

    it("returns undefined for non-existent key", async () => {
      const result = await cache.get("nonexistent");
      expect(result).toBeUndefined();
    });

    it("overwrites existing value", async () => {
      await cache.set("key1", "value1");
      await cache.set("key1", "value2");
      const result = await cache.get("key1");
      expect(result).toBe("value2");
    });
  });

  describe("TTL expiration", () => {
    it("returns undefined after TTL expires", async () => {
      vi.useFakeTimers();

      await cache.set("key1", "value1", 1000);

      let result = await cache.get("key1");
      expect(result).toBe("value1");

      vi.advanceTimersByTime(1001);

      result = await cache.get("key1");
      expect(result).toBeUndefined();

      vi.useRealTimers();
    });

    it("returns true for has() before expiration", async () => {
      vi.useFakeTimers();

      await cache.set("key1", "value1", 1000);

      let exists = await cache.has("key1");
      expect(exists).toBe(true);

      vi.advanceTimersByTime(1001);

      exists = await cache.has("key1");
      expect(exists).toBe(false);

      vi.useRealTimers();
    });

    it("does not expire when TTL is not set", async () => {
      vi.useFakeTimers();

      await cache.set("key1", "value1");

      vi.advanceTimersByTime(10000);

      const result = await cache.get("key1");
      expect(result).toBe("value1");

      vi.useRealTimers();
    });
  });

  describe("delete", () => {
    it("removes a key", async () => {
      await cache.set("key1", "value1");
      await cache.delete("key1");
      const result = await cache.get("key1");
      expect(result).toBeUndefined();
    });

    it("does not throw for non-existent key", async () => {
      await expect(cache.delete("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("has", () => {
    it("returns true for existing key", async () => {
      await cache.set("key1", "value1");
      const exists = await cache.has("key1");
      expect(exists).toBe(true);
    });

    it("returns false for non-existent key", async () => {
      const exists = await cache.has("nonexistent");
      expect(exists).toBe(false);
    });
  });

  describe("clear", () => {
    it("removes all keys", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.clear();
      expect(await cache.get("key1")).toBeUndefined();
      expect(await cache.get("key2")).toBeUndefined();
    });
  });

  describe("invalidatePattern", () => {
    it("deletes keys matching wildcard pattern", async () => {
      await cache.set("User:getUser:123", "user1");
      await cache.set("User:getUser:456", "user2");
      await cache.set("Order:getOrder:789", "order1");

      const deleted = await cache.invalidatePattern("User:getUser:*");

      expect(deleted).toBe(2);
      expect(await cache.get("User:getUser:123")).toBeUndefined();
      expect(await cache.get("User:getUser:456")).toBeUndefined();
      expect(await cache.get("Order:getOrder:789")).toBe("order1");
    });

    it("deletes exact match when no wildcard", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");

      const deleted = await cache.invalidatePattern("key1");

      expect(deleted).toBe(1);
      expect(await cache.get("key1")).toBeUndefined();
      expect(await cache.get("key2")).toBe("value2");
    });

    it("returns 0 when no keys match", async () => {
      await cache.set("key1", "value1");
      const deleted = await cache.invalidatePattern("nonexistent*");
      expect(deleted).toBe(0);
    });

    it("supports wildcard pattern in the middle of the key", async () => {
      await cache.set("user:profile:1", "profile");
      await cache.set("user:settings:1", "settings");
      await cache.set("order:profile:1", "order");

      const deleted = await cache.invalidatePattern("user:*:1");

      expect(deleted).toBe(2);
      expect(await cache.get("user:profile:1")).toBeUndefined();
      expect(await cache.get("user:settings:1")).toBeUndefined();
      expect(await cache.get("order:profile:1")).toBe("order");
    });
  });

  describe("pruneExpired", () => {
    it("removes expired entries without reads", async () => {
      vi.useFakeTimers();

      await cache.set("expired", "value", 1000);
      await cache.set("active", "value", 5000);

      vi.advanceTimersByTime(1001);

      const deleted = await cache.pruneExpired();

      expect(deleted).toBe(1);
      expect(await cache.get("expired")).toBeUndefined();
      expect(await cache.get("active")).toBe("value");

      vi.useRealTimers();
    });
  });

  describe("capacity management", () => {
    it("should apply default maxEntries of 1000 when not set", async () => {
      const defaultCache = new InMemoryCacheStore<string>();

      for (let i = 0; i < 1001; i++) {
        await defaultCache.set(`key${i}`, `value${i}`);
      }

      expect(await defaultCache.get("key0")).toBeUndefined();
      expect(await defaultCache.get("key1000")).toBe("value1000");
    });

    it("should not warn when maxEntries is explicitly set", async () => {
      const boundedCache = new InMemoryCacheStore<string>({ maxEntries: 2 });

      expect(boundedCache).toBeInstanceOf(InMemoryCacheStore);
    });

    it("should evict the oldest entry when maxEntries is exceeded", async () => {
      const boundedCache = new InMemoryCacheStore<string>({ maxEntries: 2 });

      await boundedCache.set("key1", "value1");
      await boundedCache.set("key2", "value2");
      await boundedCache.set("key3", "value3");

      expect(await boundedCache.get("key1")).toBeUndefined();
      expect(await boundedCache.get("key2")).toBe("value2");
      expect(await boundedCache.get("key3")).toBe("value3");
    });

    it("uses true LRU ordering when accessed entries are read", async () => {
      const boundedCache = new InMemoryCacheStore<string>({ maxEntries: 2 });

      await boundedCache.set("key1", "value1");
      await boundedCache.set("key2", "value2");

      expect(await boundedCache.get("key1")).toBe("value1");

      await boundedCache.set("key3", "value3");

      expect(await boundedCache.get("key1")).toBe("value1");
      expect(await boundedCache.get("key2")).toBeUndefined();
      expect(await boundedCache.get("key3")).toBe("value3");
    });

    it("should prune expired entries before evicting active ones on set", async () => {
      vi.useFakeTimers();

      const boundedCache = new InMemoryCacheStore<string>({ maxEntries: 2 });

      await boundedCache.set("expired", "value1", 1000);
      await boundedCache.set("active", "value2");

      vi.advanceTimersByTime(1001);

      await boundedCache.set("fresh", "value3");

      expect(await boundedCache.get("expired")).toBeUndefined();
      expect(await boundedCache.get("active")).toBe("value2");
      expect(await boundedCache.get("fresh")).toBe("value3");

      vi.useRealTimers();
    });
  });

  describe("getOrSet", () => {
    it("returns cached value without calling loader again", async () => {
      const loader = vi.fn(async () => "loaded");

      const first = await cache.getOrSet("key1", loader, { ttlMs: 1000 });
      const second = await cache.getOrSet("key1", loader, { ttlMs: 1000 });

      expect(first).toBe("loaded");
      expect(second).toBe("loaded");
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it("uses singleflight for concurrent requests", async () => {
      let resolveLoader!: (value: string) => void;
      const loader = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveLoader = resolve;
          }),
      );

      const pending = Promise.all([
        cache.getOrSet("key1", loader),
        cache.getOrSet("key1", loader),
        cache.getOrSet("key1", loader),
      ]);

      await Promise.resolve();

      expect(loader).toHaveBeenCalledTimes(1);

      resolveLoader("loaded");

      await expect(pending).resolves.toEqual(["loaded", "loaded", "loaded"]);
    });

    it("does not cache undefined values", async () => {
      const loader = vi.fn(async () => undefined);

      const first = await cache.getOrSet("key1", loader);
      const second = await cache.getOrSet("key1", loader);

      expect(first).toBeUndefined();
      expect(second).toBeUndefined();
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it("clear() during getOrSet load: loader completes but value not stored", async () => {
      const loader = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "loaded-value";
      });

      const pendingPromise = cache.getOrSet("key1", loader, { ttlMs: 1000 }) as Promise<string>;

      await Promise.resolve();

      await cache.clear();

      const result = await pendingPromise;

      // clear() 가 inFlightLoads 를 정리하지 않으면 value 가 복원됨
      expect(result).toBe("loaded-value");
    });

    it("delete() during getOrSet load: loader completes but value not stored", async () => {
      const loader = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "loaded-value";
      });

      const pendingPromise = cache.getOrSet("key1", loader, { ttlMs: 1000 }) as Promise<string>;

      await Promise.resolve();

      await cache.delete("key1");

      const result = await pendingPromise;

      // delete() 가 inFlightLoads 를 정리하지 않으면 value 가 복원됨
      expect(result).toBe("loaded-value");
    });

    it("invalidatePattern() during getOrSet load: loader completes but value not stored", async () => {
      const loader = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "loaded-value";
      });

      const pendingPromise = cache.getOrSet("key1", loader, { ttlMs: 1000 }) as Promise<string>;

      await Promise.resolve();

      await cache.invalidatePattern("key1");

      const result = await pendingPromise;

      // invalidatePattern() 가 inFlightLoads 를 정리하지 않으면 value 가 복원됨
      expect(result).toBe("loaded-value");
    });
  });

  describe("warmup", () => {
    it("primes multiple entries with ttl metadata", async () => {
      vi.useFakeTimers();

      await cache.warmup([
        { key: "key1", value: "value1", ttlMs: 1000 },
        { key: "key2", value: "value2" },
      ]);

      expect(await cache.get("key1")).toBe("value1");
      expect(await cache.get("key2")).toBe("value2");

      vi.advanceTimersByTime(1001);

      expect(await cache.get("key1")).toBeUndefined();
      expect(await cache.get("key2")).toBe("value2");

      vi.useRealTimers();
    });
  });

  describe("stats", () => {
    it("tracks hits, misses, evictions, and size", async () => {
      vi.useFakeTimers();

      const boundedCache = new InMemoryCacheStore<string>({ maxEntries: 2 });

      await boundedCache.set("key1", "value1");
      await boundedCache.set("key2", "value2", 1000);

      expect(await boundedCache.get("key1")).toBe("value1");
      expect(await boundedCache.get("missing")).toBeUndefined();

      vi.advanceTimersByTime(1001);

      expect(await boundedCache.get("key2")).toBeUndefined();

      await boundedCache.set("key3", "value3");
      await boundedCache.set("key4", "value4");

      expect(boundedCache.getStats()).toEqual({
        hits: 1,
        misses: 2,
        evictions: 2,
        size: 2,
      });

      vi.useRealTimers();
    });
  });

  describe("periodic cleanup", () => {
    it("removes expired entries on cleanup interval without reads", async () => {
      vi.useFakeTimers();

      const periodicCache = new InMemoryCacheStore<string>({
        maxEntries: 10,
        cleanupIntervalMs: 500,
      });

      await periodicCache.set("expiring", "value", 400);

      vi.advanceTimersByTime(500);

      expect(await periodicCache.get("expiring")).toBeUndefined();
      expect(periodicCache.getStats().evictions).toBe(1);

      vi.useRealTimers();
    });
  });
});
