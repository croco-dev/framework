import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { defineCommand } from "citty";
import {
  checkPolicyTableRuntimeCapabilities,
  defineRuntimePolicyPreset,
  formatPolicyCapabilityDiagnostic,
  isKnownRuntimePlatform,
  RUNTIME_CAPABILITY_NAMES,
  type PolicySource,
  type PolicyTable,
  type RuntimeCapabilityName,
  type RuntimeCapabilityOverridesFor,
  type RuntimePlatform,
  type RuntimePolicyPresetConfig,
} from "@croco/framework-context";
import type { FrameworkManifest } from "@croco/framework-routes";
import { createFrameworkManifest } from "@croco/framework-routes";
import {
  createContractGraphSnapshot,
  formatContractDiagnostic,
  isContractGraphSnapshot,
  type ContractDiagnostic,
  type ContractGraph,
  type ContractGraphSnapshot,
} from "@croco/protocols-core";
import { GLOBAL_OPTIONS } from "./options.js";

export type ProjectMapManifestVersion = "croco.project-map.manifest.v1";
export type ProjectMapDiagnosticSeverity = "error" | "warning";
export type ProjectMapEntrypointKind = "package-script" | "http-route" | "di-provider";
export type ProjectMapTelemetryBoundaryKind =
  | "telemetry-runtime"
  | "trace-decorator"
  | "span-wrapper"
  | "telemetry-flush";

export type ProjectMapSourceLocation = {
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
  readonly symbol?: string;
};

export type ProjectMapDiagnostic = {
  readonly code: string;
  readonly severity: ProjectMapDiagnosticSeverity;
  readonly message: string;
  readonly source?: ProjectMapSourceLocation;
  readonly artifact?: string;
  readonly routeId?: string;
  readonly packageName?: string;
  readonly capability?: string;
};

export type ProjectMapPackageDependency = {
  readonly name: string;
  readonly range: string;
  readonly kind: "dependency" | "devDependency" | "peerDependency" | "optionalDependency";
};

export type ProjectMapPackage = {
  readonly name: string;
  readonly path: string;
  readonly private: boolean;
  readonly scripts: readonly string[];
  readonly dependencies: readonly ProjectMapPackageDependency[];
};

export type ProjectMapEntrypoint = {
  readonly kind: ProjectMapEntrypointKind;
  readonly id: string;
  readonly packageName?: string;
  readonly command?: string;
  readonly method?: string;
  readonly path?: string;
  readonly source?: ProjectMapSourceLocation;
};

export type ProjectMapRuntimePolicy = {
  readonly manifestPath: string;
  readonly target: RuntimePlatform | "unknown";
  readonly planCount: number;
  readonly requiredCapabilities: readonly RuntimeCapabilityName[];
};

export type ProjectMapTelemetryBoundary = {
  readonly kind: ProjectMapTelemetryBoundaryKind;
  readonly id: string;
  readonly source: ProjectMapSourceLocation;
};

export type ProjectMapGeneratedArtifact = {
  readonly kind: string;
  readonly path: string;
  readonly commitPolicy: "commit-required" | "gitignored-generated";
};

export type ProjectMapManifest = {
  readonly version: ProjectMapManifestVersion;
  readonly project: {
    readonly root: string;
    readonly packageName: string;
    readonly packageManager?: string;
  };
  readonly summary: {
    readonly packages: number;
    readonly controllers: number;
    readonly routes: number;
    readonly providers: number;
    readonly policies: number;
    readonly problems: number;
    readonly telemetryBoundaries: number;
    readonly generatedArtifacts: number;
    readonly diagnostics: number;
    readonly errors: number;
    readonly warnings: number;
  };
  readonly packageGraph: {
    readonly packages: readonly ProjectMapPackage[];
    readonly providerProfile?: {
      readonly manifestPath: string;
      readonly profileName: string;
      readonly packages: readonly string[];
    };
  };
  readonly routeGraph: {
    readonly frameworkManifestVersion: FrameworkManifest["version"];
    readonly contractGraphSnapshotVersion?: ContractGraphSnapshot["snapshotVersion"];
    readonly controllers: readonly FrameworkManifestControllerSummary[];
    readonly routes: readonly FrameworkManifestRouteSummary[];
  };
  readonly di: {
    readonly providers: readonly FrameworkManifestProviderSummary[];
  };
  readonly policies: {
    readonly runtime?: ProjectMapRuntimePolicy;
  };
  readonly problems: {
    readonly responses: readonly ProjectMapProblemResponse[];
  };
  readonly telemetry: {
    readonly boundaries: readonly ProjectMapTelemetryBoundary[];
  };
  readonly entrypoints: readonly ProjectMapEntrypoint[];
  readonly generatedArtifacts: readonly ProjectMapGeneratedArtifact[];
  readonly diagnostics: readonly ProjectMapDiagnostic[];
};

export type FrameworkManifestControllerSummary = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly source?: ProjectMapSourceLocation;
};

export type FrameworkManifestRouteSummary = {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly controllerId: string;
  readonly handlerName: string;
  readonly source?: ProjectMapSourceLocation;
};

export type FrameworkManifestProviderSummary = {
  readonly id: string;
  readonly name: string;
  readonly scope: string;
  readonly dependencies: readonly string[];
  readonly source?: ProjectMapSourceLocation;
};

export type ProjectMapProblemResponse = {
  readonly routeId: string;
  readonly code: string;
  readonly category: string;
  readonly status: number;
  readonly type?: string;
};

export type ProjectMapInput = {
  readonly projectRoot: string;
  readonly rootPackage: RootPackageManifest;
  readonly packageGraph: readonly ProjectMapPackage[];
  readonly frameworkManifest: FrameworkManifest;
  readonly contractGraphSnapshot?: ContractGraphSnapshot;
  readonly runtimePolicyManifest?: RuntimePolicyProjectMapInput;
  readonly providerProfileManifest?: ProviderProfileProjectMapInput;
  readonly telemetryBoundaries?: readonly ProjectMapTelemetryBoundary[];
};

export type RootPackageManifest = {
  readonly name: string;
  readonly packageManager?: string;
};

export type RuntimePolicyProjectMapInput = {
  readonly path: string;
  readonly manifest: RuntimePolicyCheckManifest;
};

export type ProviderProfileProjectMapInput = {
  readonly path: string;
  readonly manifest: ProviderProfileManifest;
};

export type ProjectMapIo = {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly exists: (path: string) => boolean;
  readonly stat: (path: string) => {
    readonly isDirectory: () => boolean;
    readonly isFile: () => boolean;
  };
  readonly readDir: (path: string) => readonly ProjectMapDirent[];
  readonly cwd: string;
};

export type ProjectMapDirent = {
  readonly name: string;
  readonly isDirectory: () => boolean;
  readonly isFile: () => boolean;
};

export type ProjectMapLoader = (
  options: ProjectMapOptions,
  io: ProjectMapIo,
) => Promise<ProjectMapManifest>;
export type ContractGraphLoader = (glob: string) => Promise<ContractGraph>;

export type ProjectMapOptions = {
  readonly controllers: string | null;
  readonly sourcePaths: readonly string[];
  readonly out: string | null;
  readonly manifest: string | null;
  readonly check: boolean;
  readonly json: boolean;
  readonly frameworkManifest: string | null;
  readonly contractGraph: string | null;
  readonly runtimePolicy: string | null;
  readonly providerProfile: string | null;
};

type ProjectMapParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "run"; readonly options: ProjectMapOptions };

type RuntimePolicyCheckManifest = {
  readonly version?: string;
  readonly schemaVersion?: string;
  readonly target?: RuntimePlatform;
  readonly runtime?: {
    readonly platform?: RuntimePlatform;
    readonly capabilities?: Partial<Record<RuntimeCapabilityName, boolean>>;
    readonly source?: PolicySource;
  };
  readonly table?: PolicyTable;
  readonly plans?: PolicyTable["plans"];
};

type ProviderProfileManifest = {
  readonly schemaVersion?: string;
  readonly profile?: {
    readonly name?: string;
  };
  readonly packages?: readonly string[];
};

const PROJECT_MAP_MANIFEST_VERSION: ProjectMapManifestVersion = "croco.project-map.manifest.v1";
const DEFAULT_PROJECT_MAP_PATH = "croco.project-map.json";
const DEFAULT_FRAMEWORK_MANIFEST_PATH = ".croco/build/framework-manifest.json";
const DEFAULT_CONTRACT_GRAPH_SNAPSHOT_PATH = "contract-graph.snapshot.json";
const DEFAULT_RUNTIME_POLICY_PATH = "croco-runtime-policy.manifest.json";
const DEFAULT_PROVIDER_PROFILE_PATH = "croco-saas-profile.manifest.json";
const PACKAGE_DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".turbo",
  ".croco",
  "coverage",
  "dist",
  "node_modules",
]);
const SOURCE_EXTENSIONS = /\.(?:c|m)?tsx?$/;

const defaultIo: ProjectMapIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  readFile: (path) => readFileSync(path, "utf-8"),
  writeFile: (path, content) => writeFileSync(path, content),
  mkdir: (path) => mkdirSync(path, { recursive: true }),
  exists: (path) => existsSync(path),
  stat: (path) => statSync(path),
  readDir: (path) => readdirSync(path, { withFileTypes: true }),
  cwd: process.cwd(),
};

export const projectMap = defineCommand({
  meta: {
    name: "map",
    description: "Generate and check an LLM-readable Croco Project Map manifest",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  async run({ rawArgs }) {
    process.exitCode = await runProjectMap(rawArgs);
  },
});

export async function runProjectMap(
  args: readonly string[],
  options: {
    readonly io?: Partial<ProjectMapIo>;
    readonly loadProjectMap?: ProjectMapLoader;
    readonly loadContractGraph?: ContractGraphLoader;
  } = {},
): Promise<number> {
  const parsed = parseProjectMapArgs(args);
  const io = { ...defaultIo, ...options.io };

  if (parsed.kind === "help") {
    printProjectMapHelp(io);
    return 0;
  }

  if (parsed.kind === "invalid") {
    io.stderr(parsed.message);
    printProjectMapHelp(io);
    return 1;
  }

  try {
    const loadProjectMap =
      options.loadProjectMap ??
      ((projectMapOptions, projectMapIo) =>
        loadProjectMapFromWorkspace(projectMapOptions, projectMapIo, options.loadContractGraph));
    const manifest = await loadProjectMap(parsed.options, io);
    const checkedManifest = parsed.options.check
      ? appendProjectMapDiagnostics(
          manifest,
          readProjectMapDriftDiagnostics(manifest, parsed.options, io),
        )
      : manifest;
    const manifestJson = stringifyProjectMapManifest(checkedManifest);

    if (parsed.options.out && !parsed.options.check) {
      writeOutputFile(parsed.options.out, manifestJson, io);
      io.stdout(`Wrote Project Map manifest to ${resolvePath(parsed.options.out, io.cwd)}.`);
    } else if (parsed.options.json) {
      io.stdout(manifestJson.trimEnd());
    } else {
      reportProjectMapDiagnostics(checkedManifest, io);
    }

    return hasProjectMapErrors(checkedManifest) ? 1 : 0;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export function parseProjectMapArgs(args: readonly string[]): ProjectMapParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  const out = getFlagValue(args, "--out");
  const check = args.includes("--check");
  const manifest =
    getFlagValue(args, "--manifest") ?? (check ? (out ?? DEFAULT_PROJECT_MAP_PATH) : null);

  return {
    kind: "run",
    options: {
      controllers: getFlagValue(args, "--controllers") ?? getFirstPosition(args),
      sourcePaths: getFlagValues(args, "--source"),
      out,
      manifest,
      check,
      json: args.includes("--json"),
      frameworkManifest: getFlagValue(args, "--framework-manifest"),
      contractGraph: getFlagValue(args, "--contract-graph"),
      runtimePolicy: getFlagValue(args, "--runtime-policy"),
      providerProfile: getFlagValue(args, "--provider-profile"),
    },
  };
}

export function createProjectMapManifest(input: ProjectMapInput): ProjectMapManifest {
  const controllers = input.frameworkManifest.entities
    .filter(
      (
        entity,
      ): entity is Extract<
        FrameworkManifest["entities"][number],
        { readonly kind: "http.controller" }
      > => entity.kind === "http.controller",
    )
    .map((controller) => ({
      id: controller.id,
      name: controller.name,
      path: controller.path,
      ...(controller.source ? { source: toProjectMapSourceLocation(controller.source) } : {}),
    }))
    .sort(compareById);
  const routes = input.frameworkManifest.entities
    .filter(
      (
        entity,
      ): entity is Extract<
        FrameworkManifest["entities"][number],
        { readonly kind: "http.route" }
      > => entity.kind === "http.route",
    )
    .map((route) => ({
      id: route.id,
      method: route.method.toUpperCase(),
      path: route.path,
      controllerId: route.controllerId,
      handlerName: route.handlerName,
      ...(route.source ? { source: toProjectMapSourceLocation(route.source) } : {}),
    }))
    .sort(compareById);
  const providers = input.frameworkManifest.entities
    .filter(
      (
        entity,
      ): entity is Extract<
        FrameworkManifest["entities"][number],
        { readonly kind: "di.provider" }
      > => entity.kind === "di.provider",
    )
    .map((provider) => ({
      id: provider.id,
      name: provider.name,
      scope: provider.scope,
      dependencies: [...provider.dependencies].sort(compareStrings),
      ...(provider.source ? { source: toProjectMapSourceLocation(provider.source) } : {}),
    }))
    .sort(compareById);
  const runtimePolicy = createProjectMapRuntimePolicy(input.runtimePolicyManifest);
  const problems = createProjectMapProblemResponses(input.contractGraphSnapshot);
  const generatedArtifacts = input.frameworkManifest.generatedArtifacts
    .map((artifact) => ({
      kind: artifact.kind,
      path: artifact.path,
      commitPolicy: artifact.commitPolicy,
    }))
    .sort(compareGeneratedArtifacts);
  const entrypoints = [
    ...createPackageScriptEntrypoints(input.packageGraph),
    ...routes.map((route) => ({
      kind: "http-route" as const,
      id: route.id,
      method: route.method,
      path: route.path,
      ...(route.source ? { source: route.source } : {}),
    })),
    ...providers.map((provider) => ({
      kind: "di-provider" as const,
      id: provider.id,
      ...(provider.source ? { source: provider.source } : {}),
    })),
  ].sort(compareEntrypoints);
  const diagnostics = createProjectMapDiagnostics({
    frameworkManifest: input.frameworkManifest,
    contractGraphSnapshot: input.contractGraphSnapshot,
    runtimePolicyManifest: input.runtimePolicyManifest,
    providerProfileManifest: input.providerProfileManifest,
    packages: input.packageGraph,
    routes,
  });

  return withProjectMapSummary({
    version: PROJECT_MAP_MANIFEST_VERSION,
    project: {
      root: ".",
      packageName: input.rootPackage.name,
      ...(input.rootPackage.packageManager
        ? { packageManager: input.rootPackage.packageManager }
        : {}),
    },
    summary: emptyProjectMapSummary(),
    packageGraph: {
      packages: [...input.packageGraph].sort(comparePackages),
      ...(input.providerProfileManifest
        ? {
            providerProfile: {
              manifestPath: input.providerProfileManifest.path,
              profileName: input.providerProfileManifest.manifest.profile?.name ?? "unknown",
              packages: [...(input.providerProfileManifest.manifest.packages ?? [])].sort(
                compareStrings,
              ),
            },
          }
        : {}),
    },
    routeGraph: {
      frameworkManifestVersion: input.frameworkManifest.version,
      ...(input.contractGraphSnapshot
        ? { contractGraphSnapshotVersion: input.contractGraphSnapshot.snapshotVersion }
        : {}),
      controllers,
      routes,
    },
    di: {
      providers,
    },
    policies: runtimePolicy ? { runtime: runtimePolicy } : {},
    problems: {
      responses: problems,
    },
    telemetry: {
      boundaries: [...(input.telemetryBoundaries ?? [])].sort(compareTelemetryBoundaries),
    },
    entrypoints,
    generatedArtifacts,
    diagnostics,
  });
}

export function stringifyProjectMapManifest(manifest: ProjectMapManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

async function loadProjectMapFromWorkspace(
  options: ProjectMapOptions,
  io: ProjectMapIo,
  contractGraphLoader?: ContractGraphLoader,
): Promise<ProjectMapManifest> {
  const projectRoot = io.cwd;
  const rootManifestPath = resolvePath("package.json", projectRoot);
  const rootPackage = readRootPackageManifest(rootManifestPath, io);
  const packageGraph = discoverPackageGraph(projectRoot, io);
  const contractGraph = options.controllers
    ? await (contractGraphLoader ?? loadContractGraphFromRpcCodegen)(options.controllers)
    : undefined;
  const contractGraphSnapshot =
    contractGraph !== undefined
      ? createContractGraphSnapshot(contractGraph)
      : readOptionalContractGraphSnapshot(
          options.contractGraph ?? DEFAULT_CONTRACT_GRAPH_SNAPSHOT_PATH,
          projectRoot,
          io,
          options.contractGraph !== null,
        );
  const sourcePaths =
    options.sourcePaths.length > 0
      ? resolveConfiguredSourcePaths(projectRoot, options.sourcePaths, io)
      : discoverSourcePaths(projectRoot, io);
  const frameworkManifest = options.frameworkManifest
    ? readFrameworkManifest(options.frameworkManifest, projectRoot, io)
    : contractGraph !== undefined || sourcePaths.length > 0
      ? createFrameworkManifest({
          projectRoot,
          sourcePaths,
          ...(contractGraph ? { contractGraph } : {}),
        })
      : readFrameworkManifest(DEFAULT_FRAMEWORK_MANIFEST_PATH, projectRoot, io);

  return createProjectMapManifest({
    projectRoot,
    rootPackage,
    packageGraph,
    frameworkManifest,
    ...(contractGraphSnapshot ? { contractGraphSnapshot } : {}),
    runtimePolicyManifest: readOptionalRuntimePolicyManifest(
      options.runtimePolicy ?? DEFAULT_RUNTIME_POLICY_PATH,
      projectRoot,
      io,
      options.runtimePolicy !== null,
    ),
    providerProfileManifest: readOptionalProviderProfileManifest(
      options.providerProfile ?? DEFAULT_PROVIDER_PROFILE_PATH,
      projectRoot,
      io,
      options.providerProfile !== null,
    ),
    telemetryBoundaries: discoverTelemetryBoundaries(projectRoot, sourcePaths, io),
  });
}

async function loadContractGraphFromRpcCodegen(glob: string): Promise<ContractGraph> {
  const rpcCodegenPackage = "@croco/rpc-codegen";
  const { loadContractGraph } = await import(rpcCodegenPackage);

  return loadContractGraph(glob);
}

function createProjectMapDiagnostics(input: {
  readonly frameworkManifest: FrameworkManifest;
  readonly contractGraphSnapshot?: ContractGraphSnapshot;
  readonly runtimePolicyManifest?: RuntimePolicyProjectMapInput;
  readonly providerProfileManifest?: ProviderProfileProjectMapInput;
  readonly packages: readonly ProjectMapPackage[];
  readonly routes: readonly FrameworkManifestRouteSummary[];
}): ProjectMapDiagnostic[] {
  return [
    ...input.frameworkManifest.diagnostics.map((diagnostic) => ({
      code: `project-map/framework-manifest-${diagnostic.code}`,
      severity: diagnostic.severity,
      message: diagnostic.message,
      ...(diagnostic.sourcePath ? { source: { file: diagnostic.sourcePath } } : {}),
    })),
    ...createContractGraphDiagnostics(input.contractGraphSnapshot, input.routes),
    ...createRuntimePolicyDiagnostics(input.runtimePolicyManifest),
    ...createPackageManifestDiagnostics(input.providerProfileManifest, input.packages),
  ].sort(compareDiagnostics);
}

function createContractGraphDiagnostics(
  snapshot: ContractGraphSnapshot | undefined,
  routes: readonly FrameworkManifestRouteSummary[],
): ProjectMapDiagnostic[] {
  if (!snapshot) {
    return [];
  }

  const routeIds = new Set(routes.map((route) => route.id));
  const snapshotRouteIds = new Set(snapshot.routes.map((route) => route.routeId));
  const graphDiagnostics = snapshot.diagnostics.map((diagnostic) =>
    toProjectMapContractDiagnostic(diagnostic),
  );
  const missingFromManifest = snapshot.routes
    .filter((route) => !routeIds.has(route.routeId))
    .map((route) => ({
      code: "project-map/contract-route-conflict",
      severity: "error" as const,
      routeId: route.routeId,
      message: `Contract Graph route '${route.routeId}' is missing from the framework manifest route graph.`,
    }));
  const missingFromContract = routes
    .filter((route) => !snapshotRouteIds.has(route.id))
    .map((route) => ({
      code: "project-map/contract-route-conflict",
      severity: "error" as const,
      routeId: route.id,
      ...(route.source ? { source: route.source } : {}),
      message: `Framework manifest route '${route.id}' is missing from the Contract Graph snapshot.`,
    }));

  return [...graphDiagnostics, ...missingFromManifest, ...missingFromContract];
}

function toProjectMapContractDiagnostic(diagnostic: ContractDiagnostic): ProjectMapDiagnostic {
  const formatted = formatContractDiagnostic(diagnostic);
  const routeId =
    "routeId" in diagnostic && typeof diagnostic.routeId === "string"
      ? diagnostic.routeId
      : undefined;

  return {
    code: `project-map/contract-graph-${diagnostic.code}`,
    severity: diagnostic.severity,
    message: formatted,
    ...(routeId ? { routeId } : {}),
  };
}

function createRuntimePolicyDiagnostics(
  input: RuntimePolicyProjectMapInput | undefined,
): ProjectMapDiagnostic[] {
  if (!input) {
    return [];
  }

  const table = getRuntimePolicyTable(input.manifest);
  const target = input.manifest.runtime?.platform ?? input.manifest.target;

  if (!target) {
    return [
      {
        code: "project-map/runtime-target-missing",
        severity: "error",
        artifact: input.path,
        message: "Runtime policy manifest must set runtime.platform or target.",
      },
    ];
  }

  if (!isKnownRuntimePlatform(target)) {
    return [
      {
        code: "project-map/runtime-target-unsupported",
        severity: "error",
        artifact: input.path,
        message: `Runtime policy manifest uses unsupported target runtime '${target}'.`,
      },
    ];
  }

  const preset = defineRuntimePolicyPreset({
    platform: target,
    capabilities: input.manifest.runtime?.capabilities as RuntimeCapabilityOverridesFor<
      typeof target
    >,
    source: input.manifest.runtime?.source,
  } as RuntimePolicyPresetConfig<typeof target>);

  return checkPolicyTableRuntimeCapabilities(table, preset).map((diagnostic) => ({
    code: "project-map/runtime-capability-conflict",
    severity: "error",
    artifact: input.path,
    capability: diagnostic.capability,
    message: formatPolicyCapabilityDiagnostic(diagnostic),
  }));
}

function createPackageManifestDiagnostics(
  input: ProviderProfileProjectMapInput | undefined,
  packages: readonly ProjectMapPackage[],
): ProjectMapDiagnostic[] {
  if (!input) {
    return [];
  }

  const declaredPackages = new Set(
    packages.flatMap((packageManifest) =>
      packageManifest.dependencies.map((dependency) => dependency.name),
    ),
  );

  return [...(input.manifest.packages ?? [])]
    .sort(compareStrings)
    .filter((packageName) => !declaredPackages.has(packageName))
    .map((packageName) => ({
      code: "project-map/package-manifest-conflict",
      severity: "error" as const,
      artifact: input.path,
      packageName,
      message: `Provider profile package '${packageName}' is not declared in any discovered package manifest.`,
    }));
}

function createProjectMapRuntimePolicy(
  input: RuntimePolicyProjectMapInput | undefined,
): ProjectMapRuntimePolicy | undefined {
  if (!input) {
    return undefined;
  }

  const table = getRuntimePolicyTable(input.manifest);
  const target = input.manifest.runtime?.platform ?? input.manifest.target ?? "unknown";

  return {
    manifestPath: input.path,
    target,
    planCount: table.plans.length,
    requiredCapabilities: collectRequiredCapabilities(table),
  };
}

function collectRequiredCapabilities(table: PolicyTable): RuntimeCapabilityName[] {
  const capabilities = new Set<RuntimeCapabilityName>();

  for (const plan of table.plans) {
    for (const entry of plan.entries) {
      for (const capability of entry.requiredCapabilities ?? []) {
        capabilities.add(capability);
      }
    }
  }

  return [...capabilities].sort(compareStrings);
}

function createProjectMapProblemResponses(
  snapshot: ContractGraphSnapshot | undefined,
): ProjectMapProblemResponse[] {
  return (snapshot?.routes ?? [])
    .flatMap((route) =>
      route.problems.map((problem) => ({
        routeId: route.routeId,
        code: problem.code,
        category: problem.category,
        status: problem.status,
        ...(problem.type ? { type: problem.type } : {}),
      })),
    )
    .sort(
      (left, right) =>
        compareStrings(left.routeId, right.routeId) ||
        compareStrings(left.code, right.code) ||
        left.status - right.status,
    );
}

function createPackageScriptEntrypoints(
  packages: readonly ProjectMapPackage[],
): ProjectMapEntrypoint[] {
  return packages.flatMap((packageManifest) =>
    packageManifest.scripts.map((scriptName) => ({
      kind: "package-script" as const,
      id: `${packageManifest.name}#${scriptName}`,
      packageName: packageManifest.name,
      command: scriptName,
      source: {
        file: packageManifest.path,
        symbol: `scripts.${scriptName}`,
      },
    })),
  );
}

function readProjectMapDriftDiagnostics(
  manifest: ProjectMapManifest,
  options: ProjectMapOptions,
  io: ProjectMapIo,
): ProjectMapDiagnostic[] {
  const manifestPath = resolvePath(options.manifest ?? DEFAULT_PROJECT_MAP_PATH, io.cwd);
  const currentJson = stringifyProjectMapManifest(manifest);

  if (!io.exists(manifestPath)) {
    return [
      {
        code: "project-map/manifest-missing",
        severity: "error",
        artifact: manifestPath,
        message: `Project Map manifest '${manifestPath}' does not exist. Run croco project map --out ${DEFAULT_PROJECT_MAP_PATH}.`,
      },
    ];
  }

  const existingJson = normalizeJsonFile(io.readFile(manifestPath));

  if (existingJson === currentJson) {
    return [];
  }

  return [
    {
      code: "project-map/manifest-drift",
      severity: "error",
      artifact: manifestPath,
      message: `Project Map manifest '${manifestPath}' is stale. Regenerate it with croco project map --out ${DEFAULT_PROJECT_MAP_PATH}.`,
    },
  ];
}

function normalizeJsonFile(content: string): string {
  try {
    return `${JSON.stringify(JSON.parse(content) as unknown, null, 2)}\n`;
  } catch {
    return content.endsWith("\n") ? content : `${content}\n`;
  }
}

function reportProjectMapDiagnostics(manifest: ProjectMapManifest, io: ProjectMapIo): void {
  for (const diagnostic of manifest.diagnostics) {
    io.stdout(formatProjectMapDiagnostic(diagnostic));
  }

  if (hasProjectMapErrors(manifest)) {
    io.stdout(`Project Map check failed with ${manifest.summary.errors} error(s).`);
    return;
  }

  io.stdout(
    `Project Map check passed for ${manifest.summary.routes} route(s), ${manifest.summary.providers} provider(s), and ${manifest.summary.packages} package(s).`,
  );
}

function formatProjectMapDiagnostic(diagnostic: ProjectMapDiagnostic): string {
  const source = formatProjectMapSourceLocation(diagnostic.source);
  const artifact = diagnostic.artifact ? ` artifact=${diagnostic.artifact}` : "";
  const route = diagnostic.routeId ? ` route=${diagnostic.routeId}` : "";
  const packageName = diagnostic.packageName ? ` package=${diagnostic.packageName}` : "";
  const capability = diagnostic.capability ? ` capability=${diagnostic.capability}` : "";

  return `${diagnostic.severity.toUpperCase()} ${diagnostic.code}${artifact}${route}${packageName}${capability}${source}: ${diagnostic.message}`;
}

function formatProjectMapSourceLocation(source: ProjectMapSourceLocation | undefined): string {
  if (!source) {
    return "";
  }

  const line = source.line === undefined ? "" : `:${source.line}`;
  const column = source.column === undefined ? "" : `:${source.column}`;
  const symbol = source.symbol ? `#${source.symbol}` : "";

  return ` ${source.file}${line}${column}${symbol}`;
}

function appendProjectMapDiagnostics(
  manifest: ProjectMapManifest,
  diagnostics: readonly ProjectMapDiagnostic[],
): ProjectMapManifest {
  if (diagnostics.length === 0) {
    return manifest;
  }

  return withProjectMapSummary({
    ...manifest,
    diagnostics: [...manifest.diagnostics, ...diagnostics].sort(compareDiagnostics),
  });
}

function withProjectMapSummary(
  manifest: Omit<ProjectMapManifest, "summary"> & {
    readonly summary: ProjectMapManifest["summary"];
  },
): ProjectMapManifest {
  const errors = manifest.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warnings = manifest.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning",
  ).length;

  return {
    ...manifest,
    summary: {
      packages: manifest.packageGraph.packages.length,
      controllers: manifest.routeGraph.controllers.length,
      routes: manifest.routeGraph.routes.length,
      providers: manifest.di.providers.length,
      policies: manifest.policies.runtime ? 1 : 0,
      problems: manifest.problems.responses.length,
      telemetryBoundaries: manifest.telemetry.boundaries.length,
      generatedArtifacts: manifest.generatedArtifacts.length,
      diagnostics: manifest.diagnostics.length,
      errors,
      warnings,
    },
  };
}

function emptyProjectMapSummary(): ProjectMapManifest["summary"] {
  return {
    packages: 0,
    controllers: 0,
    routes: 0,
    providers: 0,
    policies: 0,
    problems: 0,
    telemetryBoundaries: 0,
    generatedArtifacts: 0,
    diagnostics: 0,
    errors: 0,
    warnings: 0,
  };
}

function hasProjectMapErrors(manifest: ProjectMapManifest): boolean {
  return manifest.diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function printProjectMapHelp(io: ProjectMapIo): void {
  io.stdout(`Usage: croco project map --controllers <glob> [--out croco.project-map.json]
       croco project map --controllers <glob> --check --manifest croco.project-map.json

Options:
  --controllers <glob>          Controller files used to build the Contract Graph
  --source <path>               Source file or directory to scan for providers, events, telemetry, and entrypoints; may be repeated
  --out <path>                  Write the stable Project Map manifest JSON
  --check                       Compare the generated manifest with --manifest and fail on drift
  --manifest <path>             Existing Project Map manifest for --check (default: croco.project-map.json)
  --framework-manifest <path>   Existing framework manifest to read when controllers are not provided
  --contract-graph <path>       Existing Contract Graph snapshot to read when controllers are not provided
  --runtime-policy <path>       Runtime policy manifest (default: croco-runtime-policy.manifest.json when present)
  --provider-profile <path>     Provider profile manifest (default: croco-saas-profile.manifest.json when present)
  --json                        Print the Project Map JSON to stdout
  --help, -h                    Show this help message`);
}

function readRootPackageManifest(path: string, io: ProjectMapIo): RootPackageManifest {
  const manifest = readJson(path, io);
  const record = asRecord(manifest);

  return {
    name: readOptionalString(record?.name) ?? "unknown",
    packageManager: readOptionalString(record?.packageManager),
  };
}

function discoverPackageGraph(projectRoot: string, io: ProjectMapIo): ProjectMapPackage[] {
  return discoverPackageManifestPaths(projectRoot, io)
    .map((path) => readProjectMapPackage(path, projectRoot, io))
    .sort(comparePackages);
}

function discoverPackageManifestPaths(projectRoot: string, io: ProjectMapIo): string[] {
  const paths: string[] = [];

  collectPackageManifestPaths(projectRoot, io, paths);

  return paths.sort(compareStrings);
}

function collectPackageManifestPaths(currentPath: string, io: ProjectMapIo, paths: string[]): void {
  for (const entry of io.readDir(currentPath)) {
    const entryPath = resolvePath(entry.name, currentPath);

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        collectPackageManifestPaths(entryPath, io, paths);
      }

      continue;
    }

    if (entry.isFile() && entry.name === "package.json") {
      paths.push(entryPath);
    }
  }
}

function readProjectMapPackage(
  path: string,
  projectRoot: string,
  io: ProjectMapIo,
): ProjectMapPackage {
  const manifest = asRecord(readJson(path, io));
  const relativePath = toStablePath(path.slice(projectRoot.length + 1));
  const scripts = asRecord(manifest?.scripts);

  return {
    name: readOptionalString(manifest?.name) ?? relativePath,
    path: relativePath,
    private: manifest?.private === true,
    scripts: Object.keys(scripts ?? {}).sort(compareStrings),
    dependencies: readProjectMapPackageDependencies(manifest).sort(comparePackageDependencies),
  };
}

function readProjectMapPackageDependencies(
  manifest: Readonly<Record<string, unknown>> | null,
): ProjectMapPackageDependency[] {
  if (!manifest) {
    return [];
  }

  return PACKAGE_DEPENDENCY_FIELDS.flatMap((field) => {
    const dependencies = asRecord(manifest[field]);

    return Object.entries(dependencies ?? {}).flatMap(([name, range]) =>
      typeof range === "string"
        ? [
            {
              name,
              range,
              kind: toPackageDependencyKind(field),
            },
          ]
        : [],
    );
  });
}

function toPackageDependencyKind(
  field: (typeof PACKAGE_DEPENDENCY_FIELDS)[number],
): ProjectMapPackageDependency["kind"] {
  if (field === "dependencies") {
    return "dependency";
  }

  if (field === "devDependencies") {
    return "devDependency";
  }

  if (field === "peerDependencies") {
    return "peerDependency";
  }

  return "optionalDependency";
}

function discoverSourcePaths(projectRoot: string, io: ProjectMapIo): string[] {
  const paths: string[] = [];

  collectSourcePaths(projectRoot, projectRoot, io, paths);

  return paths.sort(compareStrings);
}

function resolveConfiguredSourcePaths(
  projectRoot: string,
  sourcePaths: readonly string[],
  io: ProjectMapIo,
): string[] {
  const resolvedPaths = sourcePaths.flatMap((sourcePath) => {
    const filePath = resolvePath(sourcePath, projectRoot);

    if (!io.exists(filePath)) {
      return [sourcePath];
    }

    const stat = io.stat(filePath);

    if (stat.isDirectory()) {
      const nestedPaths: string[] = [];
      collectSourcePaths(filePath, projectRoot, io, nestedPaths);
      return nestedPaths;
    }

    return stat.isFile() ? [filePath] : [];
  });

  return uniqueStrings(resolvedPaths);
}

function collectSourcePaths(
  currentPath: string,
  projectRoot: string,
  io: ProjectMapIo,
  paths: string[],
): void {
  for (const entry of io.readDir(currentPath)) {
    const entryPath = resolvePath(entry.name, currentPath);

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        collectSourcePaths(entryPath, projectRoot, io, paths);
      }

      continue;
    }

    if (entry.isFile() && isProjectSourceFile(entry.name)) {
      paths.push(entryPath);
    }
  }
}

function isProjectSourceFile(name: string): boolean {
  return (
    SOURCE_EXTENSIONS.test(name) &&
    !name.endsWith(".d.ts") &&
    !name.endsWith(".spec.ts") &&
    !name.endsWith(".test.ts")
  );
}

function discoverTelemetryBoundaries(
  projectRoot: string,
  sourcePaths: readonly string[],
  io: ProjectMapIo,
): ProjectMapTelemetryBoundary[] {
  return sourcePaths
    .filter(
      (sourcePath) => io.exists(resolvePath(sourcePath, projectRoot)) || io.exists(sourcePath),
    )
    .flatMap((sourcePath) => {
      const filePath = io.exists(sourcePath) ? sourcePath : resolvePath(sourcePath, projectRoot);
      const stablePath = toStablePath(
        filePath.startsWith(projectRoot) ? filePath.slice(projectRoot.length + 1) : filePath,
      );

      return scanTelemetryBoundaries(stablePath, io.readFile(filePath));
    })
    .sort(compareTelemetryBoundaries);
}

function scanTelemetryBoundaries(path: string, content: string): ProjectMapTelemetryBoundary[] {
  return content.split("\n").flatMap((line, index) => {
    const lineNumber = index + 1;
    const candidates: ProjectMapTelemetryBoundary[] = [];

    if (line.includes("TelemetryRuntime")) {
      candidates.push(createTelemetryBoundary("telemetry-runtime", path, lineNumber, line));
    }
    if (line.includes("@Trace")) {
      candidates.push(createTelemetryBoundary("trace-decorator", path, lineNumber, line));
    }
    if (line.includes("withSpan")) {
      candidates.push(createTelemetryBoundary("span-wrapper", path, lineNumber, line));
    }
    if (line.includes("forceFlush")) {
      candidates.push(createTelemetryBoundary("telemetry-flush", path, lineNumber, line));
    }

    return candidates;
  });
}

function createTelemetryBoundary(
  kind: ProjectMapTelemetryBoundaryKind,
  path: string,
  line: number,
  content: string,
): ProjectMapTelemetryBoundary {
  return {
    kind,
    id: `${kind}:${path}:${line}`,
    source: {
      file: path,
      line,
      column: Math.max(content.search(/\S/) + 1, 1),
    },
  };
}

function readFrameworkManifest(
  path: string,
  projectRoot: string,
  io: ProjectMapIo,
): FrameworkManifest {
  const manifestPath = resolvePath(path, projectRoot);

  if (!io.exists(manifestPath)) {
    throw new Error(
      `Missing framework manifest '${manifestPath}'. Pass --controllers <glob> or run @croco/framework-routes first.`,
    );
  }

  return readJson(manifestPath, io) as FrameworkManifest;
}

function readOptionalContractGraphSnapshot(
  path: string,
  projectRoot: string,
  io: ProjectMapIo,
  required = false,
): ContractGraphSnapshot | undefined {
  const manifestPath = resolvePath(path, projectRoot);

  if (!io.exists(manifestPath)) {
    if (required) {
      throw new Error(`Missing Contract Graph snapshot '${manifestPath}'.`);
    }

    return undefined;
  }

  const snapshot = readJson(manifestPath, io);

  if (!isContractGraphSnapshot(snapshot)) {
    throw new Error(
      `Contract Graph snapshot '${manifestPath}' must be croco.contract-graph.snapshot.v1.`,
    );
  }

  return snapshot;
}

function readOptionalRuntimePolicyManifest(
  path: string,
  projectRoot: string,
  io: ProjectMapIo,
  required = false,
): RuntimePolicyProjectMapInput | undefined {
  const manifestPath = resolvePath(path, projectRoot);

  if (!io.exists(manifestPath)) {
    if (required) {
      throw new Error(`Missing runtime policy manifest '${manifestPath}'.`);
    }

    return undefined;
  }

  return {
    path,
    manifest: parseRuntimePolicyManifest(io.readFile(manifestPath), manifestPath),
  };
}

function readOptionalProviderProfileManifest(
  path: string,
  projectRoot: string,
  io: ProjectMapIo,
  required = false,
): ProviderProfileProjectMapInput | undefined {
  const manifestPath = resolvePath(path, projectRoot);

  if (!io.exists(manifestPath)) {
    if (required) {
      throw new Error(`Missing provider profile manifest '${manifestPath}'.`);
    }

    return undefined;
  }

  const manifest = asRecord(readJson(manifestPath, io));

  return {
    path,
    manifest: {
      schemaVersion: readOptionalString(manifest?.schemaVersion),
      profile: readProviderProfile(manifest?.profile),
      packages: readStringArray(manifest?.packages),
    },
  };
}

function readProviderProfile(value: unknown): ProviderProfileManifest["profile"] {
  const record = asRecord(value);

  if (!record) {
    return undefined;
  }

  return {
    name: readOptionalString(record.name),
  };
}

function parseRuntimePolicyManifest(
  content: string,
  manifestPath: string,
): RuntimePolicyCheckManifest {
  const parsed = readJsonContent(content, manifestPath);
  const record = asRecord(parsed);

  if (!record) {
    throw new Error(`Runtime policy manifest at ${manifestPath} must be a JSON object.`);
  }

  return {
    version: readOptionalString(record.version),
    schemaVersion: readOptionalString(record.schemaVersion),
    target: readRuntimePlatform(record.target),
    runtime: readRuntimeConfig(record.runtime),
    table: readPolicyTable(record.table),
    plans: readPolicyPlans(record.plans),
  };
}

function readRuntimeConfig(value: unknown): RuntimePolicyCheckManifest["runtime"] {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    platform: readRuntimePlatform(value.platform),
    capabilities: readCapabilities(value.capabilities),
    source: readPolicySource(value.source),
  };
}

function readRuntimePlatform(value: unknown): RuntimePlatform | undefined {
  return readOptionalString(value) as RuntimePlatform | undefined;
}

function readCapabilities(
  value: unknown,
): Partial<Record<RuntimeCapabilityName, boolean>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const capabilities: Partial<Record<RuntimeCapabilityName, boolean>> = {};

  for (const capability of RUNTIME_CAPABILITY_NAMES) {
    const capabilityValue = value[capability];

    if (typeof capabilityValue === "boolean") {
      capabilities[capability] = capabilityValue;
    }
  }

  return capabilities;
}

function readPolicySource(value: unknown): PolicySource | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    packageName: readOptionalString(value.packageName),
    file: readOptionalString(value.file),
    symbol: readOptionalString(value.symbol),
    decorator: readOptionalString(value.decorator),
  };
}

function readPolicyTable(value: unknown): PolicyTable | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const plans = readPolicyPlans(value.plans);
  return plans ? { plans } : undefined;
}

function readPolicyPlans(value: unknown): PolicyTable["plans"] | undefined {
  return Array.isArray(value) ? (value as PolicyTable["plans"]) : undefined;
}

function getRuntimePolicyTable(manifest: RuntimePolicyCheckManifest): PolicyTable {
  if (manifest.table) {
    return manifest.table;
  }

  if (manifest.plans) {
    return { plans: manifest.plans };
  }

  return { plans: [] };
}

function readJson(path: string, io: ProjectMapIo): unknown {
  return readJsonContent(io.readFile(path), path);
}

function readJsonContent(content: string, path: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read JSON '${path}': ${message}`);
  }
}

function writeOutputFile(path: string, content: string, io: ProjectMapIo): void {
  const resolvedPath = resolvePath(path, io.cwd);
  io.mkdir(dirname(resolvedPath));
  io.writeFile(resolvedPath, content);
}

function toProjectMapSourceLocation(source: {
  readonly path: string;
  readonly line: number;
  readonly column: number;
}): ProjectMapSourceLocation {
  return {
    file: source.path,
    line: source.line,
    column: source.column,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").sort(compareStrings)
    : [];
}

function resolvePath(path: string, cwd: string): string {
  return resolve(cwd, path);
}

function toStablePath(path: string): string {
  return path.split("\\").join("/");
}

function getFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

function getFlagValues(args: readonly string[], flag: string): string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) {
      continue;
    }

    const value = args[index + 1];
    if (value && !value.startsWith("--")) {
      values.push(value);
      index += 1;
    }
  }

  return values;
}

function getFirstPosition(args: readonly string[]): string | null {
  const valueFlags = new Set([
    "--controllers",
    "--source",
    "--out",
    "--manifest",
    "--framework-manifest",
    "--contract-graph",
    "--runtime-policy",
    "--provider-profile",
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (valueFlags.has(arg)) {
      index += 1;
      continue;
    }

    if (!arg.startsWith("-")) {
      return arg;
    }
  }

  return null;
}

function compareById(left: { readonly id: string }, right: { readonly id: string }): number {
  return compareStrings(left.id, right.id);
}

function comparePackages(left: ProjectMapPackage, right: ProjectMapPackage): number {
  return compareStrings(left.name, right.name) || compareStrings(left.path, right.path);
}

function comparePackageDependencies(
  left: ProjectMapPackageDependency,
  right: ProjectMapPackageDependency,
): number {
  return compareStrings(left.name, right.name) || compareStrings(left.kind, right.kind);
}

function compareGeneratedArtifacts(
  left: ProjectMapGeneratedArtifact,
  right: ProjectMapGeneratedArtifact,
): number {
  return compareStrings(left.kind, right.kind) || compareStrings(left.path, right.path);
}

function compareEntrypoints(left: ProjectMapEntrypoint, right: ProjectMapEntrypoint): number {
  return (
    compareStrings(left.kind, right.kind) ||
    compareStrings(left.id, right.id) ||
    compareStrings(left.packageName ?? "", right.packageName ?? "")
  );
}

function compareTelemetryBoundaries(
  left: ProjectMapTelemetryBoundary,
  right: ProjectMapTelemetryBoundary,
): number {
  return compareStrings(left.kind, right.kind) || compareStrings(left.id, right.id);
}

function compareDiagnostics(left: ProjectMapDiagnostic, right: ProjectMapDiagnostic): number {
  return (
    compareStrings(left.severity, right.severity) ||
    compareStrings(left.code, right.code) ||
    compareStrings(left.artifact ?? "", right.artifact ?? "") ||
    compareStrings(left.routeId ?? "", right.routeId ?? "") ||
    compareStrings(left.packageName ?? "", right.packageName ?? "") ||
    compareStrings(left.message, right.message)
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}
