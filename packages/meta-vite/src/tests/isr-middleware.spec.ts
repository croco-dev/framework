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

  it.each([false, true])(
    "keeps range responses separate with a warm full entry: %s",
    async (warm) => {
      const render = vi.fn(async (request: Request) => {
        if (request.headers.get("Range") === "bytes=0-2") {
          return new Response("abc", { status: 206, headers: { "Content-Range": "bytes 0-2/10" } });
        }
        if (request.headers.get("Range") === "bytes=7-9") {
          return new Response("hij", { status: 206, headers: { "Content-Range": "bytes 7-9/10" } });
        }
        return new Response("abcdefghij");
      });
      const middleware = createIsrMiddleware({ cache, ttlMs: 1000, render });
      const url = "https://example.com/range";
      if (warm) await middleware(new Request(url));

      const first = await middleware(new Request(url, { headers: { Range: "bytes=0-2" } }));
      expect(first.status).toBe(206);
      expect(first.headers.get("Content-Range")).toBe("bytes 0-2/10");
      await expect(first.text()).resolves.toBe("abc");
      const full = await middleware(new Request(url));
      expect(full.status).toBe(200);
      expect(full.headers.has("Content-Range")).toBe(false);
      await expect(full.text()).resolves.toBe("abcdefghij");
      const last = await middleware(new Request(url, { headers: { Range: "bytes=7-9" } }));
      expect(last.status).toBe(206);
      expect(last.headers.get("Content-Range")).toBe("bytes 7-9/10");
      await expect(last.text()).resolves.toBe("hij");
      await expect((await middleware(new Request(url))).text()).resolves.toBe("abcdefghij");
      expect(render).toHaveBeenCalledTimes(3);
    },
  );

  it.each(["GET", "HEAD"])(
    "bypasses a warm %s entry for If-Range and forwards the request",
    async (method) => {
      const render = vi.fn(
        async (request: Request) =>
          new Response(null, {
            headers: { "x-validator": request.headers.get("If-Range") ?? "none" },
          }),
      );
      const middleware = createIsrMiddleware({ cache, ttlMs: 1000, render });
      const url = "https://example.com/validator";
      await middleware(new Request(url, { method }));
      const request = new Request(url, { method, headers: { "If-Range": '"version-2"' } });
      const response = await middleware(request);
      expect(response.headers.get("x-validator")).toBe('"version-2"');
      expect(render).toHaveBeenLastCalledWith(request);
      expect(render).toHaveBeenCalledTimes(2);
    },
  );

  it("does not singleflight concurrent Range requests", async () => {
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const render = vi.fn(async (request: Request) => {
      await ready;
      return new Response(request.headers.get("Range"));
    });
    const middleware = createIsrMiddleware({ cache, ttlMs: 1000, render });
    const first = middleware(
      new Request("https://example.com/range", { headers: { Range: "bytes=0-2" } }),
    );
    const last = middleware(
      new Request("https://example.com/range", { headers: { Range: "bytes=7-9" } }),
    );
    release();
    await expect((await first).text()).resolves.toBe("bytes=0-2");
    await expect((await last).text()).resolves.toBe("bytes=7-9");
    expect(render).toHaveBeenCalledTimes(2);
  });

  it.each([{ status: 206 }, { status: 200, headers: { "Content-Range": "bytes 0-2/10" } }])(
    "does not store a partial response %j for a subsequent full request",
    async (init) => {
      const render = vi
        .fn()
        .mockResolvedValueOnce(new Response("abc", init))
        .mockImplementation(async () => new Response("abcdefghij"));
      const middleware = createIsrMiddleware({ cache, ttlMs: 1000, render });
      const request = new Request("https://example.com/partial");
      await expect((await middleware(request)).text()).resolves.toBe("abc");
      const full = await middleware(request);
      expect(full.status).toBe(200);
      await expect(full.text()).resolves.toBe("abcdefghij");
      await expect((await middleware(request)).text()).resolves.toBe("abcdefghij");
      expect(render).toHaveBeenCalledTimes(2);
    },
  );

  it.each([{ status: 206 }, { status: 200, headers: { "Content-Range": "bytes 0-2/10" } }])(
    "does not reuse an already stored partial response %j",
    async (init) => {
      const url = "https://example.com/legacy";
      await cache.set(`GET:${url}`, new Response("abc", init));
      const render = vi.fn(async () => new Response("abcdefghij"));
      const middleware = createIsrMiddleware({ cache, ttlMs: 1000, render });
      const response = await middleware(new Request(url));
      expect(response.status).toBe(200);
      expect(response.headers.has("Content-Range")).toBe(false);
      await expect(response.text()).resolves.toBe("abcdefghij");
      expect(render).toHaveBeenCalledTimes(1);
    },
  );

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

  it.each([
    ["Cache-Control", "private"],
    ["Cache-Control", "no-store"],
    ["Set-Cookie", "session=abc"],
    ["Vary", "Cookie"],
    ["Vary", "Authorization"],
  ])("keeps personalized responses uncached: %s %s", async (name, value) => {
    let renderCount = 0;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () => new Response(`private-${++renderCount}`, { headers: { [name]: value } }),
    });
    const url = "https://example.com/private";
    await expect((await middleware(new Request(url))).text()).resolves.toBe("private-1");
    await expect((await middleware(new Request(url))).text()).resolves.toBe("private-2");
  });

  it("does not cache wildcard vary responses", async () => {
    let renderCount = 0;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () =>
        new Response(`vary-${++renderCount}`, { status: 200, headers: { Vary: "*" } }),
    });

    const first = await middleware(new Request("https://example.com/page"));
    const second = await middleware(new Request("https://example.com/page"));

    await expect(first.text()).resolves.toBe("vary-1");
    await expect(second.text()).resolves.toBe("vary-2");
    expect(renderCount).toBe(2);
  });

  it("keeps caching when header names merely contain identity substrings", async () => {
    let renderCount = 0;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () =>
        new Response(`consent-${++renderCount}`, {
          status: 200,
          headers: { Vary: "X-Cookie-Consent" },
        }),
    });

    const first = await middleware(new Request("https://example.com/page"));
    const second = await middleware(new Request("https://example.com/page"));

    await expect(first.text()).resolves.toBe("consent-1");
    await expect(second.text()).resolves.toBe("consent-1");
    expect(renderCount).toBe(1);
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
