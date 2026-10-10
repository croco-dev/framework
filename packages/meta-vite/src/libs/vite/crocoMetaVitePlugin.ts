import { createRequire } from "node:module";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { EnvironmentOptions, Plugin, UserConfig } from "vite";

export type CrocoMetaVitePluginOptions = {
  /**
   * Enable the `rsc` Vite environment (real React Flight path). Opt-in:
   * the default (`false`/omitted) configures only `client` + `ssr` so
   * consumers without the optional `@vitejs/plugin-rsc` peer keep working.
   * Pass `{ rsc: true }` only when the peer is installed.
   */
  rsc?: boolean;
};

export class MissingRscPeerProblem extends Problem {
  readonly code = "meta-vite/rsc-peer-missing";
  readonly category = ProblemCategory.NotImplemented;

  constructor(reason: string) {
    super(
      "meta-vite/rsc-peer-missing",
      ProblemCategory.NotImplemented,
      `crocoMetaVitePlugin: the 'rsc' environment requires the optional peer '@vitejs/plugin-rsc': ${reason}`,
    );
  }
}

export type EnvironmentName = "client" | "ssr" | "rsc";

type VirtualModuleKind = "routes" | "entry";
type EnvironmentState = {
  readonly modules: Map<VirtualModuleKind, string>;
};
type VirtualModuleReference = {
  readonly environmentName: EnvironmentName;
  readonly kind: VirtualModuleKind;
};

const ENVIRONMENT_NAMES = ["client", "ssr", "rsc"] as const;
const VIRTUAL_MODULE_KINDS = ["routes", "entry"] as const;
const VIRTUAL_MODULE_PREFIX = "virtual:croco/";
const ENVIRONMENT_CONFIGS: Record<EnvironmentName, EnvironmentOptions> = {
  client: { consumer: "client" },
  ssr: { consumer: "server" },
  rsc: { consumer: "server" },
};

export function crocoMetaVitePlugin(options: CrocoMetaVitePluginOptions = {}): Plugin[] {
  // `rsc` is opt-in: enabling it unconditionally forces every consumer
  // (including generated apps without the optional `@vitejs/plugin-rsc` peer)
  // to fail in `configEnvironment`. Callers that need the real React Flight
  // path pass `{ rsc: true }` explicitly.
  const environmentNames = ENVIRONMENT_NAMES.filter(
    (name) => name !== "rsc" || options.rsc === true,
  );
  const environmentStates = new Map<EnvironmentName, EnvironmentState>(
    environmentNames.map((name) => [name, { modules: createVirtualModules(name) }]),
  );

  const isEnabledEnvironment = (name: EnvironmentName): boolean => environmentNames.includes(name);
  const getState = (name: EnvironmentName): EnvironmentState => {
    const state = environmentStates.get(name) ?? { modules: createVirtualModules(name) };
    environmentStates.set(name, state);
    return state;
  };
  const resolveVirtualModule = (reference: VirtualModuleReference): string | null => {
    if (!isEnabledEnvironment(reference.environmentName)) {
      return null;
    }

    const id = getVirtualModuleId(reference);
    getState(reference.environmentName).modules.set(reference.kind, id);
    return id;
  };

  const corePlugin: Plugin = {
    name: "croco:meta-vite",
    enforce: "pre",

    config(): UserConfig {
      return { environments: createEnvironmentConfigs(environmentNames) };
    },

    configEnvironment(name: string) {
      if (!isEnvironmentName(name) || !isEnabledEnvironment(name)) {
        return null;
      }

      getState(name);
      // The `rsc` environment is the React Flight path. Fail fast with an
      // explicit diagnostic when the optional `@vitejs/plugin-rsc` peer is
      // missing — never silently fall back to a non-Flight implementation.
      if (name === "rsc") {
        assertRscPeerAvailable();
      }
      return { ...ENVIRONMENT_CONFIGS[name] };
    },

    resolveId(id: string) {
      const environmentName = this.environment?.name;
      if (!isEnvironmentName(environmentName)) {
        return null;
      }

      const reference = parseVirtualModuleReference(id);
      if (reference) {
        return reference.environmentName === environmentName
          ? resolveVirtualModule(reference)
          : null;
      }

      const kind = parseVirtualModuleKind(id);
      return kind ? resolveVirtualModule({ environmentName, kind }) : null;
    },

    load(id: string) {
      const reference = parseVirtualModuleReference(id);
      if (!reference || !isEnabledEnvironment(reference.environmentName)) {
        return null;
      }

      const environmentName = this.environment?.name;
      if (
        environmentName &&
        (!isEnvironmentName(environmentName) || environmentName !== reference.environmentName)
      ) {
        return null;
      }

      return getState(reference.environmentName).modules.get(reference.kind) === id
        ? createVirtualModuleContent(reference)
        : null;
    },
  };

  return [corePlugin];
}

function createEnvironmentConfigs(names: readonly EnvironmentName[]): UserConfig["environments"] {
  return Object.fromEntries(names.map((name) => [name, { ...ENVIRONMENT_CONFIGS[name] }]));
}

function createVirtualModules(environmentName: EnvironmentName): Map<VirtualModuleKind, string> {
  return new Map(
    VIRTUAL_MODULE_KINDS.map((kind) => [kind, getVirtualModuleId({ environmentName, kind })]),
  );
}

function createVirtualModuleContent(reference: VirtualModuleReference): string {
  return [
    `export const environment = ${JSON.stringify(reference.environmentName)};`,
    `export const kind = ${JSON.stringify(reference.kind)};`,
    `export const moduleId = ${JSON.stringify(getVirtualModuleId(reference))};`,
    "export default { environment, kind, moduleId };",
  ].join("\n");
}

function getVirtualModuleId(reference: VirtualModuleReference): string {
  return `${VIRTUAL_MODULE_PREFIX}${reference.environmentName}-${reference.kind}`;
}

function parseVirtualModuleReference(id: string): VirtualModuleReference | null {
  const moduleName = id.startsWith(VIRTUAL_MODULE_PREFIX)
    ? id.slice(VIRTUAL_MODULE_PREFIX.length)
    : "";
  const [environmentName, kind] = moduleName.split("-");
  if (!isEnvironmentName(environmentName) || !isVirtualModuleKind(kind)) {
    return null;
  }

  return { environmentName, kind };
}

function parseVirtualModuleKind(id: string): VirtualModuleKind | null {
  const kind = id.startsWith(VIRTUAL_MODULE_PREFIX) ? id.slice(VIRTUAL_MODULE_PREFIX.length) : "";
  return isVirtualModuleKind(kind) ? kind : null;
}

function isEnvironmentName(name: string | undefined): name is EnvironmentName {
  return name === "client" || name === "ssr" || name === "rsc";
}

function isVirtualModuleKind(kind: string | undefined): kind is VirtualModuleKind {
  return kind === "routes" || kind === "entry";
}

function assertRscPeerAvailable(): void {
  // `@vitejs/plugin-rsc` is an optional peer of `@croco/meta-vite`: it is
  // required only for the `rsc` Vite environment. `createRequire` keeps the
  // check synchronous (Vite's `configEnvironment` contract) and out of the
  // SSR/client bundle, while the lockfile pins the supported version.
  // NOTE: the tsup bundle rewrites `import.meta.url` to an empty shim, so
  // resolve from the consumer root (`process.cwd()` = Vite project root)
  // instead of the plugin module URL.
  try {
    createRequire(`${process.cwd()}/package.json`).resolve("@vitejs/plugin-rsc");
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MissingRscPeerProblem(reason);
  }
}
