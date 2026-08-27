import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  DependencyGraphDiagnostic,
  DependencyGraphManifest,
  TokenIdentifier,
} from "@croco/framework-context";
import { Container } from "@croco/framework-context";
import { defineCommand } from "citty";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";

const DEFAULT_MANIFEST_PATH = ".croco/build/di-graph.manifest.json";
const VALUE_FLAGS = new Set(["--write", "--module", "--bootstrap", "--roots"]);
const BOOLEAN_FLAGS = new Set(["--json", "--help", "-h"]);

export type DiGraphIo = {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
  readonly writeFile: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly cwd: string;
};

export type DiGraphModuleLoader = (
  modulePath: string,
  cwd: string,
) => Promise<Record<string, unknown>>;

type DependencyGraphContainer = {
  readonly createDependencyGraphManifest: (options?: {
    readonly roots?: readonly TokenIdentifier<unknown>[];
  }) => DependencyGraphManifest;
};

type DiGraphFrameworkContext = {
  readonly Container?: DependencyGraphContainer;
  readonly default?: {
    readonly Container?: DependencyGraphContainer;
  };
};

export type DiGraphFrameworkContextLoader = (
  modulePath: string,
  cwd: string,
) => Promise<DiGraphFrameworkContext>;

type DiGraphOptions = {
  readonly write: string | null;
  readonly module: string | null;
  readonly bootstrap: string | null;
  readonly roots: string | null;
  readonly json: boolean;
};

type DiGraphParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "run"; readonly options: DiGraphOptions };

function createDefaultIo(): DiGraphIo {
  const runtime = getCrocoCommandRuntime();
  return {
    stdout: runtime.stdout,
    stderr: runtime.stderr,
    writeFile: (path, content) => writeFileSync(path, content),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
    cwd: runtime.cwd,
  };
}

const defaultLoadModule: DiGraphModuleLoader = async (modulePath, cwd) =>
  (await import(pathToFileURL(resolvePath(modulePath, cwd)).href)) as Record<string, unknown>;

const defaultLoadFrameworkContext: DiGraphFrameworkContextLoader = async (modulePath, cwd) => {
  const resolvedModule = resolvePath(modulePath, cwd);
  const requireFromAppModule = createRequire(resolvePath(modulePath, cwd));
  const requireEntry = requireFromAppModule.resolve("@croco/framework-context");
  const frameworkContextPath = resolveFrameworkContextEntry(requireEntry, resolvedModule);
  return (await import(pathToFileURL(frameworkContextPath).href)) as DiGraphFrameworkContext;
};

export const diGraph = defineCommand({
  meta: {
    name: "graph",
    description: "Generate a deterministic Croco DI graph manifest",
  },
  args: {
    write: {
      type: "string",
      description: "Write the DI graph manifest to this path",
    },
    module: {
      type: "string",
      description: "Application module to import before reading the DI graph",
    },
    bootstrap: {
      type: "string",
      description: "Named export to run before reading the DI graph",
    },
    roots: {
      type: "string",
      description: "Named export containing root DI tokens",
    },
    json: {
      type: "boolean",
      description: "Print the DI graph manifest JSON to stdout",
    },
  },
  async run({ rawArgs }) {
    getCrocoCommandRuntime().setExitCode(await runDiGraph(rawArgs));
  },
});

export async function runDiGraph(
  args: readonly string[],
  options: {
    readonly io?: Partial<DiGraphIo>;
    readonly loadModule?: DiGraphModuleLoader;
    readonly loadFrameworkContext?: DiGraphFrameworkContextLoader;
  } = {},
): Promise<number> {
  const parsed = parseDiGraphArgs(args);
  const io = { ...createDefaultIo(), ...options.io };
  const loadModule = options.loadModule ?? defaultLoadModule;
  // Custom module loaders are usually test fixtures; without a matching framework-context loader, fall back to the CLI Container.
  const loadFrameworkContext =
    options.loadFrameworkContext ?? (options.loadModule ? undefined : defaultLoadFrameworkContext);

  if (parsed.kind === "help") {
    printDiGraphHelp(io);
    return 0;
  }

  if (parsed.kind === "invalid") {
    io.stderr(parsed.message);
    printDiGraphHelp(io);
    return 1;
  }

  const prepared = await prepareDiGraph(parsed.options, io, loadModule, loadFrameworkContext);
  if (prepared.kind === "error") {
    io.stderr(prepared.message);
    return 1;
  }

  const manifest = prepared.container.createDependencyGraphManifest(
    prepared.roots ? { roots: prepared.roots } : {},
  );
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  const writePath = parsed.options.write ?? (parsed.options.json ? null : DEFAULT_MANIFEST_PATH);

  if (writePath) {
    writeOutputFile(writePath, manifestJson, io);
  }

  if (parsed.options.json) {
    io.stdout(manifestJson.trimEnd());
  } else {
    reportDiGraphManifest(manifest, writePath, io);
  }

  return manifest.status === "ready" ? 0 : 1;
}

export function parseDiGraphArgs(args: readonly string[]): DiGraphParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    const assignment = parseFlagAssignment(arg);
    if (assignment && VALUE_FLAGS.has(assignment.flag)) {
      if (assignment.value.length === 0) {
        return { kind: "invalid", message: `Missing value for ${assignment.flag}.` };
      }
      continue;
    }

    if (assignment) {
      return { kind: "invalid", message: `Unsupported option ${arg}.` };
    }

    if (VALUE_FLAGS.has(arg)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        return { kind: "invalid", message: `Missing value for ${arg}.` };
      }
      index += 1;
      continue;
    }

    if (BOOLEAN_FLAGS.has(arg)) {
      continue;
    }

    if (arg.startsWith("-")) {
      return { kind: "invalid", message: `Unsupported option ${arg}.` };
    }

    return { kind: "invalid", message: `Unexpected argument ${arg}.` };
  }

  const bootstrap = getFlagValue(args, "--bootstrap");
  const module = getFlagValue(args, "--module");
  const roots = getFlagValue(args, "--roots");

  if (bootstrap && !module) {
    return {
      kind: "invalid",
      message: "Pass --module <path> when using --bootstrap <export>.",
    };
  }

  if (roots && !module) {
    return {
      kind: "invalid",
      message: "Pass --module <path> when using --roots <export>.",
    };
  }

  return {
    kind: "run",
    options: {
      write: getFlagValue(args, "--write"),
      module,
      bootstrap,
      roots,
      json: args.includes("--json"),
    },
  };
}

async function prepareDiGraph(
  options: DiGraphOptions,
  io: DiGraphIo,
  loadModule: DiGraphModuleLoader,
  loadFrameworkContext?: DiGraphFrameworkContextLoader,
): Promise<
  | {
      readonly kind: "ready";
      readonly container: DependencyGraphContainer;
      readonly roots?: readonly TokenIdentifier<unknown>[];
    }
  | { readonly kind: "error"; readonly message: string }
> {
  if (!options.module) {
    return { kind: "ready", container: Container };
  }

  const resolvedModule = resolvePath(options.module, io.cwd);
  let loadedModule: Record<string, unknown>;
  try {
    loadedModule = await loadModule(options.module, io.cwd);
  } catch (error) {
    return {
      kind: "error",
      message: `Unable to load DI graph module '${resolvedModule}': ${formatUnknownError(error)}`,
    };
  }

  if (!options.bootstrap) {
    return prepareModuleDiGraph(options, resolvedModule, loadedModule, io, loadFrameworkContext);
  }

  const bootstrapExport = loadedModule[options.bootstrap];
  if (typeof bootstrapExport !== "function") {
    return {
      kind: "error",
      message: `DI graph bootstrap export '${options.bootstrap}' was not found in '${resolvedModule}'.`,
    };
  }

  try {
    await bootstrapExport();
  } catch (error) {
    return {
      kind: "error",
      message: `DI graph bootstrap '${options.bootstrap}' failed in '${resolvedModule}': ${formatUnknownError(error)}`,
    };
  }

  return prepareModuleDiGraph(options, resolvedModule, loadedModule, io, loadFrameworkContext);
}

async function prepareModuleDiGraph(
  options: DiGraphOptions,
  resolvedModule: string,
  loadedModule: Record<string, unknown>,
  io: DiGraphIo,
  loadFrameworkContext?: DiGraphFrameworkContextLoader,
): Promise<
  | {
      readonly kind: "ready";
      readonly container: DependencyGraphContainer;
      readonly roots?: readonly TokenIdentifier<unknown>[];
    }
  | { readonly kind: "error"; readonly message: string }
> {
  const rootsResult = await readDiGraphRoots(options, resolvedModule, loadedModule);
  if (rootsResult.kind === "error") {
    return rootsResult;
  }

  const containerResult = await readDiGraphContainer(
    options,
    resolvedModule,
    io,
    loadFrameworkContext,
  );
  if (containerResult.kind === "error") {
    return containerResult;
  }

  return { kind: "ready", roots: rootsResult.roots, container: containerResult.container };
}

async function readDiGraphContainer(
  options: DiGraphOptions,
  resolvedModule: string,
  io: DiGraphIo,
  loadFrameworkContext?: DiGraphFrameworkContextLoader,
): Promise<
  | { readonly kind: "ready"; readonly container: DependencyGraphContainer }
  | { readonly kind: "error"; readonly message: string }
> {
  if (!loadFrameworkContext || !options.module) {
    return { kind: "ready", container: Container };
  }

  let frameworkContext: DiGraphFrameworkContext;
  try {
    frameworkContext = await loadFrameworkContext(options.module, io.cwd);
  } catch (error) {
    return {
      kind: "error",
      message: `Unable to load @croco/framework-context for DI graph module '${resolvedModule}': ${formatUnknownError(error)}`,
    };
  }

  const container = readFrameworkContextContainer(frameworkContext);
  if (!container) {
    return {
      kind: "error",
      message: `@croco/framework-context resolved for '${resolvedModule}' does not export Container.createDependencyGraphManifest.`,
    };
  }

  return { kind: "ready", container };
}

async function readDiGraphRoots(
  options: DiGraphOptions,
  resolvedModule: string,
  loadedModule: Record<string, unknown>,
): Promise<
  | { readonly kind: "ready"; readonly roots?: readonly TokenIdentifier<unknown>[] }
  | { readonly kind: "error"; readonly message: string }
> {
  if (!options.roots) {
    return { kind: "ready" };
  }

  const rootsExport = loadedModule[options.roots];
  if (rootsExport === undefined) {
    return {
      kind: "error",
      message: `DI graph roots export '${options.roots}' was not found in '${resolvedModule}'.`,
    };
  }

  let roots: unknown;
  try {
    roots = typeof rootsExport === "function" ? await rootsExport() : rootsExport;
  } catch (error) {
    return {
      kind: "error",
      message: `DI graph roots export '${options.roots}' failed in '${resolvedModule}': ${formatUnknownError(error)}`,
    };
  }

  if (!Array.isArray(roots)) {
    return {
      kind: "error",
      message: `DI graph roots export '${options.roots}' in '${resolvedModule}' must return an array.`,
    };
  }

  return { kind: "ready", roots: roots as readonly TokenIdentifier<unknown>[] };
}

function reportDiGraphManifest(
  manifest: DependencyGraphManifest,
  writePath: string | null,
  io: DiGraphIo,
): void {
  for (const diagnostic of manifest.diagnostics) {
    io.stdout(formatDiGraphDiagnostic(diagnostic));
  }

  if (writePath) {
    io.stdout(`Wrote DI graph manifest to ${resolvePath(writePath, io.cwd)}.`);
  }

  if (manifest.status === "ready") {
    io.stdout(`DI graph manifest ready with ${manifest.providers.length} provider(s).`);
    return;
  }

  io.stdout(`DI graph manifest failed with ${manifest.diagnostics.length} diagnostic(s).`);
}

function formatDiGraphDiagnostic(diagnostic: DependencyGraphDiagnostic): string {
  const token = ` token=${diagnostic.token}`;
  const legacyCode = ` legacyCode=${diagnostic.legacyCode}`;
  const location = formatSourceLocation(diagnostic.sourceLocation);
  return `${diagnostic.code}${legacyCode}${token}${location}: ${diagnostic.message}`;
}

function formatSourceLocation(sourceLocation: DependencyGraphDiagnostic["sourceLocation"]): string {
  if (!sourceLocation) {
    return "";
  }

  const line = sourceLocation.line === undefined ? "" : `:${sourceLocation.line}`;
  const column = sourceLocation.column === undefined ? "" : `:${sourceLocation.column}`;
  return ` ${sourceLocation.file}${line}${column}`;
}

function isDependencyGraphContainer(value: unknown): value is DependencyGraphContainer {
  const valueType = typeof value;
  if (value === null || (valueType !== "object" && valueType !== "function")) {
    return false;
  }

  const candidate = value as { readonly createDependencyGraphManifest?: unknown };
  return typeof candidate.createDependencyGraphManifest === "function";
}

function readFrameworkContextContainer(
  frameworkContext: DiGraphFrameworkContext,
): DependencyGraphContainer | null {
  if (isDependencyGraphContainer(frameworkContext.Container)) {
    return frameworkContext.Container;
  }

  if (isDependencyGraphContainer(frameworkContext.default?.Container)) {
    return frameworkContext.default.Container;
  }

  return null;
}

function printDiGraphHelp(io: DiGraphIo): void {
  io.stdout(`Usage: croco di graph [--write <path>] [--module <path>] [--bootstrap <export>] [--roots <export>] [--json]

Options:
  --write <path>       Write the DI graph manifest. Defaults to ${DEFAULT_MANIFEST_PATH} without --json
  --module <path>      Import an application module before manifest generation
  --bootstrap <export> Run a named module export before manifest generation
  --roots <export>     Use a named module export as the manifest root token array
  --json               Print the generated manifest JSON to stdout
  --help, -h           Show this help message`);
}

function writeOutputFile(path: string, content: string, io: DiGraphIo): void {
  const resolvedPath = resolvePath(path, io.cwd);
  io.mkdir(dirname(resolvedPath));
  io.writeFile(resolvedPath, content);
}

function resolvePath(path: string, cwd: string): string {
  return resolve(cwd, path);
}

function resolveFrameworkContextEntry(requireEntry: string, appModulePath: string): string {
  if (!isEsmModulePath(appModulePath)) {
    return requireEntry;
  }

  const packageRoot = findPackageRoot(requireEntry, "@croco/framework-context");
  if (!packageRoot) {
    return requireEntry;
  }

  const packageJson = readPackageJson(join(packageRoot, "package.json"));
  const importEntry = readPackageImportEntry(packageJson);

  return importEntry ? resolve(packageRoot, importEntry) : requireEntry;
}

function isEsmModulePath(modulePath: string): boolean {
  if (modulePath.endsWith(".mjs") || modulePath.endsWith(".mts")) {
    return true;
  }

  if (modulePath.endsWith(".cjs") || modulePath.endsWith(".cts")) {
    return false;
  }

  const packageRoot = findNearestPackageRoot(modulePath);
  if (!packageRoot) {
    return false;
  }

  const packageJson = readPackageJson(join(packageRoot, "package.json"));
  return readStringProperty(packageJson, "type") === "module";
}

function findNearestPackageRoot(path: string): string | null {
  let current = dirname(path);

  while (current !== dirname(current)) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }
    current = dirname(current);
  }

  return null;
}

function findPackageRoot(entryPath: string, packageName: string): string | null {
  let current = dirname(entryPath);

  while (current !== dirname(current)) {
    const packageJsonPath = join(current, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = readPackageJson(packageJsonPath);
      if (readStringProperty(packageJson, "name") === packageName) {
        return current;
      }
    }
    current = dirname(current);
  }

  return null;
}

function readPackageJson(path: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readPackageImportEntry(packageJson: Record<string, unknown> | null): string | null {
  if (!packageJson) {
    return null;
  }

  const exportsField = packageJson.exports;
  if (typeof exportsField === "string") {
    return exportsField;
  }

  if (exportsField && typeof exportsField === "object" && !Array.isArray(exportsField)) {
    const rootExport = (exportsField as Record<string, unknown>)["."];
    if (typeof rootExport === "string") {
      return rootExport;
    }
    if (rootExport && typeof rootExport === "object" && !Array.isArray(rootExport)) {
      return readStringProperty(rootExport as Record<string, unknown>, "import");
    }
  }

  return readStringProperty(packageJson, "module");
}

function readStringProperty(value: Record<string, unknown> | null, key: string): string | null {
  const property = value?.[key];
  return typeof property === "string" ? property : null;
}

function getFlagValue(args: readonly string[], flag: string): string | null {
  const assignment = args.find((arg) => arg.startsWith(`${flag}=`));
  if (assignment) {
    const value = assignment.slice(flag.length + 1);
    return value.length > 0 ? value : null;
  }

  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

function parseFlagAssignment(
  arg: string,
): { readonly flag: string; readonly value: string } | null {
  const separator = arg.indexOf("=");
  if (separator < 0 || !arg.startsWith("--")) {
    return null;
  }

  return {
    flag: arg.slice(0, separator),
    value: arg.slice(separator + 1),
  };
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
