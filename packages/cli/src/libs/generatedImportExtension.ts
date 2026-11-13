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
  sourceRoot = dirname(importerPath),
): ImportExtension {
  const fileName = ts.sys.resolvePath(importerPath);
  const sourcePrefix = `${ts.sys.resolvePath(sourceRoot)}/`;
  const configPath = ts.findConfigFile(dirname(fileName), ts.sys.fileExists);
  if (!configPath) return "";

  const project = readProject(configPath, fileName);
  if (!project.projectReferences?.length) return importExtension(fileName, project.options);

  const visited = new Set([configPath]);
  const configs = [configPath];
  for (const path of configs) {
    const candidate = path === configPath ? project : readProject(path, fileName);
    if (importExtension(fileName, candidate.options) === ".js") {
      const roots = candidate.fileNames;
      if (roots.includes(fileName)) return ".js";
      // An explicit application entry can reach newly generated modules through imports.
      if (!candidate.options.noResolve && roots.some((root) => root.startsWith(sourcePrefix))) {
        return ".js";
      }
    }
    for (const reference of candidate.projectReferences ?? []) {
      const path = ts.resolveProjectReferencePath(reference);
      if (visited.has(path)) continue;
      visited.add(path);
      configs.push(path);
    }
  }
  return importExtension(fileName, project.options);
}

function readProject(configPath: string, fileName: string): ts.ParsedCommandLine {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      readDirectory: (path, extensions, excludes, includes, depth) => {
        const sourceDirectory = posix.dirname(fileName);
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
