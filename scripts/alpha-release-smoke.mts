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

type SmokeReport = {
  readonly cleanInstallDirectory?: string;
  readonly error?: string;
  readonly generatedAppDirectory?: string;
  readonly packedPackageCount: number;
  readonly smokeCase: typeof alphaReleaseGeneratedAppSmoke;
  readonly spineRoots: readonly string[];
  readonly status: "PASS" | "FAIL";
  readonly validations: readonly string[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultRootDir = resolve(__dirname, "..");
const commandTimeoutMs = 900_000;
const skippedPackageJsonDirectories = new Set([".turbo", "coverage", "dist", "node_modules"]);

export const alphaReleaseEvidenceReportPath = "ci-reports/release/alpha-release-smoke.md";

export const alphaReleaseSpineRoots = [
  "create-croco-app",
  "@croco/cli",
  "@croco/events-core",
  "@croco/events-inmemory",
  "@croco/framework-context",
  "@croco/problems-core",
  "@croco/protocols-rest",
  "@croco/repository-core",
  "@croco/retry-core",
  "@croco/telemetry-api",
  "@croco/telemetry-sdk-node",
  "@croco/transports-http",
] as const;

export const alphaReleaseGeneratedAppSmoke = {
  args: ["--preset", "production-app", "--scope", "@alpha", "--no-install", "--no-git"],
  name: "alpha-production-app",
  preset: "production-app",
} as const;

export const alphaReleaseGeneratedAppValidations = [
  "contract:snapshot",
  "contract:verify",
  "typecheck",
  "build",
  "dev:smoke",
] as const;

export const alphaReleaseCleanInstallImportPackages = [
  "@croco/diagnostics-core",
  "@croco/events-core",
  "@croco/framework-context",
  "@croco/problems-core",
  "@croco/protocols-core",
  "@croco/protocols-rest",
  "@croco/repository-core",
  "@croco/retry-core",
  "@croco/telemetry-api",
] as const;

function main(): void {
  const rootDir = parseArgs(process.argv.slice(2));
  const smokeRoot = mkdtempSync(join(tmpdir(), "croco-alpha-release-smoke-"));
  const packRoot = join(smokeRoot, "packs");
  const packedPackages = new Map<string, string>();
  let report: SmokeReport = {
    packedPackageCount: 0,
    smokeCase: alphaReleaseGeneratedAppSmoke,
    spineRoots: alphaReleaseSpineRoots,
    status: "FAIL",
    validations: alphaReleaseGeneratedAppValidations,
  };

  try {
    const packageIndex = createReleasePackageIndex(rootDir);
    const spinePackages = resolvePackageClosure(alphaReleaseSpineRoots, packageIndex);
    buildPackages(spinePackages, rootDir);
    const spineOverrides = packPackages(spinePackages, packRoot, rootDir, packedPackages);
    const cleanInstallDirectory = runCleanSpineInstall(
      join(smokeRoot, "spine-consumer"),
      spinePackages,
      spineOverrides,
      rootDir,
    );
    const generatedAppDirectory = runPackedCreateCrocoAppSmoke(
      smokeRoot,
      packageIndex,
      spineOverrides,
      rootDir,
      packedPackages,
    );

    report = {
      cleanInstallDirectory,
      generatedAppDirectory,
      packedPackageCount: packedPackages.size,
      smokeCase: alphaReleaseGeneratedAppSmoke,
      spineRoots: alphaReleaseSpineRoots,
      status: "PASS",
      validations: alphaReleaseGeneratedAppValidations,
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
    [
      "--input-type=module",
      "--eval",
      alphaSpineImportSmoke(alphaReleaseCleanInstallImportPackages),
    ],
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
): string {
  const cliConsumerDir = join(smokeRoot, "create-croco-app-consumer");
  const projectDir = join(smokeRoot, alphaReleaseGeneratedAppSmoke.name);
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
  run(
    "pnpm",
    ["exec", "create-croco-app", projectDir, ...alphaReleaseGeneratedAppSmoke.args],
    cliConsumerDir,
  );

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

  for (const validation of alphaReleaseGeneratedAppValidations) {
    run("pnpm", [validation], projectDir);
    console.log(`alpha-release-smoke: generated app ${validation} passed`);
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

function writePnpmOverrides(projectDir: string, rangeOverrides: Record<string, string>): void {
  const manifestPath = join(projectDir, "package.json");
  const packageJson = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  const pnpmConfig = isRecord(packageJson.pnpm) ? packageJson.pnpm : {};
  const existingOverrides = isDependencyMap(pnpmConfig.overrides) ? pnpmConfig.overrides : {};

  packageJson.pnpm = {
    ...pnpmConfig,
    overrides: {
      ...existingOverrides,
      ...rangeOverrides,
    },
  };

  writeFileSync(manifestPath, `${JSON.stringify(packageJson, null, 2)}\n`);
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
  const lines = [
    "# Alpha release smoke",
    "",
    `- Status: ${report.status}`,
    `- Spine roots: ${report.spineRoots.map((packageName) => `\`${packageName}\``).join(", ")}`,
    `- Packed package tarballs: ${report.packedPackageCount}`,
    `- Generated app preset: \`${report.smokeCase.preset}\``,
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
    "- The packed create-croco-app artifact generates the production-app preset outside the repository checkout.",
    "- Generated app install uses packed Croco artifacts with no `@croco/*` workspace ranges.",
    "- Contract verification, typecheck, build, and zero-credential smoke run against the generated project.",
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
