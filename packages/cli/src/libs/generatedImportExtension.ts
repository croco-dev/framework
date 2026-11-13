import { dirname } from "node:path";
import ts from "typescript";
import { CliError } from "./CliError.js";

type ImportExtension = "" | ".js";

export function generatedImportExtension(importerPath: string): ImportExtension {
  const fileName = ts.sys.resolvePath(importerPath);
  const configPath = ts.findConfigFile(dirname(fileName), ts.sys.fileExists);
  if (!configPath) return "";

  const configs = new Set([configPath]);
  for (const path of configs) {
    const project = readProject(path);
    if (
      ts.getImpliedNodeFormatForFile(fileName, undefined, ts.sys, project.options) ===
      ts.ModuleKind.ESNext
    ) {
      return ".js";
    }
    for (const reference of project.projectReferences ?? []) {
      configs.add(ts.resolveProjectReferencePath(reference));
    }
  }
  return "";
}

function readProject(configPath: string): ts.ParsedCommandLine {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      // Referenced projects can consume files transitively after generation. Only read their settings.
      readDirectory: () => [],
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

function failInvalidConfig(diagnostic: ts.Diagnostic): never {
  throw new CliError(
    "CROCO_CLI_GENERATION_FAILED",
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  );
}
