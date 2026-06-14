#!/usr/bin/env node

/**
 * Enforce release metadata for publishable package behavior changes.
 *
 * Narrow exemptions:
 * - package docs and tests do not require a changeset;
 * - private packages do not require a changeset;
 * - docs-site package source does not require a package changeset;
 * - root-only lockfile/package-manager changes do not require a changeset here;
 * - .changeset/README.md is documentation and never counts as a release changeset.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { env, exit, stdout } from "node:process";

type CheckOptions = {
  readonly baseRef: string;
  readonly headRef: string;
  readonly rootDir: string;
};

type PackageInfo = {
  readonly name: string;
  readonly private: boolean;
  readonly relativeDir: string;
};

const realChangesetPattern = /^\.changeset\/[^/]+\.md$/;
const releaseExemptPackageNames = new Set(["@croco/docs"]);
const testFilePattern = /(?:^|[.-])(spec|test)\.[cm]?[jt]sx?$/;

function log(message: string): void {
  stdout.write(`${message}\n`);
}

function runGit(rootDir: string, args: readonly string[]): string {
  const result = spawnSync("git", [...args], {
    cwd: rootDir,
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }

  return result.stdout.trim();
}

function parseArgs(args: readonly string[]): CheckOptions {
  let rootDir = process.cwd();
  let baseRef = env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : "trunk";
  let headRef = "HEAD";

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      index++;
      continue;
    }

    if (arg === "--base") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--base requires a git ref");
      }
      baseRef = value;
      index++;
      continue;
    }

    if (arg === "--head") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--head requires a git ref");
      }
      headRef = value;
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    baseRef,
    headRef,
    rootDir,
  };
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function getChangedFiles(options: CheckOptions): string[] {
  runGit(options.rootDir, ["rev-parse", "--verify", `${options.baseRef}^{commit}`]);
  runGit(options.rootDir, ["rev-parse", "--verify", `${options.headRef}^{commit}`]);

  const output = runGit(options.rootDir, [
    "diff",
    "--name-only",
    "--diff-filter=ACMRD",
    `${options.baseRef}...${options.headRef}`,
  ]);

  return output
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean)
    .map(toPosixPath);
}

function findPackageJsonFiles(dir: string, results: string[] = []): string[] {
  if (!existsSync(dir)) {
    return results;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) {
        continue;
      }
      findPackageJsonFiles(fullPath, results);
      continue;
    }

    if (entry.isFile() && entry.name === "package.json") {
      results.push(fullPath);
    }
  }

  return results.sort();
}

function readPackages(rootDir: string): PackageInfo[] {
  return findPackageJsonFiles(join(rootDir, "packages"))
    .map((packageJsonPath) => {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      const relativeDir = toPosixPath(
        relative(rootDir, packageJsonPath).replace(/\/package\.json$/, ""),
      );

      if (typeof pkg.name !== "string") {
        throw new Error(`${relativeDir}/package.json is missing a string name`);
      }

      return {
        name: pkg.name,
        private: pkg.private === true,
        relativeDir,
      };
    })
    .sort((left, right) => right.relativeDir.length - left.relativeDir.length);
}

function getOwningPackage(file: string, packages: readonly PackageInfo[]): PackageInfo | null {
  return (
    packages.find((pkg) => file === pkg.relativeDir || file.startsWith(`${pkg.relativeDir}/`)) ??
    null
  );
}

function isRealChangesetPath(file: string): boolean {
  return realChangesetPattern.test(file) && basename(file) !== "README.md";
}

function isValidChangesetContent(content: string): boolean {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") {
    return false;
  }

  const endIndex = lines.indexOf("---", 1);
  if (endIndex <= 1) {
    return false;
  }

  return lines
    .slice(1, endIndex)
    .map((line) => line.trim())
    .some((line) =>
      /^['"]?(@?[\w.-]+(?:\/[\w.-]+)?|[\w.-]+)['"]?: (major|minor|patch)$/.test(line),
    );
}

function hasValidChangeset(options: CheckOptions, changedFiles: readonly string[]): boolean {
  for (const file of changedFiles) {
    if (!isRealChangesetPath(file)) {
      continue;
    }

    try {
      const content = runGit(options.rootDir, ["show", `${options.headRef}:${file}`]);
      if (isValidChangesetContent(content)) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

function isPackageTestFile(packageRelativeFile: string): boolean {
  const fileName = basename(packageRelativeFile);

  return (
    packageRelativeFile.startsWith("__tests__/") ||
    packageRelativeFile.startsWith("src/__tests__/") ||
    packageRelativeFile.startsWith("src/tests/") ||
    packageRelativeFile.startsWith("test/") ||
    packageRelativeFile.startsWith("tests/") ||
    testFilePattern.test(fileName)
  );
}

function isReleaseSignificantPackageFile(packageRelativeFile: string): boolean {
  if (packageRelativeFile === "package.json") {
    return true;
  }

  if (isPackageTestFile(packageRelativeFile)) {
    return false;
  }

  if (
    packageRelativeFile.startsWith("src/") ||
    packageRelativeFile.startsWith("templates/") ||
    packageRelativeFile.startsWith("bin/")
  ) {
    return true;
  }

  if (
    packageRelativeFile === "README.md" ||
    packageRelativeFile === "CHANGELOG.md" ||
    packageRelativeFile.startsWith("docs/")
  ) {
    return false;
  }

  return false;
}

function getReleaseSignificantChanges(
  changedFiles: readonly string[],
  packages: readonly PackageInfo[],
): Map<string, string[]> {
  const changes = new Map<string, string[]>();

  for (const file of changedFiles) {
    const pkg = getOwningPackage(file, packages);
    if (!pkg || pkg.private || releaseExemptPackageNames.has(pkg.name)) {
      continue;
    }

    const packageRelativeFile = file.slice(`${pkg.relativeDir}/`.length);
    if (!isReleaseSignificantPackageFile(packageRelativeFile)) {
      continue;
    }

    const packageFiles = changes.get(pkg.name) ?? [];
    packageFiles.push(file);
    changes.set(pkg.name, packageFiles);
  }

  return changes;
}

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));
    const changedFiles = getChangedFiles(options);
    const packages = readPackages(options.rootDir);
    const significantChanges = getReleaseSignificantChanges(changedFiles, packages);

    if (significantChanges.size === 0) {
      log("changeset-required: no publishable package behavior changes detected (passing)");
      exit(0);
    }

    if (hasValidChangeset(options, changedFiles)) {
      log("changeset-required: valid non-README changeset found (passing)");
      exit(0);
    }

    log("changeset-required: publishable package changes require a non-README changeset.");
    log("Add .changeset/<name>.md for release-significant package changes.");
    log("");
    log("Release-significant changes:");

    for (const [packageName, files] of significantChanges) {
      log(`- ${packageName}`);
      for (const file of files) {
        log(`  - ${file}`);
      }
    }

    exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`changeset-required: failed: ${message}`);
    exit(1);
  }
}

main();
