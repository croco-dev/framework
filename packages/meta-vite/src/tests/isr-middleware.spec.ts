import { InMemoryCacheStore } from "@croco/cache-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AbstractCacheStoreAdapter } from "../libs/isr/adapters/abstractAdapter";
import { createIsrMiddleware } from "../libs/isr/isrMiddleware";

describe("createIsrMiddleware", () => {
  let cache!: InMemoryCacheStore<Response>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<Response>({ maxEntries: 1000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached content within the TTL", async () => {
    vi.useFakeTimers();
    let renderCount = 0;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () => new Response(`render-${++renderCount}`, { status: 200 }),
    });

    const first = await middleware(new Request("https://example.com/page"));
    const second = await middleware(new Request("https://example.com/page"));

    await expect(first.text()).resolves.toBe("render-1");
    await expect(second.text()).resolves.toBe("render-1");
    expect(renderCount).toBe(1);
  });

  it("re-renders after the TTL expires", async () => {
    vi.useFakeTimers();
    let renderCount = 0;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () => new Response(`render-${++renderCount}`, { status: 200 }),
    });

    const first = await middleware(new Request("https://example.com/page"));
    vi.advanceTimersByTime(1001);
    const second = await middleware(new Request("https://example.com/page"));

    await expect(first.text()).resolves.toBe("render-1");
    await expect(second.text()).resolves.toBe("render-2");
    expect(renderCount).toBe(2);
  });

  it("bypasses cache for POST requests", async () => {
    let renderCount = 0;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () => new Response(`render-${++renderCount}`, { status: 200 }),
    });

    const first = await middleware(new Request("https://example.com/page", { method: "POST" }));
    const second = await middleware(new Request("https://example.com/page", { method: "POST" }));

    await expect(first.text()).resolves.toBe("render-1");
    await expect(second.text()).resolves.toBe("render-2");
    expect(renderCount).toBe(2);
  });

  it("caches HEAD requests", async () => {
    let renderCount = 0;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () =>
        new Response(null, {
          status: 204,
          headers: { "x-render-count": String(++renderCount) },
        }),
    });

    const first = await middleware(new Request("https://example.com/page", { method: "HEAD" }));
    const second = await middleware(new Request("https://example.com/page", { method: "HEAD" }));

    expect(first.headers.get("x-render-count")).toBe("1");
    expect(second.headers.get("x-render-count")).toBe("1");
    expect(renderCount).toBe(1);
  });

  it("does not cache 4xx or 5xx responses", async () => {
    let renderCount = 0;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () => {
        renderCount++;
        return new Response(`error-${renderCount}`, { status: renderCount === 1 ? 404 : 500 });
      },
    });

    const first = await middleware(new Request("https://example.com/missing"));
    const second = await middleware(new Request("https://example.com/missing"));

    expect(first.status).toBe(404);
    expect(second.status).toBe(500);
    await expect(first.text()).resolves.toBe("error-1");
    await expect(second.text()).resolves.toBe("error-2");
    expect(renderCount).toBe(2);
  });

  it("does not cache redirect responses", async () => {
    let renderCount = 0;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () =>
        new Response(null, {
          status: 302,
          headers: {
            Location: `/next-${++renderCount}`,
          },
        }),
    });

    const first = await middleware(new Request("https://example.com/redirect"));
    const second = await middleware(new Request("https://example.com/redirect"));

    expect(first.headers.get("Location")).toBe("/next-1");
    expect(second.headers.get("Location")).toBe("/next-2");
    expect(renderCount).toBe(2);
  });

  it("keeps concurrent non-cacheable adapter responses readable and uncached", async () => {
    let renderCount = 0;
    const renderResolvers: Array<() => void> = [];
    const adapter = new TestAdapter();
    const middleware = createIsrMiddleware({
      cache: adapter,
      ttlMs: 1000,
      render: async () => {
        renderCount++;
        await new Promise<void>((resolve) => {
          renderResolvers.push(resolve);
        });
        return new Response(`not-found-${renderCount}`, { status: 404 });
      },
    });

    const pending = Promise.all([
      middleware(new Request("https://example.com/missing")),
      middleware(new Request("https://example.com/missing")),
      middleware(new Request("https://example.com/missing")),
    ]);

    await Promise.resolve();
    expect(renderCount).toBe(1);

    resolveRender(renderResolvers, 0);
    const responses = await pending;
    const bodies = await Promise.all(responses.map((response) => response.text()));

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404]);
    expect(bodies).toEqual(["not-found-1", "not-found-1", "not-found-1"]);

    const nextPromise = middleware(new Request("https://example.com/missing"));
    await Promise.resolve();
    resolveRender(renderResolvers, 1);
    const next = await nextPromise;

    await expect(next.text()).resolves.toBe("not-found-2");
    expect(renderCount).toBe(2);
  });

  it("uses getOrSet singleflight for concurrent requests", async () => {
    let renderCount = 0;
    let resolveRender!: () => void;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () => {
        renderCount++;
        await new Promise<void>((resolve) => {
          resolveRender = resolve;
        });
        return new Response(`render-${renderCount}`, { status: 200 });
      },
    });

    const pending = Promise.all([
      middleware(new Request("https://example.com/page")),
      middleware(new Request("https://example.com/page")),
      middleware(new Request("https://example.com/page")),
    ]);

    await Promise.resolve();
    expect(renderCount).toBe(1);

    resolveRender();
    const responses = await pending;
    const bodies = await Promise.all(responses.map((response) => response.text()));

    expect(bodies).toEqual(["render-1", "render-1", "render-1"]);
    expect(renderCount).toBe(1);
  });

  it("bypasses cache for Authorization requests", async () => {
    let renderCount = 0;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () => new Response(`render-${++renderCount}`, { status: 200 }),
    });
    const request = new Request("https://example.com/page", {
      headers: { Authorization: "Bearer token" },
    });

    const first = await middleware(request);
    const second = await middleware(request.clone());

    await expect(first.text()).resolves.toBe("render-1");
    await expect(second.text()).resolves.toBe("render-2");
    expect(renderCount).toBe(2);
  });

  it("bypasses cache for Cookie requests", async () => {
    let renderCount = 0;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () => new Response(`render-${++renderCount}`, { status: 200 }),
    });
    const request = new Request("https://example.com/page", {
      headers: { Cookie: "session=abc" },
    });

    const first = await middleware(request);
    const second = await middleware(request.clone());

    await expect(first.text()).resolves.toBe("render-1");
    await expect(second.text()).resolves.toBe("render-2");
    expect(renderCount).toBe(2);
  });
});

function resolveRender(renderResolvers: ReadonlyArray<() => void>, index: number): void {
  const resolve = renderResolvers[index];
  if (!resolve) {
    throw new Error(`non-cacheable render ${index} was not called`);
  }

  resolve();
}

class TestAdapter extends AbstractCacheStoreAdapter {
  private readonly store = new Map<string, { value: Response; expiresAt?: number }>();

  async _get(key: string): Promise<Response | undefined> {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  async _set(key: string, value: Response, ttlMs?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  async _delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
