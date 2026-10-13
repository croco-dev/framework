import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  createServerActionHandler,
  createServerActionRegistry,
} from "../libs/actions/serverActions";
import { createMetaViteFrontendActionManifestFromRegistry } from "../libs/build/frontendActionManifest";
import { createMetaViteRouteManifestFromRegistry } from "../libs/build/routeManifest";
import { createMetaFetchHandler } from "../libs/render/composeHandler";
import { RenderServer } from "../libs/render/renderServer";
import { RouteConflictError, RouteRegistry } from "../libs/routes/routeRegistry";

describe("Unicode route dispatch", () => {
  it.each(["/소개", "/docs/소개", "/about", "/%EC%86%8C%EA%B0%9C", "/literal%2Fsegment"])(
    "renders registered page %s through its URL",
    async (path) => {
      const registry = new RouteRegistry();
      registry.register({
        path,
        componentRef: "src/Page.tsx#Page",
        component: () => createElement("main", null, "Registered page"),
      });
      const manifest = createMetaViteRouteManifestFromRegistry({ routeRegistry: registry });
      expect(manifest.pages[0]?.path).toBe(path);
      const server = new RenderServer(registry.compile());
      const response = await server.handle(
        new Request(`https://example.test${manifest.pages[0]?.path}?view=full`),
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("<main>Registered page</main>");
      expect((await server.handle(new Request("https://example.test/missing"))).status).toBe(404);
    },
  );

  it.each(["/소개", "/about"])("rejects duplicate page %s", (path) => {
    const registry = new RouteRegistry();
    const definition = { path, component: () => createElement("main", null, "Page") };
    registry.register(definition);
    expect(() => registry.register(definition)).toThrow(RouteConflictError);
  });

  it("rejects the encoded spelling of an already registered Unicode page", () => {
    const registry = new RouteRegistry();
    const component = () => createElement("main", null, "Page");
    registry.register({ path: "/소개", component });
    expect(() => registry.register({ path: "/%EC%86%8C%EA%B0%9C", component })).toThrow(
      RouteConflictError,
    );
  });

  it.each(["저장", "save", "literal%EC%86%8C", "save/item"])(
    "dispatches action %s through its manifest URL exactly once",
    async (name) => {
      const registry = createServerActionRegistry();
      registry.register({ name, handler: (data) => ({ ok: true, data }) });
      const manifest = createMetaViteFrontendActionManifestFromRegistry({
        serverActionRegistry: registry,
      });
      const action = manifest.actions[0];
      expect(action).toBeDefined();
      if (name === "저장") {
        expect(action?.path).toBe("/api/action/%EC%A0%80%EC%9E%A5");
      }
      const handler = createMetaFetchHandler({ apiRoutes: [createServerActionHandler(registry)] });
      const form = new FormData();
      form.set("message", "saved value");
      const response = await handler(
        new Request(`https://example.test${action?.path}`, { method: "POST", body: form }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, data: { message: "saved value" } });
      expect(() =>
        registry.register({ name, handler: () => ({ ok: true, data: null }) }),
      ).toThrow();
    },
  );

  it.each(["%", "%E0%A4", "%ZZ"])(
    "returns the existing invalid-path problem for malformed escape %s",
    async (segment) => {
      const registry = createServerActionRegistry();
      const response = await createServerActionHandler(registry).handler(
        new Request(`https://example.test/api/action/${segment}`, {
          method: "POST",
          body: new FormData(),
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ kind: "invalid_path" });
    },
  );
});
