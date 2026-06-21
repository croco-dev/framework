import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export type DependencyField = (typeof dependencyFields)[number];

const workspacePackageDependencyFields = [
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
] as const satisfies readonly DependencyField[];

export type PackageJson = {
  readonly name?: unknown;
  readonly version?: unknown;
} & Partial<Record<DependencyField, unknown>>;

export type WorkspacePackage = {
  readonly name: string;
  readonly packageDir: string;
  readonly version: string;
  readonly dependencyNames: readonly string[];
};

export type ExternalCrocoRangeException = {
  readonly range: string;
  readonly reason: string;
};

export type ExternalCrocoRangeExceptions = Readonly<Record<string, ExternalCrocoRangeException>>;

const skippedPackageJsonDirectories = new Set([".turbo", "coverage", "dist", "node_modules"]);

export function createWorkspacePackageIndex(
  rootDir: string,
): ReadonlyMap<string, WorkspacePackage> {
  const index = new Map<string, WorkspacePackage>();

  for (const packageJsonPath of findPackageJsonFiles(join(rootDir, "packages"))) {
    const packageJson = readPackageJson(packageJsonPath);

    if (typeof packageJson.name !== "string" || !packageJson.name.startsWith("@croco/")) {
      continue;
    }

    if (typeof packageJson.version !== "string") {
      throw new Error(`${packageJsonPath}: ${packageJson.name} is missing a string version`);
    }

    if (index.has(packageJson.name)) {
      throw new Error(`Duplicate workspace package name ${packageJson.name}`);
    }

    index.set(packageJson.name, {
      name: packageJson.name,
      packageDir: dirname(packageJsonPath),
      version: packageJson.version,
      dependencyNames: collectCrocoDependencyNames(packageJson, workspacePackageDependencyFields),
    });
  }

  return index;
}

export function collectGeneratedCrocoDependencyNames(projectDir: string): readonly string[] {
  const manifests = readProjectManifests(projectDir);
  const generatedPackageNames = new Set(
    manifests
      .map(({ packageJson }) => packageJson.name)
      .filter((name): name is string => typeof name === "string"),
  );
  const dependencies = new Set<string>();

  for (const { packageJson } of manifests) {
    for (const dependencyName of collectCrocoDependencyNames(packageJson)) {
      if (!generatedPackageNames.has(dependencyName)) {
        dependencies.add(dependencyName);
      }
    }
  }

  return [...dependencies].sort();
}

export function resolveLocalCrocoPackagesForGeneratedProject(
  projectDir: string,
  workspacePackageIndex: ReadonlyMap<string, WorkspacePackage>,
  externalRangeExceptions: ExternalCrocoRangeExceptions = {},
): readonly WorkspacePackage[] {
  const resolvedPackages = new Map<string, WorkspacePackage>();
  const resolvingPackages = new Set<string>();

  function resolvePackage(packageName: string, referenceSource: string): void {
    if (externalRangeExceptions[packageName]) {
      return;
    }

    const workspacePackage = workspacePackageIndex.get(packageName);
    if (!workspacePackage) {
      throw new Error(
        `${referenceSource} references ${packageName}, but it is not a local @croco workspace package and has no explicit generated-smoke external exception`,
      );
    }

    if (resolvedPackages.has(packageName) || resolvingPackages.has(packageName)) {
      return;
    }

    resolvingPackages.add(packageName);
    resolvedPackages.set(packageName, workspacePackage);

    for (const dependencyName of workspacePackage.dependencyNames) {
      resolvePackage(dependencyName, `${workspacePackage.name} package.json`);
    }

    resolvingPackages.delete(packageName);
  }

  for (const dependencyName of collectGeneratedCrocoDependencyNames(projectDir)) {
    resolvePackage(dependencyName, "Generated project package.json");
  }

  return [...resolvedPackages.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function rewriteExternalCrocoRanges(
  projectDir: string,
  rangeOverrides: Readonly<Record<string, string>>,
  externalRangeExceptions: ExternalCrocoRangeExceptions = {},
): void {
  const manifests = readProjectManifests(projectDir);
  const generatedPackageNames = new Set(
    manifests
      .map(({ packageJson }) => packageJson.name)
      .filter((name): name is string => typeof name === "string"),
  );

  for (const manifest of manifests) {
    let changed = false;

    for (const field of dependencyFields) {
      const dependencies = manifest.packageJson[field];

      if (!isDependencyMap(dependencies)) {
        continue;
      }

      for (const packageName of Object.keys(dependencies)) {
        if (!packageName.startsWith("@croco/") || generatedPackageNames.has(packageName)) {
          continue;
        }

        const replacementRange =
          rangeOverrides[packageName] ?? externalRangeExceptions[packageName]?.range;
        if (replacementRange === undefined) {
          throw new Error(
            `Generated smoke dependency ${packageName} is missing a local tarball override or explicit external exception`,
          );
        }

        if (dependencies[packageName] !== replacementRange) {
          dependencies[packageName] = replacementRange;
          changed = true;
        }
      }
    }

    if (changed) {
      writeFileSync(manifest.path, `${JSON.stringify(manifest.packageJson, null, 2)}\n`);
    }
  }
}

function readProjectManifests(projectDir: string): readonly {
  readonly path: string;
  readonly packageJson: PackageJson;
}[] {
  return findPackageJsonFiles(projectDir).map((path) => ({
    path,
    packageJson: readPackageJson(path),
  }));
}

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

function collectCrocoDependencyNames(
  packageJson: PackageJson,
  fields: readonly DependencyField[] = dependencyFields,
): readonly string[] {
  const dependencies = new Set<string>();

  for (const field of fields) {
    const dependencyMap = packageJson[field];

    if (!isDependencyMap(dependencyMap)) {
      continue;
    }

    for (const packageName of Object.keys(dependencyMap)) {
      if (packageName.startsWith("@croco/")) {
        dependencies.add(packageName);
      }
    }
  }

  return [...dependencies].sort();
}

function findPackageJsonFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (skippedPackageJsonDirectories.has(entry.name)) {
        return [];
      }

      return findPackageJsonFiles(entryPath);
    }

    return entry.name === "package.json" ? [entryPath] : [];
  });
}

function isDependencyMap(value: unknown): value is Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((dependencyRange) => typeof dependencyRange === "string");
}
