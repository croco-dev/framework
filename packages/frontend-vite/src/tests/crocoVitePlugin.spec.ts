import { ProblemCategory } from "@croco/problems-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Plugin, PluginOption } from "vite";
import { crocoVitePlugin } from "../libs/crocoVitePlugin";
import { MissingCloudflareVitePluginProblem } from "../libs/problems/MissingCloudflareVitePluginProblem";

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

  it("should expose the missing cloudflare plugin diagnostic as a Problem", () => {
    const cause = Object.assign(
      new Error(
        "Cannot find package '@cloudflare/vite-plugin' imported from /consumer/app/vite.config.mjs",
      ),
      { code: "ERR_MODULE_NOT_FOUND" },
    );
    const problem = new MissingCloudflareVitePluginProblem(cause);

    expect(problem).toBeInstanceOf(Error);
    expect(problem).toBeInstanceOf(MissingCloudflareVitePluginProblem);
    expect(problem).toMatchObject({
      category: ProblemCategory.ValidationError,
      code: "frontend-vite/missing-cloudflare-vite-plugin",
      message:
        'crocoVitePlugin() requires optional peer dependency "@cloudflare/vite-plugin" when Cloudflare support is enabled. Install "@cloudflare/vite-plugin" or call crocoVitePlugin({ cloudflare: false }).',
    });
    expect(problem.cause).toBe(cause);
  });

  it("should preserve nested module resolution errors from the cloudflare plugin", async () => {
    vi.resetModules();
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
    await collectPlugins(await pluginOption, resolvedPlugins);
  }

  return resolvedPlugins;
}

async function collectPlugins(
  pluginOption: Awaited<PluginOption>,
  plugins: Plugin[],
): Promise<void> {
  if (!pluginOption) {
    return;
  }

  if (Array.isArray(pluginOption)) {
    for (const nestedPluginOption of pluginOption) {
      await collectPlugins(await nestedPluginOption, plugins);
    }
    return;
  }

  plugins.push(pluginOption);
}
