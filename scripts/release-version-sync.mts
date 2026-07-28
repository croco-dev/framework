#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { exit, stdout } from "node:process";
import { fileURLToPath } from "node:url";

import { formatVerificationProblem, VerificationProblem } from "./verification-problem.mts";

type Mode = "check" | "write";

type Options = {
  readonly mode: Mode;
  readonly rootDir: string;
};

type PackageJson = {
  readonly name?: unknown;
  readonly version?: unknown;
};

type JsonObject = Record<string, unknown>;

type SyncResult = {
  readonly content: string;
  readonly drift: readonly string[];
  readonly path: string;
};

const scriptRootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const crocoRangesPath = join("packages", "create-croco-app", "src", "helpers", "croco-ranges.ts");
const packageCatalogPath = join("docs", "package-catalog.json");
const crocoRangeLinePattern = /^(\s*)(["'])(@croco\/[^"']+)\2:\s*(["'])([^"']+)\4(,?)$/;

main();

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));
    const packageVersions = readWorkspacePackageVersions(options.rootDir);
    const results = [
      synchronizeCrocoRanges(options.rootDir, packageVersions),
      synchronizeCertificationVersions(options.rootDir, packageVersions),
    ];
    const drift = results.flatMap((result) => result.drift);

    if (options.mode === "check" && drift.length > 0) {
      stdout.write("release-version-sync: release metadata drift detected.\n");
      for (const diagnostic of drift) {
        stdout.write(`- ${diagnostic}\n`);
      }
      exit(1);
    }

    if (options.mode === "write") {
      for (const result of results) {
        writeFileSync(join(options.rootDir, result.path), result.content, "utf-8");
      }
    }

    stdout.write(
      `release-version-sync: ${options.mode === "write" ? "synchronized" : "verified"} ${results.length} version-derived metadata files.\n`,
    );
  } catch (error) {
    stdout.write(`release-version-sync: ${formatVerificationProblem(error)}\n`);
    exit(1);
  }
}

function parseArgs(args: readonly string[]): Options {
  let mode: Mode = "check";
  let rootDir = scriptRootDir;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--check") {
      mode = "check";
      continue;
    }

    if (arg === "--write") {
      mode = "write";
      continue;
    }

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new VerificationProblem(
          "MISSING_RELEASE_VERSION_SYNC_ROOT",
          "input",
          "--root requires a path",
        );
      }
      rootDir = resolve(value);
      index++;
      continue;
    }

    throw new VerificationProblem(
      "UNKNOWN_RELEASE_VERSION_SYNC_OPTION",
      "input",
      `Unknown option: ${arg}`,
    );
  }

  return { mode, rootDir };
}

function readWorkspacePackageVersions(rootDir: string): ReadonlyMap<string, string> {
  const packagesDir = join(rootDir, "packages");
  if (!existsSync(packagesDir)) {
    throw new VerificationProblem(
      "RELEASE_PACKAGES_DIRECTORY_MISSING",
      "configuration",
      `packages directory does not exist: ${packagesDir}`,
    );
  }

  const versions = new Map<string, string>();
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifestPath = join(packagesDir, entry.name, "package.json");
    if (!existsSync(manifestPath)) {
      continue;
    }

    const manifest = readJsonFile<PackageJson>(manifestPath);
    if (typeof manifest.name !== "string" || typeof manifest.version !== "string") {
      throw new VerificationProblem(
        "INVALID_WORKSPACE_PACKAGE_MANIFEST",
        "contract",
        `${manifestPath} must declare string name and version fields`,
      );
    }
    if (versions.has(manifest.name)) {
      throw new VerificationProblem(
        "DUPLICATE_WORKSPACE_PACKAGE_NAME",
        "contract",
        `duplicate workspace package name: ${manifest.name}`,
      );
    }
    versions.set(manifest.name, manifest.version);
  }

  return versions;
}

function synchronizeCrocoRanges(
  rootDir: string,
  packageVersions: ReadonlyMap<string, string>,
): SyncResult {
  const filePath = join(rootDir, crocoRangesPath);
  const source = readRequiredFile(filePath);
  const drift: string[] = [];
  const unmatchedRangeLines: number[] = [];
  let insideRangeDeclaration = false;
  let rangeCount = 0;

  const content = source
    .split("\n")
    .map((line, index) => {
      if (/^\s*const EXTERNAL_CROCO_PACKAGE_RANGES\s*=\s*{\s*$/.test(line)) {
        insideRangeDeclaration = true;
        return line;
      }

      if (
        insideRangeDeclaration &&
        /^\s*}\s+as const(?:\s+satisfies\s+Record<string,\s*string>)?;\s*$/.test(line)
      ) {
        insideRangeDeclaration = false;
        return line;
      }

      if (!insideRangeDeclaration) {
        return line;
      }

      const match = line.match(crocoRangeLinePattern);
      if (!match) {
        if (line.includes("@croco/")) {
          unmatchedRangeLines.push(index + 1);
        }
        return line;
      }

      const [, indent, keyQuote, packageName, valueQuote, currentRange, comma] = match;
      if (
        indent === undefined ||
        keyQuote === undefined ||
        packageName === undefined ||
        valueQuote === undefined ||
        currentRange === undefined ||
        comma === undefined
      ) {
        throw new VerificationProblem(
          "UNREADABLE_CROCO_RANGE_ENTRY",
          "contract",
          `${crocoRangesPath} contains an unreadable Croco range entry`,
        );
      }

      const version = packageVersions.get(packageName);
      if (!version) {
        throw new VerificationProblem(
          "CROCO_RANGE_PACKAGE_MISSING",
          "contract",
          `${crocoRangesPath} references missing workspace package ${packageName}`,
        );
      }

      rangeCount++;
      const expectedRange = `^${version}`;
      if (currentRange !== expectedRange) {
        drift.push(
          `${crocoRangesPath}: ${packageName} range ${currentRange} must match workspace version ${expectedRange}`,
        );
      }

      return `${indent}${keyQuote}${packageName}${keyQuote}: ${valueQuote}${expectedRange}${valueQuote}${comma}`;
    })
    .join("\n");

  if (unmatchedRangeLines.length > 0) {
    throw new VerificationProblem(
      "UNMATCHED_CROCO_RANGE_ENTRY",
      "contract",
      `${crocoRangesPath} contains Croco package references that do not match the required range declaration format on lines ${unmatchedRangeLines.join(", ")}`,
    );
  }

  if (rangeCount === 0) {
    throw new VerificationProblem(
      "CROCO_RANGE_DECLARATIONS_MISSING",
      "contract",
      `${crocoRangesPath} does not declare any Croco package ranges`,
    );
  }

  return { content, drift, path: crocoRangesPath };
}

function synchronizeCertificationVersions(
  rootDir: string,
  packageVersions: ReadonlyMap<string, string>,
): SyncResult {
  const filePath = join(rootDir, packageCatalogPath);
  const source = readRequiredFile(filePath);
  const catalog = readJsonFile<JsonObject>(filePath);
  const certification = requireObject(catalog.certification, `${packageCatalogPath}.certification`);
  const records = certification.records;
  if (!Array.isArray(records)) {
    throw new VerificationProblem(
      "INVALID_CERTIFICATION_RECORDS",
      "contract",
      `${packageCatalogPath}.certification.records must be an array`,
    );
  }

  const drift: string[] = [];
  const synchronizedRecords = records.map((value, index) => {
    const record = requireObject(value, `${packageCatalogPath}.certification.records[${index}]`);
    const packageName = record.package;
    if (typeof packageName !== "string" || packageName.length === 0) {
      throw new VerificationProblem(
        "INVALID_CERTIFICATION_PACKAGE",
        "contract",
        `${packageCatalogPath}.certification.records[${index}].package must be a non-empty string`,
      );
    }

    const version = packageVersions.get(packageName);
    if (!version) {
      throw new VerificationProblem(
        "CERTIFICATION_PACKAGE_MISSING",
        "contract",
        `${packageCatalogPath}.certification.records[${index}] references missing workspace package ${packageName}`,
      );
    }

    if (record.packageVersion !== version) {
      drift.push(
        `${packageCatalogPath}: certification record for ${packageName} version ${String(record.packageVersion)} must match ${version}`,
      );
    }

    return {
      ...record,
      packageVersion: version,
    };
  });
  const synchronizedCatalog = {
    ...catalog,
    certification: {
      ...certification,
      records: synchronizedRecords,
    },
  };
  const content = `${JSON.stringify(synchronizedCatalog, null, 2)}\n`;

  if (source === content && drift.length > 0) {
    throw new VerificationProblem(
      "CERTIFICATION_DRIFT_INVARIANT_VIOLATION",
      "contract",
      `${packageCatalogPath} drift diagnostics do not match generated content`,
    );
  }

  return { content, drift, path: packageCatalogPath };
}

function readRequiredFile(path: string): string {
  if (!existsSync(path)) {
    throw new VerificationProblem(
      "RELEASE_VERSION_SYNC_FILE_MISSING",
      "configuration",
      `required file does not exist: ${path}`,
    );
  }

  try {
    return readFileSync(path, "utf-8");
  } catch (error) {
    throw new VerificationProblem(
      "RELEASE_VERSION_SYNC_FILE_UNREADABLE",
      "configuration",
      `required file could not be read: ${path}: ${formatVerificationProblem(error)}`,
    );
  }
}

function readJsonFile<T>(path: string): T {
  try {
    return JSON.parse(readRequiredFile(path)) as T;
  } catch (error) {
    if (error instanceof VerificationProblem) {
      throw error;
    }
    throw new VerificationProblem(
      "INVALID_RELEASE_VERSION_SYNC_JSON",
      "contract",
      `${path} must contain valid JSON: ${formatVerificationProblem(error)}`,
    );
  }
}

function requireObject(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new VerificationProblem(
      "INVALID_RELEASE_VERSION_SYNC_OBJECT",
      "contract",
      `${label} must be an object`,
    );
  }
  return value as JsonObject;
}
