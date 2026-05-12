import type { EnvironmentOptions, Plugin, UserConfig } from "vite";

export type CrocoMetaVitePluginOptions = {
  rsc?: boolean;
};

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
  const environmentNames = ENVIRONMENT_NAMES.filter(
    (name) => options.rsc !== false || name !== "rsc",
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
