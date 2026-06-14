import { afterEach, describe, expect, it, vi } from "vitest";
import type { Plugin, PluginOption } from "vite";
import { crocoVitePlugin } from "../libs/crocoVitePlugin";

describe("crocoVitePlugin", () => {
  afterEach(() => {
    vi.doUnmock("@cloudflare/vite-plugin");
    vi.resetModules();
  });

  it("should return plugins array with cloudflare by default", async () => {
    const plugins = await resolvePluginOptions(crocoVitePlugin());

    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBeGreaterThan(0);

    const hasCloudflare = plugins.some((p) => p.name?.includes("cloudflare"));
    expect(hasCloudflare).toBe(true);
  });

  it("should exclude cloudflare plugin when cloudflare: false", () => {
    const plugins = crocoVitePlugin({ cloudflare: false });

    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins).toEqual([]);
  });

  it("should have no viteEnvironment option when ssr: false", async () => {
    const plugins = await resolvePluginOptions(crocoVitePlugin({ ssr: false }));

    expect(Array.isArray(plugins)).toBe(true);

    const cloudflarePlugins = plugins.filter((p) => p.name?.includes("cloudflare"));
    expect(cloudflarePlugins.length).toBeGreaterThan(0);
  });

  it("should preserve nested module resolution errors from the cloudflare plugin", async () => {
    vi.doMock("@cloudflare/vite-plugin", () => ({
      cloudflare: () => {
        throw Object.assign(
          new Error(
            "Cannot find package 'cloudflare-plugin-transitive-missing' imported from /consumer/node_modules/@cloudflare/vite-plugin/dist/index.mjs",
          ),
          { code: "ERR_MODULE_NOT_FOUND" },
        );
      },
    }));

    await expect(Promise.all(crocoVitePlugin())).rejects.toMatchObject({
      code: "ERR_MODULE_NOT_FOUND",
      message:
        "Cannot find package 'cloudflare-plugin-transitive-missing' imported from /consumer/node_modules/@cloudflare/vite-plugin/dist/index.mjs",
    });
  });
});

async function resolvePluginOptions(pluginOptions: PluginOption[]): Promise<Plugin[]> {
  const resolvedPlugins: Plugin[] = [];

  for (const pluginOption of pluginOptions) {
    collectPlugins(await pluginOption, resolvedPlugins);
  }

  return resolvedPlugins;
}

function collectPlugins(pluginOption: Awaited<PluginOption>, plugins: Plugin[]): void {
  if (!pluginOption) {
    return;
  }

  if (Array.isArray(pluginOption)) {
    for (const nestedPluginOption of pluginOption) {
      collectPlugins(nestedPluginOption as Awaited<PluginOption>, plugins);
    }
    return;
  }

  plugins.push(pluginOption);
}
