import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { defineApiRoute } from "../libs/routes/defineApiRoute";
import { defineRoute } from "../libs/routes/defineRoute";
import { head } from "../libs/routes/head";
import { RouteConflictError, RouteRegistry } from "../libs/routes/routeRegistry";
import type { RenderRouteComponentProps } from "../libs/routes/types";

function Page({ request }: RenderRouteComponentProps) {
  return createElement("main", null, request.url);
}

describe("RouteRegistry", () => {
  it("compiles an SSR route", async () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: "/dashboard", component: Page, mode: "ssr" }));

    const routes = registry.compile();

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ path: "/dashboard", mode: "ssr" });
    await expect(routes[0]?.componentLoader()).resolves.toEqual({ default: Page });
  });

  it("compiles an SSG route", () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: "/about", component: Page, mode: "ssg" }));

    const routes = registry.compile();

    expect(routes[0]).toMatchObject({ path: "/about", mode: "ssg" });
  });

  it("compiles an ISR route with revalidation in milliseconds", () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: "/blog", component: Page, mode: "isr", revalidate: 60 }));

    const routes = registry.compile();

    expect(routes[0]).toMatchObject({ path: "/blog", mode: "isr", revalidateMs: 60_000 });
  });

  it("compiles an RSC route", () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: "/feed", component: Page, mode: "rsc" }));

    const routes = registry.compile();

    expect(routes[0]).toMatchObject({ path: "/feed", mode: "rsc" });
  });

  it("keeps registered route order", () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: "/first", component: Page, mode: "ssr" }));
    registry.register(defineRoute({ path: "/second", component: Page, mode: "ssg" }));
    registry.register(defineRoute({ path: "/third", component: Page, mode: "rsc" }));

    const routes = registry.compile();

    expect(routes.map((route) => route.path)).toEqual(["/first", "/second", "/third"]);
  });

  it("throws RouteConflictError for duplicate page paths", () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: "/dashboard", component: Page, mode: "ssr" }));

    expect(() =>
      registry.register(defineRoute({ path: "/dashboard", component: Page, mode: "ssg" })),
    ).toThrow(RouteConflictError);
  });

  it("loads components typed with RenderRouteComponentProps", async () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: "/typed", component: Page }));

    const [route] = registry.compile();
    const module = await route.componentLoader();
    const element = createElement(module.default, {
      request: new Request("https://example.com/typed"),
    });

    expect(element.type).toBe(Page);
  });
});

describe("ApiRoute registration", () => {
  it("registers a GET route by default", () => {
    const registry = new RouteRegistry();
    const handler = vi.fn<() => Promise<Response>>();
    registry.registerApiRoute(defineApiRoute({ path: "/api/users", handler }));

    const routes = registry.getApiRoutes();

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ path: "/api/users", method: "GET", handler });
  });

  it("registers a route with explicit method", () => {
    const registry = new RouteRegistry();
    const handler = vi.fn<() => Promise<Response>>();
    registry.registerApiRoute(defineApiRoute({ path: "/api/users", method: "POST", handler }));

    const routes = registry.getApiRoutes();

    expect(routes[0]).toMatchObject({ path: "/api/users", method: "POST" });
  });

  it("throws RouteConflictError for duplicate path+method", () => {
    const registry = new RouteRegistry();
    const handler = vi.fn<() => Promise<Response>>();
    registry.registerApiRoute(defineApiRoute({ path: "/api/users", handler }));

    expect(() =>
      registry.registerApiRoute(defineApiRoute({ path: "/api/users", handler })),
    ).toThrow(RouteConflictError);
  });

  it("allows same path with different methods", () => {
    const registry = new RouteRegistry();
    const getHandler = vi.fn<() => Promise<Response>>();
    const postHandler = vi.fn<() => Promise<Response>>();
    registry.registerApiRoute(
      defineApiRoute({ path: "/api/users", method: "GET", handler: getHandler }),
    );
    registry.registerApiRoute(
      defineApiRoute({ path: "/api/users", method: "POST", handler: postHandler }),
    );

    const routes = registry.getApiRoutes();

    expect(routes).toHaveLength(2);
    expect(routes.map((r) => r.method)).toEqual(["GET", "POST"]);
  });

  it("allows same method with different paths", () => {
    const registry = new RouteRegistry();
    const handler1 = vi.fn<() => Promise<Response>>();
    const handler2 = vi.fn<() => Promise<Response>>();
    registry.registerApiRoute(
      defineApiRoute({ path: "/api/users", method: "GET", handler: handler1 }),
    );
    registry.registerApiRoute(
      defineApiRoute({ path: "/api/posts", method: "GET", handler: handler2 }),
    );

    const routes = registry.getApiRoutes();

    expect(routes).toHaveLength(2);
    expect(routes.map((r) => r.path)).toEqual(["/api/users", "/api/posts"]);
  });

  it("keeps registered API route order", () => {
    const registry = new RouteRegistry();
    const handler = vi.fn<() => Promise<Response>>();
    registry.registerApiRoute(defineApiRoute({ path: "/api/first", method: "GET", handler }));
    registry.registerApiRoute(defineApiRoute({ path: "/api/second", method: "POST", handler }));
    registry.registerApiRoute(defineApiRoute({ path: "/api/third", method: "DELETE", handler }));

    const routes = registry.getApiRoutes();

    expect(routes.map((r) => r.path)).toEqual(["/api/first", "/api/second", "/api/third"]);
  });

  it("API routes are independent from page routes", () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: "/page", component: Page }));
    registry.registerApiRoute(defineApiRoute({ path: "/api/test", handler: vi.fn() }));

    const pageRoutes = registry.compile();
    const apiRoutes = registry.getApiRoutes();

    expect(pageRoutes).toHaveLength(1);
    expect(pageRoutes[0]).toMatchObject({ path: "/page" });
    expect(apiRoutes).toHaveLength(1);
    expect(apiRoutes[0]).toMatchObject({ path: "/api/test" });
  });
});
