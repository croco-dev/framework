import { dirname } from "node:path";
import ts from "typescript";
import { CliError } from "./CliError.js";

export function generatedImportExtension(importerPath: string): "" | ".js" {
  const fileName = ts.sys.resolvePath(importerPath);
  const configPath = ts.findConfigFile(dirname(fileName), ts.sys.fileExists);
  if (!configPath) return "";

  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      // The generator needs compiler options, including when no source has been written yet.
      readDirectory: () => [],
      onUnRecoverableConfigFileDiagnostic: failInvalidConfig,
    },
  );
  // Empty files and include lists do not affect module resolution.
  const invalidConfig = parsed?.errors.find(({ code }) => code !== 18002 && code !== 18003);
  if (invalidConfig) failInvalidConfig(invalidConfig);

  return parsed &&
    ts.getImpliedNodeFormatForFile(fileName, undefined, ts.sys, parsed.options) ===
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
