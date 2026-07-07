import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeCatalogSpinePackageName } from "../helpers/catalog-spine.js";
import {
  getExternalCrocoPackageRange,
  getExternalCrocoPackageRanges,
  getGeneratedAppCrocoVersionSet,
} from "../helpers/croco-ranges.js";

const TEMPLATES_DIR = new URL("../../templates", import.meta.url).pathname;
const REPO_ROOT_DIR = new URL("../../../../", import.meta.url).pathname;
const CROCO_WORKSPACE_DEPENDENCY_PATTERN = /"(@croco\/[^"]+)":\s*"workspace:[^"]+"/g;
const INSTALLABLE_VERSION_RANGE_PATTERN = /^\^\d+\.\d+\.\d+$/;

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectFiles(entryPath);
    }

    return [entryPath];
  });
}

function collectTemplateCrocoWorkspaceDependencies(): string[] {
  const dependencies = collectFiles(TEMPLATES_DIR)
    .filter((filePath) => filePath.endsWith("package.json.hbs"))
    .flatMap((filePath) => {
      const content = readFileSync(filePath, "utf8");
      const matches = [...content.matchAll(CROCO_WORKSPACE_DEPENDENCY_PATTERN)];

      return matches.map((match) => match[1]);
    });

  return [...new Set(dependencies)].sort();
}

function readWorkspacePackageVersion(packageName: string): string {
  const packageDir = packageName.replace("@croco/", "");
  const packageJsonPath = join(REPO_ROOT_DIR, "packages", packageDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };

  return packageJson.version;
}

function readSpinePackageNames(): Set<string> {
  const catalogPath = join(REPO_ROOT_DIR, "docs", "package-catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
    spine: {
      packages: string[];
    };
  };

  return new Set(catalog.spine.packages.map(normalizeCatalogSpinePackageName));
}

describe("external Croco package ranges", () => {
  it("covers every external Croco workspace dependency used by templates", () => {
    const templateDependencies = collectTemplateCrocoWorkspaceDependencies();
    const versionSet = getGeneratedAppCrocoVersionSet();
    const versionSetRanges: ReadonlyMap<string, string> = new Map(
      versionSet.packages.map((entry) => [entry.packageName, entry.range]),
    );
    const expectedRangeNames = Object.keys(getExternalCrocoPackageRanges()).sort();
    const spinePackageNames = readSpinePackageNames();
    const spineTemplateDependencies = templateDependencies.filter((packageName) =>
      spinePackageNames.has(packageName),
    );
    const missingRanges = templateDependencies.filter(
      (packageName) => getExternalCrocoPackageRange(packageName) === undefined,
    );
    const invalidRanges = templateDependencies.flatMap((packageName) => {
      const range = getExternalCrocoPackageRange(packageName);

      if (range !== undefined && INSTALLABLE_VERSION_RANGE_PATTERN.test(range)) {
        return [];
      }

      return [
        {
          packageName,
          actual: range,
        },
      ];
    });
    const staleRanges = templateDependencies.flatMap((packageName) => {
      const range = getExternalCrocoPackageRange(packageName);

      if (range === undefined) {
        return [];
      }

      const expectedRange = `^${readWorkspacePackageVersion(packageName)}`;

      if (range === expectedRange) {
        return [];
      }

      return [
        {
          packageName,
          expected: expectedRange,
          actual: range,
        },
      ];
    });

    expect(templateDependencies).not.toEqual([]);
    expect(versionSet.policy).toBe("tested-croco-compatibility-train");
    expect(versionSet.packages.map((entry) => entry.packageName)).toEqual(expectedRangeNames);
    expect(spineTemplateDependencies).not.toEqual([]);
    expect(
      spineTemplateDependencies.filter((packageName) => !versionSetRanges.has(packageName)),
    ).toEqual([]);
    expect(missingRanges).toEqual([]);
    expect(invalidRanges).toEqual([]);
    expect(staleRanges).toEqual([]);
  });
});
