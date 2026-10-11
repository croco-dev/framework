#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export function collectPackageTestTypecheckDiagnostics(rootDir: string): string[] {
  const diagnostics: string[] = [];
  for (const entry of readdirSync(join(rootDir, "packages"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageDir = join(rootDir, "packages", entry.name);
    const manifestPath = join(packageDir, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name?: string;
      scripts?: { typecheck?: string };
    };
    const command = manifest.scripts?.typecheck;
    if (command === undefined) continue;
    const label = `${manifest.name ?? entry.name} (${relative(rootDir, manifestPath)})`;
    const match = /^(?:tsc|node\s+\S*typescript\/bin\/tsc)\s+(.+)$/.exec(command);
    if (!match?.[1] || /[;&|`$"']/.test(match[1])) {
      diagnostics.push(`${label}: unsupported typecheck command ${JSON.stringify(command)}`);
      continue;
    }
    const parsedCommand = ts.parseCommandLine(match[1].split(/\s+/));
    if (
      parsedCommand.errors.length > 0 ||
      parsedCommand.fileNames.length > 0 ||
      !parsedCommand.options.noEmit
    ) {
      diagnostics.push(`${label}: typecheck must run tsc --noEmit with a project config`);
      continue;
    }
    const project = resolve(packageDir, parsedCommand.options.project ?? "tsconfig.json");
    const configPath =
      existsSync(project) && statSync(project).isDirectory()
        ? join(project, "tsconfig.json")
        : project;
    const configLabel = `${label}, config ${relative(rootDir, configPath)}`;
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error) {
      diagnostics.push(
        `${configLabel}: ${ts.flattenDiagnosticMessageText(config.error.messageText, " ")}`,
      );
      continue;
    }
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      dirname(configPath),
      parsedCommand.options,
      configPath,
    );
    for (const error of parsed.errors) {
      diagnostics.push(
        `${configLabel}: TS${error.code} ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`,
      );
    }
    const included = new Set(parsed.fileNames.map((path) => resolve(path)));
    const tests = ts.sys.readDirectory(join(packageDir, "src"), [".ts"], undefined, [
      "**/*.spec.ts",
      "**/*.test.ts",
    ]);
    for (const test of tests) {
      if (!included.has(resolve(test))) {
        diagnostics.push(
          `${configLabel}: test ${relative(rootDir, test)} is missing from typecheck inputs`,
        );
      }
    }
  }
  return diagnostics.sort();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const diagnostics = collectPackageTestTypecheckDiagnostics(resolve(import.meta.dirname, ".."));
  if (diagnostics.length > 0) {
    console.error("package-test-typecheck-check: failed");
    for (const diagnostic of diagnostics) console.error(`- ${diagnostic}`);
    process.exitCode = 1;
  } else {
    console.log(
      "package-test-typecheck-check: all package src tests are included by their typecheck configs",
    );
  }
}
