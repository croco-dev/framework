import { describe, expect, it, vi } from "vitest";
import { createNodeComposedHandler, createNodeHandler } from "../libs/providers/node";
import type { CrocoFetchHandler } from "../libs/render/types";

describe("createNodeComposedHandler", () => {
  it("returns an API response when an API handler matches the request", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("Page response"));
    const adapter = createNodeComposedHandler({
      apiHandlers: [
        {
          match: (request) => new URL(request.url).pathname === "/api/users",
          handle: async () => new Response("API response", { status: 201 }),
        },
      ],
      pageHandler,
    });

    const response = await adapter.fetch(new Request("https://example.com/api/users"));

    expect(response.status).toBe(201);
    await expect(response.text()).resolves.toBe("API response");
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it("falls back to the page handler when no API handler matches the request", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(
      async () => new Response("SSR response", { status: 200 }),
    );
    const adapter = createNodeComposedHandler({
      apiHandlers: [
        {
          match: (request) => new URL(request.url).pathname === "/api/users",
          handle: async () => new Response("API response"),
        },
      ],
      pageHandler,
    });
    const request = new Request("https://example.com/dashboard");

    const response = await adapter.fetch(request);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("SSR response");
    expect(pageHandler).toHaveBeenCalledWith(request, { platform: "node" });
  });

  it("forwards a node RuntimeContext to the page handler", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async (_request, context) => {
      return new Response(`Platform: ${context?.platform ?? "missing"}`);
    });
    const adapter = createNodeComposedHandler({
      apiHandlers: [],
      pageHandler,
    });

    const response = await adapter.fetch(new Request("https://example.com/page"));

    await expect(response.text()).resolves.toBe("Platform: node");
  });

  it("returns a fetch-compatible object", async () => {
    const adapter = createNodeComposedHandler({
      apiHandlers: [],
      pageHandler: async () => new Response("OK"),
    });

    expect(typeof adapter.fetch).toBe("function");
    await expect(adapter.fetch(new Request("https://example.com"))).resolves.toBeInstanceOf(
      Response,
    );
  });

  it("refuses a request whose origin differs from the configured origin", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("page"));
    const adapter = createNodeComposedHandler({
      origin: "http://127.0.0.1:4317",
      apiHandlers: [],
      pageHandler,
    });

    // An absolute request target or a forged Host header both end up as the
    // origin of `request.url` in a Node HTTP server.
    const response = await adapter.fetch(new Request("http://127.0.0.1:9/products/orbit"));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "meta-vite/node-request-origin-mismatch" });
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it("serves the configured origin regardless of a trailing slash in the option", async () => {
    const adapter = createNodeComposedHandler({
      origin: "http://127.0.0.1:4317/",
      apiHandlers: [],
      pageHandler: async () => new Response("page"),
    });

    const response = await adapter.fetch(new Request("http://127.0.0.1:4317/products/orbit"));

    expect(response.status).toBe(200);
  });
});

describe("createNodeHandler", () => {
  it("refuses a foreign origin before calling the handler", async () => {
    const handler = vi.fn<CrocoFetchHandler>(async () => new Response("page"));
    const adapter = createNodeHandler(handler, { origin: "https://shop.example" });

    const response = await adapter.fetch(new Request("https://attacker.example/"));

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("origin pinning behind a proxy", () => {
  it("accepts the configured host over plain HTTP and hands on the public https URL with the body", async () => {
    const seen: { url: string; body: string }[] = [];
    const adapter = createNodeComposedHandler({
      origin: "https://shop.example",
      apiHandlers: [],
      pageHandler: async (request) => {
        seen.push({ url: request.url, body: await request.text() });
        return new Response("page");
      },
    });

    // A proxy that ended TLS forwards the public Host over plain HTTP.
    const response = await adapter.fetch(
      new Request("http://shop.example/products/orbit?tab=1", { method: "POST", body: "form" }),
    );

    expect(response.status).toBe(200);
    expect(seen).toEqual([{ url: "https://shop.example/products/orbit?tab=1", body: "form" }]);
  });

  it("refuses another host even when the scheme matches", async () => {
    const adapter = createNodeHandler(async () => new Response("page"), {
      origin: "https://shop.example",
    });

    const response = await adapter.fetch(new Request("https://10.0.0.7:3000/"));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "meta-vite/node-request-origin-mismatch",
    });
  });
});
