import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { EnvironmentOptions, Plugin, UserConfig } from "vite";
import {
  RSC_CLIENT_BUILD_FILE,
  RSC_FLIGHT_VERSION,
  composeRscClientManifestVersion,
} from "../rsc/flight";

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

/**
 * The emitted build outputs the client digest reads. Declared structurally:
 * `vite`'s plugin type does not re-export the rollup `OutputBundle` type, and
 * the digest only needs these fields.
 */
type ClientBuildBundle = {
  readonly [fileName: string]: {
    readonly type: "chunk" | "asset";
    readonly fileName: string;
    readonly code?: string;
    readonly source?: string | Uint8Array;
  };
};

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

  // Vite's `config` hook runs before `configEnvironment` and carries the
  // project root the user configured, so the peer check can resolve from the
  // project rather than from wherever the process was started.
  let projectRoot: string | undefined;
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

    config(userConfig: UserConfig): UserConfig {
      // Vite resolves a relative `root` against its own cwd, so join it the
      // same way rather than trusting the raw string.
      projectRoot = resolve(process.cwd(), userConfig.root ?? ".");
      return { environments: createEnvironmentConfigs(environmentNames) };
    },

    generateBundle(_options, bundle) {
      // The client build is the only artifact a browser runs, so it is the only
      // one that can identify what the browser may ask the server for. The
      // emitted file lets a host read the current client build id at request
      // time instead of guessing a constant.
      if (options.rsc !== true || this.environment?.name !== "client") {
        return;
      }

      const clientBuildId = createClientBuildId(bundle);
      if (clientBuildId === null) {
        return;
      }

      this.emitFile({
        type: "asset",
        fileName: RSC_CLIENT_BUILD_FILE,
        source: `${JSON.stringify(
          {
            flightVersion: RSC_FLIGHT_VERSION,
            clientBuildId,
            clientManifestVersion: composeRscClientManifestVersion(clientBuildId),
          },
          null,
          2,
        )}\n`,
      });
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
        assertRscPeerAvailable(projectRoot);
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

function assertRscPeerAvailable(projectRoot: string | undefined): void {
  // `@vitejs/plugin-rsc` is an optional peer of `@croco/meta-vite`: it is
  // required only for the `rsc` Vite environment. `createRequire` keeps the
  // check synchronous (Vite's `configEnvironment` contract) and out of the
  // SSR/client bundle, while the lockfile pins the supported version.
  // NOTE: the tsup bundle rewrites `import.meta.url` to an empty shim, so
  // resolve from an anchor rather than the plugin module URL. The anchor is
  // the Vite project root when known: Vite 6 can run with a cwd that differs
  // from the project (for example a monorepo invoking a nested build), and the
  // peer is installed in the project, not in the invoking cwd.
  const anchors = [projectRoot, process.cwd()].filter(
    (anchor): anchor is string => typeof anchor === "string" && anchor.length > 0,
  );

  // An anchor that cannot resolve keeps its reason so the Problem can report
  // which install was consulted and why it did not answer.
  let failureReason: string | undefined;

  for (const anchor of anchors) {
    try {
      createRequire(join(anchor, "package.json")).resolve("@vitejs/plugin-rsc");
      return;
    } catch (error: unknown) {
      failureReason ??= error instanceof Error ? error.message : String(error);
    }
  }

  throw new MissingRscPeerProblem(
    failureReason ??
      `Could not resolve '@vitejs/plugin-rsc' from the Vite project root (${anchors.join(", ")})`,
  );
}

function createClientBuildId(bundle: ClientBuildBundle): string | null {
  const digest = createHash("sha256");
  const outputs = Object.entries(bundle)
    // Names are sorted so the digest does not depend on the order Rollup
    // happened to emit the outputs in.
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  let outputCount = 0;

  for (const [fileName, output] of outputs) {
    if (fileName === RSC_CLIENT_BUILD_FILE) {
      continue;
    }

    outputCount += 1;
    digest.update(fileName);
    digest.update("\0");
    if (output.type === "chunk") {
      digest.update(output.code ?? "");
    } else {
      digest.update(output.source ?? "");
    }
    digest.update("\0");
  }

  return outputCount === 0 ? null : digest.digest("hex").slice(0, 16);
}
