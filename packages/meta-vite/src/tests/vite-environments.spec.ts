import type { ConfigEnv, EnvironmentOptions, Plugin, UserConfig } from "vite";
import { describe, expect, it } from "vitest";
import { composeRscClientManifestVersion, RSC_CLIENT_BUILD_FILE } from "../libs/rsc/flight";
import { crocoMetaVitePlugin } from "../libs/vite/crocoMetaVitePlugin";

type HookContext = {
  readonly environment: {
    readonly name: string;
  };
};

type PluginResolveIdHook = NonNullable<Plugin["resolveId"]>;
type PluginLoadHook = NonNullable<Plugin["load"]>;

describe("crocoMetaVitePlugin environments", () => {
  it("should configure client and ssr environments by default (rsc is opt-in)", () => {
    const plugin = getPlugin();
    const config = callConfig(plugin);

    expect(config).toBeDefined();
    expect(config?.environments).toEqual({
      client: { consumer: "client" },
      ssr: { consumer: "server" },
    });
  });

  it("should configure the rsc environment only when explicitly enabled", () => {
    const plugin = getPlugin({ rsc: true });
    const config = callConfig(plugin);

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
    const plugin = getPlugin({ rsc: true });

    const clientId = callResolveId(plugin, "client", "virtual:croco/routes");
    const rscId = callResolveId(plugin, "rsc", "virtual:croco/routes");
    const ssrId = callResolveId(plugin, "ssr", "virtual:croco/routes");

    expect(clientId).toBe("virtual:croco/client-routes");
    expect(rscId).toBe("virtual:croco/rsc-routes");
    expect(ssrId).toBe("virtual:croco/ssr-routes");
    expect(clientId).not.toBe(rscId);
  });

  it("should keep environment-specific virtual modules from colliding", () => {
    const plugin = getPlugin({ rsc: true });

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

describe("crocoMetaVitePlugin client build id", () => {
  it("should record a client build id that composes into the manifest version", () => {
    const emitted = emitClientBuild({ rsc: true }, createClientBundle());

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.fileName).toBe(RSC_CLIENT_BUILD_FILE);

    const build = JSON.parse(emitted[0]?.source ?? "") as {
      clientBuildId: string;
      clientManifestVersion: string;
    };
    expect(build.clientManifestVersion).toBe(composeRscClientManifestVersion(build.clientBuildId));
  });

  it("should keep the build id identical for an unchanged client bundle", () => {
    const first = JSON.parse(emitClientBuild({ rsc: true }, createClientBundle())[0]?.source ?? "");
    const second = JSON.parse(
      emitClientBuild({ rsc: true }, createClientBundle())[0]?.source ?? "",
    );

    expect(second).toEqual(first);
  });

  it("should change the build id when a client chunk changes", () => {
    const first = JSON.parse(
      emitClientBuild({ rsc: true }, createClientBundle())[0]?.source ?? "",
    ) as {
      clientBuildId: string;
    };
    const changed = createClientBundle();
    const entry = changed["c9f4a2.js"];
    if (entry?.type === "chunk") {
      entry.code = `${entry.code} console.log("changed");`;
    }
    const second = JSON.parse(emitClientBuild({ rsc: true }, changed)[0]?.source ?? "") as {
      clientBuildId: string;
    };

    expect(second.clientBuildId).not.toBe(first.clientBuildId);
  });

  it("should ignore the client build order when computing the id", () => {
    const first = JSON.parse(
      emitClientBuild({ rsc: true }, createClientBundle())[0]?.source ?? "",
    ) as {
      clientBuildId: string;
    };
    const reordered = Object.fromEntries(Object.entries(createClientBundle()).reverse());
    const second = JSON.parse(emitClientBuild({ rsc: true }, reordered)[0]?.source ?? "") as {
      clientBuildId: string;
    };

    expect(second.clientBuildId).toBe(first.clientBuildId);
  });

  it("should not emit a build file for the ssr environment", () => {
    expect(emitClientBuild({ rsc: true }, createClientBundle(), "ssr")).toEqual([]);
  });

  it("should not emit a build file when the rsc path is disabled", () => {
    expect(emitClientBuild({}, createClientBundle())).toEqual([]);
  });

  it("should not emit a build file for an empty client bundle", () => {
    expect(emitClientBuild({ rsc: true }, {})).toEqual([]);
  });
});

type EmittedAsset = {
  readonly type: "asset";
  readonly fileName: string;
  readonly source: string;
};

type ClientBundleFixture = Record<
  string,
  | { type: "chunk"; fileName: string; code: string }
  | { type: "asset"; fileName: string; source: string }
>;

type GenerateBundleHook = (
  this: GenerateBundleContext,
  options: unknown,
  bundle: unknown,
  isWrite: boolean,
) => void;

type GenerateBundleContext = {
  readonly environment: {
    readonly name: string;
  };
  readonly emitFile: (file: EmittedAsset) => void;
};

function createClientBundle(): ClientBundleFixture {
  return {
    "c9f4a2.js": { type: "chunk", fileName: "c9f4a2.js", code: "export const a = 1;" },
    "assets/style.css": { type: "asset", fileName: "assets/style.css", source: ".a{}" },
  };
}

function emitClientBuild(
  options: Parameters<typeof crocoMetaVitePlugin>[0],
  bundle: ClientBundleFixture,
  environmentName = "client",
): EmittedAsset[] {
  const plugin = getPlugin(options);
  const hook = plugin.generateBundle as GenerateBundleHook | { handler: GenerateBundleHook } | null;
  const emitted: EmittedAsset[] = [];
  const context: GenerateBundleContext = {
    environment: { name: environmentName },
    emitFile: (file) => {
      emitted.push(file);
    },
  };

  if (hook && typeof hook === "object") {
    hook.handler.call(context, {}, bundle, true);
    return emitted;
  }

  hook?.call(context, {}, bundle, true);
  return emitted;
}

function getPlugin(options?: Parameters<typeof crocoMetaVitePlugin>[0]): Plugin {
  return crocoMetaVitePlugin(options)[0];
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
