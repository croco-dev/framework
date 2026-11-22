import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  RSC_CLIENT_BUILD_FILE,
  RSC_FLIGHT_VERSION,
  composeRscClientManifestVersion,
} from "./flight";
import { RSC_SERVER_ENTRY_VERSION, RSC_SSR_ENTRY_VERSION } from "./buildEntry";
import { startRscBuildWorker } from "./rscBuildWorkerClient";
import type { HeadMetadata } from "../routes/head";
import type { RenderRouteIR } from "../routes/types";
import type { RscBuild } from "./buildEntry";
import type { RscWorkerRoute } from "./rscBuildProtocol";

/**
 * A production build cannot be served: an artifact is missing, has the wrong
 * shape, or belongs to a different build than the others. Raised while the
 * host starts, before any request is accepted.
 */
export class RscBuildInvalidProblem extends Problem {
  readonly code = "meta-vite/rsc-build-invalid";
  readonly category = ProblemCategory.InternalServerError;

  constructor(artifact: string, reason: string) {
    super(
      "meta-vite/rsc-build-invalid",
      ProblemCategory.InternalServerError,
      `RSC build artifact '${artifact}' cannot be served: ${reason}`,
      { extensions: { artifact, reason } },
    );
  }
}

export type LoadRscBuildOptions = {
  /**
   * The Vite build output that holds `rsc/`, `ssr/` and `client/`, the
   * `@vitejs/plugin-rsc` default layout.
   */
  readonly outDir: string | URL;
};

type ClientBuildRecord = {
  readonly clientManifestVersion: string;
};

/**
 * Loads a `@vitejs/plugin-rsc` production build into a worker thread of its
 * own. plugin-rsc registers its module loaders on `globalThis`, so builds of
 * different apps must not share a thread. Every artifact is checked before the
 * promise resolves, so a stale or partial build fails at startup.
 */
export async function loadRscBuild(options: LoadRscBuildOptions): Promise<RscBuild> {
  const outDir =
    typeof options.outDir === "string" ? resolve(options.outDir) : fileURLToPath(options.outDir);
  const clientDir = join(outDir, "client");
  const client = await readClientBuildRecord(join(clientDir, RSC_CLIENT_BUILD_FILE));
  const serverFile = resolveEntryFile(join(outDir, "rsc"));
  const ssrFile = resolveEntryFile(join(outDir, "ssr"));

  const worker = await startRscBuildWorker(resolveWorkerFile([outDir, process.cwd()]), {
    serverFile,
    ssrFile,
    serverEntryVersion: RSC_SERVER_ENTRY_VERSION,
    ssrEntryVersion: RSC_SSR_ENTRY_VERSION,
  });
  if ("type" in worker) {
    throw new RscBuildInvalidProblem(worker.artifact, worker.reason);
  }
  try {
    assertClientEntryBuilt(clientDir, worker.clientEntryUrl);
  } catch (error) {
    await worker.close();
    throw error;
  }

  return {
    routes: toRenderRoutes(worker.routes),
    clientManifestVersion: client.clientManifestVersion,
    clientEntryUrl: worker.clientEntryUrl,
    clientDir,
    actions: worker.actions,
    renderFlight: worker.renderFlight,
    renderDocument: worker.renderDocument,
    invokeAction: worker.invokeAction,
    close: worker.close,
  };
}

// The worker sits next to the package entry: `src/libs/rsc/rscBuildWorker.mts`
// beside `src/index.ts` in the workspace (Node strips its types), and
// `dist/libs/rsc/rscBuildWorker.mjs` beside `dist/index.js` when published.
function resolveWorkerFile(anchors: readonly string[]): string {
  for (const anchor of anchors) {
    let entryDir: string;
    try {
      entryDir = dirname(createRequire(join(anchor, "package.json")).resolve("@croco/meta-vite"));
    } catch {
      continue; // this anchor does not see the package; the next one may
    }
    const file = ["rscBuildWorker.mts", "rscBuildWorker.mjs"]
      .map((name) => join(entryDir, "libs", "rsc", name))
      .find((candidate) => existsSync(candidate));
    if (file) {
      return file;
    }
  }
  throw new RscBuildInvalidProblem(
    "@croco/meta-vite",
    "the RSC build worker entry cannot be resolved from the build directory or the working directory",
  );
}

async function readClientBuildRecord(file: string): Promise<ClientBuildRecord> {
  if (!existsSync(file)) {
    throw new RscBuildInvalidProblem(
      file,
      "the client build record is missing; build with crocoMetaVitePlugin({ rsc: true })",
    );
  }

  let record: unknown;
  try {
    record = JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new RscBuildInvalidProblem(file, "the client build record is not valid JSON");
  }

  const fields = (typeof record === "object" && record !== null ? record : {}) as Record<
    string,
    unknown
  >;
  if (fields["flightVersion"] !== RSC_FLIGHT_VERSION) {
    throw new RscBuildInvalidProblem(
      file,
      `the build targets Flight protocol '${String(fields["flightVersion"])}', expected '${RSC_FLIGHT_VERSION}'`,
    );
  }

  const clientBuildId = fields["clientBuildId"];
  const clientManifestVersion = fields["clientManifestVersion"];
  if (
    typeof clientBuildId !== "string" ||
    typeof clientManifestVersion !== "string" ||
    clientManifestVersion !== composeRscClientManifestVersion(clientBuildId)
  ) {
    throw new RscBuildInvalidProblem(
      file,
      "clientManifestVersion does not match clientBuildId; rebuild the app",
    );
  }

  return { clientManifestVersion };
}

// Vite writes `index.mjs` instead of `index.js` when the app's package.json is
// CommonJS, so both names are accepted.
function resolveEntryFile(environmentDir: string): string {
  const candidates = [join(environmentDir, "index.js"), join(environmentDir, "index.mjs")];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (file === undefined) {
    throw new RscBuildInvalidProblem(
      candidates[0] ?? environmentDir,
      "the built entry is missing; run the Vite build first",
    );
  }
  return file;
}

// The SSR build records the hashed client entry it was compiled against. When
// that file is absent, `client/` came from another build and the browser would
// load a bundle that cannot resolve this build's client references.
function assertClientEntryBuilt(clientDir: string, clientEntryUrl: string): void {
  if (!clientEntryUrl.startsWith("/")) {
    throw new RscBuildInvalidProblem(
      clientEntryUrl,
      "the client entry URL must be root-relative; a custom Vite base is not supported",
    );
  }

  const file = join(clientDir, decodeURIComponent(clientEntryUrl.slice(1)));
  const fromRoot = relative(clientDir, file);
  if (fromRoot === "" || fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) {
    throw new RscBuildInvalidProblem(
      clientEntryUrl,
      "the client entry URL leaves the client build",
    );
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    throw new RscBuildInvalidProblem(
      file,
      "the SSR build references a client entry that the client build does not contain; rebuild client and server together",
    );
  }
}

// `head()` ran once in the worker, so each route answers that metadata.
function toRenderRoutes(routes: readonly RscWorkerRoute[]): RenderRouteIR[] {
  return routes.map((route) => ({
    path: route.path,
    mode: "rsc",
    ...(route.head ? { head: (): HeadMetadata => route.head ?? {} } : {}),
    componentLoader: () =>
      Promise.reject(
        new RscBuildInvalidProblem(
          route.path,
          "the component renders only inside the rsc build, through renderFlight",
        ),
      ),
  }));
}
