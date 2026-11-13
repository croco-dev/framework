import { basename, dirname, posix } from "node:path";
import ts from "typescript";
import { CliError } from "./CliError.js";

type ImportExtension = "" | ".js";

// Use the pinned compiler's own include/exclude matcher for a file that may not exist yet.
const { matchFiles } = ts as typeof ts & {
  matchFiles(
    path: string,
    extensions: readonly string[] | undefined,
    excludes: readonly string[] | undefined,
    includes: readonly string[] | undefined,
    caseSensitive: boolean,
    cwd: string,
    depth: number | undefined,
    readEntries: (directory: string) => { files: string[]; directories: string[] },
    realpath: (path: string) => string,
  ): string[];
};

export function generatedImportExtension(
  importerPath: string,
  generatedSources: ReadonlyMap<string, string> = new Map(),
  overwrite = false,
  sourceRoot = dirname(importerPath),
): ImportExtension {
  const fileName = ts.sys.resolvePath(importerPath);
  const planned = new Map(
    Array.from(generatedSources, ([path, content]) => [ts.sys.resolvePath(path), content]),
  );
  const plannedPaths = [...planned.keys(), fileName];
  const configPath = ts.findConfigFile(dirname(fileName), ts.sys.fileExists);
  if (!configPath) return "";

  const project = readProject(configPath, plannedPaths);
  if (!project.projectReferences?.length) return importExtension(fileName, project.options);

  const visited = new Set([configPath]);
  const configs = [configPath];
  const sourcePrefix = `${ts.sys.resolvePath(sourceRoot)}/`;
  let directlyIncluded = false;
  let hasNodeEsmApp = false;
  let hasOtherApp = false;
  const otherProjects: Array<{ path: string; project: ts.ParsedCommandLine }> = [];
  for (const path of configs) {
    const candidate = path === configPath ? project : readProject(path, plannedPaths);
    const roots = candidate.fileNames;
    const includesImporter = roots.includes(fileName);
    directlyIncluded ||= includesImporter;
    if (importExtension(fileName, candidate.options) === ".js") {
      if (includesImporter) return ".js";
      const actualRoots = readProject(path, plannedPaths, true).fileNames;
      if (!candidate.options.noResolve) {
        const program = createReferenceProgram(
          candidate.options,
          [...new Set([...roots, ...actualRoots])],
          fileName,
          planned,
          overwrite,
        );
        if (program?.getSourceFile(fileName)) return ".js";
        hasNodeEsmApp ||=
          program?.getSourceFiles().some((source) => source.fileName.startsWith(sourcePrefix)) ??
          false;
      }
    } else if (!includesImporter && !candidate.options.noResolve) {
      otherProjects.push({ path, project: candidate });
    }
    for (const reference of candidate.projectReferences ?? []) {
      const path = ts.resolveProjectReferencePath(reference);
      if (visited.has(path)) continue;
      visited.add(path);
      configs.push(path);
    }
  }
  if (directlyIncluded || !hasNodeEsmApp) return "";
  for (const { path, project: candidate } of otherProjects) {
    const actualRoots = readProject(path, plannedPaths, true).fileNames;
    const program = createReferenceProgram(
      candidate.options,
      [...new Set([...candidate.fileNames, ...actualRoots])],
      fileName,
      planned,
      overwrite,
    );
    if (program?.getSourceFile(fileName)) return "";
    hasOtherApp ||=
      program?.getSourceFiles().some((source) => source.fileName.startsWith(sourcePrefix)) ?? false;
  }
  return hasOtherApp ? "" : ".js";
}

function createReferenceProgram(
  options: ts.CompilerOptions,
  roots: string[],
  fileName: string,
  planned: ReadonlyMap<string, string>,
  overwrite: boolean,
): ts.Program | undefined {
  if (!roots.length) return undefined;

  const sources = new Map(planned);
  if (!sources.has(fileName)) sources.set(fileName, "");
  const directories = new Set<string>();
  for (const path of sources.keys()) {
    for (
      let directory = dirname(path);
      !ts.sys.directoryExists(directory);
      directory = dirname(directory)
    ) {
      if (directories.has(directory)) break;
      directories.add(directory);
    }
  }

  const compilerOptions = { ...options, noLib: true, types: [] };
  const host = ts.createCompilerHost(compilerOptions);
  host.readFile = (path) =>
    (overwrite ? planned.get(path) : undefined) ?? ts.sys.readFile(path) ?? sources.get(path);
  host.fileExists = (path) => sources.has(path) || ts.sys.fileExists(path);
  host.directoryExists = (path) => directories.has(path) || ts.sys.directoryExists(path);
  const cache = ts.createModuleResolutionCache(
    host.getCurrentDirectory(),
    host.getCanonicalFileName,
    compilerOptions,
  );
  host.resolveModuleNameLiterals = (literals, containingFile, _redirect, options, source) =>
    literals.map((literal) => {
      const resolved = ts.resolveModuleName(
        literal.text,
        containingFile,
        options,
        host,
        cache,
        undefined,
        ts.getModeForUsageLocation(source, literal, options),
      );
      // Package declarations cannot make an application source a root or a local import.
      return resolved.resolvedModule?.isExternalLibraryImport
        ? { resolvedModule: undefined }
        : resolved;
    });
  return ts.createProgram(roots, compilerOptions, host);
}

function readProject(
  configPath: string,
  plannedPaths: readonly string[],
  readExistingFiles = false,
): ts.ParsedCommandLine {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      readDirectory: (path, extensions, excludes, includes, depth) => {
        if (readExistingFiles)
          return ts.sys.readDirectory(path, extensions, excludes, includes, depth);
        return matchFiles(
          path,
          extensions,
          excludes,
          includes,
          ts.sys.useCaseSensitiveFileNames,
          ts.sys.getCurrentDirectory(),
          depth,
          (directory) => {
            const absoluteDirectory = ts.sys.resolvePath(directory);
            const files = new Set<string>();
            const directories = new Set<string>();
            for (const path of plannedPaths) {
              const relative = posix.relative(absoluteDirectory, path);
              const slash = relative.indexOf("/");
              if (relative.startsWith("../") || !relative) continue;
              if (slash === -1) files.add(basename(path));
              else directories.add(relative.slice(0, slash));
            }
            return { files: [...files], directories: [...directories] };
          },
          (path) => path,
        );
      },
      onUnRecoverableConfigFileDiagnostic: failInvalidConfig,
    },
  );
  if (!parsed) {
    throw new CliError(
      "CROCO_CLI_GENERATION_FAILED",
      `Cannot read TypeScript config ${configPath}.`,
    );
  }
  // Empty files and include lists do not affect module resolution.
  const invalidConfig = parsed.errors.find(({ code }) => code !== 18002 && code !== 18003);
  if (invalidConfig) failInvalidConfig(invalidConfig);
  return parsed;
}

function importExtension(fileName: string, options: ts.CompilerOptions): ImportExtension {
  return ts.getImpliedNodeFormatForFile(fileName, undefined, ts.sys, options) ===
    ts.ModuleKind.ESNext
    ? ".js"
    : "";
}

function failInvalidConfig(diagnostic: ts.Diagnostic): never {
  throw new CliError(
    "CROCO_CLI_GENERATION_FAILED",
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  );
}
