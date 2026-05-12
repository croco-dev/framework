import type { ConfigEnv, EnvironmentOptions, Plugin, UserConfig } from "vite";
import { describe, expect, it } from "vitest";
import { crocoMetaVitePlugin } from "../libs/vite/crocoMetaVitePlugin";

type HookContext = {
  readonly environment: {
    readonly name: string;
  };
};

type PluginResolveIdHook = NonNullable<Plugin["resolveId"]>;
type PluginLoadHook = NonNullable<Plugin["load"]>;

describe("crocoMetaVitePlugin environments", () => {
  it("should configure client, ssr, and rsc environments", () => {
    const plugin = getPlugin();
    const config = callConfig(plugin);

    expect(config).toBeDefined();
    expect(config?.environments).toEqual({
      client: { consumer: "client" },
      ssr: { consumer: "server" },
      rsc: { consumer: "server" },
    });
  });

  it("should preserve the ssr environment name exactly", () => {
    const plugin = getPlugin();
    const config = callConfig(plugin);
    const ssrEnvironmentName = Object.keys(config?.environments ?? {}).find(
      (name) => name === "ssr",
    );

    expect(ssrEnvironmentName).toBe("ssr");
    expect(callConfigEnvironment(plugin, "ssr")).toEqual({ consumer: "server" });
  });

  it("should resolve virtual module IDs separately per environment", () => {
    const plugin = getPlugin();

    const clientId = callResolveId(plugin, "client", "virtual:croco/routes");
    const rscId = callResolveId(plugin, "rsc", "virtual:croco/routes");
    const ssrId = callResolveId(plugin, "ssr", "virtual:croco/routes");

    expect(clientId).toBe("virtual:croco/client-routes");
    expect(rscId).toBe("virtual:croco/rsc-routes");
    expect(ssrId).toBe("virtual:croco/ssr-routes");
    expect(clientId).not.toBe(rscId);
  });

  it("should keep environment-specific virtual modules from colliding", () => {
    const plugin = getPlugin();

    const clientRoutes = callLoad(plugin, "client", "virtual:croco/client-routes");
    const rscRoutes = callLoad(plugin, "rsc", "virtual:croco/rsc-routes");
    const crossEnvironmentLoad = callLoad(plugin, "client", "virtual:croco/rsc-routes");

    expect(clientRoutes).toContain('environment = "client"');
    expect(clientRoutes).toContain('moduleId = "virtual:croco/client-routes"');
    expect(rscRoutes).toContain('environment = "rsc"');
    expect(rscRoutes).toContain('moduleId = "virtual:croco/rsc-routes"');
    expect(clientRoutes).not.toBe(rscRoutes);
    expect(crossEnvironmentLoad).toBeNull();
  });
});

function getPlugin(): Plugin {
  return crocoMetaVitePlugin()[0];
}

function callConfig(plugin: Plugin): UserConfig | undefined {
  const hook = plugin.config;
  if (!hook) {
    return undefined;
  }

  const context = {} as never;
  if (typeof hook === "object") {
    return hook.handler.call(context, {}, createConfigEnv()) as UserConfig;
  }

  return hook.call(context, {}, createConfigEnv()) as UserConfig;
}

function callConfigEnvironment(
  plugin: Plugin,
  environmentName: string,
): EnvironmentOptions | null | undefined {
  const hook = plugin.configEnvironment;
  if (!hook) {
    return undefined;
  }

  const context = {} as never;
  if (typeof hook === "object") {
    return hook.handler.call(
      context,
      environmentName,
      {},
      createConfigEnv(),
    ) as EnvironmentOptions | null;
  }

  return hook.call(context, environmentName, {}, createConfigEnv()) as EnvironmentOptions | null;
}

function callResolveId(plugin: Plugin, environmentName: string, id: string): unknown {
  const hook = plugin.resolveId as PluginResolveIdHook | undefined;
  if (typeof hook === "object") {
    return hook.handler.call(createHookContext(environmentName) as never, id, undefined, {
      attributes: {},
      isEntry: false,
    });
  }

  return hook?.call(createHookContext(environmentName) as never, id, undefined, {
    attributes: {},
    isEntry: false,
  });
}

function callLoad(plugin: Plugin, environmentName: string, id: string): unknown {
  const hook = plugin.load as PluginLoadHook | undefined;
  if (typeof hook === "object") {
    return hook.handler.call(createHookContext(environmentName) as never, id);
  }

  return hook?.call(createHookContext(environmentName) as never, id);
}

function createHookContext(environmentName: string): HookContext {
  return { environment: { name: environmentName } };
}

function createConfigEnv(): ConfigEnv {
  return { command: "build", mode: "test" };
}
