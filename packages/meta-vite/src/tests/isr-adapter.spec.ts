import { beforeEach, describe, expect, it } from "vitest";
import { AbstractCacheStoreAdapter } from "../libs/isr/adapters/abstractAdapter";

describe("AbstractCacheStoreAdapter", () => {
  const store = new Map<string, { value: Response; expiresAt?: number }>();

  class TestAdapter extends AbstractCacheStoreAdapter {
    async _get(key: string): Promise<Response | undefined> {
      const entry = store.get(key);
      if (!entry) {
        return undefined;
      }
      if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    }

    async _set(key: string, value: Response, ttlMs?: number): Promise<void> {
      store.set(key, {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      });
    }

    async _delete(key: string): Promise<void> {
      store.delete(key);
    }
  }

  beforeEach(() => {
    store.clear();
  });

  it("returns cached response on hit", async () => {
    const adapter = new TestAdapter();
    const cached = new Response("cached");
    await adapter._set("/test", cached);

    const fetcher = async () => new Response("fresh");
    const result = await adapter.getOrSet("/test", fetcher);

    expect(await result.text()).toBe("cached");
  });

  it("calls fetcher and caches on miss", async () => {
    const adapter = new TestAdapter();
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      return new Response(`fetched-${fetchCount}`);
    };

    const result = await adapter.getOrSet("/test", fetcher);

    expect(await result.text()).toBe("fetched-1");
    expect(fetchCount).toBe(1);
  });

  it("singleflights concurrent misses for the same key", async () => {
    const adapter = new TestAdapter();
    let fetchCount = 0;
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetcher = async () => {
      fetchCount++;
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    };

    const pending = Promise.all([
      adapter.getOrSet("/test", fetcher),
      adapter.getOrSet("/test", fetcher),
      adapter.getOrSet("/test", fetcher),
    ]);

    await Promise.resolve();
    expect(fetchCount).toBe(1);

    if (!resolveFetch) {
      throw new Error("singleflight fetcher was not called");
    }

    resolveFetch(new Response("fetched-1"));
    const responses = await pending;
    const bodies = await Promise.all(responses.map((response) => response.text()));

    expect(bodies).toEqual(["fetched-1", "fetched-1", "fetched-1"]);
    expect(fetchCount).toBe(1);
  });

  it("caches the fetched value", async () => {
    const adapter = new TestAdapter();
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      return new Response(`fetched-${fetchCount}`);
    };

    await adapter.getOrSet("/test", fetcher);
    const second = await adapter.getOrSet("/test", fetcher);

    expect(await second.text()).toBe("fetched-1");
    expect(fetchCount).toBe(1);
  });

  it("supports ttlMs via options", async () => {
    const adapter = new TestAdapter();
    await adapter._set("/test", new Response("cached"), 50);

    const result = await adapter._get("/test");
    expect(result).toBeDefined();
  });
});
