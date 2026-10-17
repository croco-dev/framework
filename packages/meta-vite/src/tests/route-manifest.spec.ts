import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  createMetaViteRouteManifest,
  createMetaViteRouteManifestFromRegistry,
  MetaViteRouteManifestError,
  MetaViteUnsupportedCapabilityProblem,
  serializeMetaViteRouteManifest,
  writeMetaViteRouteManifest,
} from "../libs/build/routeManifest";
import { createServerAction, createServerActionRegistry } from "../libs/actions/serverActions";
import { defineApiRoute } from "../libs/routes/defineApiRoute";
import { defineRoute } from "../libs/routes/defineRoute";
import { RouteRegistry } from "../libs/routes/routeRegistry";
import type { PageRouteIR, RenderRouteComponentProps } from "../libs/routes/types";

function Page({ request }: RenderRouteComponentProps) {
  return createElement("main", null, request.url);
}

describe("rsc route capabilities (real Flight)", () => {
  const pages = [{ path: "/rsc", mode: "rsc" as const, componentRef: "src/Page.rsc.tsx#Page" }];

  it("preserves requested mode while reporting the Flight implementation", () => {
    const [page] = createMetaViteRouteManifest({ pages }).pages;
    expect(page?.mode).toBe("rsc");
    expect(page?.runtimeCapabilities).toEqual(["fetch", "react-server-components"]);
    expect(page?.runtimeRequirements).toEqual([
      {
        code: "CROCO_META_VITE_RSC_RUNTIME_REQUIRED",
        capability: "react-server-components",
        phase: "runtime",
      },
    ]);
  });
  it("rejects profiles requiring streaming-response before certifying their manifest", () => {
    expect(() =>
      createMetaViteRouteManifest({ pages, requiredCapabilities: ["streaming-response"] }),
    ).toThrow(MetaViteUnsupportedCapabilityProblem);
    try {
      createMetaViteRouteManifest({ pages, requiredCapabilities: ["streaming-response"] });
    } catch (error) {
      expect(error).toMatchObject({
        code: "meta-vite/unsupported-render-capability",
        status: 501,
        extensions: { path: "/rsc", capability: "streaming-response" },
      });
    }
  });

  it("accepts Flight requirements and enforces registry profile requirements", () => {
    expect(
      createMetaViteRouteManifest({
        pages,
        requiredCapabilities: ["fetch", "react-server-components"],
      }).pages,
    ).toHaveLength(1);
  });
});

describe("createMetaViteRouteManifestFromRegistry", () => {
  it.each([NaN, Infinity, -Infinity, -1])(
    "rejects invalid milliseconds %s in direct manifest input with a route diagnostic",
    (revalidateMs) => {
      expect(() =>
        createMetaViteRouteManifest({
          pages: [
            { path: "/invalid-ttl", mode: "isr", componentRef: "src/Page.tsx#Page", revalidateMs },
          ],
        }),
      ).toThrowError(
        expect.objectContaining({
          code: "CROCO_META_VITE_ROUTE_REVALIDATE_INVALID",
          path: "/invalid-ttl",
        }),
      );
    },
  );

  it("rejects an unsupported mode in direct manifest input with a route diagnostic", () => {
    expect(() =>
      createMetaViteRouteManifest({
        pages: [
          {
            path: "/invalid-mode",
            mode: "invalid",
            componentRef: "src/Page.tsx#Page",
          } as unknown as PageRouteIR,
        ],
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "CROCO_META_VITE_ROUTE_MODE_UNSUPPORTED",
        path: "/invalid-mode",
      }),
    );
  });

  it.each(["/webhooks/stripe", "/healthz", "/apix", "/apiary", "/API/foo", "/", ""])(
    "rejects API route outside the /api namespace: %j",
    (path) => {
      const create = () =>
        createMetaViteRouteManifest({
          pages: [],
          apiRoutes: [{ path, method: "POST", handler: vi.fn() }],
        });

      expect(create).toThrow(
        expect.objectContaining({
          code: "CROCO_META_VITE_API_ROUTE_PREFIX_REQUIRED",
          path,
          method: "POST",
        }),
      );
      expect(create).toThrow("POST");
    },
  );

  it.each(["/api", "/api/", "/api/users"])(
    "includes API namespace path %s in the manifest",
    (path) => {
      const manifest = createMetaViteRouteManifest({
        pages: [],
        apiRoutes: [{ path, handler: vi.fn() }],
      });

      expect(manifest.apiRoutes).toEqual([
        {
          kind: "api",
          order: 0,
          path,
          method: "GET",
          runtimeCapabilities: ["fetch", "api-dispatch"],
        },
      ]);
    },
  );

  it("emits a deterministic route manifest for pages, API routes, and server actions", () => {
    const routeRegistry = new RouteRegistry();
    routeRegistry.register(
      defineRoute({
        path: "/dashboard",
        componentRef: "src/pages/Dashboard.tsx#DashboardPage",
        component: Page,
        mode: "ssr",
      }),
    );
    routeRegistry.register(
      defineRoute({
        path: "/about",
        componentRef: "src/pages/About.tsx#AboutPage",
        component: Page,
        mode: "ssg",
      }),
    );
    routeRegistry.register(
      defineRoute({
        path: "/blog",
        componentRef: "src/pages/Blog.tsx#BlogPage",
        component: Page,
        mode: "isr",
        revalidate: 60,
      }),
    );
    routeRegistry.register(
      defineRoute({
        path: "/feed",
        componentRef: "src/pages/Feed.server.tsx#FeedPage",
        component: Page,
        mode: "rsc",
      }),
    );
    routeRegistry.registerApiRoute(
      defineApiRoute({ path: "/api/users", method: "GET", handler: vi.fn() }),
    );
    routeRegistry.registerApiRoute(
      defineApiRoute({ path: "/api/users", method: "POST", handler: vi.fn() }),
    );

    const serverActionRegistry = createServerActionRegistry();
    createServerAction(
      {
        name: "signup",
        schema: z.object({ email: z.string().email() }),
        output: { description: "Signup result", schema: z.object({ ok: z.boolean() }) },
        problems: [
          {
            code: "auth/signup-closed",
            status: 422,
            description: "Signup is disabled",
            type: "https://example.com/problems/signup-closed",
          },
        ],
        invalidates: [
          {
            kind: "query-key-prefix",
            target: "session",
            reason: "signup accepted",
          },
        ],
        handler: async () => ({ ok: true, data: { ok: true } }),
      },
      serverActionRegistry,
    );

    const manifest = createMetaViteRouteManifestFromRegistry({
      routeRegistry,
      serverActionRegistry,
    });
    const serialized = serializeMetaViteRouteManifest(manifest);

    expect(serialized).toBe(serializeMetaViteRouteManifest(manifest));
    expect(serialized).toMatchInlineSnapshot(`
      "{
        "schemaVersion": "croco.meta-vite.route-manifest.v1",
        "pages": [
          {
            "kind": "page",
            "order": 0,
            "path": "/about",
            "mode": "ssg",
            "componentRef": "src/pages/About.tsx#AboutPage",
            "runtimeCapabilities": [
              "static-prerender",
              "react-ssr"
            ],
            "runtimeRequirements": [
              {
                "code": "CROCO_META_VITE_STATIC_PRERENDER_REQUIRED",
                "capability": "static-prerender",
                "phase": "build"
              }
            ]
          },
          {
            "kind": "page",
            "order": 1,
            "path": "/blog",
            "mode": "isr",
            "componentRef": "src/pages/Blog.tsx#BlogPage",
            "runtimeCapabilities": [
              "fetch",
              "react-ssr",
              "isr-cache"
            ],
            "runtimeRequirements": [
              {
                "code": "CROCO_META_VITE_ISR_CACHE_REQUIRED",
                "capability": "isr-cache",
                "phase": "runtime",
                "revalidateMs": 60000
              }
            ],
            "revalidateMs": 60000
          },
          {
            "kind": "page",
            "order": 2,
            "path": "/dashboard",
            "mode": "ssr",
            "componentRef": "src/pages/Dashboard.tsx#DashboardPage",
            "runtimeCapabilities": [
              "fetch",
              "react-ssr"
            ],
            "runtimeRequirements": []
          },
          {
            "kind": "page",
            "order": 3,
            "path": "/feed",
            "mode": "rsc",
            "componentRef": "src/pages/Feed.server.tsx#FeedPage",
            "runtimeCapabilities": [
              "fetch",
              "react-server-components"
            ],
            "runtimeRequirements": [
              {
                "code": "CROCO_META_VITE_RSC_RUNTIME_REQUIRED",
                "capability": "react-server-components",
                "phase": "runtime"
              }
            ]
          }
        ],
        "apiRoutes": [
          {
            "kind": "api",
            "order": 0,
            "path": "/api/users",
            "method": "GET",
            "runtimeCapabilities": [
              "fetch",
              "api-dispatch"
            ]
          },
          {
            "kind": "api",
            "order": 1,
            "path": "/api/users",
            "method": "POST",
            "runtimeCapabilities": [
              "fetch",
              "api-dispatch"
            ]
          }
        ],
        "serverActions": [
          {
            "kind": "server-action",
            "order": 0,
            "name": "signup",
            "path": "/api/action/signup",
            "method": "POST",
            "input": {
              "schema": "declared"
            },
            "output": {
              "schema": "declared",
              "description": "Signup result"
            },
            "problems": [
              {
                "code": "auth/signup-closed",
                "status": 422,
                "description": "Signup is disabled",
                "type": "https://example.com/problems/signup-closed"
              }
            ],
            "invalidates": [
              {
                "kind": "query-key-prefix",
                "target": "session",
                "reason": "signup accepted"
              }
            ],
            "runtimeCapabilities": [
              "fetch",
              "server-action-dispatch",
              "form-data"
            ]
          }
        ]
      }
      "
    `);
  });

  it("normalizes older server action contracts without invalidation metadata", () => {
    const manifest = createMetaViteRouteManifest({
      pages: [],
      serverActions: [
        {
          name: "refresh-session",
          path: "/api/action/refresh-session",
          method: "POST",
          input: { schema: "none" },
          output: { schema: "none" },
          problems: [],
        },
      ],
    });

    expect(manifest.serverActions[0]?.invalidates).toEqual([]);
  });

  it("reports streaming-response only for shell-first SSR pages with regions", () => {
    const registry = new RouteRegistry();
    registry.register(
      defineRoute({
        path: "/pdp",
        mode: "ssr",
        componentRef: "src/pages/Pdp.tsx#PdpPage",
        component: Page,
        regions: [{ id: "reviews", loader: async () => "ok" }],
      }),
    );
    registry.register(
      defineRoute({
        path: "/plain",
        mode: "ssr",
        componentRef: "src/pages/Plain.tsx#PlainPage",
        component: Page,
      }),
    );

    const manifest = createMetaViteRouteManifestFromRegistry({ routeRegistry: registry });
    const pdp = manifest.pages.find((page) => page.path === "/pdp");
    const plain = manifest.pages.find((page) => page.path === "/plain");

    expect(pdp?.runtimeCapabilities).toEqual(["fetch", "react-ssr", "streaming-response"]);
    expect(plain?.runtimeCapabilities).toEqual(["fetch", "react-ssr"]);
    expect(() =>
      createMetaViteRouteManifestFromRegistry({
        routeRegistry: registry,
        requiredCapabilities: ["streaming-response"],
      }),
    ).toThrow(MetaViteUnsupportedCapabilityProblem);
  });

  it("canonicalizes equivalent route sets regardless of registration order", () => {
    const firstRegistry = new RouteRegistry();
    firstRegistry.register(
      defineRoute({ path: "/b", componentRef: "src/pages/B.tsx#B", component: Page }),
    );
    firstRegistry.register(
      defineRoute({ path: "/a", componentRef: "src/pages/A.tsx#A", component: Page }),
    );
    firstRegistry.registerApiRoute(
      defineApiRoute({ path: "/api/z", method: "POST", handler: vi.fn() }),
    );
    firstRegistry.registerApiRoute(
      defineApiRoute({ path: "/api/a", method: "GET", handler: vi.fn() }),
    );

    const secondRegistry = new RouteRegistry();
    secondRegistry.register(
      defineRoute({ path: "/a", componentRef: "src/pages/A.tsx#A", component: Page }),
    );
    secondRegistry.register(
      defineRoute({ path: "/b", componentRef: "src/pages/B.tsx#B", component: Page }),
    );
    secondRegistry.registerApiRoute(
      defineApiRoute({ path: "/api/a", method: "GET", handler: vi.fn() }),
    );
    secondRegistry.registerApiRoute(
      defineApiRoute({ path: "/api/z", method: "POST", handler: vi.fn() }),
    );

    const firstActions = createServerActionRegistry();
    createServerAction(
      {
        name: "zeta",
        handler: async () => ({ ok: true, data: {} }),
      },
      firstActions,
    );
    createServerAction(
      {
        name: "alpha",
        handler: async () => ({ ok: true, data: {} }),
      },
      firstActions,
    );

    const secondActions = createServerActionRegistry();
    createServerAction(
      {
        name: "alpha",
        handler: async () => ({ ok: true, data: {} }),
      },
      secondActions,
    );
    createServerAction(
      {
        name: "zeta",
        handler: async () => ({ ok: true, data: {} }),
      },
      secondActions,
    );

    expect(
      serializeMetaViteRouteManifest(
        createMetaViteRouteManifestFromRegistry({
          routeRegistry: firstRegistry,
          serverActionRegistry: firstActions,
        }),
      ),
    ).toBe(
      serializeMetaViteRouteManifest(
        createMetaViteRouteManifestFromRegistry({
          routeRegistry: secondRegistry,
          serverActionRegistry: secondActions,
        }),
      ),
    );
  });

  it("rejects page routes without explicit component references", () => {
    const routeRegistry = new RouteRegistry();
    routeRegistry.register(defineRoute({ path: "/", component: Page }));

    expect(() => createMetaViteRouteManifestFromRegistry({ routeRegistry })).toThrow(
      MetaViteRouteManifestError,
    );

    try {
      createMetaViteRouteManifestFromRegistry({ routeRegistry });
    } catch (error) {
      expect(error).toMatchObject({
        code: "CROCO_META_VITE_ROUTE_MANIFEST_COMPONENT_REF_REQUIRED",
      });
    }
  });

  it("writes the route manifest as byte-stable JSON", async () => {
    const routeRegistry = new RouteRegistry();
    routeRegistry.register(
      defineRoute({
        path: "/",
        componentRef: "src/pages/Home.tsx#HomePage",
        component: Page,
      }),
    );

    const manifest = createMetaViteRouteManifestFromRegistry({ routeRegistry });
    const directory = await mkdtemp(join(tmpdir(), "croco-meta-route-manifest-"));
    const outputPath = join(directory, "dist", "route-manifest.json");

    try {
      await writeMetaViteRouteManifest(manifest, outputPath);

      await expect(readFile(outputPath, "utf-8")).resolves.toBe(
        serializeMetaViteRouteManifest(manifest),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
