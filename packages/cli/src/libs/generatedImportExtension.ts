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

export function generatedImportExtension(importerPath: string): ImportExtension {
  const fileName = ts.sys.resolvePath(importerPath);
  const configPath = ts.findConfigFile(dirname(fileName), ts.sys.fileExists);
  if (!configPath) return "";

  const project = readProject(configPath, fileName);
  const configuredExtension = importExtension(fileName, project.options);
  if (!project.projectReferences?.length) return configuredExtension;

  const projects = [project];
  const visited = new Set([configPath]);
  const includedExtensions: ImportExtension[] = [];
  const referencedExtensions: ImportExtension[] = [];
  for (const candidate of projects) {
    const extension = importExtension(fileName, candidate.options);
    if (candidate.fileNames.includes(fileName)) includedExtensions.push(extension);
    if (candidate !== project) referencedExtensions.push(extension);
    for (const reference of candidate.projectReferences ?? []) {
      const path = ts.resolveProjectReferencePath(reference);
      if (visited.has(path)) continue;
      visited.add(path);
      projects.push(readProject(path, fileName));
    }
  }

  // Entry-point-only projects can reach new files through imports that are not on disk yet.
  const extensions = includedExtensions.length ? includedExtensions : referencedExtensions;
  return extensions.includes(".js") ? ".js" : (includedExtensions[0] ?? configuredExtension);
}

function readProject(configPath: string, fileName: string): ts.ParsedCommandLine {
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
