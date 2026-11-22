import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  RSC_CLIENT_BUILD_FILE,
  RSC_FLIGHT_VERSION,
  composeRscClientManifestVersion,
} from "./flight";
import { isRscServerEntry, isRscSsrEntry } from "./buildEntry";
import type { RenderRouteIR } from "../routes/types";
import type { RscBuild, RscServerEntry } from "./buildEntry";

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
 * Loads a `@vitejs/plugin-rsc` production build into this process. Each
 * environment was bundled with its own React conditions at build time, so the
 * `rsc` and `ssr` entries run side by side without a child process. Every
 * artifact is checked here so a stale or partial build fails at startup.
 */
export async function loadRscBuild(options: LoadRscBuildOptions): Promise<RscBuild> {
  const outDir =
    typeof options.outDir === "string" ? resolve(options.outDir) : fileURLToPath(options.outDir);
  const clientDir = join(outDir, "client");
  const client = await readClientBuildRecord(join(clientDir, RSC_CLIENT_BUILD_FILE));
  const serverFile = resolveEntryFile(join(outDir, "rsc"));
  const ssrFile = resolveEntryFile(join(outDir, "ssr"));
  const server = await importEntry(serverFile);
  const ssr = await importEntry(ssrFile);

  if (!isRscServerEntry(server)) {
    throw new RscBuildInvalidProblem(
      serverFile,
      "the default export is not created by defineRscServerEntry() from '@croco/meta-vite/rsc/server'",
    );
  }
  if (!isRscSsrEntry(ssr)) {
    throw new RscBuildInvalidProblem(
      ssrFile,
      "the default export is not created by defineRscSsrEntry() from '@croco/meta-vite/rsc/ssr'",
    );
  }
  assertClientEntryBuilt(clientDir, ssr.clientEntryUrl);

  return {
    routes: toRenderRoutes(server),
    clientManifestVersion: client.clientManifestVersion,
    clientEntryUrl: ssr.clientEntryUrl,
    clientDir,
    server,
    ssr,
  };
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

async function importEntry(file: string): Promise<unknown> {
  // A variable specifier keeps bundlers from inlining the app's build output.
  const specifier: string = pathToFileURL(file).href;
  const module = (await import(/* @vite-ignore */ specifier)) as { default?: unknown };
  return module.default;
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

function toRenderRoutes(server: RscServerEntry): RenderRouteIR[] {
  return server.routes.map((route) => ({
    path: route.path,
    mode: "rsc",
    ...(route.head ? { head: route.head } : {}),
    componentLoader: () =>
      Promise.reject(
        new RscBuildInvalidProblem(
          route.path,
          "the component renders only inside the rsc build, through renderFlight",
        ),
      ),
  }));
}
