import type { ServerActionContractIR } from "../actions/serverActions";
import type { ApiMethod, ApiRouteIR, PageRouteIR, RenderMode } from "../routes/types";

export const META_VITE_ROUTE_MANIFEST_SCHEMA_VERSION = "croco.meta-vite.route-manifest.v1" as const;

export const META_VITE_ROUTE_MANIFEST_COMPONENT_REF_REQUIRED =
  "CROCO_META_VITE_ROUTE_MANIFEST_COMPONENT_REF_REQUIRED" as const;

export class MetaViteRouteManifestError extends Error {
  readonly code = META_VITE_ROUTE_MANIFEST_COMPONENT_REF_REQUIRED;

  constructor(path: string) {
    super(`Route manifest requires componentRef for page route '${path}'`);
    this.name = "MetaViteRouteManifestError";
  }
}

export type MetaViteRuntimeCapability =
  | "fetch"
  | "react-ssr"
  | "static-prerender"
  | "isr-cache"
  | "react-server-components"
  | "streaming-response"
  | "api-dispatch"
  | "server-action-dispatch"
  | "form-data";

export type MetaViteRuntimeRequirementCode =
  | "CROCO_META_VITE_STATIC_PRERENDER_REQUIRED"
  | "CROCO_META_VITE_ISR_CACHE_REQUIRED"
  | "CROCO_META_VITE_RSC_RUNTIME_REQUIRED";

export type MetaViteRuntimeRequirement = {
  readonly code: MetaViteRuntimeRequirementCode;
  readonly capability: MetaViteRuntimeCapability;
  readonly phase: "build" | "runtime";
  readonly revalidateMs?: number;
};

export type MetaVitePageRouteManifestEntry = {
  readonly kind: "page";
  readonly order: number;
  readonly path: string;
  readonly mode: RenderMode;
  readonly componentRef: string;
  readonly runtimeCapabilities: readonly MetaViteRuntimeCapability[];
  readonly runtimeRequirements: readonly MetaViteRuntimeRequirement[];
  readonly revalidateMs?: number;
};

export type MetaViteApiRouteManifestEntry = {
  readonly kind: "api";
  readonly order: number;
  readonly path: string;
  readonly method: ApiMethod;
  readonly runtimeCapabilities: readonly MetaViteRuntimeCapability[];
};

export type MetaViteServerActionManifestEntry = {
  readonly kind: "server-action";
  readonly order: number;
  readonly name: string;
  readonly path: string;
  readonly method: "POST";
  readonly input: ServerActionContractIR["input"];
  readonly output: ServerActionContractIR["output"];
  readonly problems: ServerActionContractIR["problems"];
  readonly runtimeCapabilities: readonly MetaViteRuntimeCapability[];
};

export type MetaViteRouteManifest = {
  readonly schemaVersion: typeof META_VITE_ROUTE_MANIFEST_SCHEMA_VERSION;
  readonly pages: readonly MetaVitePageRouteManifestEntry[];
  readonly apiRoutes: readonly MetaViteApiRouteManifestEntry[];
  readonly serverActions: readonly MetaViteServerActionManifestEntry[];
};

export type MetaViteRouteManifestSource = {
  readonly pages: readonly PageRouteIR[];
  readonly apiRoutes?: readonly ApiRouteIR[];
  readonly serverActions?: readonly ServerActionContractIR[];
};

export type MetaViteRouteRegistryManifestSource = {
  readonly getPageRoutes: () => readonly PageRouteIR[];
  readonly getApiRoutes: () => readonly ApiRouteIR[];
};

export type MetaViteServerActionRegistryManifestSource = {
  readonly getActions: () => readonly ServerActionContractIR[];
};

export type MetaViteRouteManifestRegistryOptions = {
  readonly routeRegistry: MetaViteRouteRegistryManifestSource;
  readonly serverActionRegistry?: MetaViteServerActionRegistryManifestSource;
};

export function createMetaViteRouteManifest(
  source: MetaViteRouteManifestSource,
): MetaViteRouteManifest {
  return {
    schemaVersion: META_VITE_ROUTE_MANIFEST_SCHEMA_VERSION,
    pages: sortPageRoutes(source.pages).map(createPageRouteEntry),
    apiRoutes: sortApiRoutes(source.apiRoutes ?? []).map(createApiRouteEntry),
    serverActions: sortServerActions(source.serverActions ?? []).map(createServerActionEntry),
  };
}

export function createMetaViteRouteManifestFromRegistry(
  options: MetaViteRouteManifestRegistryOptions,
): MetaViteRouteManifest {
  return createMetaViteRouteManifest({
    pages: options.routeRegistry.getPageRoutes(),
    apiRoutes: options.routeRegistry.getApiRoutes(),
    serverActions: options.serverActionRegistry?.getActions(),
  });
}

export function serializeMetaViteRouteManifest(manifest: MetaViteRouteManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export async function writeMetaViteRouteManifest(
  manifest: MetaViteRouteManifest,
  outputPath: string,
): Promise<void> {
  const [{ mkdir, writeFile }, { dirname }] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeMetaViteRouteManifest(manifest), "utf-8");
}

function createPageRouteEntry(route: PageRouteIR, index: number): MetaVitePageRouteManifestEntry {
  if (!route.componentRef) {
    throw new MetaViteRouteManifestError(route.path);
  }

  return {
    kind: "page",
    order: index,
    path: route.path,
    mode: route.mode,
    componentRef: route.componentRef,
    runtimeCapabilities: getPageRuntimeCapabilities(route.mode),
    runtimeRequirements: getPageRuntimeRequirements(route),
    ...(route.revalidateMs !== undefined ? { revalidateMs: route.revalidateMs } : {}),
  };
}

function sortPageRoutes(routes: readonly PageRouteIR[]): PageRouteIR[] {
  return [...routes].sort(
    (a, b) => compareStrings(a.path, b.path) || compareStrings(a.mode, b.mode),
  );
}

function sortApiRoutes(routes: readonly ApiRouteIR[]): ApiRouteIR[] {
  return [...routes].sort(
    (a, b) =>
      compareStrings(a.path, b.path) || compareStrings(a.method ?? "GET", b.method ?? "GET"),
  );
}

function sortServerActions(actions: readonly ServerActionContractIR[]): ServerActionContractIR[] {
  return [...actions].sort((a, b) => compareStrings(a.name, b.name));
}

function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function createApiRouteEntry(route: ApiRouteIR, index: number): MetaViteApiRouteManifestEntry {
  return {
    kind: "api",
    order: index,
    path: route.path,
    method: route.method ?? "GET",
    runtimeCapabilities: ["fetch", "api-dispatch"],
  };
}

function createServerActionEntry(
  action: ServerActionContractIR,
  index: number,
): MetaViteServerActionManifestEntry {
  return {
    kind: "server-action",
    order: index,
    name: action.name,
    path: action.path,
    method: action.method,
    input: action.input,
    output: action.output,
    problems: action.problems,
    runtimeCapabilities: ["fetch", "server-action-dispatch", "form-data"],
  };
}

function getPageRuntimeCapabilities(mode: RenderMode): readonly MetaViteRuntimeCapability[] {
  switch (mode) {
    case "ssr":
      return ["fetch", "react-ssr"];
    case "ssg":
      return ["static-prerender", "react-ssr"];
    case "isr":
      return ["fetch", "react-ssr", "isr-cache"];
    case "rsc":
      return ["fetch", "react-server-components", "streaming-response"];
  }
}

function getPageRuntimeRequirements(route: PageRouteIR): readonly MetaViteRuntimeRequirement[] {
  switch (route.mode) {
    case "ssg":
      return [
        {
          code: "CROCO_META_VITE_STATIC_PRERENDER_REQUIRED",
          capability: "static-prerender",
          phase: "build",
        },
      ];
    case "isr":
      return [
        {
          code: "CROCO_META_VITE_ISR_CACHE_REQUIRED",
          capability: "isr-cache",
          phase: "runtime",
          ...(route.revalidateMs !== undefined ? { revalidateMs: route.revalidateMs } : {}),
        },
      ];
    case "rsc":
      return [
        {
          code: "CROCO_META_VITE_RSC_RUNTIME_REQUIRED",
          capability: "react-server-components",
          phase: "runtime",
        },
      ];
    case "ssr":
      return [];
  }
}
