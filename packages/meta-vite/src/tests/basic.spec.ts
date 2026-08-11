import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  CrocoFetchHandler,
  HeadMetadata,
  PageRouteDefinition,
  RuntimeContext,
} from "../index";

describe("@croco/meta-vite", () => {
  it("should export expected public API symbols", async () => {
    const mod = await import("../index");
    expect(mod.defineRoute).toBeDefined();
    expect(mod.crocoMetaVitePlugin).toBeDefined();
    expect(mod.createCloudflareHandler).toBeDefined();
    expect(mod.createLambdaHandler).toBeDefined();
    expect(mod.createNodeHandler).toBeDefined();
    expect(mod.createIsrHandler).toBeDefined();
    expect(mod.createIsrMiddleware).toBeDefined();
    expect(mod.createMetaFetchHandler).toBeDefined();
    expect(mod.createMetaViteRouteManifest).toBeDefined();
    expect(mod.createMetaViteRouteManifestFromRegistry).toBeDefined();
    expect(mod.MetaViteRouteManifestError).toBeDefined();
    expect(mod.META_VITE_ROUTE_MANIFEST_COMPONENT_REF_REQUIRED).toBe(
      "CROCO_META_VITE_ROUTE_MANIFEST_COMPONENT_REF_REQUIRED",
    );
    expect(mod.serializeMetaViteRouteManifest).toBeDefined();
    expect(mod.writeMetaViteRouteManifest).toBeDefined();
    expect(mod.head).toBeDefined();
  });

  it("should export the fetch handler type contract", () => {
    expectTypeOf<CrocoFetchHandler>().parameters.toEqualTypeOf<
      [request: Request, context?: RuntimeContext]
    >();
    expectTypeOf<CrocoFetchHandler>().returns.toEqualTypeOf<Promise<Response>>();
  });

  it("should export the page route metadata type contract", () => {
    expectTypeOf<PageRouteDefinition["mode"]>().toEqualTypeOf<
      "ssr" | "ssg" | "isr" | "rsc" | undefined
    >();
    expectTypeOf<PageRouteDefinition["head"]>().toEqualTypeOf<(() => HeadMetadata) | undefined>();
  });

  it("head() returns a function that produces the given metadata", async () => {
    const mod = await import("../index");
    const metadata = { title: "Test", description: "A test page" };
    const fn = mod.head(metadata);
    expect(fn()).toEqual(metadata);
  });
});
