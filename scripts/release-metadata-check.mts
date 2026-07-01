#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { argv, exit, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { findPackageJsonFiles } from "./package-manifest-contracts.mjs";

type Options = {
  readonly allowPendingChangesets: boolean;
  readonly rootDir: string;
};

type PackageJson = {
  readonly name?: unknown;
  readonly private?: unknown;
  readonly version?: unknown;
};

type DiagnosticCode =
  | "MISSING_CHANGELOG"
  | "MISSING_NAME"
  | "MISSING_VERSION"
  | "PLACEHOLDER_VERSION";

type PackageDiagnostic = {
  readonly codes: readonly DiagnosticCode[];
  readonly messages: readonly string[];
  readonly packageName: string;
  readonly relativePath: string;
};

const defaultRootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const changesetPackagePattern =
  /^['"]?(@?[\w.-]+(?:\/[\w.-]+)?|[\w.-]+)['"]?: (major|minor|patch)$/;
const pendingChangesetRecoverableCodes = new Set<DiagnosticCode>([
  "MISSING_CHANGELOG",
  "PLACEHOLDER_VERSION",
]);

function log(message = ""): void {
  stdout.write(`${message}\n`);
}

function parseArgs(args: readonly string[]): Options {
  let rootDir = defaultRootDir;
  let allowPendingChangesets = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      index++;
      continue;
    }

    if (arg === "--allow-pending-changesets") {
      allowPendingChangesets = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    allowPendingChangesets,
    rootDir,
  };
}

function readPackageJson(packagePath: string): PackageJson {
  return JSON.parse(readFileSync(packagePath, "utf-8")) as PackageJson;
}

function pendingChangesetPackages(rootDir: string): ReadonlySet<string> {
  const changesetsDir = join(rootDir, ".changeset");
  const packageNames = new Set<string>();

  if (!existsSync(changesetsDir)) {
    return packageNames;
  }

  const entries = readChangesetFiles(changesetsDir);
  for (const entryPath of entries) {
    const content = readFileSync(entryPath, "utf-8").replace(/\r\n/g, "\n");
    const lines = content.split("\n");

    if (lines[0] !== "---") {
      continue;
    }

    const endIndex = lines.indexOf("---", 1);
    if (endIndex <= 1) {
      continue;
    }

    for (const line of lines.slice(1, endIndex)) {
      const match = changesetPackagePattern.exec(line.trim());
      if (match?.[1]) {
        packageNames.add(match[1]);
      }
    }
  }

  return packageNames;
}

function readChangesetFiles(changesetsDir: string): string[] {
  return readdirSync(changesetsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => join(changesetsDir, entry.name))
    .sort();
}

function collectReleaseMetadataDiagnostics(options: Options): {
  readonly blockedDiagnostics: readonly PackageDiagnostic[];
  readonly checkedCount: number;
  readonly pendingDiagnostics: readonly PackageDiagnostic[];
  readonly skippedPrivateCount: number;
} {
  const packageJsonFiles = findPackageJsonFiles(join(options.rootDir, "packages"));
  const pendingPackages = options.allowPendingChangesets
    ? pendingChangesetPackages(options.rootDir)
    : new Set<string>();
  const blockedDiagnostics: PackageDiagnostic[] = [];
  const pendingDiagnostics: PackageDiagnostic[] = [];
  let checkedCount = 0;
  let skippedPrivateCount = 0;

  for (const packagePath of packageJsonFiles) {
    const manifest = readPackageJson(packagePath);

    if (manifest.private === true) {
      skippedPrivateCount++;
      continue;
    }

    checkedCount++;

    const packageName =
      typeof manifest.name === "string" && manifest.name.length > 0
        ? manifest.name
        : relative(options.rootDir, dirname(packagePath));
    const codes: DiagnosticCode[] = [];
    const messages: string[] = [];

    if (typeof manifest.name !== "string" || manifest.name.length === 0) {
      codes.push("MISSING_NAME");
      messages.push("name must be a non-empty string");
    }

    if (typeof manifest.version !== "string" || manifest.version.length === 0) {
      codes.push("MISSING_VERSION");
      messages.push("version must be a non-empty string");
    } else if (manifest.version === "0.0.0") {
      codes.push("PLACEHOLDER_VERSION");
      messages.push('version is "0.0.0"');
    }

    if (!existsSync(join(dirname(packagePath), "CHANGELOG.md"))) {
      codes.push("MISSING_CHANGELOG");
      messages.push("CHANGELOG.md is missing");
    }

    if (messages.length === 0) {
      continue;
    }

    const diagnostic = {
      codes,
      messages,
      packageName,
      relativePath: relative(options.rootDir, packagePath),
    };

    if (
      options.allowPendingChangesets &&
      typeof manifest.name === "string" &&
      pendingPackages.has(manifest.name) &&
      codes.every((code) => pendingChangesetRecoverableCodes.has(code))
    ) {
      pendingDiagnostics.push(diagnostic);
      continue;
    }

    blockedDiagnostics.push(diagnostic);
  }

  return {
    blockedDiagnostics,
    checkedCount,
    pendingDiagnostics,
    skippedPrivateCount,
  };
}

function printDiagnostics(heading: string, diagnostics: readonly PackageDiagnostic[]): void {
  if (diagnostics.length === 0) {
    return;
  }

  log("");
  log(heading);
  for (const diagnostic of diagnostics) {
    log(
      `- ${diagnostic.relativePath} (${diagnostic.packageName}): ${diagnostic.messages.join("; ")}`,
    );
  }
}

function printRecovery(): void {
  log("");
  log("Recovery:");
  log(
    "- Add or update a .changeset/*.md entry for each affected package, then let `pnpm version-packages` / the Changesets release PR write package versions and CHANGELOG.md.",
  );
  log("- Do not manually edit package versions to bypass this gate.");
}

function main(): void {
  const options = parseArgs(argv.slice(2));
  const result = collectReleaseMetadataDiagnostics(options);

  log("=== Release metadata summary ===");
  log(`Checked publishable: ${result.checkedCount}`);
  log(`Skipped private/non-published tooling: ${result.skippedPrivateCount}`);
  log(`Pending changeset recoveries: ${result.pendingDiagnostics.length}`);

  printDiagnostics("Pending changeset metadata recoveries:", result.pendingDiagnostics);
  printDiagnostics("Release metadata violations:", result.blockedDiagnostics);

  if (result.blockedDiagnostics.length > 0) {
    printRecovery();
    exit(1);
  }

  if (result.pendingDiagnostics.length > 0) {
    log("");
    log(
      "OK: Release metadata placeholders are covered by pending changesets. Final publish candidates must pass without --allow-pending-changesets.",
    );
    return;
  }

  log("");
  log("OK: Release metadata is publish-ready.");
}

main();
