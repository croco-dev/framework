import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type QualityTask = "build" | "typecheck" | "test";
export type QualityStatus = "pass" | "fail" | "not-collected" | "not-configured" | "not-run";

export type PackageInfo = {
  readonly name: string;
  readonly private: boolean;
  readonly relativeDir: string;
  readonly scripts: Readonly<Record<string, string>>;
};

export type PackageTaskResult = {
  readonly task: QualityTask;
  readonly status: QualityStatus;
  readonly taskId: string | null;
  readonly logFile: string | null;
  readonly cacheStatus: string | null;
};

export type PackageQualityRow = {
  readonly packageName: string;
  readonly relativeDir: string;
  readonly private: boolean;
  readonly tasks: Readonly<Record<QualityTask, PackageTaskResult>>;
};

export type DependencyBoundaryViolation = {
  readonly file: string;
  readonly line: number;
  readonly excerpt: string;
};

export type DependencyBoundaryResult = {
  readonly id: string;
  readonly packageName: string;
  readonly sourceDir: string;
  readonly policy: string;
  readonly status: "pass" | "fail" | "missing-source";
  readonly violations: readonly DependencyBoundaryViolation[];
};

export type PublicApiGuardResult = {
  readonly status: "pass" | "fail" | "not-collected";
  readonly packageCount: number | null;
  readonly changedPackages: number | null;
  readonly runtimeAdded: number | null;
  readonly runtimeRemoved: number | null;
  readonly typeAdded: number | null;
  readonly typeRemoved: number | null;
  readonly snapshotPath: string;
  readonly reportPath: string;
  readonly updateCommand: string;
};

export type BundleSizeStatus =
  | "within-baseline"
  | "over-baseline"
  | "missing-baseline"
  | "not-built";

export type BundleSizeArtifact = {
  readonly packageName: string;
  readonly relativeDir: string;
  readonly artifactPath: string | null;
  readonly baselineKey: string | null;
  readonly sizeBytes: number | null;
  readonly baselineBytes: number | null;
  readonly deltaBytes: number | null;
  readonly deltaPercent: number | null;
  readonly status: BundleSizeStatus;
  readonly recoveryCommand: string;
};

export type BundleSizeWarningReport = {
  readonly ciMode: "warning-only";
  readonly baselinePath: string;
  readonly reportPath: string;
  readonly localCommand: string;
  readonly measuredPackageCount: number;
  readonly artifactCount: number;
  readonly missingBaselineCount: number;
  readonly overBaselineCount: number;
  readonly unmatchedBaselineCount: number;
  readonly notBuiltPackageCount: number;
  readonly unmatchedBaselines: readonly string[];
  readonly artifacts: readonly BundleSizeArtifact[];
};

export type PackageQualityReport = {
  readonly generatedAt: string;
  readonly rootDir: string;
  readonly summaryDir: string;
  readonly rows: readonly PackageQualityRow[];
  readonly boundaries: readonly DependencyBoundaryResult[];
  readonly publicApi: PublicApiGuardResult;
  readonly bundleSize: BundleSizeWarningReport;
  readonly gateOutcomes: Readonly<Record<string, string>>;
};

type CheckOptions = {
  readonly rootDir: string;
  readonly outputDir: string;
  readonly summaryDir: string;
  readonly boundaryCheckOnly: boolean;
};

type TurboTaskSummary = {
  readonly taskId: string;
  readonly task: string;
  readonly package: string;
  readonly directory: string | null;
  readonly logFile: string | null;
  readonly cacheStatus: string | null;
  readonly exitCode: number | null;
};

type TurboRunSummary = {
  readonly filePath: string;
  readonly command: string;
  readonly endTime: number;
  readonly exitCode: number | null;
  readonly tasks: readonly TurboTaskSummary[];
};

type DependencyBoundaryRule = {
  readonly id: string;
  readonly packageName: string;
  readonly sourceDir: string;
  readonly forbiddenPattern: RegExp;
  readonly policy: string;
};

type BundleBaselineMatch = {
  readonly key: string;
  readonly bytes: number;
};

const QUALITY_TASKS: readonly QualityTask[] = ["build", "typecheck", "test"];
const reportDirectory = join("ci-reports", "package-quality");
const bundleSizeBaselinePath = join("ci-reports", "bundle-size", "baseline.json");
const bundleSizeReportPath = join(reportDirectory, "bundle-size.md");
const turboRunsDirectory = join(".turbo", "runs");
const workspaceFileName = "pnpm-workspace.yaml";
const publicApiSummaryPath = join(reportDirectory, "public-api-summary.json");
const bundleSizeRecoveryCommand = "pnpm build && pnpm package-quality:report";
const bundleSizeArtifactSuffixes = [
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".wasm",
  ".map",
  ".json",
  ".d.ts",
];

const DEPENDENCY_BOUNDARY_RULES: readonly DependencyBoundaryRule[] = [
  {
    id: "repository-core-drizzle-free",
    packageName: "@croco/repository-core",
    sourceDir: "packages/repository-core/src",
    forbiddenPattern: /drizzle/i,
    policy:
      "@croco/repository-core is an interface layer and must not mention Drizzle implementation details in src.",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8")) as unknown;
}

function normalizeScripts(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function isQualityTask(value: string): value is QualityTask {
  return value === "build" || value === "typecheck" || value === "test";
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

function stripInlineYamlComment(value: string): string {
  const commentIndex = value.indexOf(" #");
  return commentIndex === -1 ? value : value.slice(0, commentIndex);
}

function normalizeWorkspacePattern(value: string): string | null {
  const normalized = stripInlineYamlComment(value)
    .trim()
    .replace(/^['"]|['"]$/g, "");

  if (!normalized || normalized.startsWith("!")) {
    return null;
  }

  return toPosixPath(normalized).replace(/\/+$/, "");
}

export function parseWorkspacePackagePatterns(source: string): string[] {
  const patterns: string[] = [];
  let inPackagesSection = false;

  for (const line of source.split(/\r?\n/)) {
    if (/^packages:\s*$/.test(line)) {
      inPackagesSection = true;
      continue;
    }

    if (inPackagesSection && /^[^\s#][^:]*:/.test(line)) {
      break;
    }

    if (!inPackagesSection) {
      continue;
    }

    const match = line.match(/^\s*-\s+(.+?)\s*$/);
    const pattern = match ? normalizeWorkspacePattern(match[1]) : null;

    if (pattern) {
      patterns.push(pattern);
    }
  }

  return patterns;
}

function getDirectChildPackageJsonFiles(rootDir: string, relativeDir: string): string[] {
  const baseDir = join(rootDir, relativeDir);

  if (!existsSync(baseDir)) {
    return [];
  }

  return readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(baseDir, entry.name, "package.json"))
    .filter((packageJsonPath) => existsSync(packageJsonPath));
}

function getWorkspacePackageJsonFilesForPattern(rootDir: string, pattern: string): string[] {
  if (pattern.endsWith("/**/*")) {
    return findPackageJsonFiles(join(rootDir, pattern.slice(0, -5)));
  }

  if (pattern.endsWith("/*")) {
    return getDirectChildPackageJsonFiles(rootDir, pattern.slice(0, -2));
  }

  if (!pattern.includes("*")) {
    const packageJsonPath = join(rootDir, pattern, "package.json");
    return existsSync(packageJsonPath) ? [packageJsonPath] : [];
  }

  return [];
}

function readWorkspacePackageJsonFiles(rootDir: string): string[] {
  const workspacePath = join(rootDir, workspaceFileName);

  if (!existsSync(workspacePath)) {
    return findPackageJsonFiles(join(rootDir, "packages"));
  }

  const patterns = parseWorkspacePackagePatterns(readFileSync(workspacePath, "utf-8"));
  if (patterns.length === 0) {
    return findPackageJsonFiles(join(rootDir, "packages"));
  }

  return [
    ...new Set(
      patterns.flatMap((pattern) => getWorkspacePackageJsonFilesForPattern(rootDir, pattern)),
    ),
  ].sort();
}

export function readPackages(rootDir: string): PackageInfo[] {
  return readWorkspacePackageJsonFiles(rootDir)
    .map((packageJsonPath) => {
      const packageJson = readJsonFile(packageJsonPath);
      const relativeDir = toPosixPath(
        relative(rootDir, packageJsonPath).replace(/\/package\.json$/, ""),
      );

      if (!isRecord(packageJson) || typeof packageJson.name !== "string") {
        throw new Error(`${relativeDir}/package.json is missing a string name`);
      }

      return {
        name: packageJson.name,
        private: packageJson.private === true,
        relativeDir,
        scripts: normalizeScripts(packageJson.scripts),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function parseTurboTask(task: unknown): TurboTaskSummary | null {
  if (!isRecord(task) || typeof task.task !== "string" || typeof task.package !== "string") {
    return null;
  }

  const execution = isRecord(task.execution) ? task.execution : {};
  const cache = isRecord(task.cache) ? task.cache : {};
  const taskId = typeof task.taskId === "string" ? task.taskId : `${task.package}#${task.task}`;
  const directory = typeof task.directory === "string" ? toPosixPath(task.directory) : null;
  const logFile = typeof task.logFile === "string" ? task.logFile : null;
  const cacheStatus = typeof cache.status === "string" ? cache.status : null;
  const exitCode = typeof execution.exitCode === "number" ? execution.exitCode : null;

  return {
    taskId,
    task: task.task,
    package: task.package,
    directory,
    logFile,
    cacheStatus,
    exitCode,
  };
}

function parseTurboRunSummary(filePath: string): TurboRunSummary | null {
  const json = readJsonFile(filePath);

  if (!isRecord(json) || !isRecord(json.execution) || !Array.isArray(json.tasks)) {
    return null;
  }

  const command = typeof json.execution.command === "string" ? json.execution.command : "";
  const endTime = typeof json.execution.endTime === "number" ? json.execution.endTime : 0;
  const exitCode = typeof json.execution.exitCode === "number" ? json.execution.exitCode : null;
  const tasks = json.tasks.flatMap((task) => {
    const parsedTask = parseTurboTask(task);
    return parsedTask ? [parsedTask] : [];
  });

  return {
    filePath,
    command,
    endTime,
    exitCode,
    tasks,
  };
}

export function readTurboRunSummaries(summaryDir: string): TurboRunSummary[] {
  if (!existsSync(summaryDir)) {
    return [];
  }

  return readdirSync(summaryDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .flatMap((fileName) => {
      const filePath = join(summaryDir, fileName);
      const summary = parseTurboRunSummary(filePath);
      return summary ? [summary] : [];
    })
    .sort((left, right) => left.endTime - right.endTime);
}

function getCommandTask(command: string): QualityTask | null {
  const match = command.match(/(?:^|\s)turbo\s+(?:run\s+)?(build|typecheck|test)(?:\s|$)/);
  const task = match?.[1];

  return task === "build" || task === "typecheck" || task === "test" ? task : null;
}

function getLatestSummaryByTask(
  summaries: readonly TurboRunSummary[],
): Map<QualityTask, TurboRunSummary> {
  const byTask = new Map<QualityTask, TurboRunSummary>();

  for (const summary of summaries) {
    const task = getCommandTask(summary.command);

    if (!task) {
      continue;
    }

    const current = byTask.get(task);
    if (!current || summary.endTime >= current.endTime) {
      byTask.set(task, summary);
    }
  }

  return byTask;
}

function mergePackagesWithTurboTasks(
  packages: readonly PackageInfo[],
  summaries: readonly TurboRunSummary[],
): PackageInfo[] {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));

  for (const summary of summaries) {
    for (const task of summary.tasks) {
      if (!isQualityTask(task.task)) {
        continue;
      }

      const existing = byName.get(task.package);
      if (existing) {
        if (!existing.scripts[task.task]) {
          byName.set(task.package, {
            ...existing,
            scripts: {
              ...existing.scripts,
              [task.task]: "observed by Turbo summary",
            },
          });
        }
        continue;
      }

      byName.set(task.package, {
        name: task.package,
        private: false,
        relativeDir: task.directory ?? "",
        scripts: {
          [task.task]: "observed by Turbo summary",
        },
      });
    }
  }

  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function getTaskResult(
  pkg: PackageInfo,
  task: QualityTask,
  summaryByTask: ReadonlyMap<QualityTask, TurboRunSummary>,
): PackageTaskResult {
  if (!pkg.scripts[task]) {
    return {
      task,
      status: "not-configured",
      taskId: null,
      logFile: null,
      cacheStatus: null,
    };
  }

  const summary = summaryByTask.get(task);
  if (!summary) {
    return {
      task,
      status: "not-collected",
      taskId: null,
      logFile: null,
      cacheStatus: null,
    };
  }

  const turboTask = summary.tasks.find(
    (candidate) => candidate.task === task && candidate.package === pkg.name,
  );
  if (!turboTask) {
    return {
      task,
      status: "not-run",
      taskId: null,
      logFile: null,
      cacheStatus: null,
    };
  }

  return {
    task,
    status: turboTask.exitCode === 0 ? "pass" : "fail",
    taskId: turboTask.taskId,
    logFile: turboTask.logFile,
    cacheStatus: turboTask.cacheStatus,
  };
}

function createPackageRow(
  pkg: PackageInfo,
  summaryByTask: ReadonlyMap<QualityTask, TurboRunSummary>,
): PackageQualityRow {
  return {
    packageName: pkg.name,
    relativeDir: pkg.relativeDir,
    private: pkg.private,
    tasks: {
      build: getTaskResult(pkg, "build", summaryByTask),
      typecheck: getTaskResult(pkg, "typecheck", summaryByTask),
      test: getTaskResult(pkg, "test", summaryByTask),
    },
  };
}

function walkFiles(dir: string, results: string[] = []): string[] {
  if (!existsSync(dir)) {
    return results;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") {
        continue;
      }
      walkFiles(fullPath, results);
      continue;
    }

    if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

function getBoundaryViolations(
  rootDir: string,
  rule: DependencyBoundaryRule,
): DependencyBoundaryViolation[] {
  const sourceDir = join(rootDir, rule.sourceDir);

  return walkFiles(sourceDir).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf-8");
    const relativeFile = toPosixPath(relative(rootDir, filePath));

    return source.split(/\r?\n/).flatMap((line, index) => {
      if (!rule.forbiddenPattern.test(line)) {
        return [];
      }

      return [
        {
          file: relativeFile,
          line: index + 1,
          excerpt: line.trim(),
        },
      ];
    });
  });
}

export function scanDependencyBoundaries(
  rootDir: string,
  rules: readonly DependencyBoundaryRule[] = DEPENDENCY_BOUNDARY_RULES,
): DependencyBoundaryResult[] {
  return rules.map((rule) => {
    const absoluteSourceDir = join(rootDir, rule.sourceDir);

    if (!existsSync(absoluteSourceDir) || !statSync(absoluteSourceDir).isDirectory()) {
      return {
        id: rule.id,
        packageName: rule.packageName,
        sourceDir: rule.sourceDir,
        policy: rule.policy,
        status: "missing-source",
        violations: [],
      };
    }

    const violations = getBoundaryViolations(rootDir, rule);

    return {
      id: rule.id,
      packageName: rule.packageName,
      sourceDir: rule.sourceDir,
      policy: rule.policy,
      status: violations.length > 0 ? "fail" : "pass",
      violations,
    };
  });
}

function readGateOutcomes(): Record<string, string> {
  return {
    "changeset-required:check": process.env.PACKAGE_QUALITY_CHANGESET_STATUS ?? "not provided",
    "pnpm check": process.env.PACKAGE_QUALITY_CHECK_STATUS ?? "not provided",
    build: process.env.PACKAGE_QUALITY_BUILD_STATUS ?? "not provided",
    typecheck: process.env.PACKAGE_QUALITY_TYPECHECK_STATUS ?? "not provided",
    test: process.env.PACKAGE_QUALITY_TEST_STATUS ?? "not provided",
    "provider-certification:check":
      process.env.PACKAGE_QUALITY_PROVIDER_CERTIFICATION_STATUS ?? "not provided",
  };
}

function readNumberField(value: Record<string, unknown>, fieldName: string): number | null {
  return typeof value[fieldName] === "number" ? value[fieldName] : null;
}

function readStringField(
  value: Record<string, unknown>,
  fieldName: string,
  fallback: string,
): string {
  return typeof value[fieldName] === "string" ? value[fieldName] : fallback;
}

function readPublicApiGuardResult(rootDir: string): PublicApiGuardResult {
  const summaryPath = join(rootDir, publicApiSummaryPath);

  if (!existsSync(summaryPath)) {
    return {
      status: "not-collected",
      packageCount: null,
      changedPackages: null,
      runtimeAdded: null,
      runtimeRemoved: null,
      typeAdded: null,
      typeRemoved: null,
      snapshotPath: "public-api-surface.snapshot.json",
      reportPath: toPosixPath(publicApiSummaryPath.replace(/summary\.json$/, "diff.md")),
      updateCommand: "pnpm public-api:write",
    };
  }

  const summary = readJsonFile(summaryPath);
  if (!isRecord(summary)) {
    throw new Error(`${publicApiSummaryPath} must contain an object`);
  }

  const status = summary.status === "pass" || summary.status === "fail" ? summary.status : "fail";

  return {
    status,
    packageCount: readNumberField(summary, "packageCount"),
    changedPackages: readNumberField(summary, "changedPackages"),
    runtimeAdded: readNumberField(summary, "runtimeAdded"),
    runtimeRemoved: readNumberField(summary, "runtimeRemoved"),
    typeAdded: readNumberField(summary, "typeAdded"),
    typeRemoved: readNumberField(summary, "typeRemoved"),
    snapshotPath: readStringField(summary, "snapshotPath", "public-api-surface.snapshot.json"),
    reportPath: readStringField(
      summary,
      "reportPath",
      toPosixPath(publicApiSummaryPath.replace(/summary\.json$/, "diff.md")),
    ),
    updateCommand: readStringField(summary, "updateCommand", "pnpm public-api:write"),
  };
}

function readBundleSizeBaselines(rootDir: string): ReadonlyMap<string, number> {
  const baselinePath = join(rootDir, bundleSizeBaselinePath);

  if (!existsSync(baselinePath)) {
    return new Map();
  }

  const baseline = readJsonFile(baselinePath);
  if (!isRecord(baseline)) {
    throw new Error(`${bundleSizeBaselinePath} must contain an object`);
  }

  const artifactEntries = isRecord(baseline.artifacts) ? baseline.artifacts : baseline;
  const baselines = new Map<string, number>();

  for (const [key, value] of Object.entries(artifactEntries)) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      baselines.set(key, value);
      continue;
    }

    if (
      isRecord(value) &&
      typeof value.bytes === "number" &&
      Number.isFinite(value.bytes) &&
      value.bytes >= 0
    ) {
      baselines.set(key, value.bytes);
      continue;
    }

    throw new Error(
      `${bundleSizeBaselinePath} entry ${key} must be a non-negative byte number or an object with a non-negative bytes number`,
    );
  }

  return baselines;
}

function isMeasuredBundleArtifact(path: string): boolean {
  return bundleSizeArtifactSuffixes.some((suffix) => path.endsWith(suffix));
}

function getBundleBaselineMatch(
  baselines: ReadonlyMap<string, number>,
  packageName: string,
  artifactPath: string,
): BundleBaselineMatch | null {
  const packageArtifactKey = `${packageName}:${artifactPath}`;
  const packageArtifactBytes = baselines.get(packageArtifactKey);
  if (packageArtifactBytes !== undefined) {
    return {
      key: packageArtifactKey,
      bytes: packageArtifactBytes,
    };
  }

  const artifactBytes = baselines.get(artifactPath);
  return artifactBytes === undefined
    ? null
    : {
        key: artifactPath,
        bytes: artifactBytes,
      };
}

function getBundleSizeRecoveryCommand(packageName: string): string {
  return `pnpm --filter ${packageName} build && pnpm package-quality:report`;
}

function createBundleSizeArtifact(
  pkg: PackageInfo,
  artifactPath: string,
  sizeBytes: number,
  baselineMatch: BundleBaselineMatch | null,
): BundleSizeArtifact {
  const baselineBytes = baselineMatch?.bytes ?? null;
  const deltaBytes = baselineBytes === null ? null : sizeBytes - baselineBytes;
  const deltaPercent =
    baselineBytes === null || baselineBytes === 0 ? null : (deltaBytes / baselineBytes) * 100;

  return {
    packageName: pkg.name,
    relativeDir: pkg.relativeDir,
    artifactPath,
    baselineKey: baselineMatch?.key ?? null,
    sizeBytes,
    baselineBytes,
    deltaBytes,
    deltaPercent,
    status:
      baselineBytes === null
        ? "missing-baseline"
        : sizeBytes > baselineBytes
          ? "over-baseline"
          : "within-baseline",
    recoveryCommand: getBundleSizeRecoveryCommand(pkg.name),
  };
}

function createNotBuiltBundleSizeArtifact(pkg: PackageInfo): BundleSizeArtifact {
  return {
    packageName: pkg.name,
    relativeDir: pkg.relativeDir,
    artifactPath: null,
    baselineKey: null,
    sizeBytes: null,
    baselineBytes: null,
    deltaBytes: null,
    deltaPercent: null,
    status: "not-built",
    recoveryCommand: getBundleSizeRecoveryCommand(pkg.name),
  };
}

function collectPackageBundleSizeArtifacts(
  rootDir: string,
  pkg: PackageInfo,
  baselines: ReadonlyMap<string, number>,
): BundleSizeArtifact[] {
  const distDir = join(rootDir, pkg.relativeDir, "dist");

  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    return [createNotBuiltBundleSizeArtifact(pkg)];
  }

  const artifacts = walkFiles(distDir)
    .map((filePath) => toPosixPath(relative(rootDir, filePath)))
    .filter(isMeasuredBundleArtifact)
    .map((artifactPath) =>
      createBundleSizeArtifact(
        pkg,
        artifactPath,
        statSync(join(rootDir, artifactPath)).size,
        getBundleBaselineMatch(baselines, pkg.name, artifactPath),
      ),
    );

  return artifacts.length > 0 ? artifacts : [createNotBuiltBundleSizeArtifact(pkg)];
}

export function createBundleSizeWarningReport(
  rootDir: string,
  packages: readonly PackageInfo[],
): BundleSizeWarningReport {
  const baselines = readBundleSizeBaselines(rootDir);
  const measuredPackages = packages.filter((pkg) => !pkg.private && Boolean(pkg.scripts.build));
  const artifacts = measuredPackages.flatMap((pkg) =>
    collectPackageBundleSizeArtifacts(rootDir, pkg, baselines),
  );
  const matchedBaselineKeys = new Set(
    artifacts
      .map((artifact) => artifact.baselineKey)
      .filter((baselineKey): baselineKey is string => baselineKey !== null),
  );
  const unmatchedBaselines = [...baselines.keys()]
    .filter((baselineKey) => !matchedBaselineKeys.has(baselineKey))
    .sort();

  return {
    ciMode: "warning-only",
    baselinePath: bundleSizeBaselinePath,
    reportPath: bundleSizeReportPath,
    localCommand: bundleSizeRecoveryCommand,
    measuredPackageCount: measuredPackages.length,
    artifactCount: artifacts.filter((artifact) => artifact.artifactPath !== null).length,
    missingBaselineCount: artifacts.filter((artifact) => artifact.status === "missing-baseline")
      .length,
    overBaselineCount: artifacts.filter((artifact) => artifact.status === "over-baseline").length,
    unmatchedBaselineCount: unmatchedBaselines.length,
    notBuiltPackageCount: artifacts.filter((artifact) => artifact.status === "not-built").length,
    unmatchedBaselines,
    artifacts,
  };
}

export function createPackageQualityReport(
  options: Pick<CheckOptions, "rootDir" | "summaryDir">,
): PackageQualityReport {
  const summaries = readTurboRunSummaries(options.summaryDir);
  const summaryByTask = getLatestSummaryByTask(summaries);
  const packages = mergePackagesWithTurboTasks(readPackages(options.rootDir), summaries);
  const rows = packages.map((pkg) => createPackageRow(pkg, summaryByTask));

  return {
    generatedAt: new Date().toISOString(),
    rootDir: options.rootDir,
    summaryDir: options.summaryDir,
    rows,
    boundaries: scanDependencyBoundaries(options.rootDir),
    publicApi: readPublicApiGuardResult(options.rootDir),
    bundleSize: createBundleSizeWarningReport(options.rootDir, packages),
    gateOutcomes: readGateOutcomes(),
  };
}

function summarizeStatus(
  rows: readonly PackageQualityRow[],
  task: QualityTask,
  status: QualityStatus,
): number {
  return rows.filter((row) => row.tasks[task].status === status).length;
}

function formatTaskCell(result: PackageTaskResult): string {
  if (result.status === "pass") {
    return result.cacheStatus === "HIT" ? "pass (cached)" : "pass";
  }

  if (result.status === "fail") {
    return result.logFile ? `fail; log: \`${result.logFile}\`` : "fail";
  }

  return result.status;
}

function formatPackageNotes(row: PackageQualityRow): string {
  const failures = QUALITY_TASKS.flatMap((task) => {
    const result = row.tasks[task];
    return result.status === "fail" ? [`${task} failed`] : [];
  });

  if (failures.length > 0) {
    return failures.join("; ");
  }

  if (row.private) {
    return "private package";
  }

  return "";
}

function formatFailureSummary(rows: readonly PackageQualityRow[]): string[] {
  const failures = rows.flatMap((row) =>
    QUALITY_TASKS.flatMap((task) => {
      const result = row.tasks[task];
      if (result.status !== "fail") {
        return [];
      }

      const evidence = result.logFile ? `; log: \`${result.logFile}\`` : "";
      return `- \`${row.packageName}\` ${task} failed${evidence}`;
    }),
  );

  return failures.length > 0 ? failures : ["- none"];
}

function formatBoundaryStatus(result: DependencyBoundaryResult): string {
  if (result.status === "pass") {
    return "pass";
  }

  if (result.status === "missing-source") {
    return "fail; source directory missing";
  }

  return `fail; ${result.violations.length} violation(s)`;
}

function formatBoundaryEvidence(result: DependencyBoundaryResult): string {
  if (result.violations.length === 0) {
    return `Scanned \`${result.sourceDir}\``;
  }

  return result.violations
    .slice(0, 5)
    .map((violation) => `\`${violation.file}:${violation.line}\` ${violation.excerpt}`)
    .join("<br>");
}

function formatNullableCount(value: number | null): string {
  return value === null ? "not-collected" : String(value);
}

function formatPublicApiStatus(result: PublicApiGuardResult): string {
  if (result.status === "not-collected") {
    return "not-collected";
  }

  if (result.status === "pass") {
    return "pass";
  }

  return `fail; ${formatNullableCount(result.changedPackages)} package(s) changed`;
}

function formatPublicApiEvidence(result: PublicApiGuardResult): string {
  if (result.status === "not-collected") {
    return "run `pnpm public-api:check` to collect snapshot drift";
  }

  return `snapshot \`${result.snapshotPath}\`; report \`${result.reportPath}\``;
}

function formatPublicApiSection(result: PublicApiGuardResult): string[] {
  return [
    "## Public API surface guard",
    `- Status: ${formatPublicApiStatus(result)}`,
    `- Packages scanned: ${formatNullableCount(result.packageCount)}`,
    `- Packages with API drift: ${formatNullableCount(result.changedPackages)}`,
    `- Runtime exports added/removed: ${formatNullableCount(result.runtimeAdded)} / ${formatNullableCount(result.runtimeRemoved)}`,
    `- Type exports added/removed: ${formatNullableCount(result.typeAdded)} / ${formatNullableCount(result.typeRemoved)}`,
    `- Snapshot: \`${result.snapshotPath}\``,
    `- Diff report: \`${result.reportPath}\``,
    `- Intentional update procedure: run \`${result.updateCommand}\`, review the runtime/type diff, and include a changeset when a publishable package's import surface, types, or behavior changes.`,
  ];
}

function formatBytes(value: number | null): string {
  if (value === null) {
    return "-";
  }

  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absoluteValue < 1024) {
    return `${sign}${absoluteValue} B`;
  }

  if (absoluteValue < 1024 * 1024) {
    return `${sign}${(absoluteValue / 1024).toFixed(1)} KiB`;
  }

  return `${sign}${(absoluteValue / 1024 / 1024).toFixed(2)} MiB`;
}

function formatBundleDelta(artifact: BundleSizeArtifact): string {
  if (artifact.deltaBytes === null) {
    return "-";
  }

  const sign = artifact.deltaBytes >= 0 ? "+" : "";
  const percent =
    artifact.deltaPercent === null ? "" : ` (${sign}${artifact.deltaPercent.toFixed(1)}%)`;

  return `${sign}${formatBytes(artifact.deltaBytes)}${percent}`;
}

function formatBundleArtifactPath(artifact: BundleSizeArtifact): string {
  return artifact.artifactPath === null
    ? "_dist artifact not found_"
    : `\`${artifact.artifactPath}\``;
}

function formatBundleBaseline(artifact: BundleSizeArtifact): string {
  return artifact.baselineBytes === null ? "missing" : formatBytes(artifact.baselineBytes);
}

function formatBundleSizeStatus(report: BundleSizeWarningReport): string {
  if (report.measuredPackageCount === 0) {
    return "warning-only; no publishable build packages in scope";
  }

  const warnings = [
    report.overBaselineCount > 0 ? `${report.overBaselineCount} artifact(s) over baseline` : null,
    report.missingBaselineCount > 0
      ? `${report.missingBaselineCount} missing bundle-size baseline(s)`
      : null,
    report.unmatchedBaselineCount > 0
      ? `${report.unmatchedBaselineCount} unmatched bundle-size baseline(s)`
      : null,
    report.notBuiltPackageCount > 0
      ? `${report.notBuiltPackageCount} package(s) without measured dist artifacts`
      : null,
  ].filter((warning): warning is string => warning !== null);

  if (warnings.length > 0) {
    return `warning-only; ${warnings.join(", ")}`;
  }

  return "warning-only; measured artifacts within baseline";
}

function formatBundleBaselineKey(artifact: BundleSizeArtifact): string {
  return artifact.baselineKey === null ? "-" : `\`${artifact.baselineKey}\``;
}

function formatUnmatchedBaselineRows(report: BundleSizeWarningReport): string[] {
  if (report.unmatchedBaselines.length === 0) {
    return ["| _none_ |"];
  }

  return report.unmatchedBaselines.map((baselineKey) => `| \`${baselineKey}\` |`);
}

function formatBundleSizeEvidence(report: BundleSizeWarningReport): string {
  return `report \`${report.reportPath}\`; baseline \`${report.baselinePath}\`; run \`${report.localCommand}\``;
}

export function buildBundleSizeMarkdown(report: BundleSizeWarningReport): string {
  const artifactRows =
    report.artifacts.length === 0
      ? ["| _none_ | _none_ | - | - | - | - | warning-only | - |"]
      : report.artifacts.map(
          (artifact) =>
            `| \`${artifact.packageName}\` | ${formatBundleArtifactPath(artifact)} | ${formatBytes(artifact.sizeBytes)} | ${formatBundleBaseline(artifact)} | ${formatBundleBaselineKey(artifact)} | ${formatBundleDelta(artifact)} | ${artifact.status} | \`${artifact.recoveryCommand}\` |`,
        );

  const lines = [
    "# Bundle Size Warning Report",
    "",
    `- CI mode: ${report.ciMode}`,
    "- Scope: publishable workspace packages with a `build` script and generated `dist` artifacts (`.js`, `.mjs`, `.cjs`, `.css`, `.wasm`, `.map`, `.json`, `.d.ts`).",
    `- Baseline input: \`${report.baselinePath}\``,
    `- Local recovery command: \`${report.localCommand}\``,
    "",
    "## Warning summary",
    `- Measured packages: ${report.measuredPackageCount}`,
    `- Measured artifacts: ${report.artifactCount}`,
    `- Missing baselines: ${report.missingBaselineCount}`,
    `- Over-baseline artifacts: ${report.overBaselineCount}`,
    `- Unmatched baselines: ${report.unmatchedBaselineCount}`,
    `- Packages without measured dist artifacts: ${report.notBuiltPackageCount}`,
    "",
    "## Artifact responsibility",
    "| Package | Artifact | Size | Baseline | Baseline key | Delta | Status | Recovery |",
    "| --- | --- | ---: | ---: | --- | ---: | --- | --- |",
    ...artifactRows,
    "",
    "## Unmatched baselines",
    "Baseline keys listed here did not match any measured artifact and may be stale or duplicated.",
    "",
    "| Baseline key |",
    "| --- |",
    ...formatUnmatchedBaselineRows(report),
    "",
    "## Promotion criteria",
    "1. Commit `ci-reports/bundle-size/baseline.json` from a green protected-branch build or another reproducible protected-branch source.",
    "2. Every measured artifact must resolve to exactly one package and artifact row with a local recovery command.",
    "3. New publishable build packages must either produce measured `dist` artifacts or carry an explicit exemption before enforcement.",
    "4. Keep this report warning-only until multiple PRs show stable package ownership, no missing baselines, and no unmatched baselines.",
  ];

  return `${lines.join("\n")}\n`;
}

export function buildReportMarkdown(report: PackageQualityReport): string {
  const lines = [
    "# Package Quality Dashboard",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Turbo summary directory: \`${toPosixPath(relative(report.rootDir, report.summaryDir))}\``,
    "- Source: Turbo run summaries plus repository dependency boundary and public API surface scans.",
    "",
    "## Gate summary",
    "| Gate | Scope | CI mode | Current outcome | Evidence |",
    "| --- | --- | --- | --- | --- |",
    `| \`changeset-required:check\` | publishable package behavior changes | blocking on PR | ${report.gateOutcomes["changeset-required:check"]} | links public package changes to a required non-README changeset |`,
    `| \`pnpm check\` | repository policy, lint, format, architecture policy, dependency boundaries, strict contract checks, static misuse checks, public API drift | blocking on PR/trunk | ${report.gateOutcomes["pnpm check"]} | includes \`architecture-policy:check\`, \`dependency-boundaries:check\`, \`strict-contract-typecheck\`, \`static-misuse:check\`, and \`public-api:check\` |`,
    `| \`public-api:check\` | package public export surface drift | blocking through \`pnpm check\` | ${formatPublicApiStatus(report.publicApi)} | ${formatPublicApiEvidence(report.publicApi)} |`,
    `| \`build\` | package build tasks | blocking on PR/trunk | ${report.gateOutcomes.build} | Turbo \`build\` summary below |`,
    `| \`typecheck\` | package TypeScript tasks | blocking on PR/trunk | ${report.gateOutcomes.typecheck} | Turbo \`typecheck\` summary below |`,
    `| \`test\` | package test tasks | blocking on PR/trunk | ${report.gateOutcomes.test} | Turbo \`test\` summary below |`,
    `| \`provider-certification:check\` | provider, integration, transport, and presentation certification evidence | blocking on PR/trunk | ${report.gateOutcomes["provider-certification:check"]} | validates catalog certification records and writes \`ci-reports/package-quality/provider-certification.md\` plus JSON |`,
    `| \`bundle-size:warning\` | publishable package generated artifact growth | warning-only until baselines stabilize | ${formatBundleSizeStatus(report.bundleSize)} | ${formatBundleSizeEvidence(report.bundleSize)} |`,
    "| benchmark | performance drift | blocking in dedicated benchmark workflow | enforce | latest-five-green evidence and benchmark baselines are committed |",
    "",
    "## Package task totals",
    "| Task | Pass | Fail | Not collected | Not configured | Not run |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...QUALITY_TASKS.map(
      (task) =>
        `| ${task} | ${summarizeStatus(report.rows, task, "pass")} | ${summarizeStatus(report.rows, task, "fail")} | ${summarizeStatus(report.rows, task, "not-collected")} | ${summarizeStatus(report.rows, task, "not-configured")} | ${summarizeStatus(report.rows, task, "not-run")} |`,
    ),
    "",
    "## Failure summary",
    ...formatFailureSummary(report.rows),
    "",
    "## Dependency boundary results",
    "| Rule | Package | Status | Evidence |",
    "| --- | --- | --- | --- |",
    ...report.boundaries.map(
      (result) =>
        `| \`${result.id}\` | \`${result.packageName}\` | ${formatBoundaryStatus(result)} | ${formatBoundaryEvidence(result)} |`,
    ),
    "",
    ...formatPublicApiSection(report.publicApi),
    "",
    "## Bundle size warning",
    `- Status: ${formatBundleSizeStatus(report.bundleSize)}`,
    `- Report: \`${report.bundleSize.reportPath}\``,
    `- Baseline input: \`${report.bundleSize.baselinePath}\``,
    `- Local recovery command: \`${report.bundleSize.localCommand}\``,
    "",
    "## Package matrix",
    "| Package | Build | Typecheck | Test | Notes |",
    "| --- | --- | --- | --- | --- |",
    ...report.rows.map(
      (row) =>
        `| \`${row.packageName}\` | ${formatTaskCell(row.tasks.build)} | ${formatTaskCell(row.tasks.typecheck)} | ${formatTaskCell(row.tasks.test)} | ${formatPackageNotes(row)} |`,
    ),
    "",
    "## Trunk gate rollout",
    "- Current blocking gates: changeset-required, architecture-policy, dependency-boundaries, static-misuse, lint/format/policy checks, build, typecheck, test, and the dedicated benchmark workflow.",
    "- Current advisory gates: production audit on PRs, core coverage baseline warnings, and bundle-size warnings.",
    "- Promote warning-only gates only after the dashboard shows stable package-level ownership, no unknown package rows, and documented baselines.",
    "- New packages should appear in this dashboard with explicit build/typecheck/test support or an intentional not-configured state.",
  ];

  return `${lines.join("\n")}\n`;
}

export function writePackageQualityReport(report: PackageQualityReport, outputDir: string): string {
  mkdirSync(outputDir, { recursive: true });

  const markdownPath = join(outputDir, "report.md");
  const jsonPath = join(outputDir, "summary.json");
  const bundleSizePath = join(outputDir, "bundle-size.md");

  writeFileSync(markdownPath, buildReportMarkdown(report));
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(bundleSizePath, buildBundleSizeMarkdown(report.bundleSize));

  return markdownPath;
}

function parseArgs(args: readonly string[]): CheckOptions {
  let rootDir = process.cwd();
  let outputDir = join(rootDir, reportDirectory);
  let summaryDir = join(rootDir, turboRunsDirectory);
  let boundaryCheckOnly = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      outputDir = join(rootDir, reportDirectory);
      summaryDir = join(rootDir, turboRunsDirectory);
      index++;
      continue;
    }

    if (arg === "--output-dir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--output-dir requires a path");
      }
      outputDir = resolve(value);
      index++;
      continue;
    }

    if (arg === "--summary-dir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--summary-dir requires a path");
      }
      summaryDir = resolve(value);
      index++;
      continue;
    }

    if (arg === "--boundary-check-only") {
      boundaryCheckOnly = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    rootDir,
    outputDir,
    summaryDir,
    boundaryCheckOnly,
  };
}

function runBoundaryCheck(rootDir: string): number {
  const results = scanDependencyBoundaries(rootDir);
  const failures = results.filter((result) => result.status !== "pass");

  for (const result of results) {
    console.log(`dependency-boundaries: ${result.id} ${result.status}`);
    for (const violation of result.violations) {
      console.error(`- ${violation.file}:${violation.line}: ${violation.excerpt}`);
    }
  }

  if (failures.length > 0) {
    console.error(`dependency-boundaries: ${failures.length} rule(s) failed`);
    return 1;
  }

  console.log("dependency-boundaries: all rules passed");
  return 0;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.boundaryCheckOnly) {
    process.exit(runBoundaryCheck(options.rootDir));
  }

  const report = createPackageQualityReport({
    rootDir: options.rootDir,
    summaryDir: options.summaryDir,
  });
  const markdownPath = writePackageQualityReport(report, options.outputDir);
  const failureCount = report.rows.reduce(
    (count, row) =>
      count + QUALITY_TASKS.filter((task) => row.tasks[task].status === "fail").length,
    0,
  );
  const boundaryFailureCount = report.boundaries.filter(
    (result) => result.status !== "pass",
  ).length;

  console.log(`package-quality-report: wrote ${markdownPath}`);
  console.log(`package-quality-report: package task failures=${failureCount}`);
  console.log(`package-quality-report: dependency boundary failures=${boundaryFailureCount}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`package-quality-report: failed: ${message}`);
    process.exit(1);
  });
}
