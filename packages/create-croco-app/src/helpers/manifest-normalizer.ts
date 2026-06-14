import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getExternalCrocoPackageRange } from "./croco-ranges.js";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];
type DependencyMap = Record<string, string>;
type PackageJson = {
  name?: unknown;
} & Partial<Record<DependencyField, unknown>>;

type ParsedManifest = {
  path: string;
  packageJson: PackageJson;
};

export function rewriteExternalCrocoWorkspaceRanges(projectDir: string): void {
  const manifests = findPackageJsonFiles(projectDir).map((path) => ({
    path,
    packageJson: JSON.parse(readFileSync(path, "utf8")) as PackageJson,
  }));
  const generatedPackageNames = new Set(
    manifests
      .map(({ packageJson }) => packageJson.name)
      .filter((name): name is string => typeof name === "string"),
  );

  for (const manifest of manifests) {
    if (rewriteManifest(manifest, generatedPackageNames)) {
      writeFileSync(manifest.path, `${JSON.stringify(manifest.packageJson, null, 2)}\n`);
    }
  }
}

function findPackageJsonFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return findPackageJsonFiles(entryPath);
    }

    return entry.name === "package.json" ? [entryPath] : [];
  });
}

function rewriteManifest(manifest: ParsedManifest, generatedPackageNames: Set<string>): boolean {
  let changed = false;

  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = manifest.packageJson[field];

    if (!isDependencyMap(dependencies)) {
      continue;
    }

    for (const [packageName, range] of Object.entries(dependencies)) {
      if (!shouldRewriteDependency(packageName, range, generatedPackageNames)) {
        continue;
      }

      const publishedRange = getExternalCrocoPackageRange(packageName);
      if (publishedRange === undefined) {
        throw new Error(`No published range configured for generated dependency ${packageName}`);
      }

      dependencies[packageName] = publishedRange;
      changed = true;
    }
  }

  return changed;
}

function shouldRewriteDependency(
  packageName: string,
  range: string,
  generatedPackageNames: Set<string>,
): boolean {
  return (
    packageName.startsWith("@croco/") &&
    range.startsWith("workspace:") &&
    !generatedPackageNames.has(packageName)
  );
}

function isDependencyMap(value: unknown): value is DependencyMap {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((dependencyRange) => typeof dependencyRange === "string");
}
