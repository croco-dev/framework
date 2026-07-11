#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createWorkspacePackageIndex,
  resolveLocalCrocoPackagesForGeneratedProject,
  rewriteExternalCrocoRanges,
  type WorkspacePackage,
} from "./create-croco-app-generated-smoke-support.mts";
import { normalizeCatalogSpinePackageName } from "../packages/create-croco-app/src/helpers/catalog-spine.ts";

export { normalizeCatalogSpinePackageName } from "../packages/create-croco-app/src/helpers/catalog-spine.ts";

type DependencyField = "dependencies" | "peerDependencies" | "optionalDependencies";

type PackageJson = {
  readonly name?: unknown;
  readonly packageManager?: unknown;
  readonly version?: unknown;
  readonly private?: unknown;
  readonly scripts?: unknown;
} & Partial<Record<DependencyField, unknown>>;

type ReleasePackage = WorkspacePackage & {
  readonly manifestPath: string;
  readonly sourceManifest: PackageJson;
};

type CommandResult = {
  readonly stderr: string;
  readonly stdout: string;
};

type PackageCatalog = {
  readonly spine?: unknown;
};

export type AlphaReleaseImportExclusion = {
  readonly checkedBy: string;
  readonly packageName: string;
  readonly reason: string;
};

export type AlphaReleaseSpineCoverage = {
  readonly cleanInstallImportExclusions: readonly AlphaReleaseImportExclusion[];
  readonly cleanInstallImports: readonly string[];
  readonly spineRoots: readonly string[];
};

type SmokeReport = {
  readonly cleanInstallImportExclusions: readonly AlphaReleaseImportExclusion[];
  readonly cleanInstallDirectory?: string;
  readonly cleanInstallImports: readonly string[];
  readonly error?: string;
  readonly generatedAppDirectory?: string;
  readonly packedPackageCount: number;
  readonly smokeCases: typeof alphaReleaseGeneratedAppSmokeCases;
  readonly spineRoots: readonly string[];
  readonly status: "PASS" | "FAIL";
  readonly validations: readonly string[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultRootDir = resolve(__dirname, "..");
const commandTimeoutMs = 900_000;
const packageCatalogPath = join("docs", "package-catalog.json");
const skippedPackageJsonDirectories = new Set([".turbo", "coverage", "dist", "node_modules"]);

export const alphaReleaseEvidenceReportPath = "ci-reports/release/alpha-release-smoke.md";

export const alphaReleaseGeneratedAppValidations = [
  "contract:snapshot",
  "contract:verify",
  "typecheck",
  "build",
  "test",
  "dev:smoke",
] as const;

export const alphaReleaseGeneratedAppSmoke = {
  args: ["--preset", "production-app", "--scope", "@alpha", "--no-install", "--no-git"],
  name: "alpha-production-app",
  preset: "production-app",
} as const;

export const alphaReleaseCanonicalSaasValidations = [
  "typecheck",
  "build",
  "test",
  "demo:smoke",
] as const;

export const alphaReleaseGeneratedAppSmokeCases = [
  {
    ...alphaReleaseGeneratedAppSmoke,
    validations: alphaReleaseGeneratedAppValidations,
  },
  {
    args: ["--goal", "saas-api", "--scope", "@myorg", "--no-install", "--no-git"],
    goal: "saas-api",
    name: "my-saas-api",
    preset: "saas",
    validations: alphaReleaseCanonicalSaasValidations,
  },
] as const;

export const alphaReleaseBinarySmokeCommands = [
  "pnpm exec create-croco-app --version",
  "pnpm exec create-croco-app <project> --preset production-app --scope @alpha --no-install --no-git",
  "pnpm exec create-croco-app my-saas-api --goal saas-api --scope @myorg --no-install --no-git",
  "pnpm exec croco --help",
] as const;

export const alphaReleaseCleanInstallImportExclusions = [
  {
    checkedBy:
      "pnpm exec create-croco-app <project> --preset production-app --scope @alpha --no-install --no-git",
    packageName: "create-croco-app",
    reason: "CLI scaffold package is exercised through the packed generated-app smoke command.",
  },
  {
    checkedBy: "pnpm exec croco --help",
    packageName: "@croco/cli",
    reason: "CLI package is exercised through the packed croco binary smoke command.",
  },
] as const satisfies readonly AlphaReleaseImportExclusion[];

export const alphaReleaseSpineRoots = readCatalogSpinePackageNames(defaultRootDir);
export const alphaReleaseCleanInstallImportPackages = deriveAlphaReleaseCleanInstallImportPackages(
  alphaReleaseSpineRoots,
  alphaReleaseCleanInstallImportExclusions,
);

function main(): void {
  const rootDir = parseArgs(process.argv.slice(2));
  const smokeRoot = mkdtempSync(join(tmpdir(), "croco-alpha-release-smoke-"));
  const packRoot = join(smokeRoot, "packs");
  const packedPackages = new Map<string, string>();
  let report: SmokeReport = {
    cleanInstallImportExclusions: alphaReleaseCleanInstallImportExclusions,
    cleanInstallImports: alphaReleaseCleanInstallImportPackages,
    packedPackageCount: 0,
    smokeCases: alphaReleaseGeneratedAppSmokeCases,
    spineRoots: alphaReleaseSpineRoots,
    status: "FAIL",
    validations: [
      ...new Set(alphaReleaseGeneratedAppSmokeCases.flatMap((smokeCase) => smokeCase.validations)),
    ],
  };

  try {
    const spineCoverage = resolveAlphaReleaseSpineCoverage(rootDir);
    assertAlphaReleaseSpineCoverage(spineCoverage);
    report = {
      ...report,
      cleanInstallImportExclusions: spineCoverage.cleanInstallImportExclusions,
      cleanInstallImports: spineCoverage.cleanInstallImports,
      spineRoots: spineCoverage.spineRoots,
    };

    const packageIndex = createReleasePackageIndex(rootDir);
    const spinePackages = resolvePackageClosure(spineCoverage.spineRoots, packageIndex);
    buildPackages(spinePackages, rootDir);
    const spineOverrides = packPackages(spinePackages, packRoot, rootDir, packedPackages);
    const cleanInstallDirectory = runCleanSpineInstall(
      join(smokeRoot, "spine-consumer"),
      spinePackages,
      spineOverrides,
      spineCoverage.cleanInstallImports,
      rootDir,
    );
    const generatedAppDirectories = alphaReleaseGeneratedAppSmokeCases.map((smokeCase) =>
      runPackedCreateCrocoAppSmoke(
        smokeRoot,
        packageIndex,
        spineOverrides,
        rootDir,
        packedPackages,
        smokeCase,
      ),
    );
    const generatedAppDirectory = generatedAppDirectories.at(-1);

    report = {
      cleanInstallImportExclusions: spineCoverage.cleanInstallImportExclusions,
      cleanInstallDirectory,
      cleanInstallImports: spineCoverage.cleanInstallImports,
      generatedAppDirectory,
      packedPackageCount: packedPackages.size,
      smokeCases: alphaReleaseGeneratedAppSmokeCases,
      spineRoots: spineCoverage.spineRoots,
      status: "PASS",
      validations: [
        ...new Set(
          alphaReleaseGeneratedAppSmokeCases.flatMap((smokeCase) => smokeCase.validations),
        ),
      ],
    };

    console.log("alpha-release-smoke: clean install and packed generated app smoke passed");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report = {
      ...report,
      error: message,
      packedPackageCount: packedPackages.size,
      status: "FAIL",
    };
    throw error;
  } finally {
    writeReport(rootDir, report);
    rmSync(smokeRoot, { force: true, recursive: true });
  }
}

function parseArgs(args: readonly string[]): string {
  let rootDir = defaultRootDir;

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

    throw new Error(`Unknown option: ${arg}`);
  }

  return rootDir;
}

export function readCatalogSpinePackageNames(rootDir = defaultRootDir): readonly string[] {
  const catalogFile = join(rootDir, packageCatalogPath);
  const catalog = JSON.parse(readFileSync(catalogFile, "utf8")) as PackageCatalog;
  const spine = isRecord(catalog.spine) ? catalog.spine : undefined;
  const packages = spine?.packages;

  if (!Array.isArray(packages)) {
    throw new Error(`${catalogFile}: spine.packages must be an array`);
  }

  return packages.map((packageName, index) => {
    if (typeof packageName !== "string" || packageName.length === 0) {
      throw new Error(`${catalogFile}: spine.packages[${index}] must be a non-empty string`);
    }

    return normalizeCatalogSpinePackageName(packageName);
  });
}

export function deriveAlphaReleaseCleanInstallImportPackages(
  spinePackageNames: readonly string[],
  importExclusions: readonly AlphaReleaseImportExclusion[],
): readonly string[] {
  const excludedPackageNames = new Set(importExclusions.map(({ packageName }) => packageName));

  return spinePackageNames.filter(
    (packageName) => packageName.startsWith("@croco/") && !excludedPackageNames.has(packageName),
  );
}

export function resolveAlphaReleaseSpineCoverage(
  rootDir = defaultRootDir,
): AlphaReleaseSpineCoverage {
  const spineRoots = readCatalogSpinePackageNames(rootDir);

  return {
    cleanInstallImportExclusions: alphaReleaseCleanInstallImportExclusions,
    cleanInstallImports: deriveAlphaReleaseCleanInstallImportPackages(
      spineRoots,
      alphaReleaseCleanInstallImportExclusions,
    ),
    spineRoots,
  };
}

export function validateAlphaReleaseSpineCoverage(
  coverage: AlphaReleaseSpineCoverage,
  binarySmokeCommands: readonly string[] = alphaReleaseBinarySmokeCommands,
): readonly string[] {
  const violations: string[] = [];
  const spineSet = new Set(coverage.spineRoots);
  const importSet = new Set(coverage.cleanInstallImports);
  const exclusionPackageNames = coverage.cleanInstallImportExclusions.map(
    ({ packageName }) => packageName,
  );
  const exclusionSet = new Set(exclusionPackageNames);
  const binarySmokeCommandSet = new Set(binarySmokeCommands);

  for (const packageName of duplicateValues(coverage.spineRoots)) {
    violations.push(`${packageName}: duplicate cataloged spine package`);
  }

  for (const packageName of duplicateValues(coverage.cleanInstallImports)) {
    violations.push(`${packageName}: duplicate clean-install import smoke entry`);
  }

  for (const packageName of duplicateValues(exclusionPackageNames)) {
    violations.push(`${packageName}: duplicate clean-install import exclusion`);
  }

  for (const packageName of coverage.cleanInstallImports) {
    if (!spineSet.has(packageName)) {
      violations.push(
        `${packageName}: clean-install import smoke entry is not a cataloged spine package`,
      );
    }
  }

  for (const exclusion of coverage.cleanInstallImportExclusions) {
    if (!spineSet.has(exclusion.packageName)) {
      violations.push(
        `${exclusion.packageName}: clean-install import exclusion is not a cataloged spine package`,
      );
    }
    if (exclusion.reason.trim().length === 0) {
      violations.push(
        `${exclusion.packageName}: clean-install import exclusion must include a reason`,
      );
    }
    if (exclusion.checkedBy.trim().length === 0) {
      violations.push(
        `${exclusion.packageName}: clean-install import exclusion must include checkedBy`,
      );
    } else if (!binarySmokeCommandSet.has(exclusion.checkedBy)) {
      violations.push(
        `${exclusion.packageName}: clean-install import exclusion checkedBy is not an alpha-release binary smoke command`,
      );
    }
  }

  for (const packageName of coverage.spineRoots) {
    const isImported = importSet.has(packageName);
    const isExcluded = exclusionSet.has(packageName);

    if (isImported && isExcluded) {
      violations.push(`${packageName}: cataloged spine package is both import-smoked and excluded`);
    }
    if (!isImported && !isExcluded) {
      violations.push(
        `${packageName}: cataloged spine package is neither import-smoked nor covered by a checked exclusion`,
      );
    }
  }

  return violations;
}

function assertAlphaReleaseSpineCoverage(coverage: AlphaReleaseSpineCoverage): void {
  const violations = validateAlphaReleaseSpineCoverage(coverage);

  if (violations.length > 0) {
    throw new Error(
      [
        "Alpha release spine coverage is invalid:",
        ...violations.map((violation) => `- ${violation}`),
      ].join("\n"),
    );
  }
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates].sort();
}

function createReleasePackageIndex(rootDir: string): ReadonlyMap<string, ReleasePackage> {
  const index = new Map<string, ReleasePackage>();

  for (const manifestPath of findPackageJsonFiles(join(rootDir, "packages"))) {
    const sourceManifest = readPackageJson(manifestPath);
    if (sourceManifest.private === true) {
      continue;
    }

    const name = stringField(sourceManifest.name, `${manifestPath}: package name is required`);
    const version = stringField(
      sourceManifest.version,
      `${manifestPath}: ${name} is missing a string version`,
    );

    if (index.has(name)) {
      throw new Error(`Duplicate package name ${name}`);
    }

    index.set(name, {
      dependencyNames: collectDependencyNames(sourceManifest),
      manifestPath,
      name,
      packageDir: dirname(manifestPath),
      sourceManifest,
      version,
    });
  }

  return index;
}

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

function stringField(value: unknown, message: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new Error(message);
}

function collectDependencyNames(packageJson: PackageJson): readonly string[] {
  const dependencies = new Set<string>();

  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"] as const) {
    const value = packageJson[field];
    if (!isDependencyMap(value)) {
      continue;
    }

    for (const dependencyName of Object.keys(value)) {
      if (dependencyName.startsWith("@croco/")) {
        dependencies.add(dependencyName);
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

function resolvePackageClosure(
  rootPackageNames: readonly string[],
  packageIndex: ReadonlyMap<string, ReleasePackage>,
): readonly ReleasePackage[] {
  const resolved = new Map<string, ReleasePackage>();
  const resolving = new Set<string>();

  function resolvePackage(packageName: string, source: string): void {
    const packageInfo = packageIndex.get(packageName);
    if (!packageInfo) {
      throw new Error(
        `${source} references ${packageName}, but it is not a public workspace package`,
      );
    }

    if (resolved.has(packageName) || resolving.has(packageName)) {
      return;
    }

    resolving.add(packageName);
    resolved.set(packageName, packageInfo);

    for (const dependencyName of packageInfo.dependencyNames) {
      resolvePackage(dependencyName, `${packageInfo.name} package.json`);
    }

    resolving.delete(packageName);
  }

  for (const packageName of rootPackageNames) {
    resolvePackage(packageName, "alpha release spine");
  }

  return [...resolved.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function buildPackages(packages: readonly ReleasePackage[], rootDir: string): void {
  const packageNamesToBuild = packages
    .filter((packageInfo) => hasBuildScript(packageInfo.sourceManifest))
    .map(({ name }) => name);

  if (packageNamesToBuild.length === 0) {
    return;
  }

  run(
    process.execPath,
    [
      join(rootDir, "node_modules", "turbo", "bin", "turbo"),
      "build",
      ...packageNamesToBuild.map((packageName) => `--filter=${packageName}...`),
    ],
    rootDir,
  );
}

function hasBuildScript(packageJson: PackageJson): boolean {
  if (!isRecord(packageJson.scripts)) {
    return false;
  }

  return typeof packageJson.scripts.build === "string";
}

function packPackages(
  packages: readonly ReleasePackage[],
  packRoot: string,
  rootDir: string,
  packedPackages: Map<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    packages.map((packageInfo) => [
      packageInfo.name,
      `file:${packPackage(packageInfo, packRoot, rootDir, packedPackages)}`,
    ]),
  );
}

function packPackage(
  packageInfo: ReleasePackage,
  packRoot: string,
  rootDir: string,
  packedPackages: Map<string, string>,
): string {
  const cachedTarball = packedPackages.get(packageInfo.name);
  if (cachedTarball) {
    return cachedTarball;
  }

  mkdirSync(packRoot, { recursive: true });
  run("pnpm", ["--filter", packageInfo.name, "pack", "--pack-destination", packRoot], rootDir);

  const tarballPath = join(packRoot, packageTarballName(packageInfo));
  if (!existsSync(tarballPath)) {
    throw new Error(`${packageInfo.name}: expected packed tarball ${tarballPath} was not created`);
  }

  packedPackages.set(packageInfo.name, tarballPath);
  return tarballPath;
}

function packageTarballName(packageInfo: Pick<ReleasePackage, "name" | "version">): string {
  return `${packageInfo.name.replace(/^@/, "").replace("/", "-")}-${packageInfo.version}.tgz`;
}

function runCleanSpineInstall(
  consumerDir: string,
  spinePackages: readonly ReleasePackage[],
  spineOverrides: Record<string, string>,
  cleanInstallImportPackages: readonly string[],
  rootDir: string,
): string {
  mkdirSync(consumerDir, { recursive: true });
  writePackageJson(consumerDir, {
    name: "croco-alpha-spine-consumer",
    packageManager: packageManagerFor(rootDir),
    private: true,
    type: "module",
  });
  writePnpmOverrides(consumerDir, spineOverrides);

  run(
    "pnpm",
    [
      "add",
      "--prod",
      "--ignore-scripts",
      ...spinePackages.map(({ name }) => rangeFor(spineOverrides, name)),
    ],
    consumerDir,
  );
  assertNoWorkspaceReferences(consumerDir, "alpha spine clean install", "all");
  assertNoRepositoryCheckoutReferences(consumerDir, rootDir, "alpha spine clean install");

  run(
    "node",
    ["--input-type=module", "--eval", alphaSpineImportSmoke(cleanInstallImportPackages)],
    consumerDir,
  );
  run("pnpm", ["exec", "create-croco-app", "--version"], consumerDir);
  run("pnpm", ["exec", "croco", "--help"], consumerDir);
  console.log("alpha-release-smoke: clean spine package install passed");

  return consumerDir;
}

function runPackedCreateCrocoAppSmoke(
  smokeRoot: string,
  packageIndex: ReadonlyMap<string, ReleasePackage>,
  spineOverrides: Record<string, string>,
  rootDir: string,
  packedPackages: Map<string, string>,
  smokeCase: (typeof alphaReleaseGeneratedAppSmokeCases)[number],
): string {
  const cliConsumerDir = join(smokeRoot, "create-croco-app-consumer");
  const projectDir = join(smokeRoot, smokeCase.name);
  mkdirSync(cliConsumerDir, { recursive: true });
  writePackageJson(cliConsumerDir, {
    name: "croco-alpha-create-app-consumer",
    packageManager: packageManagerFor(rootDir),
    private: true,
    type: "module",
  });
  writePnpmOverrides(cliConsumerDir, spineOverrides);
  run(
    "pnpm",
    ["add", "--prod", "--ignore-scripts", rangeFor(spineOverrides, "create-croco-app")],
    cliConsumerDir,
  );
  run("pnpm", ["exec", "create-croco-app", projectDir, ...smokeCase.args], cliConsumerDir);

  const generatedPackageIndex = createWorkspacePackageIndex(rootDir);
  const generatedPackages = resolveLocalCrocoPackagesForGeneratedProject(
    projectDir,
    generatedPackageIndex,
  );
  const generatedReleasePackages = generatedPackages.map((packageInfo) =>
    releasePackageFor(packageIndex, packageInfo),
  );

  buildPackages(generatedReleasePackages, rootDir);
  const generatedOverrides = packPackages(
    generatedReleasePackages,
    join(smokeRoot, "generated-packs"),
    rootDir,
    packedPackages,
  );
  rewriteExternalCrocoRanges(projectDir, generatedOverrides);
  writePnpmOverrides(projectDir, generatedOverrides);

  run("pnpm", ["install"], projectDir);
  assertNoWorkspaceReferences(projectDir, "packed create-croco-app generated app", "croco-only");
  assertNoRepositoryCheckoutReferences(
    projectDir,
    rootDir,
    "packed create-croco-app generated app",
  );

  for (const validation of smokeCase.validations) {
    run("pnpm", [validation], projectDir);
    console.log(`alpha-release-smoke: ${smokeCase.name} ${validation} passed`);
  }

  return projectDir;
}

function releasePackageFor(
  packageIndex: ReadonlyMap<string, ReleasePackage>,
  workspacePackage: WorkspacePackage,
): ReleasePackage {
  const packageInfo = packageIndex.get(workspacePackage.name);
  if (!packageInfo) {
    throw new Error(
      `${workspacePackage.name}: generated app dependency is not in release package index`,
    );
  }

  return packageInfo;
}

function writePackageJson(directory: string, packageJson: Record<string, unknown>): void {
  writeFileSync(join(directory, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
}

function packageManagerFor(rootDir: string): string {
  const packageJson = readPackageJson(join(rootDir, "package.json"));
  return stringField(
    packageJson.packageManager,
    `${rootDir}/package.json: packageManager is required`,
  );
}

export function writePnpmOverrides(
  projectDir: string,
  rangeOverrides: Record<string, string>,
): void {
  const workspacePath = join(projectDir, "pnpm-workspace.yaml");
  const existingContent = existsSync(workspacePath)
    ? readFileSync(workspacePath, "utf8")
    : `packages:\n  - "."\n`;
  const contentWithoutOverrides = removeTopLevelYamlBlock(existingContent, "overrides").trimEnd();
  const overrideLines = Object.entries(rangeOverrides)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([packageName, range]) =>
        `  ${toYamlDoubleQuotedScalar(packageName)}: ${toYamlDoubleQuotedScalar(range)}`,
    );

  writeFileSync(
    workspacePath,
    `${contentWithoutOverrides}\n\n${["overrides:", ...overrideLines].join("\n")}\n`,
  );
}

function rangeFor(rangeOverrides: Record<string, string>, packageName: string): string {
  const range = rangeOverrides[packageName];
  if (!range) {
    throw new Error(`${packageName}: missing packed tarball override`);
  }

  return range;
}

function alphaSpineImportSmoke(packageNames: readonly string[]): string {
  return [
    `const packageNames = ${JSON.stringify(packageNames.filter((name) => name.startsWith("@croco/")))};`,
    "for (const packageName of packageNames) {",
    "  await import(packageName);",
    "}",
    "console.log(`alpha spine imports passed for ${packageNames.length} packages`);",
  ].join("\n");
}

function assertNoWorkspaceReferences(
  directory: string,
  label: string,
  mode: "all" | "croco-only",
): void {
  const violations: string[] = [];

  for (const path of collectEvidenceFiles(directory)) {
    const content = readFileSync(path, "utf8");
    const hasViolation =
      mode === "all"
        ? content.includes("workspace:")
        : /@croco\/[A-Za-z0-9._-]+[\s\S]{0,200}workspace:/.test(content);

    if (hasViolation) {
      violations.push(relative(directory, path));
    }
  }

  if (violations.length > 0) {
    throw new Error(`${label} leaked workspace references in ${violations.join(", ")}`);
  }
}

function assertNoRepositoryCheckoutReferences(
  directory: string,
  rootDir: string,
  label: string,
): void {
  const violations = collectEvidenceFiles(directory)
    .filter((path) => readFileSync(path, "utf8").includes(rootDir))
    .map((path) => relative(directory, path));

  if (violations.length > 0) {
    throw new Error(`${label} leaked repository checkout paths in ${violations.join(", ")}`);
  }
}

function collectEvidenceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
        return [];
      }

      return collectEvidenceFiles(entryPath);
    }

    return ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"].includes(entry.name)
      ? [entryPath]
      : [];
  });
}

function removeTopLevelYamlBlock(content: string, key: string): string {
  const lines = content.split(/\r?\n/);
  const blockStartIndex = lines.findIndex((line) => line === `${key}:`);

  if (blockStartIndex === -1) {
    return content;
  }

  let blockEndIndex = blockStartIndex + 1;
  while (
    blockEndIndex < lines.length &&
    (lines[blockEndIndex] === "" || /^\s/.test(lines[blockEndIndex]))
  ) {
    blockEndIndex += 1;
  }

  return [...lines.slice(0, blockStartIndex), ...lines.slice(blockEndIndex)].join("\n");
}

function toYamlDoubleQuotedScalar(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function run(command: string, args: readonly string[], cwd: string): void {
  const result = runCommand(command, args, cwd, true);

  if (result instanceof Error) {
    throw result;
  }
}

function runCommand(
  command: string,
  args: readonly string[],
  cwd: string,
  inherit: boolean,
): CommandResult | Error {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
    timeout: commandTimeoutMs,
  });

  if (result.error) {
    return result.error;
  }

  if (result.status !== 0) {
    return new Error(
      [
        `${command} ${args.join(" ")} failed with exit code ${result.status}`,
        typeof result.stdout === "string" ? result.stdout.trim() : undefined,
        typeof result.stderr === "string" ? result.stderr.trim() : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return {
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    stdout: typeof result.stdout === "string" ? result.stdout : "",
  };
}

export function formatAlphaReleaseSmokeReport(report: SmokeReport): string {
  const cleanInstallImportExclusions =
    report.cleanInstallImportExclusions.length > 0
      ? report.cleanInstallImportExclusions
          .map(
            (exclusion) =>
              `\`${exclusion.packageName}\` checked by \`${exclusion.checkedBy}\`: ${exclusion.reason}`,
          )
          .join("; ")
      : "none";
  const lines = [
    "# Alpha release smoke",
    "",
    `- Status: ${report.status}`,
    `- Spine roots: ${report.spineRoots.map((packageName) => `\`${packageName}\``).join(", ")}`,
    `- Clean install imports: ${report.cleanInstallImports.map((packageName) => `\`${packageName}\``).join(", ")}`,
    `- Clean install import exclusions: ${cleanInstallImportExclusions}`,
    `- Packed package tarballs: ${report.packedPackageCount}`,
    `- Generated app cases: ${report.smokeCases
      .map((smokeCase) =>
        "goal" in smokeCase
          ? `\`${smokeCase.goal}\` goal (\`${smokeCase.name}\`)`
          : `\`${smokeCase.preset}\` preset (\`${smokeCase.name}\`)`,
      )
      .join(", ")}`,
    `- Generated app validations: ${report.validations.map((validation) => `\`pnpm ${validation}\``).join(", ")}`,
  ];

  if (report.cleanInstallDirectory) {
    lines.push(`- Clean install directory: \`${report.cleanInstallDirectory}\``);
  }

  if (report.generatedAppDirectory) {
    lines.push(`- Generated app directory: \`${report.generatedAppDirectory}\``);
  }

  if (report.error) {
    lines.push("", "## Error", "", "```text", report.error, "```");
  }

  lines.push(
    "",
    "## Evidence",
    "",
    "- The alpha spine package set installs into a clean project from packed artifacts.",
    "- Config-free alpha spine entrypoints import successfully from the clean install.",
    "- The packed create-croco-app artifact preserves the production-app smoke and generates the canonical saas-api goal outside the repository checkout.",
    "- Generated app install uses packed Croco artifacts with no `@croco/*` workspace ranges.",
    "- The canonical SaaS project passes typecheck, build, test, and the documented zero-credential `demo:smoke` scenario.",
  );

  return `${lines.join("\n")}\n`;
}

function writeReport(rootDir: string, report: SmokeReport): void {
  const reportPath = join(rootDir, alphaReleaseEvidenceReportPath);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, formatAlphaReleaseSmokeReport(report));
  console.log(`alpha-release-smoke: wrote ${alphaReleaseEvidenceReportPath}`);
}

function isDependencyMap(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main();
}
