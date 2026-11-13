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

type ProjectFiles = {
  project: ts.ParsedCommandLine;
  rootFiles: readonly string[];
};

export function generatedImportExtension(importerPath: string): ImportExtension {
  const fileName = ts.sys.resolvePath(importerPath);
  const configPath = ts.findConfigFile(dirname(fileName), ts.sys.fileExists);
  if (!configPath) return "";

  const project = readProject(configPath, fileName);
  return (
    findProjectExtension(project, fileName, new Set([configPath])) ??
    importExtension(fileName, project.project.options)
  );
}

function findProjectExtension(
  { project, rootFiles }: ProjectFiles,
  fileName: string,
  visited: Set<string>,
): ImportExtension | undefined {
  let extension = includesSource(project, rootFiles, fileName)
    ? importExtension(fileName, project.options)
    : undefined;
  for (const reference of project.projectReferences ?? []) {
    if (extension === ".js") break;
    const path = ts.resolveProjectReferencePath(reference);
    if (visited.has(path)) continue;
    visited.add(path);
    extension = findProjectExtension(readProject(path, fileName), fileName, visited) ?? extension;
  }
  return extension;
}

function includesSource(
  project: ts.ParsedCommandLine,
  rootFiles: readonly string[],
  fileName: string,
): boolean {
  if (project.fileNames.includes(fileName)) return true;
  if (rootFiles.length === 0 || importExtension(fileName, project.options) !== ".js") return false;

  // Explicit entry-point lists can reach generated source through imports.
  const host = ts.createCompilerHost(project.options);
  const readFile = host.readFile;
  const fileExists = host.fileExists;
  host.readFile = (path) => (path === fileName ? "" : readFile(path));
  host.fileExists = (path) => path === fileName || fileExists(path);
  const program = ts.createProgram({
    rootNames: [...rootFiles],
    options: { ...project.options, noLib: true, types: [] },
    host,
  });
  return program.getSourceFile(fileName) !== undefined;
}

function readProject(configPath: string, fileName: string): ProjectFiles {
  const sourceDirectory = posix.dirname(fileName);
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      readDirectory: (path, extensions, excludes, includes, depth) =>
        matchFiles(
          path,
          extensions,
          excludes,
          includes,
          ts.sys.useCaseSensitiveFileNames,
          ts.sys.getCurrentDirectory(),
          depth,
          (directory) => {
            const absoluteDirectory = ts.sys.resolvePath(directory);
            if (
              absoluteDirectory === sourceDirectory ||
              (!ts.sys.useCaseSensitiveFileNames &&
                absoluteDirectory.toLowerCase() === sourceDirectory.toLowerCase())
            ) {
              return { files: [basename(fileName)], directories: [] };
            }
            const relative = posix.relative(absoluteDirectory, sourceDirectory);
            const child = relative.split("/")[0];
            return { files: [], directories: child && child !== ".." ? [child] : [] };
          },
          (path) => path,
        ),
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
  // Read actual entry points only when the proposed source is absent from the root patterns.
  const rootFiles = parsed.fileNames.includes(fileName)
    ? parsed.fileNames
    : (ts.getParsedCommandLineOfConfigFile(
        configPath,
        {},
        {
          ...ts.sys,
          onUnRecoverableConfigFileDiagnostic: failInvalidConfig,
        },
      )?.fileNames ?? []);
  return { project: parsed, rootFiles };
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
