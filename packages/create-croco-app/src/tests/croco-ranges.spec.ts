import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getExternalCrocoPackageRange } from "../helpers/croco-ranges.js";

const TEMPLATES_DIR = new URL("../../templates", import.meta.url).pathname;
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

describe("external Croco package ranges", () => {
  it("covers every external Croco workspace dependency used by templates", () => {
    const templateDependencies = collectTemplateCrocoWorkspaceDependencies();
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

    expect(templateDependencies).not.toEqual([]);
    expect(missingRanges).toEqual([]);
    expect(invalidRanges).toEqual([]);
  });
});
