import { InMemoryCacheStore } from "@croco/cache-core";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { createIsrMiddleware } from "../libs/isr/isrMiddleware";
import { RenderServer } from "../libs/render/renderServer";
import { defineRoute } from "../libs/routes/defineRoute";
import { RouteRegistry } from "../libs/routes/routeRegistry";
import { composeRscClientManifestVersion } from "../libs/rsc/flight";

const VARIANTS = [
  { vary: "Accept", header: "Accept", values: ["text/html", "text/x-component"] },
  { vary: "Accept-Language", header: "Accept-Language", values: ["en", "ko"] },
  { vary: "Accept-Encoding", header: "Accept-Encoding", values: ["identity", "gzip"] },
  { vary: "  aCcEpT , ACCEPT-LANGUAGE  ", header: "Accept-Language", values: ["en", "ko"] },
  { vary: "X-Representation", header: "X-Representation", values: ["summary", "detail"] },
] as const;

describe("ISR Vary representations", () => {
  it.each(VARIANTS)("does not store $vary responses in either request order", async (variant) => {
    for (const values of [variant.values, [...variant.values].reverse()]) {
      const cache = new InMemoryCacheStore<Response>();
      const render = vi.fn(
        async (request: Request) =>
          new Response(request.headers.get(variant.header), { headers: { Vary: variant.vary } }),
      );
      const middleware = createIsrMiddleware({ cache, render, ttlMs: 1000 });
      for (const value of values) {
        const response = await middleware(
          new Request("https://example.com/variant", { headers: { [variant.header]: value } }),
        );
        await expect(response.text()).resolves.toBe(value);
      }
      expect(render).toHaveBeenCalledTimes(2);
      expect(await cache.has("GET:https://example.com/variant")).toBe(false);
    }
  });

  it.each(VARIANTS)(
    "does not share $vary responses during concurrent first fill",
    async (variant) => {
      for (const values of [variant.values, [...variant.values].reverse()]) {
        const cache = new InMemoryCacheStore<Response>();
        let release!: () => void;
        let started!: () => void;
        const ready = new Promise<void>((resolve) => {
          release = resolve;
        });
        const entered = new Promise<void>((resolve) => {
          started = resolve;
        });
        const render = vi.fn(async (request: Request) => {
          started();
          await ready;
          return new Response(request.headers.get(variant.header), {
            headers: { Vary: variant.vary },
          });
        });
        const middleware = createIsrMiddleware({ cache, render, ttlMs: 1000 });
        const responses = values.map((value) =>
          middleware(
            new Request("https://example.com/concurrent", { headers: { [variant.header]: value } }),
          ),
        );
        await entered;
        release();
        const bodies = await Promise.all(
          responses.map(async (response) => (await response).text()),
        );
        expect(bodies).toEqual(values);
        expect(render).toHaveBeenCalledTimes(2);
        expect(await cache.has("GET:https://example.com/concurrent")).toBe(false);
      }
    },
  );

  it.each(["GET", "HEAD"])("bypasses legacy Vary entries for %s", async (method) => {
    for (const vary of [
      "Accept",
      "Accept-Language",
      "Accept-Encoding",
      "X-Custom",
      "*",
      "Cookie",
      "Authorization",
    ]) {
      const cache = new InMemoryCacheStore<Response>();
      const url = "https://example.com/legacy-vary";
      await cache.set(
        `${method}:${url}`,
        new Response(null, { headers: { Vary: vary, "x-value": "old" } }),
      );
      const render = vi.fn(async () => new Response(null, { headers: { "x-value": "fresh" } }));
      const middleware = createIsrMiddleware({ cache, render, ttlMs: 1000 });
      expect((await middleware(new Request(url, { method }))).headers.get("x-value")).toBe("fresh");
      expect(render).toHaveBeenCalledTimes(1);
    }
  });

  it.each([undefined, "", " , , "])("retains TTL singleflight for empty Vary %j", async (vary) => {
    const cache = new InMemoryCacheStore<Response>();
    const render = vi.fn(
      async () => new Response("shared", { headers: vary === undefined ? {} : { Vary: vary } }),
    );
    const middleware = createIsrMiddleware({ cache, render, ttlMs: 1000 });
    const responses = await Promise.all(
      Array.from({ length: 3 }, () => middleware(new Request("https://example.com/shared"))),
    );
    expect(await Promise.all(responses.map((response) => response.text()))).toEqual([
      "shared",
      "shared",
      "shared",
    ]);
    await expect(
      (await middleware(new Request("https://example.com/shared"))).text(),
    ).resolves.toBe("shared");
    expect(render).toHaveBeenCalledTimes(1);
  });
});

describe("ISR with RenderServer Flight negotiation", () => {
  it.each(["html-first", "flight-first", "concurrent"])(
    "keeps HTML/Flight and manifest validation: %s",
    async (order) => {
      const registry = new RouteRegistry();
      registry.register(
        defineRoute({
          path: "/product",
          mode: "rsc",
          component: () => createElement("main", null, "Product"),
        }),
      );
      const server = new RenderServer(registry.compile(), {
        clientBuildId: "build-3647",
        encodeFlight: async () =>
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode('0:["$","main",null,{"children":"Product"}]\n'),
              );
              controller.close();
            },
          }),
      });
      const cache = new InMemoryCacheStore<Response>();
      const middleware = createIsrMiddleware({
        cache,
        ttlMs: 1000,
        render: (request) => server.handle(request),
      });
      const url = "https://example.com/product";
      const version = composeRscClientManifestVersion("build-3647");
      const html = () => new Request(url, { headers: { Accept: "text/html" } });
      const flight = () =>
        new Request(url, {
          headers: { Accept: "text/x-component", "x-croco-rsc-client-manifest": version },
        });
      const requests = order === "flight-first" ? [flight(), html()] : [html(), flight()];
      const concurrent =
        order === "concurrent" ? requests.map((request) => middleware(request)) : undefined;
      for (const [index, request] of requests.entries()) {
        const response = await (concurrent?.[index] ?? middleware(request));
        expect(response.status).toBe(200);
        if (request.headers.get("Accept") === "text/html") {
          expect(response.headers.get("content-type")).toContain("text/html");
          expect(await response.text()).toContain("<main>Product</main>");
        } else {
          expect(response.headers.get("content-type")).toContain("text/x-component");
          expect(await response.text()).toBe('0:["$","main",null,{"children":"Product"}]\n');
        }
      }
      // A pre-upgrade writer may have left a successful Flight response at this key.
      await cache.set(`GET:${url}`, await server.handle(flight()));
      for (const manifest of [undefined, "stale-build"]) {
        const response = await middleware(
          new Request(url, {
            headers: {
              Accept: "text/x-component",
              ...(manifest === undefined ? {} : { "x-croco-rsc-client-manifest": manifest }),
            },
          }),
        );
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
          code: "meta-vite/rsc-client-manifest-mismatch",
        });
      }
    },
  );
});
