import { describe, expect, it } from "vitest";
import { createCrocoSpaViteConfig as createPublicCrocoSpaViteConfig } from "../index";
import { crocoSpaViteConfig } from "../libs/crocoSpaViteConfig";

describe("crocoSpaViteConfig", () => {
  it("should return plugins array without options", () => {
    const result = crocoSpaViteConfig();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should not include vike-related plugins", () => {
    const plugins = crocoSpaViteConfig();

    const hasVike = plugins.some((p) => p.name === undefined && "_vikeVitePluginOptions" in p);
    expect(hasVike).toBe(false);

    const hasCloudflare = plugins.some((p) => p.name?.includes("cloudflare"));
    expect(hasCloudflare).toBe(false);
  });

  it("should accept custom options", () => {
    const plugins = crocoSpaViteConfig({
      outDir: "build",
      base: "/custom/",
      envPrefix: ["CUSTOM_"],
    });

    expect(Array.isArray(plugins)).toBe(true);
  });

  it("should create SPA vite config shape with defaults and custom options", async () => {
    const { createCrocoSpaViteConfig } = await import("../libs/crocoSpaViteConfig");

    expect(createCrocoSpaViteConfig()).toEqual({
      plugins: [],
      build: {
        outDir: "dist",
      },
      base: "/",
      envPrefix: ["VITE_"],
    });

    expect(
      createCrocoSpaViteConfig({
        outDir: "build",
        base: "/custom/",
        envPrefix: ["CUSTOM_"],
      }),
    ).toEqual({
      plugins: [],
      build: {
        outDir: "build",
      },
      base: "/custom/",
      envPrefix: ["CUSTOM_"],
    });
  });

  it("should expose SPA vite config creator from package entrypoint", () => {
    expect(createPublicCrocoSpaViteConfig({ outDir: "public-build" }).build.outDir).toBe(
      "public-build",
    );
  });
});
