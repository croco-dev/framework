import {
  createPersonalizedCacheKey,
  definePersonalizedCachePolicy,
  InMemoryCacheStore,
  invalidatePersonalizedFragment,
} from "@croco/cache-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPersonalizedFragments } from "../libs/isr/personalizedFragments";
import type {
  PersonalizedFragmentInspectEvent,
  PersonalizedFragmentStore,
} from "../libs/isr/personalizedFragments";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture(
  mode: "background" | "foreground",
  withRefresh = true,
  preserveInvalidatedValue = true,
) {
  const cache = new InMemoryCacheStore<unknown>();
  const refreshes: Promise<unknown>[] = [];
  const events: PersonalizedFragmentInspectEvent[] = [];
  const store: PersonalizedFragmentStore = {
    async getOrSet<V>(key: string, factory: () => Promise<V>, options?: { ttlMs?: number }) {
      return (await cache.getOrSet(key, factory, options)) as V;
    },
    invalidate: (key) => cache.delete(key),
    async get<V>(key: string) {
      return (await cache.get(key)) as V | undefined;
    },
    ...(withRefresh
      ? {
          async refresh<V>(key: string, factory: () => Promise<V>, options?: { ttlMs?: number }) {
            const pending = cache.refresh(key, factory, {
              ...options,
              preserveInvalidatedValue,
            });
            refreshes.push(pending);
            return (await pending) as V | undefined;
          },
        }
      : {}),
  };
  const policy = definePersonalizedCachePolicy({
    scope: {
      app: "shop",
      env: "test",
      tenant: "acme",
      site: "kr",
      locale: "ko",
      resource: "pdp:42",
    },
    revision: "r1",
    freshness: {
      ttlMs: 100,
      staleWhileRevalidateMs: mode === "background" ? 1000 : 0,
      staleIfErrorMs: 5000,
    },
    zones: [{ zone: "public" }],
  });
  let now = 0;
  const key = createPersonalizedCacheKey(policy, "public");
  const run = (
    load: () => Promise<string>,
    options: {
      signal?: AbortSignal;
      domain?: string;
      inspect?: (event: PersonalizedFragmentInspectEvent) => void;
    } = {},
  ) =>
    loadPersonalizedFragments({
      store,
      policy,
      now: () => now,
      signal: options.signal,
      inspect: (event) => {
        events.push(event);
        options.inspect?.(event);
      },
      publicLoader: {
        zone: "public",
        domain: options.domain,
        load: async () => {
          const value = await load();
          return { value, bytes: JSON.stringify(value) };
        },
      },
      privateLoader: { zone: "private", load: async () => "private" },
    });
  return {
    cache,
    store,
    key,
    policy,
    run,
    refreshes,
    events,
    advance: () => {
      now = 200;
      vi.setSystemTime(now);
    },
  };
}

describe("Personalized fragment revalidation", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it.each(["background", "foreground"] as const)(
    "does not restore an invalidated %s fill",
    async (mode) => {
      const f = fixture(mode);
      await f.run(async () => "initial");
      f.advance();
      const started = deferred<void>();
      const result = deferred<string>();
      const pending = f.run(() => {
        started.resolve();
        return result.promise;
      });
      await started.promise;
      if (mode === "background") expect((await pending).public).toBe("initial");
      await invalidatePersonalizedFragment(f.cache, f.policy, "public");
      expect(await f.cache.get(f.key)).toBeUndefined();
      result.resolve("old-snapshot");
      await pending;
      await Promise.all(f.refreshes);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(await f.cache.get(f.key)).toBeUndefined();
    },
  );

  it.each(["background", "foreground"] as const)(
    "keeps a newer fill when an invalidated %s loader finishes last",
    async (mode) => {
      const f = fixture(mode);
      await f.run(async () => "initial");
      f.advance();
      const started = deferred<void>();
      const result = deferred<string>();
      const pending = f.run(() => {
        started.resolve();
        return result.promise;
      });
      await started.promise;
      if (mode === "background") await pending;
      await f.store.invalidate(f.key);
      expect((await f.run(async () => "new-snapshot")).public).toBe("new-snapshot");
      result.resolve("old-snapshot");
      await pending;
      await Promise.all(f.refreshes);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect((await f.run(async () => "unexpected-load")).public).toBe("new-snapshot");
    },
  );

  it("coalesces background refreshes while retaining stale reads, then publishes the fresh value", async () => {
    const f = fixture("background");
    await f.run(async () => "initial");
    f.advance();
    const started = deferred<void>();
    const result = deferred<string>();
    const loader = vi.fn(() => {
      started.resolve();
      return result.promise;
    });
    const first = f.run(loader);
    await started.promise;
    expect((await first).public).toBe("initial");
    expect((await f.run(loader)).public).toBe("initial");
    expect(loader).toHaveBeenCalledTimes(1);
    result.resolve("updated");
    await Promise.all(f.refreshes);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect((await f.run(async () => "unexpected-load")).public).toBe("updated");
  });

  it("publishes a normal foreground refresh for subsequent cache hits", async () => {
    const f = fixture("foreground");
    await f.run(async () => "initial");
    f.advance();
    expect((await f.run(async () => "updated")).public).toBe("updated");
    expect((await f.run(async () => "unexpected-load")).public).toBe("updated");
  });

  it("preserves bounded stale-if-error recovery after a refresh fails", async () => {
    const f = fixture("foreground");
    await f.run(async () => "initial");
    f.advance();
    expect(
      (
        await f.run(async () => {
          throw new Error("source unavailable");
        })
      ).public,
    ).toBe("initial");
    expect(await f.cache.get(f.key)).toMatchObject({ bytes: JSON.stringify("initial") });
  });

  it.each(["background", "foreground"] as const)(
    "keeps legacy-store %s refreshes request-local",
    async (mode) => {
      const f = fixture(mode, false);
      await f.run(async () => "initial");
      f.advance();
      const started = deferred<void>();
      const result = deferred<string>();
      const pending = f.run(() => {
        started.resolve();
        return result.promise;
      });
      await started.promise;
      if (mode === "background") expect((await pending).public).toBe("initial");
      await f.store.invalidate(f.key);
      result.resolve("request-local");
      if (mode === "foreground") expect((await pending).public).toBe("request-local");
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(await f.cache.get(f.key)).toBeUndefined();
    },
  );

  it("keeps a live foreground waiter independent of the refresh owner cancellation", async () => {
    const f = fixture("foreground");
    await f.run(async () => "initial-price", { domain: "price" });
    f.advance();
    const started = deferred<void>();
    const loaded = deferred<string>();
    const controller = new AbortController();
    const owner = f.run(
      () => {
        started.resolve();
        return loaded.promise;
      },
      { domain: "price", signal: controller.signal },
    );
    await started.promise;
    const peerLoader = vi.fn(async () => "peer-price");
    const peer = f.run(peerLoader, { domain: "price", signal: new AbortController().signal });
    const observedPeer = peer.then(
      (value) => value,
      (error) => ({ error }),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.refreshes).toHaveLength(2);
    expect(peerLoader).not.toHaveBeenCalled();
    controller.abort(new Error("owner disconnected"));
    loaded.resolve("owner-price");
    await expect(owner).rejects.toThrow("owner disconnected");
    expect(await observedPeer).toMatchObject({ public: "peer-price" });
    expect(peerLoader).toHaveBeenCalledTimes(1);
    expect(f.events).toContainEqual(
      expect.objectContaining({
        zone: "public",
        outcome: "miss",
        reason: "refresh-request-local",
      }),
    );
    // The independent retry never publishes through a new invalidation boundary.
    expect(await f.cache.get(f.key)).toMatchObject({ bytes: JSON.stringify("initial-price") });
  });

  it("runs a suppressed waiter local loader only once and preserves its source failure", async () => {
    const f = fixture("foreground", true, false);
    await f.run(async () => "initial-price", { domain: "price" });
    f.advance();
    const started = deferred<void>();
    const loaded = deferred<string>();
    const owner = f.run(
      () => {
        started.resolve();
        return loaded.promise;
      },
      { domain: "price" },
    );
    await started.promise;
    let calls = 0;
    const peerLoader = vi.fn(async () => {
      if (++calls === 1) throw new Error("peer source failed");
      return "unexpected second result";
    });
    const peer = f.run(peerLoader, { domain: "price" });
    const observedPeer = peer.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.refreshes).toHaveLength(2);
    expect(peerLoader).not.toHaveBeenCalled();
    await f.cache.delete(f.key);
    loaded.resolve("owner-price");
    expect((await owner).public).toBe("owner-price");
    expect(await observedPeer).toHaveProperty("error.message", "peer source failed");
    expect(peerLoader).toHaveBeenCalledTimes(1);
    expect(await f.cache.get(f.key)).toBeUndefined();
  });

  it("returns a loaded foreground value when adapter persistence fails", async () => {
    const f = fixture("foreground");
    await f.run(async () => "initial");
    f.advance();
    f.store.refresh = async <V>(_key: string, factory: () => Promise<V>) => {
      await factory();
      throw new Error("cache persistence failed");
    };
    expect((await f.run(async () => "updated")).public).toBe("updated");
    expect(await f.cache.get(f.key)).toMatchObject({ bytes: JSON.stringify("initial") });
  });
  it("does not turn an inspect failure into a stale business success", async () => {
    const f = fixture("foreground");
    await f.run(async () => "initial");
    f.advance();
    f.store.refresh = async <V>(_key: string, factory: () => Promise<V>) => {
      await factory();
      throw new Error("cache persistence failed");
    };
    await expect(
      f.run(async () => "updated", {
        inspect: (event) => {
          if (event.reason === "cache-write-failed") throw new Error("observer failed");
        },
      }),
    ).rejects.toThrow("observer failed");
  });
});
