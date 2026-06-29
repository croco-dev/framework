#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { argv, env, exit, stdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

type CompanionStatus = "pass" | "needs-checks" | "fail";
type CheckStatus = "not-applicable" | "not-run" | "pass" | "fail";
type AnnotationLevel = "notice" | "warning" | "error";

type Options = {
  readonly baseRef: string;
  readonly changedFilesFile: string | null;
  readonly emitGithubAnnotations: boolean;
  readonly headRef: string;
  readonly outputDir: string;
  readonly rootDir: string;
  readonly runRequiredChecks: boolean;
};

type WorkspacePackage = {
  readonly directory: string;
  readonly name: string;
  readonly private: boolean;
  readonly scripts: ReadonlySet<string>;
};

type ChangedPackage = {
  readonly changedFiles: readonly string[];
  readonly commands: readonly CommandSuggestion[];
  readonly directory: string;
  readonly name: string;
  readonly private: boolean;
};

type CommandSuggestion = {
  readonly command: string;
  readonly reason: string;
};

type RequiredCheck = {
  readonly affectedFiles: readonly string[];
  readonly command: string;
  readonly evidence: string;
  readonly id: string;
  readonly output: string | null;
  readonly status: CheckStatus;
  readonly title: string;
};

type GeneratedArtifactSignal = {
  readonly affectedFiles: readonly string[];
  readonly command: string;
  readonly expectedArtifacts: readonly string[];
  readonly id: string;
  readonly missingArtifactsInPr: readonly string[];
  readonly status: CheckStatus;
  readonly title: string;
};

type Annotation = {
  readonly file: string | null;
  readonly level: AnnotationLevel;
  readonly message: string;
  readonly title: string;
};

type CompanionReport = {
  readonly annotations: readonly Annotation[];
  readonly baseRef: string;
  readonly changedFiles: readonly string[];
  readonly changedPackages: readonly ChangedPackage[];
  readonly generatedArtifacts: readonly GeneratedArtifactSignal[];
  readonly headRef: string;
  readonly output: {
    readonly jsonPath: string;
    readonly markdownPath: string;
  };
  readonly requiredChecks: readonly RequiredCheck[];
  readonly schemaVersion: "croco.pr-review-companion.v1";
  readonly status: CompanionStatus;
  readonly suggestedCommands: readonly CommandSuggestion[];
};

type PackageManifest = {
  readonly name?: unknown;
  readonly private?: unknown;
  readonly scripts?: unknown;
};

const scriptRootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultOutputDir = join("ci-reports", "pr-review-companion");
const workspaceFileName = "pnpm-workspace.yaml";
const generatedApiDocsRoot = join("packages", "docs", "src", "content", "docs", "api");
const problemRegistryArtifacts = [
  join("docs", "problem-code-registry.json"),
  join(
    "packages",
    "docs",
    "src",
    "content",
    "docs",
    "en",
    "reference",
    "problem-recovery-cookbook.md",
  ),
] as const;
const contractArtifactNames = [
  "contract-graph.snapshot.json",
  "contract-graph.coverage.json",
  "openapi.json",
  "croco.project-map.json",
] as const;
const generatedRpcClientRoot = "libs/shared/provider-rpc/src";
const packageScriptCommands = ["test", "typecheck", "build"] as const;
const defaultWorkspacePackagePatterns = ["packages/**/*", "apps/*", "libs/*"] as const;
const releaseChangesetPattern = /^\.changeset\/[^/]+\.md$/;
const testFilePattern = /(?:^|[.-])(spec|test)\.[cm]?[jt]sx?$/;

function toGitPath(path: string): string {
  return path.split(sep).join("/");
}

function normalizeChangedFile(path: string): string {
  return toGitPath(path.trim()).replace(/^\.\//, "");
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function formatList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.map((value) => `\`${value}\``).join(", ");
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

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8")) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readManifest(path: string): PackageManifest {
  const parsed = readJson(path);
  if (!isRecord(parsed)) {
    throw new Error(`${path} must contain a JSON object`);
  }

  return parsed;
}

function readScriptNamesFromManifest(path: string): Set<string> {
  const manifest = readManifest(path);
  const scripts = isRecord(manifest.scripts) ? manifest.scripts : {};

  return new Set(Object.keys(scripts).filter((name) => typeof scripts[name] === "string"));
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

  return results.sort(compareText);
}

function unquoteYamlScalar(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function readWorkspacePackagePatterns(rootDir: string): string[] {
  const workspacePath = join(rootDir, workspaceFileName);
  if (!existsSync(workspacePath)) {
    return [...defaultWorkspacePackagePatterns];
  }

  const patterns: string[] = [];
  let inPackagesSection = false;

  for (const line of readFileSync(workspacePath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      inPackagesSection = trimmed === "packages:";
      continue;
    }

    if (!inPackagesSection || !trimmed.startsWith("- ")) {
      continue;
    }

    const pattern = unquoteYamlScalar(trimmed.slice(2));

    if (pattern.length > 0 && !pattern.startsWith("!")) {
      patterns.push(pattern);
    }
  }

  return patterns.length > 0 ? patterns : [...defaultWorkspacePackagePatterns];
}

function patternSearchRoot(pattern: string): string {
  const normalized = normalizeChangedFile(pattern);
  const wildcardIndex = normalized.search(/[*[{]/);
  const staticPrefix = wildcardIndex === -1 ? normalized : normalized.slice(0, wildcardIndex);
  const root = staticPrefix.replace(/\/+$/, "");

  return root.length === 0 ? "." : root;
}

function readWorkspacePackages(rootDir: string): WorkspacePackage[] {
  const packageJsonPaths = new Set<string>();
  for (const pattern of readWorkspacePackagePatterns(rootDir)) {
    const searchRoot = patternSearchRoot(pattern);
    const resolvedRoot = join(rootDir, searchRoot);

    if (existsSync(join(resolvedRoot, "package.json"))) {
      packageJsonPaths.add(join(resolvedRoot, "package.json"));
    }

    if (pattern.includes("*") || pattern.includes("{")) {
      for (const packageJsonPath of findPackageJsonFiles(resolvedRoot)) {
        packageJsonPaths.add(packageJsonPath);
      }
    }
  }

  return [...packageJsonPaths]
    .map((packageJsonPath) => {
      const manifest = readManifest(packageJsonPath);
      const directory = toGitPath(relative(rootDir, dirname(packageJsonPath)));

      if (typeof manifest.name !== "string" || manifest.name.length === 0) {
        throw new Error(`${directory}/package.json is missing a string name`);
      }

      return {
        directory,
        name: manifest.name,
        private: manifest.private === true,
        scripts: readScriptNamesFromManifest(packageJsonPath),
      };
    })
    .sort(
      (left, right) =>
        right.directory.length - left.directory.length || compareText(left.name, right.name),
    );
}

function readRootScriptNames(rootDir: string): Set<string> {
  const rootPackageJson = join(rootDir, "package.json");
  return existsSync(rootPackageJson) ? readScriptNamesFromManifest(rootPackageJson) : new Set();
}

function getChangedFiles(options: Options): string[] {
  if (options.changedFilesFile) {
    return uniqueSorted(
      readFileSync(options.changedFilesFile, "utf-8")
        .split(/\r?\n/)
        .map(normalizeChangedFile)
        .filter(Boolean),
    );
  }

  runGit(options.rootDir, ["rev-parse", "--verify", `${options.baseRef}^{commit}`]);
  runGit(options.rootDir, ["rev-parse", "--verify", `${options.headRef}^{commit}`]);

  const output = runGit(options.rootDir, [
    "diff",
    "--name-only",
    "--diff-filter=ACMRD",
    `${options.baseRef}...${options.headRef}`,
  ]);

  return uniqueSorted(output.split(/\r?\n/).map(normalizeChangedFile).filter(Boolean));
}

function getOwningPackage(
  file: string,
  packages: readonly WorkspacePackage[],
): WorkspacePackage | null {
  return (
    packages.find((pkg) => file === pkg.directory || file.startsWith(`${pkg.directory}/`)) ?? null
  );
}

function packageRelativeFile(file: string, pkg: WorkspacePackage): string {
  return file === pkg.directory ? "" : file.slice(`${pkg.directory}/`.length);
}

function isPackageTestFile(path: string): boolean {
  const fileName = basename(path);

  return (
    path.startsWith("__tests__/") ||
    path.startsWith("src/__tests__/") ||
    path.startsWith("src/tests/") ||
    path.startsWith("test/") ||
    path.startsWith("tests/") ||
    testFilePattern.test(fileName)
  );
}

function isPackageSourceFile(file: string, pkg: WorkspacePackage): boolean {
  const relativeFile = packageRelativeFile(file, pkg);
  return relativeFile.startsWith("src/") && !isPackageTestFile(relativeFile);
}

function isReleaseSignificantPackageFile(file: string, pkg: WorkspacePackage): boolean {
  const relativeFile = packageRelativeFile(file, pkg);
  if (relativeFile === "package.json") {
    return true;
  }

  if (isPackageTestFile(relativeFile)) {
    return false;
  }

  return (
    relativeFile.startsWith("src/") ||
    relativeFile.startsWith("templates/") ||
    relativeFile.startsWith("bin/")
  );
}

function commandForPackageScript(
  pkg: WorkspacePackage,
  script: (typeof packageScriptCommands)[number],
): CommandSuggestion | null {
  if (!pkg.scripts.has(script)) {
    return null;
  }

  return {
    command: `pnpm --filter ${pkg.name} ${script}`,
    reason: `${pkg.name} changed and defines a ${script} script`,
  };
}

function createChangedPackages(
  changedFiles: readonly string[],
  packages: readonly WorkspacePackage[],
): ChangedPackage[] {
  return packages
    .map((pkg) => {
      const files = changedFiles.filter(
        (file) => getOwningPackage(file, packages)?.directory === pkg.directory,
      );
      const commands = packageScriptCommands
        .map((script) => commandForPackageScript(pkg, script))
        .filter((command): command is CommandSuggestion => command !== null);

      return {
        changedFiles: files,
        commands,
        directory: pkg.directory,
        name: pkg.name,
        private: pkg.private,
      };
    })
    .filter((pkg) => pkg.changedFiles.length > 0)
    .sort((left, right) => compareText(left.name, right.name));
}

function hasRealChangeset(changedFiles: readonly string[]): boolean {
  return changedFiles.some(
    (file) => releaseChangesetPattern.test(file) && basename(file) !== "README.md",
  );
}

function isGeneratedApiDocsFile(file: string): boolean {
  return file.startsWith(`${generatedApiDocsRoot}/`);
}

function isRootQualitySurface(file: string): boolean {
  return (
    file === "package.json" ||
    file === "pnpm-lock.yaml" ||
    file === "turbo.json" ||
    file === "croco.arch.json" ||
    file.startsWith(".github/workflows/") ||
    file.startsWith("scripts/")
  );
}

function isCreateCrocoAppSurface(file: string): boolean {
  return (
    file.startsWith("packages/create-croco-app/src/") ||
    file.startsWith("packages/create-croco-app/templates/") ||
    file.startsWith("scripts/create-croco-app-generated-smoke")
  );
}

function isGeneratedAppContractSource(file: string): boolean {
  if (!file.startsWith("apps/api-server/src/")) {
    return false;
  }

  const relativeFile = file.slice("apps/api-server/src/".length);

  return (
    relativeFile.startsWith("controllers/") ||
    relativeFile === "admin.ts" ||
    relativeFile === "users.ts" ||
    relativeFile === "problems.ts"
  );
}

function isGeneratedRpcClientArtifact(file: string): boolean {
  return file === generatedRpcClientRoot || file.startsWith(`${generatedRpcClientRoot}/`);
}

function isContractOrProjectMapSurface(file: string): boolean {
  return (
    isCreateCrocoAppSurface(file) ||
    isGeneratedAppContractSource(file) ||
    isGeneratedRpcClientArtifact(file) ||
    file.startsWith("packages/cli/src/commands/contracts") ||
    file.startsWith("packages/cli/src/commands/projectMap") ||
    file.startsWith("packages/protocols-core/src/libs/ContractGraph") ||
    contractArtifactNames.some((name) => file.endsWith(`/${name}`) || file === name)
  );
}

function readExistingFile(rootDir: string, file: string): string | null {
  const path = join(rootDir, file);
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

function isProblemRegistrySource(
  rootDir: string,
  file: string,
  pkg: WorkspacePackage | null,
): boolean {
  if (
    !pkg ||
    !file.startsWith(`${pkg.directory}/src/`) ||
    isPackageTestFile(packageRelativeFile(file, pkg))
  ) {
    return false;
  }

  if (file.includes("Problem") || file.includes("DiagnosticCodes")) {
    return true;
  }

  const content = readExistingFile(rootDir, file);
  if (!content) {
    return false;
  }

  return (
    /\bextends\s+Problem\b/.test(content) ||
    /\breadonly\s+code\s*=/.test(content) ||
    /\bProblemCategory\b/.test(content) ||
    /\bcreate[A-Z][A-Za-z0-9]*ProblemDetails\b/.test(content)
  );
}

function createRequiredCheck(input: {
  readonly affectedFiles: readonly string[];
  readonly command: string;
  readonly evidence: string;
  readonly id: string;
  readonly title: string;
}): RequiredCheck {
  return {
    affectedFiles: uniqueSorted(input.affectedFiles),
    command: input.command,
    evidence: input.evidence,
    id: input.id,
    output: null,
    status: "not-run",
    title: input.title,
  };
}

function rootScriptCommand(rootScripts: ReadonlySet<string>, scriptName: string): string | null {
  return rootScripts.has(scriptName) ? `pnpm ${scriptName}` : null;
}

function pushScriptBackedCheck(
  checks: RequiredCheck[],
  rootScripts: ReadonlySet<string>,
  scriptName: string,
  input: {
    readonly affectedFiles: readonly string[];
    readonly args?: string;
    readonly evidence: string;
    readonly id: string;
    readonly title: string;
  },
): void {
  const command = rootScriptCommand(rootScripts, scriptName);

  if (!command) {
    return;
  }

  checks.push(
    createRequiredCheck({
      affectedFiles: input.affectedFiles,
      command: input.args ? `${command} ${input.args}` : command,
      evidence: input.evidence,
      id: input.id,
      title: input.title,
    }),
  );
}

function resolveContractProjectMapCommand(rootScripts: ReadonlySet<string>): string | null {
  for (const scriptName of [
    "ci:contracts",
    "contract:verify",
    "create-croco-app:smoke",
    "project-map:check",
    "contract:check",
  ]) {
    const command = rootScriptCommand(rootScripts, scriptName);

    if (command) {
      return command;
    }
  }

  return null;
}

function resolveRequiredChecks(
  rootDir: string,
  rootScripts: ReadonlySet<string>,
  baseRef: string,
  headRef: string,
  changedFiles: readonly string[],
  changedPackages: readonly ChangedPackage[],
  packages: readonly WorkspacePackage[],
): RequiredCheck[] {
  const checks: RequiredCheck[] = [];
  const publicReleaseChanges = changedFiles.filter((file) => {
    const pkg = getOwningPackage(file, packages);
    return pkg !== null && !pkg.private && isReleaseSignificantPackageFile(file, pkg);
  });
  const packageManifestChanges = changedFiles.filter((file) => {
    const pkg = getOwningPackage(file, packages);
    return pkg !== null && packageRelativeFile(file, pkg) === "package.json";
  });
  const publicPackageSourceChanges = changedFiles.filter((file) => {
    const pkg = getOwningPackage(file, packages);
    return (
      pkg !== null &&
      !pkg.private &&
      (isPackageSourceFile(file, pkg) || packageRelativeFile(file, pkg) === "package.json")
    );
  });
  const problemRegistryFiles = changedFiles.filter(
    (file) =>
      problemRegistryArtifacts.includes(file as (typeof problemRegistryArtifacts)[number]) ||
      isProblemRegistrySource(rootDir, file, getOwningPackage(file, packages)),
  );
  const architectureSurfaceFiles = changedFiles.filter((file) => {
    const pkg = getOwningPackage(file, packages);
    return (
      file === "croco.arch.json" ||
      packageManifestChanges.includes(file) ||
      (pkg !== null && isPackageSourceFile(file, pkg))
    );
  });
  const generatedAppFiles = changedFiles.filter(isContractOrProjectMapSurface);
  const docsTriggerFiles = changedFiles.filter(
    (file) =>
      isGeneratedApiDocsFile(file) ||
      file === ".github/workflows/ci.yml" ||
      file === "scripts/api-docs-trigger-check.mts",
  );

  if (publicReleaseChanges.length > 0 && !hasRealChangeset(changedFiles)) {
    pushScriptBackedCheck(checks, rootScripts, "changeset-required:check", {
      affectedFiles: publicReleaseChanges,
      args: `-- --base ${baseRef} --head ${headRef}`,
      evidence:
        "publishable package behavior files changed without a visible non-README changeset in the PR file set",
      id: "changeset-required",
      title: "Changeset requirement",
    });
  }

  if (packageManifestChanges.length > 0) {
    pushScriptBackedCheck(checks, rootScripts, "package-manifests:check", {
      affectedFiles: packageManifestChanges,
      evidence: "package manifests changed and must stay normalized",
      id: "package-manifests",
      title: "Package manifest normalization",
    });
  }

  if (
    publicPackageSourceChanges.length > 0 ||
    changedFiles.includes("public-api-surface.snapshot.json")
  ) {
    pushScriptBackedCheck(checks, rootScripts, "public-api:check", {
      affectedFiles: [...publicPackageSourceChanges, "public-api-surface.snapshot.json"].filter(
        (file) => changedFiles.includes(file),
      ),
      evidence: "public package source or manifest changes can drift the public API snapshot",
      id: "public-api",
      title: "Public API snapshot drift",
    });
  }

  if (problemRegistryFiles.length > 0) {
    pushScriptBackedCheck(checks, rootScripts, "problem-registry:check", {
      affectedFiles: problemRegistryFiles,
      evidence: "Problem source or generated registry artifacts changed",
      id: "problem-registry",
      title: "Problem Registry drift",
    });
  }

  if (docsTriggerFiles.length > 0) {
    pushScriptBackedCheck(checks, rootScripts, "docs:api-triggers:check", {
      affectedFiles: docsTriggerFiles,
      evidence: "generated API docs or their CI path filter changed",
      id: "docs-api-triggers",
      title: "Generated API docs trigger drift",
    });
  }

  if (architectureSurfaceFiles.length > 0) {
    pushScriptBackedCheck(checks, rootScripts, "architecture-policy:check", {
      affectedFiles: architectureSurfaceFiles,
      evidence:
        "architecture manifest, package manifest, or package source changes can violate layer boundaries",
      id: "architecture-policy",
      title: "Architecture policy violations",
    });
  }

  if (generatedAppFiles.length > 0) {
    const command = resolveContractProjectMapCommand(rootScripts);

    if (command) {
      checks.push(
        createRequiredCheck({
          affectedFiles: generatedAppFiles,
          command,
          evidence:
            "Contract Graph, OpenAPI/RPC, Project Map, or generated app template surfaces changed",
          id: "contract-project-map-generated-app",
          title: "Contract Graph and Project Map generated-app smoke",
        }),
      );
    }
  }

  if (changedPackages.length > 0 || changedFiles.some(isRootQualitySurface)) {
    pushScriptBackedCheck(checks, rootScripts, "check", {
      affectedFiles: changedFiles.filter((file) => {
        const pkg = getOwningPackage(file, packages);
        return pkg !== null || isRootQualitySurface(file);
      }),
      evidence: "changed packages or root quality surfaces need the repository policy gate",
      id: "repository-policy",
      title: "Repository policy gate",
    });
  }

  return dedupeChecks(checks);
}

function getContractExpectedArtifacts(changedFiles: readonly string[]): string[] {
  const expectedArtifacts: string[] = [...contractArtifactNames];

  if (
    changedFiles.some(
      (file) => isGeneratedAppContractSource(file) || isGeneratedRpcClientArtifact(file),
    )
  ) {
    expectedArtifacts.push(generatedRpcClientRoot);
  }

  return expectedArtifacts;
}

function hasChangedPath(changedFiles: readonly string[], expectedPath: string): boolean {
  return changedFiles.some((file) => file === expectedPath || file.startsWith(`${expectedPath}/`));
}

function getMissingContractArtifacts(
  changedFiles: readonly string[],
  check: RequiredCheck | undefined,
): string[] {
  if (!check || check.affectedFiles.length === 0) {
    return [];
  }

  return getContractExpectedArtifacts(changedFiles).filter(
    (artifactPath) => !hasChangedPath(changedFiles, artifactPath),
  );
}

function dedupeChecks(checks: readonly RequiredCheck[]): RequiredCheck[] {
  const byId = new Map<string, RequiredCheck>();
  for (const check of checks) {
    const existing = byId.get(check.id);
    if (!existing) {
      byId.set(check.id, check);
      continue;
    }

    byId.set(check.id, {
      ...existing,
      affectedFiles: uniqueSorted([...existing.affectedFiles, ...check.affectedFiles]),
    });
  }
  return [...byId.values()].sort((left, right) => compareText(left.id, right.id));
}

function runRequiredChecks(rootDir: string, checks: readonly RequiredCheck[]): RequiredCheck[] {
  return checks.map((check) => {
    const result = spawnSync(check.command, {
      cwd: rootDir,
      encoding: "utf-8",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");

    return {
      ...check,
      output: output.length > 0 ? output.slice(-6000) : null,
      status: result.status === 0 ? "pass" : "fail",
    };
  });
}

function createGeneratedArtifactSignals(
  changedFiles: readonly string[],
  checks: readonly RequiredCheck[],
): GeneratedArtifactSignal[] {
  const byId = new Map(checks.map((check) => [check.id, check] as const));
  const problemCheck = byId.get("problem-registry");
  const publicApiCheck = byId.get("public-api");
  const contractCheck = byId.get("contract-project-map-generated-app");
  const docsApiCheck = byId.get("docs-api-triggers");

  return [
    {
      affectedFiles: problemCheck?.affectedFiles ?? [],
      command: problemCheck?.command ?? "pnpm problem-registry:check",
      expectedArtifacts: problemRegistryArtifacts,
      id: "problem-registry",
      missingArtifactsInPr:
        problemCheck && problemCheck.affectedFiles.length > 0
          ? problemRegistryArtifacts.filter((file) => !changedFiles.includes(file))
          : [],
      status: problemCheck?.status ?? "not-applicable",
      title: "Problem Registry",
    },
    {
      affectedFiles: publicApiCheck?.affectedFiles ?? [],
      command: publicApiCheck?.command ?? "pnpm public-api:check",
      expectedArtifacts: ["public-api-surface.snapshot.json"],
      id: "public-api",
      missingArtifactsInPr:
        publicApiCheck &&
        publicApiCheck.affectedFiles.length > 0 &&
        !changedFiles.includes("public-api-surface.snapshot.json")
          ? ["public-api-surface.snapshot.json"]
          : [],
      status: publicApiCheck?.status ?? "not-applicable",
      title: "Public API snapshot",
    },
    {
      affectedFiles: contractCheck?.affectedFiles ?? [],
      command: contractCheck?.command ?? "pnpm create-croco-app:smoke",
      expectedArtifacts: getContractExpectedArtifacts(changedFiles),
      id: "contract-project-map-generated-app",
      missingArtifactsInPr: getMissingContractArtifacts(changedFiles, contractCheck),
      status: contractCheck?.status ?? "not-applicable",
      title: "Contract Graph, OpenAPI/RPC, and Project Map",
    },
    {
      affectedFiles: docsApiCheck?.affectedFiles ?? [],
      command: docsApiCheck?.command ?? "pnpm docs:api-triggers:check",
      expectedArtifacts: [`${generatedApiDocsRoot}/<package>`],
      id: "docs-api-triggers",
      missingArtifactsInPr: [],
      status: docsApiCheck?.status ?? "not-applicable",
      title: "Generated API docs triggers",
    },
  ];
}

function createSuggestedCommands(
  changedPackages: readonly ChangedPackage[],
  requiredChecks: readonly RequiredCheck[],
): CommandSuggestion[] {
  const commands = new Map<string, CommandSuggestion>();
  for (const pkg of changedPackages) {
    for (const command of pkg.commands) {
      commands.set(command.command, command);
    }
  }

  for (const check of requiredChecks) {
    commands.set(check.command, {
      command: check.command,
      reason: check.title,
    });
  }

  return [...commands.values()].sort((left, right) => compareText(left.command, right.command));
}

function createAnnotations(
  checks: readonly RequiredCheck[],
  artifacts: readonly GeneratedArtifactSignal[],
): Annotation[] {
  const annotations: Annotation[] = [];
  for (const check of checks) {
    if (check.status === "fail") {
      annotations.push({
        file: check.affectedFiles[0] ?? null,
        level: "error",
        message: `${check.title} failed. Run \`${check.command}\` and review ${defaultOutputDir}/report.md.`,
        title: check.title,
      });
      continue;
    }

    if (check.status === "not-run") {
      annotations.push({
        file: check.affectedFiles[0] ?? null,
        level: "notice",
        message: `${check.title} is required for this PR surface. Run \`${check.command}\`.`,
        title: check.title,
      });
    }
  }

  for (const artifact of artifacts) {
    if (artifact.missingArtifactsInPr.length === 0 || artifact.status === "pass") {
      continue;
    }

    annotations.push({
      file: artifact.affectedFiles[0] ?? null,
      level: "warning",
      message: `${artifact.title} inputs changed without these generated artifact paths in the PR file set: ${artifact.missingArtifactsInPr.join(", ")}. The authoritative gate is \`${artifact.command}\`.`,
      title: `${artifact.title} artifact review`,
    });
  }

  return annotations.sort((left, right) =>
    compareText(`${left.level}:${left.title}`, `${right.level}:${right.title}`),
  );
}

function resolveStatus(checks: readonly RequiredCheck[]): CompanionStatus {
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }

  if (checks.some((check) => check.status === "not-run")) {
    return "needs-checks";
  }

  return "pass";
}

function buildMarkdown(report: CompanionReport): string {
  const lines = [
    "# Croco PR Review Companion",
    "",
    `- Status: ${report.status}`,
    `- Compared refs: \`${report.baseRef}...${report.headRef}\``,
    `- Changed files: ${report.changedFiles.length}`,
    `- Changed packages: ${report.changedPackages.length}`,
    "",
    "## Changed Packages",
  ];

  if (report.changedPackages.length === 0) {
    lines.push("- none");
  } else {
    lines.push(
      "| Package | Path | Visibility | Changed files | Suggested commands |",
      "| --- | --- | --- | ---: | --- |",
    );
    for (const pkg of report.changedPackages) {
      lines.push(
        `| \`${pkg.name}\` | \`${pkg.directory}\` | ${pkg.private ? "private" : "public"} | ${pkg.changedFiles.length} | ${pkg.commands.map((command) => `\`${command.command}\``).join("<br>") || "none"} |`,
      );
    }
  }

  lines.push(
    "",
    "## Required Checks",
    "| Check | Status | Command | Evidence |",
    "| --- | --- | --- | --- |",
  );
  if (report.requiredChecks.length === 0) {
    lines.push("| none | not-applicable | none | no changed surface requires a companion check |");
  } else {
    for (const check of report.requiredChecks) {
      lines.push(`| ${check.title} | ${check.status} | \`${check.command}\` | ${check.evidence} |`);
    }
  }

  lines.push(
    "",
    "## Generated Artifact Drift",
    "| Artifact surface | Status | Command | Missing artifact paths in PR |",
    "| --- | --- | --- | --- |",
  );
  for (const artifact of report.generatedArtifacts) {
    lines.push(
      `| ${artifact.title} | ${artifact.status} | \`${artifact.command}\` | ${formatList(artifact.missingArtifactsInPr)} |`,
    );
  }

  lines.push("", "## Suggested Commands");
  if (report.suggestedCommands.length === 0) {
    lines.push("- none");
  } else {
    for (const suggestion of report.suggestedCommands) {
      lines.push(`- \`${suggestion.command}\` - ${suggestion.reason}`);
    }
  }

  const failedChecks = report.requiredChecks.filter((check) => check.status === "fail");
  if (failedChecks.length > 0) {
    lines.push("", "## Failed Check Output");
    for (const check of failedChecks) {
      lines.push(
        "",
        `### ${check.title}`,
        "",
        "```text",
        check.output ?? "no output captured",
        "```",
      );
    }
  }

  lines.push("");
  return `${lines.join("\n")}`;
}

function createReport(options: Options): CompanionReport {
  const changedFiles = getChangedFiles(options);
  const rootScripts = readRootScriptNames(options.rootDir);
  const packages = readWorkspacePackages(options.rootDir);
  const changedPackages = createChangedPackages(changedFiles, packages);
  const discoveredChecks = resolveRequiredChecks(
    options.rootDir,
    rootScripts,
    options.baseRef,
    options.headRef,
    changedFiles,
    changedPackages,
    packages,
  );
  const requiredChecks = options.runRequiredChecks
    ? runRequiredChecks(options.rootDir, discoveredChecks)
    : discoveredChecks;
  const generatedArtifacts = createGeneratedArtifactSignals(changedFiles, requiredChecks);
  const annotations = createAnnotations(requiredChecks, generatedArtifacts);
  const outputDir = resolve(options.rootDir, options.outputDir);

  return {
    annotations,
    baseRef: options.baseRef,
    changedFiles,
    changedPackages,
    generatedArtifacts,
    headRef: options.headRef,
    output: {
      jsonPath: toGitPath(relative(options.rootDir, join(outputDir, "report.json"))),
      markdownPath: toGitPath(relative(options.rootDir, join(outputDir, "report.md"))),
    },
    requiredChecks,
    schemaVersion: "croco.pr-review-companion.v1",
    status: resolveStatus(requiredChecks),
    suggestedCommands: createSuggestedCommands(changedPackages, requiredChecks),
  };
}

function writeReport(rootDir: string, outputDir: string, report: CompanionReport): void {
  const resolvedOutputDir = resolve(rootDir, outputDir);
  mkdirSync(resolvedOutputDir, { recursive: true });
  writeFileSync(join(resolvedOutputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(resolvedOutputDir, "report.md"), buildMarkdown(report));
}

function escapeGithubValue(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function emitGithubAnnotations(annotations: readonly Annotation[]): void {
  for (const annotation of annotations) {
    const properties = annotation.file
      ? ` file=${escapeGithubValue(annotation.file)},title=${escapeGithubValue(annotation.title)}`
      : ` title=${escapeGithubValue(annotation.title)}`;
    stdout.write(`::${annotation.level}${properties}::${escapeGithubValue(annotation.message)}\n`);
  }
}

function parseArgs(args: readonly string[]): Options {
  let baseRef = env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : "origin/trunk";
  let changedFilesFile: string | null = null;
  let emitGithubAnnotations = env.GITHUB_ACTIONS === "true";
  let headRef = "HEAD";
  let outputDir = defaultOutputDir;
  let rootDir = scriptRootDir;
  let runRequiredChecks = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--") {
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

    if (arg === "--changed-files-file") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--changed-files-file requires a path");
      }
      changedFilesFile = resolve(value);
      index++;
      continue;
    }

    if (arg === "--github-annotations") {
      emitGithubAnnotations = true;
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

    if (arg === "--no-github-annotations") {
      emitGithubAnnotations = false;
      continue;
    }

    if (arg === "--output-dir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--output-dir requires a path");
      }
      outputDir = value;
      index++;
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

    if (arg === "--run-required-checks") {
      runRequiredChecks = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    baseRef,
    changedFilesFile,
    emitGithubAnnotations,
    headRef,
    outputDir,
    rootDir,
    runRequiredChecks,
  };
}

function main(): void {
  try {
    const options = parseArgs(argv.slice(2));
    const report = createReport(options);
    writeReport(options.rootDir, options.outputDir, report);

    stdout.write(`pr-review-companion: ${report.status}\n`);
    stdout.write(`pr-review-companion: markdown ${report.output.markdownPath}\n`);
    stdout.write(`pr-review-companion: json ${report.output.jsonPath}\n`);

    if (options.emitGithubAnnotations) {
      emitGithubAnnotations(report.annotations);
    }

    exit(report.status === "fail" ? 1 : 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stdout.write(`pr-review-companion: failed: ${message}\n`);
    exit(1);
  }
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  main();
}

export { buildMarkdown, createReport, createSuggestedCommands, resolveRequiredChecks };
