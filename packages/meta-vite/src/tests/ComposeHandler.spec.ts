import { describe, expect, it, vi } from "vitest";
import { createMetaFetchHandler } from "../libs/render/composeHandler";
import type { ApiRouteIR } from "../libs/routes/types";

describe("createMetaFetchHandler route specificity", () => {
  const createApiRoutes = (routes: ApiRouteIR[]): readonly ApiRouteIR[] => routes;

  it("dispatches to the most specific API route regardless of registration order", async () => {
    const usersRoute: ApiRouteIR = {
      path: "/api/users",
      handler: async () => new Response("user list"),
    };
    const exportRoute: ApiRouteIR = {
      path: "/api/users/export",
      handler: async () => new Response("user export"),
    };

    for (const apiRoutes of [
      createApiRoutes([usersRoute, exportRoute]),
      createApiRoutes([exportRoute, usersRoute]),
    ]) {
      const handler = createMetaFetchHandler({ apiRoutes });

      const response = await handler(new Request("https://example.com/api/users/export"));

      await expect(response.text()).resolves.toBe("user export");
    }
  });

  it("returns 405 for the most specific route instead of dispatching a matching parent method", async () => {
    const parentHandler = vi.fn(async () => new Response("user list"));
    const apiRoutes = createApiRoutes([
      {
        path: "/api/users",
        method: "GET",
        handler: parentHandler,
      },
      {
        path: "/api/users/export",
        method: "POST",
        handler: async () => new Response("user export"),
      },
    ]);
    const handler = createMetaFetchHandler({ apiRoutes });

    const response = await handler(
      new Request("https://example.com/api/users/export", { method: "GET" }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    await expect(response.json()).resolves.toEqual({ error: "Method Not Allowed" });
    expect(parentHandler).not.toHaveBeenCalled();
  });
});
