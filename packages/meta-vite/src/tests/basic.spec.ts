import { describe, expect, it } from "vitest";

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

  it("should export public types", async () => {
    // Types are compile-time only, but we verify the module resolves
    const mod = await import("../index");
    expect(typeof mod.defineRoute).toBe("function");
    expect(typeof mod.crocoMetaVitePlugin).toBe("function");
    expect(typeof mod.createMetaFetchHandler).toBe("function");
    expect(typeof mod.createMetaViteRouteManifest).toBe("function");
    expect(typeof mod.serializeMetaViteRouteManifest).toBe("function");
    expect(typeof mod.head).toBe("function");
  });

  it("head() returns a function that produces the given metadata", async () => {
    const mod = await import("../index");
    const metadata = { title: "Test", description: "A test page" };
    const fn = mod.head(metadata);
    expect(fn()).toEqual(metadata);
  });
});
