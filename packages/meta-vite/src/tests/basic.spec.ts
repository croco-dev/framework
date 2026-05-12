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
    expect(mod.head).toBeDefined();
  });

  it("should export public types", async () => {
    // Types are compile-time only, but we verify the module resolves
    const mod = await import("../index");
    expect(typeof mod.defineRoute).toBe("function");
    expect(typeof mod.crocoMetaVitePlugin).toBe("function");
    expect(typeof mod.createMetaFetchHandler).toBe("function");
    expect(typeof mod.head).toBe("function");
  });

  it("head() returns a function that produces the given metadata", async () => {
    const mod = await import("../index");
    const metadata = { title: "Test", description: "A test page" };
    const fn = mod.head(metadata);
    expect(fn()).toEqual(metadata);
  });
});
