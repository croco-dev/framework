import { createElement } from "react";
import { InMemoryCacheStore } from "@croco/cache-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AbstractCacheStoreAdapter } from "../libs/isr/adapters/abstractAdapter";
import { createIsrMiddleware } from "../libs/isr/isrMiddleware";
import { RenderServer } from "../libs/render/renderServer";

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

  it.each([
    "no-cache",
    'public, No-CaChE = "ETag, Last-Modified", max-age=60',
    String.raw`ext="value with an escaped \" and a comma,", no-cache`,
  ])("does not store responses with Cache-Control: %s", async (cacheControl) => {
    const url = "https://example.com/fresh";
    const render = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("initial", { headers: { "Cache-Control": cacheControl } }),
      )
      .mockImplementation(async () => new Response("updated"));
    const middleware = createIsrMiddleware({ cache, ttlMs: 60_000, render });

    const first = await middleware(new Request(url));
    expect(first.headers.get("Cache-Control")).toBe(cacheControl);
    await expect(first.text()).resolves.toBe("initial");
    await expect(cache.get(`GET:${url}`)).resolves.toBeUndefined();
    await expect((await middleware(new Request(url))).text()).resolves.toBe("updated");
    await expect((await middleware(new Request(url))).text()).resolves.toBe("updated");
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("does not interpret a quoted Cache-Control extension value as a directive", async () => {
    const render = vi.fn(
      async () =>
        new Response("cached", {
          headers: { "Cache-Control": 'public, ext="before, no-cache, after", max-age=60' },
        }),
    );
    const middleware = createIsrMiddleware({ cache, ttlMs: 60_000, render });
    const url = "https://example.com/extension";

    await expect((await middleware(new Request(url))).text()).resolves.toBe("cached");
    await expect((await middleware(new Request(url))).text()).resolves.toBe("cached");
    expect(render).toHaveBeenCalledOnce();
  });

  it.each([
    ["misplaced quote before private", 'ext=bad", private, other="ok'],
    ["misplaced quote before no-store", 'ext=bad", no-store, other="ok'],
    ["control byte in quoted text", `ext="bad${String.fromCharCode(1)}, private, after"`],
    ["escaped control byte", `ext="bad\\${String.fromCharCode(127)}, no-store, after"`],
  ])("bypasses malformed Cache-Control: %s", async (_label, cacheControl) => {
    const url = "https://example.com/malformed-cache-control";
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 60_000,
      render: async (request) =>
        new Response(request.headers.get("X-Label") ?? "anonymous", {
          headers: { "Cache-Control": cacheControl },
        }),
    });
    const first = await middleware(new Request(url, { headers: { "X-Label": "first" } }));
    await expect(first.text()).resolves.toBe("first");
    const second = await middleware(new Request(url));
    await expect(second.text()).resolves.toBe("anonymous");
    await expect(cache.get(`GET:${url}`)).resolves.toBeUndefined();
  });

  it("renders around a previously stored no-cache response while it remains in the store", async () => {
    const url = "https://example.com/legacy-no-cache";
    await cache.set(
      `GET:${url}`,
      new Response("old", { headers: { "Cache-Control": "no-cache" } }),
    );
    let renderCount = 0;
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 60_000,
      render: async () => new Response(`current-${++renderCount}`),
    });

    await expect((await middleware(new Request(url))).text()).resolves.toBe("current-1");
    await expect((await middleware(new Request(url))).text()).resolves.toBe("current-2");
  });

  it("renders each concurrent request when the first fill returns no-cache", async () => {
    let signalFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      signalFirstStarted = resolve;
    });
    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const render = vi.fn(async () => {
      const attempt = render.mock.calls.length;
      if (attempt === 1) {
        signalFirstStarted();
        await firstReleased;
      }
      return new Response(`render-${attempt}`, { headers: { "Cache-Control": "no-cache" } });
    });
    const middleware = createIsrMiddleware({ cache: new TestAdapter(), ttlMs: 60_000, render });
    const request = new Request("https://example.com/concurrent");
    const first = middleware(request);
    await firstStarted;
    const second = middleware(request);
    releaseFirst();

    await expect((await first).text()).resolves.toBe("render-1");
    await expect((await second).text()).resolves.toBe("render-2");
  });

  it.each(["memory store", "adapter"] as const)(
    "keeps live ISR waiters on one replacement fill after the owner disconnects (%s)",
    async (backend) => {
      const url = "https://example.com/product";
      const controller = new AbortController();
      let signalStarted!: () => void;
      const firstStarted = new Promise<void>((resolve) => {
        signalStarted = resolve;
      });
      const componentLoader = vi.fn(async () => {
        if (componentLoader.mock.calls.length === 1) {
          signalStarted();
          await new Promise<void>(() => {});
        }
        return { default: () => createElement("main", null, "Current product") };
      });
      const server = new RenderServer([{ path: "/product", mode: "isr", componentLoader }]);
      const middleware = createIsrMiddleware({
        cache: backend === "adapter" ? new TestAdapter() : cache,
        ttlMs: 60_000,
        render: async (request) => {
          const response = await server.handle(request, { platform: "node" });
          if (response.status === 503) response.headers.set("Cache-Control", "private, no-store");
          return response;
        },
      });

      const first = middleware(new Request(url, { signal: controller.signal }));
      await firstStarted;
      const waiter = middleware(new Request(url));
      const otherWaiter = middleware(new Request(url));
      // The live request joins the existing fill before its owner disconnects.
      await Promise.resolve();
      expect(componentLoader).toHaveBeenCalledOnce();
      controller.abort();

      const [cancelled, live, other] = await Promise.all([first, waiter, otherWaiter]);
      expect(cancelled.status).toBe(503);
      expect(live.status).toBe(200);
      expect(other.status).toBe(200);
      await expect(live.text()).resolves.toContain("<main>Current product</main>");
      await expect(other.text()).resolves.toContain("<main>Current product</main>");
      expect(componentLoader).toHaveBeenCalledTimes(2);

      const cached = await middleware(new Request(url));
      expect(cached.status).toBe(200);
      await expect(cached.text()).resolves.toContain("<main>Current product</main>");
      expect(componentLoader).toHaveBeenCalledTimes(2);
    },
  );

  it("checks the signal again before a waiter actually owns the replacement fill", async () => {
    const start = createLatch();
    const replacementLookups = createLatch();
    const releaseLookups: Array<() => void> = [];
    let holdLookups = false;
    const adapter = new TestAdapter();
    const get = adapter._get.bind(adapter);
    vi.spyOn(adapter, "_get").mockImplementation(async (key) => {
      if (holdLookups) {
        await new Promise<void>((resolve) => {
          releaseLookups.push(resolve);
          if (releaseLookups.length === 2) replacementLookups.release();
        });
      }
      return get(key);
    });
    const owner = new AbortController();
    const abandoned = new AbortController();
    const render = vi.fn(async (request: Request) => {
      const client = request.headers.get("x-client");
      if (client === "owner") {
        start.release();
        await new Promise<void>((resolve) =>
          request.signal.addEventListener("abort", () => resolve(), { once: true }),
        );
        return new Response("owner-only recovery", { status: 503, headers: { Vary: "x-client" } });
      }
      return new Response(client);
    });
    const middleware = createIsrMiddleware({ cache: adapter, ttlMs: 60_000, render });
    const request = (client: string, signal?: AbortSignal) =>
      new Request("https://example.com/product", {
        headers: { "x-client": client },
        ...(signal ? { signal } : {}),
      });
    const first = middleware(request("owner", owner.signal));
    await start.promise;
    const next = middleware(request("abandoned", abandoned.signal));
    const live = middleware(request("live"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    holdLookups = true;
    owner.abort();
    await replacementLookups.promise;
    holdLookups = false;
    abandoned.abort();
    resolveRender(releaseLookups, 0);
    let cancelled: Response;
    try {
      cancelled = await next;
    } finally {
      resolveRender(releaseLookups, 1);
    }
    expect(cancelled.status).toBe(503);
    await expect(cancelled.text()).resolves.not.toContain("owner-only recovery");
    await expect((await first).text()).resolves.toBe("owner-only recovery");
    await expect((await live).text()).resolves.toBe("live");
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("never clones a cancelled owner's private 503 into a cancelled waiter's result", async () => {
    const ready = createLatch();
    const finish = createLatch();
    const owner = new AbortController();
    const waiter = new AbortController();
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 60_000,
      render: async () => {
        ready.release();
        await finish.promise;
        return new Response("owner-only recovery", {
          status: 503,
          headers: { Vary: "x-client", "x-owner-context": "private" },
        });
      },
    });
    const url = "https://example.com/product";
    const first = middleware(new Request(url, { signal: owner.signal }));
    await ready.promise;
    const next = middleware(new Request(url, { signal: waiter.signal }));
    await Promise.resolve();
    waiter.abort();
    owner.abort();
    finish.release();

    expect((await first).headers.get("x-owner-context")).toBe("private");
    const result = await next;
    expect(result.status).toBe(503);
    expect(result.headers.has("x-owner-context")).toBe(false);
    await expect(result.text()).resolves.not.toContain("owner-only recovery");
  });

  it.each([
    "cacheable response",
    "vary response",
    "live vary response",
    "another disconnect",
    "private response",
    "late success from a disconnected replacement",
  ] as const)("refuses to reuse the ISR replacement response after %s", async (ending) => {
    const started = createLatch();
    const firstReleased = createLatch();
    const replacementStarted = createLatch();
    const replacementReleased = createLatch();
    const owner = new AbortController();
    const replacement = new AbortController();
    const waiter = new AbortController();
    const render = vi.fn(async (request: Request) => {
      const client = request.headers.get("x-client");
      if (client === "owner") {
        started.release();
        await firstReleased.promise;
        return new Response(null, { status: 503 });
      }
      if (client === "replacement") {
        replacementStarted.release();
        await replacementReleased.promise;
        if (ending === "another disconnect") return new Response(null, { status: 503 });
        if (ending === "private response") {
          return new Response("replacement-only content", {
            headers: { "Cache-Control": "private, no-store", "Set-Cookie": "session=fixture" },
          });
        }
        const headers =
          ending === "vary response" || ending === "live vary response"
            ? { Vary: "x-client" }
            : undefined;
        return new Response("fresh", { headers });
      }
      return new Response("new render");
    });
    const middleware = createIsrMiddleware({ cache, ttlMs: 60_000, render });
    const request = (client: string, signal: AbortSignal) =>
      new Request("https://example.com/product", { signal, headers: { "x-client": client } });
    const first = middleware(request("owner", owner.signal));
    await started.promise;
    const second = middleware(request("replacement", replacement.signal));
    const other = middleware(request("waiter", waiter.signal));
    await new Promise<void>((resolve) => setImmediate(resolve));
    owner.abort();
    firstReleased.release();
    await replacementStarted.promise;
    const late =
      ending === "private response"
        ? middleware(request("late", new AbortController().signal))
        : undefined;
    if (late) await new Promise<void>((resolve) => setImmediate(resolve));
    const cancelledReplacement =
      ending === "another disconnect" || ending === "late success from a disconnected replacement";
    if (cancelledReplacement) replacement.abort();
    else if (ending !== "private response" && ending !== "live vary response") waiter.abort();
    replacementReleased.release();

    expect((await first).status).toBe(503);
    const replacementResponse = await second;
    expect(replacementResponse.status).toBe(cancelledReplacement ? 503 : 200);
    const waiterResponse = await other;
    expect(waiterResponse.status).toBe(503);
    expect(waiterResponse.headers.get("cache-control")).toBe("no-store");
    await expect(waiterResponse.text()).resolves.toBe("");
    if (ending === "private response") {
      expect(replacementResponse.headers.get("set-cookie")).toBe("session=fixture");
      await expect(replacementResponse.text()).resolves.toBe("replacement-only content");
      expect(waiterResponse.headers.has("set-cookie")).toBe(false);
      const lateResponse = await late;
      expect(lateResponse?.status).toBe(503);
      expect(lateResponse?.headers.get("cache-control")).toBe("no-store");
      expect(lateResponse?.headers.has("set-cookie")).toBe(false);
      expect(await lateResponse?.text()).toBe("");
    }
    expect(render).toHaveBeenCalledTimes(2);
    if (ending === "late success from a disconnected replacement") {
      const fresh = await middleware(request("fresh", new AbortController().signal));
      await expect(fresh.text()).resolves.toBe("new render");
      expect(render).toHaveBeenCalledTimes(3);
    }
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

  it("keeps unrecognized Vary dimensions uncached", async () => {
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
    await expect(second.text()).resolves.toBe("consent-2");
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

function createLatch() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
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
