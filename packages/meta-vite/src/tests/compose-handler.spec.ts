import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { createMetaFetchHandler } from "../libs/render/composeHandler";
import { RenderServer } from "../libs/render/renderServer";
import { defineRoute } from "../libs/routes/defineRoute";
import { RouteRegistry } from "../libs/routes/routeRegistry";
import type { ApiRouteIR } from "../libs/routes/types";

describe("createMetaFetchHandler", () => {
  it("returns API response when the API handler handles the request", async () => {
    const handler = createMetaFetchHandler({
      apiHandler: async () => ({ handled: true, response: new Response("api-data") }),
    });

    const response = await handler(new Request("https://example.com/api/data"));

    await expect(response.text()).resolves.toBe("api-data");
  });

  it("falls back to page handler when the API handler declines the request", async () => {
    const apiHandler = vi.fn(async () => ({ handled: false as const }));
    const pageHandler = vi.fn(async () => new Response("page-fallback"));
    const handler = createMetaFetchHandler({ apiHandler, pageHandler });

    const response = await handler(new Request("https://example.com/page"));

    await expect(response.text()).resolves.toContain("page-fallback");
    expect(apiHandler).toHaveBeenCalledOnce();
    expect(pageHandler).toHaveBeenCalledOnce();
  });

  it("does not fall back to page handler for an intentional API 404", async () => {
    const pageHandler = vi.fn(async () => {
      throw new Error("page handler should not be called");
    });
    const handler = createMetaFetchHandler({
      apiHandler: async () => ({
        handled: true,
        response: new Response("API 404", { status: 404 }),
      }),
      pageHandler,
    });

    const response = await handler(new Request("https://example.com/api/missing"));

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("API 404");
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it("returns 404 when no page handler is available", async () => {
    const handler = createMetaFetchHandler({
      apiHandler: async () => ({ handled: false }),
    });

    const response = await handler(new Request("https://example.com/missing"));

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Not Found");
  });

  it("returns fresh 404 responses when no page handler is available", async () => {
    const handler = createMetaFetchHandler({});

    const first = await handler(new Request("https://example.com/first-missing"));
    const second = await handler(new Request("https://example.com/second-missing"));

    expect(first.status).toBe(404);
    expect(second.status).toBe(404);
    await expect(first.text()).resolves.toContain("Not Found");
    await expect(second.text()).resolves.toContain("Not Found");
  });

  it("delegates directly to page handler when no API handler is provided", async () => {
    const handler = createMetaFetchHandler({
      pageHandler: async () => new Response("page-direct"),
    });

    const response = await handler(new Request("https://example.com/page"));

    await expect(response.text()).resolves.toContain("page-direct");
  });

  it("supports RenderServer as the page handler", async () => {
    const registry = new RouteRegistry();
    registry.register(
      defineRoute({
        path: "/registry-page",
        component: () => createElement("main", null, "Rendered through registry"),
        mode: "ssr",
      }),
    );
    const handler = createMetaFetchHandler({ pageHandler: new RenderServer(registry.compile()) });

    const response = await handler(new Request("https://example.com/registry-page"));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("Rendered through registry");
  });

  it("propagates API handler exceptions instead of falling back to page handler", async () => {
    const pageHandler = vi.fn(async () => new Response("should not reach"));
    const handler = createMetaFetchHandler({
      apiHandler: async () => {
        throw new Error("api failed");
      },
      pageHandler,
    });

    await expect(handler(new Request("https://example.com/page"))).rejects.toThrow("api failed");
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it("preserves the original error instance when the API handler throws", async () => {
    const originalError = new Error("boom");
    const handler = createMetaFetchHandler({
      apiHandler: async () => {
        throw originalError;
      },
      pageHandler: async () => new Response("nope"),
    });

    await expect(handler(new Request("https://example.com/page"))).rejects.toBe(originalError);
  });
});

describe("createMetaFetchHandler with apiRoutes", () => {
  const createApiRoutes = (routes: ApiRouteIR[]): readonly ApiRouteIR[] => routes;

  it("dispatches to matching API route handler", async () => {
    const apiRoutes = createApiRoutes([
      {
        path: "/api/hello",
        handler: async () => new Response("Hello from API"),
      },
    ]);

    const handler = createMetaFetchHandler({
      apiRoutes,
      pageHandler: async () => new Response("page"),
    });

    const response = await handler(new Request("https://example.com/api/hello"));

    await expect(response.text()).resolves.toBe("Hello from API");
  });

  it("returns 404 for non-existent /api/* route", async () => {
    const apiRoutes = createApiRoutes([
      {
        path: "/api/exists",
        handler: async () => new Response("exists"),
      },
    ]);

    const pageHandler = vi.fn(async () => new Response("page"));
    const handler = createMetaFetchHandler({ apiRoutes, pageHandler });

    const response = await handler(new Request("https://example.com/api/nonexistent"));

    expect(response.status).toBe(404);
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it("returns fresh API 404 responses for repeated route misses", async () => {
    const apiRoutes = createApiRoutes([
      {
        path: "/api/exists",
        handler: async () => new Response("exists"),
      },
    ]);

    const pageHandler = vi.fn(async () => new Response("page"));
    const handler = createMetaFetchHandler({ apiRoutes, pageHandler });

    const first = await handler(new Request("https://example.com/api/missing-one"));
    const second = await handler(new Request("https://example.com/api/missing-two"));

    expect(first.status).toBe(404);
    expect(second.status).toBe(404);
    await expect(first.json()).resolves.toEqual({ error: "Not Found" });
    await expect(second.json()).resolves.toEqual({ error: "Not Found" });
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it("returns 405 with Allow header for /api/* with wrong method", async () => {
    const apiRoutes = createApiRoutes([
      {
        path: "/api/data",
        method: "POST",
        handler: async () => new Response("created"),
      },
    ]);

    const pageHandler = vi.fn(async () => new Response("page"));
    const handler = createMetaFetchHandler({ apiRoutes, pageHandler });

    const response = await handler(new Request("https://example.com/api/data", { method: "GET" }));

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    await expect(response.json()).resolves.toEqual({ error: "Method Not Allowed" });
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it("returns all allowed methods for an API route path mismatch", async () => {
    const apiRoutes = createApiRoutes([
      {
        path: "/api/data",
        method: "GET",
        handler: async () => new Response("read"),
      },
      {
        path: "/api/data",
        method: "POST",
        handler: async () => new Response("created"),
      },
    ]);

    const pageHandler = vi.fn(async () => new Response("page"));
    const handler = createMetaFetchHandler({ apiRoutes, pageHandler });

    const response = await handler(
      new Request("https://example.com/api/data", { method: "PATCH" }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, POST");
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it("falls through to page handler for non-/api/* routes", async () => {
    const apiRoutes = createApiRoutes([
      {
        path: "/api/hello",
        handler: async () => new Response("api"),
      },
    ]);

    const pageHandler = vi.fn(async () => new Response("page"));
    const handler = createMetaFetchHandler({ apiRoutes, pageHandler });

    const response = await handler(new Request("https://example.com/page"));

    await expect(response.text()).resolves.toBe("page");
    expect(pageHandler).toHaveBeenCalledOnce();
  });

  it("dispatches to GET method-specific route", async () => {
    const apiRoutes = createApiRoutes([
      {
        path: "/api/users",
        method: "GET",
        handler: async () => new Response("user list"),
      },
    ]);

    const handler = createMetaFetchHandler({
      apiRoutes,
      pageHandler: async () => new Response("page"),
    });

    const response = await handler(new Request("https://example.com/api/users", { method: "GET" }));

    await expect(response.text()).resolves.toBe("user list");
  });

  it("returns 404 when apiRoutes is provided but request is /api/*", async () => {
    const apiRoutes = createApiRoutes([]);
    const pageHandler = vi.fn(async () => new Response("page"));
    const handler = createMetaFetchHandler({ apiRoutes, pageHandler });

    const response = await handler(new Request("https://example.com/api/empty"));

    expect(response.status).toBe(404);
    expect(pageHandler).not.toHaveBeenCalled();
  });
});
