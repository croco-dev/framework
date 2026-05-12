import { describe, expect, it, vi } from "vitest";
import { createNodeComposedHandler } from "../libs/providers/node";
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
});
