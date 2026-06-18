import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { defineCommand } from "citty";
import { WORKSPACE_MAX_DEPTH } from "../libs/constants.js";
import { GLOBAL_OPTIONS } from "./options.js";

export type DoctorSeverity = "error" | "warning";
export type DoctorSummary = "healthy" | "issues_detected";
export type DoctorCheckStatus = "pass" | "fail" | "skipped";

export type DoctorLocation = {
  readonly file?: string;
  readonly line?: number;
  readonly packageName?: string;
};

export type DoctorDiagnostic = {
  readonly code: string;
  readonly severity: DoctorSeverity;
  readonly checkId: string;
  readonly cause: string;
  readonly location: DoctorLocation | null;
  readonly action: string;
};

export type DoctorCheckResult = {
  readonly id: string;
  readonly title: string;
  readonly status: DoctorCheckStatus;
  readonly diagnostics: readonly DoctorDiagnostic[];
  readonly note?: string;
};

export type DoctorPackage = {
  readonly name: string;
  readonly relativeDir: string;
  readonly absoluteDir: string;
};

export type DoctorReport = {
  readonly version: "croco.doctor.v1";
  readonly rootDir: string | null;
  readonly packageCount: number;
  readonly summary: DoctorSummary;
  readonly checks: readonly DoctorCheckResult[];
  readonly diagnostics: readonly DoctorDiagnostic[];
};

export type RunDoctorOptions = {
  readonly cwd?: string;
};

type WorkspacePattern = {
  readonly pattern: string;
  readonly excluded: boolean;
};

type WorkspacePackageReadResult =
  | { readonly kind: "valid"; readonly package: DoctorPackage }
  | { readonly kind: "invalid"; readonly diagnostic: DoctorDiagnostic };

type WorkspaceDiscoveryResult = {
  readonly packages: readonly DoctorPackage[];
  readonly patterns: readonly WorkspacePattern[];
  readonly diagnostics: readonly DoctorDiagnostic[];
};

const sourceFileExtensions = [".ts", ".tsx", ".mts", ".cts", ".ts.hbs", ".tsx.hbs"];
const ignoredDirectories = new Set([
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "tests",
  "__tests__",
]);

export function runDoctor(options: RunDoctorOptions = {}): DoctorReport {
  const startDir = resolve(options.cwd ?? process.cwd());
  const rootDir = findWorkspaceRoot(startDir);

  if (!rootDir) {
    const diagnostic: DoctorDiagnostic = {
      code: "doctor/workspace-not-found",
      severity: "error",
      checkId: "workspace-discovery",
      cause:
        "croco doctor could not find pnpm-workspace.yaml by walking up from the execution directory.",
      location: { file: startDir },
      action:
        "Run croco doctor from inside a Croco monorepo, or pass --cwd to a directory under the workspace root.",
    };

    return {
      version: "croco.doctor.v1",
      rootDir: null,
      packageCount: 0,
      summary: "issues_detected",
      checks: [
        {
          id: "workspace-discovery",
          title: "Workspace discovery",
          status: "fail",
          diagnostics: [diagnostic],
        },
      ],
      diagnostics: [diagnostic],
    };
  }

  const workspace = readWorkspacePackages(rootDir);
  const checks = [
    workspaceDiscoveryCheck(rootDir, workspace),
    repositoryCoreBoundaryCheck(rootDir),
    lambdaTelemetryFlushCheck(rootDir, workspace.packages),
  ];
  const diagnostics = checks.flatMap((check) => check.diagnostics);

  return {
    version: "croco.doctor.v1",
    rootDir,
    packageCount: workspace.packages.length,
    summary: diagnostics.some((diagnostic) => diagnostic.severity === "error")
      ? "issues_detected"
      : "healthy",
    checks,
    diagnostics,
  };
}

export function getDoctorExitCode(report: DoctorReport): number {
  return report.summary === "healthy" ? 0 : 1;
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [`Croco doctor: ${report.summary}`];

  if (report.rootDir) {
    lines.push(`Workspace: ${report.rootDir}`);
    lines.push(`Packages: ${report.packageCount}`);
  }

  lines.push("Checks:");
  for (const check of report.checks) {
    const suffix = check.note ? ` - ${check.note}` : "";
    lines.push(`- ${check.id}: ${check.status}${suffix}`);
  }

  if (report.diagnostics.length === 0) {
    lines.push("Diagnostics: none");
    return lines.join("\n");
  }

  lines.push("Diagnostics:");
  for (const diagnostic of report.diagnostics) {
    lines.push(`${diagnostic.severity.toUpperCase()} ${diagnostic.code}`);
    lines.push(`  Cause: ${diagnostic.cause}`);
    lines.push(`  Location: ${formatLocation(diagnostic.location)}`);
    lines.push(`  Action: ${diagnostic.action}`);
  }

  return lines.join("\n");
}

function workspaceDiscoveryCheck(
  rootDir: string,
  workspace: WorkspaceDiscoveryResult,
): DoctorCheckResult {
  const includeCount = workspace.patterns.filter((pattern) => !pattern.excluded).length;
  const diagnostics = [...workspace.diagnostics];

  if (includeCount > 0 && workspace.packages.length === 0 && workspace.diagnostics.length === 0) {
    diagnostics.push({
      code: "doctor/workspace-packages-empty",
      severity: "error",
      checkId: "workspace-discovery",
      cause:
        "pnpm-workspace.yaml defines package globs, but croco doctor did not discover any package.json files.",
      location: { file: toPosixPath(relative(rootDir, join(rootDir, "pnpm-workspace.yaml"))) },
      action:
        "Check the packages entries in pnpm-workspace.yaml or run croco doctor from the repository root so configured package globs resolve to workspace packages.",
    });
  }

  return {
    id: "workspace-discovery",
    title: "Workspace discovery",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note: `${workspace.packages.length} package(s) discovered from ${relative(rootDir, join(rootDir, "pnpm-workspace.yaml"))}`,
  };
}

function repositoryCoreBoundaryCheck(rootDir: string): DoctorCheckResult {
  const checkId = "repository-core-boundary";
  const sourceDir = join(rootDir, "packages", "repository-core", "src");

  if (!existsSync(sourceDir)) {
    return {
      id: checkId,
      title: "repository-core dependency boundary",
      status: "skipped",
      diagnostics: [],
      note: "packages/repository-core/src was not found.",
    };
  }

  const diagnostics = listSourceFiles(sourceDir).flatMap((file) =>
    findForbiddenLines(file, /drizzle/i).map((line) => ({
      code: "doctor/repository-core-drizzle-boundary",
      severity: "error" as const,
      checkId,
      cause:
        "@croco/repository-core is an interface layer but references Drizzle implementation details.",
      location: {
        file: toPosixPath(relative(rootDir, file)),
        line: line.line,
        packageName: "@croco/repository-core",
      },
      action:
        "Move Drizzle-specific types and implementation code to @croco/tx-drizzle or another Drizzle adapter package.",
    })),
  );

  return {
    id: checkId,
    title: "repository-core dependency boundary",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note:
      diagnostics.length > 0
        ? `${diagnostics.length} boundary violation(s) found.`
        : "No Drizzle references found in packages/repository-core/src.",
  };
}

function lambdaTelemetryFlushCheck(
  rootDir: string,
  packages: readonly DoctorPackage[],
): DoctorCheckResult {
  const checkId = "lambda-telemetry-flush";
  const diagnostics = packages.flatMap((workspacePackage) =>
    listSourceFiles(workspacePackage.absoluteDir).flatMap((file) => {
      const source = readFileSync(file, "utf-8");
      const sourceWithoutComments = stripTypeScriptComments(source);

      if (
        !isLambdaTelemetryEntrypoint(file, sourceWithoutComments) ||
        hasHandlerForceFlush(sourceWithoutComments)
      ) {
        return [];
      }

      const line = findFirstMatchingLine(sourceWithoutComments, /TelemetryRuntime|lambdaPreset/);

      return [
        {
          code: "doctor/lambda-telemetry-flush-missing",
          severity: "error" as const,
          checkId,
          cause:
            "A Lambda entrypoint initializes @croco/telemetry-sdk-node but does not flush telemetry before the invocation returns.",
          location: {
            file: toPosixPath(relative(rootDir, file)),
            line,
            packageName: workspacePackage.name,
          },
          action:
            "Await telemetry readiness before handler work and call telemetry.forceFlush() in a finally block before returning.",
        },
      ];
    }),
  );

  return {
    id: checkId,
    title: "Lambda telemetry flush boundary",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note:
      diagnostics.length > 0
        ? `${diagnostics.length} Lambda telemetry entrypoint(s) missing forceFlush().`
        : "No Lambda telemetry entrypoints are missing forceFlush().",
  };
}

function findWorkspaceRoot(cwd: string): string | null {
  let current = cwd;
  for (let depth = 0; depth < WORKSPACE_MAX_DEPTH; depth += 1) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

function readWorkspacePackages(rootDir: string): WorkspaceDiscoveryResult {
  const workspacePath = join(rootDir, "pnpm-workspace.yaml");
  const patterns = parseWorkspacePackagePatterns(readFileSync(workspacePath, "utf-8"));
  const packageJsonFiles = readWorkspacePackageJsonFiles(rootDir, patterns);
  const packageResults = packageJsonFiles
    .sort()
    .map((packageJsonPath) => readPackage(rootDir, packageJsonPath));

  return {
    packages: packageResults.flatMap((result) => (result.kind === "valid" ? [result.package] : [])),
    patterns,
    diagnostics: packageResults.flatMap((result) =>
      result.kind === "invalid" ? [result.diagnostic] : [],
    ),
  };
}

function parseWorkspacePackagePatterns(source: string): WorkspacePattern[] {
  const inlinePatterns = parseInlineWorkspacePackagePatterns(source);
  if (inlinePatterns.length > 0) {
    return inlinePatterns;
  }

  const patterns: WorkspacePattern[] = [];
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
    if (!match) {
      continue;
    }

    const pattern = normalizeWorkspacePattern(match[1]);
    if (pattern) {
      patterns.push(pattern);
    }
  }

  return patterns;
}

function parseInlineWorkspacePackagePatterns(source: string): WorkspacePattern[] {
  const match = source.match(/^packages:\s*\[(.*)\]\s*$/m);
  if (!match) {
    return [];
  }

  return match[1]
    .split(",")
    .map((item) => normalizeWorkspacePattern(item))
    .filter((pattern): pattern is WorkspacePattern => pattern !== null);
}

function normalizeWorkspacePattern(value: string): WorkspacePattern | null {
  const commentIndex = value.indexOf(" #");
  const withoutComment = commentIndex === -1 ? value : value.slice(0, commentIndex);
  const rawPattern = withoutComment.trim().replace(/^['"]|['"]$/g, "");
  const excluded = rawPattern.startsWith("!");
  const pattern = excluded ? rawPattern.slice(1) : rawPattern;

  if (!pattern) {
    return null;
  }

  return {
    pattern: toPosixPath(pattern).replace(/\/+$/, ""),
    excluded,
  };
}

function readWorkspacePackageJsonFiles(
  rootDir: string,
  patterns: readonly WorkspacePattern[],
): string[] {
  if (patterns.length === 0) {
    return findPackageJsonFiles(join(rootDir, "packages"));
  }

  const packageJsonFiles = findPackageJsonFiles(rootDir);
  const includePatterns = patterns.filter((pattern) => !pattern.excluded);
  const excludePatterns = patterns.filter((pattern) => pattern.excluded);

  return packageJsonFiles.filter((packageJsonPath) => {
    const relativeDir = toPosixPath(relative(rootDir, dirname(packageJsonPath)));
    return (
      includePatterns.some((pattern) => matchesWorkspacePattern(relativeDir, pattern.pattern)) &&
      !excludePatterns.some((pattern) => matchesWorkspacePattern(relativeDir, pattern.pattern))
    );
  });
}

function findPackageJsonFiles(dir: string, results: string[] = []): string[] {
  if (!existsSync(dir)) {
    return results;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name) || entry.name.startsWith(".")) {
        continue;
      }
      findPackageJsonFiles(fullPath, results);
      continue;
    }

    if (entry.isFile() && entry.name === "package.json") {
      results.push(fullPath);
    }
  }

  return results;
}

function listSourceFiles(dir: string, results: string[] = []): string[] {
  if (!existsSync(dir)) {
    return results;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name) || entry.name.startsWith(".")) {
        continue;
      }
      listSourceFiles(fullPath, results);
      continue;
    }

    if (entry.isFile() && isDoctorSourceFile(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

function isDoctorSourceFile(fileName: string): boolean {
  if (fileName.endsWith(".d.ts")) {
    return false;
  }

  return sourceFileExtensions.some((extension) => fileName.endsWith(extension));
}

function findForbiddenLines(
  file: string,
  forbiddenPattern: RegExp,
): Array<{ readonly line: number }> {
  return readFileSync(file, "utf-8")
    .split(/\r?\n/)
    .flatMap((line, index) => (forbiddenPattern.test(line) ? [{ line: index + 1 }] : []));
}

function isLambdaTelemetryEntrypoint(file: string, source: string): boolean {
  const normalizedFile = toPosixPath(file);
  const usesTelemetryRuntime = /TelemetryRuntime/.test(source);
  const looksLikeHandler =
    /startServerAndCreateLambdaHandler/.test(source) ||
    /export\s+(const|async function)\s+handler\b/.test(source) ||
    /AWS_LAMBDA_FUNCTION_NAME/.test(source) ||
    normalizedFile.endsWith("/handler.ts") ||
    normalizedFile.endsWith("/handler.ts.hbs");

  return usesTelemetryRuntime && looksLikeHandler;
}

function hasHandlerForceFlush(source: string): boolean {
  const handlerSource = extractExportedHandlerSource(source);
  const sourceToCheck = handlerSource ?? source;

  return /\.forceFlush\s*\(/.test(sourceToCheck);
}

function extractExportedHandlerSource(source: string): string | null {
  const handlerMatch = source.match(/export\s+(?:const|async function)\s+handler\b/);
  if (!handlerMatch || handlerMatch.index === undefined) {
    return null;
  }

  const bodyStart = source.indexOf("{", handlerMatch.index);
  if (bodyStart === -1) {
    const statementEnd = source.indexOf(";", handlerMatch.index);
    return statementEnd === -1
      ? source.slice(handlerMatch.index)
      : source.slice(handlerMatch.index, statementEnd + 1);
  }

  const bodyEnd = findBalancedBlockEnd(source, bodyStart);
  return bodyEnd === null
    ? source.slice(handlerMatch.index)
    : source.slice(handlerMatch.index, bodyEnd + 1);
}

function findBalancedBlockEnd(source: string, startIndex: number): number | null {
  let depth = 0;
  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return null;
}

function stripTypeScriptComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function findFirstMatchingLine(source: string, pattern: RegExp): number {
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) {
      return index + 1;
    }
  }
  return 1;
}

function readPackage(rootDir: string, packageJsonPath: string): WorkspacePackageReadResult {
  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as unknown;
    if (!isRecord(parsed) || typeof parsed.name !== "string") {
      return invalidPackageDiagnostic(
        rootDir,
        packageJsonPath,
        "package.json is missing a string name field.",
      );
    }

    const absoluteDir = dirname(packageJsonPath);

    return {
      kind: "valid",
      package: {
        name: parsed.name,
        absoluteDir,
        relativeDir: toPosixPath(relative(rootDir, absoluteDir)),
      },
    };
  } catch (error) {
    return invalidPackageDiagnostic(
      rootDir,
      packageJsonPath,
      `package.json could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function invalidPackageDiagnostic(
  rootDir: string,
  packageJsonPath: string,
  cause: string,
): WorkspacePackageReadResult {
  return {
    kind: "invalid",
    diagnostic: {
      code: "doctor/workspace-package-invalid",
      severity: "error",
      checkId: "workspace-discovery",
      cause,
      location: { file: toPosixPath(relative(rootDir, packageJsonPath)) },
      action: "Fix the package.json so it contains valid JSON and a string package name.",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatLocation(location: DoctorLocation | null): string {
  if (!location) {
    return "unknown";
  }

  const line = typeof location.line === "number" ? `:${location.line}` : "";
  const packageName = location.packageName ? ` (${location.packageName})` : "";
  return `${location.file ?? "unknown"}${line}${packageName}`;
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function matchesWorkspacePattern(relativeDir: string, pattern: string): boolean {
  return matchGlobSegments(toPosixPath(relativeDir).split("/"), toPosixPath(pattern).split("/"));
}

function matchGlobSegments(
  pathSegments: readonly string[],
  patternSegments: readonly string[],
): boolean {
  if (patternSegments.length === 0) {
    return pathSegments.length === 0;
  }

  const [patternHead, ...patternTail] = patternSegments;
  if (patternHead === "**") {
    return (
      matchGlobSegments(pathSegments, patternTail) ||
      (pathSegments.length > 0 && matchGlobSegments(pathSegments.slice(1), patternSegments))
    );
  }

  if (pathSegments.length === 0 || !matchGlobSegment(pathSegments[0], patternHead)) {
    return false;
  }

  return matchGlobSegments(pathSegments.slice(1), patternTail);
}

function matchGlobSegment(pathSegment: string, patternSegment: string): boolean {
  if (patternSegment === "*") {
    return true;
  }

  if (!patternSegment.includes("*")) {
    return pathSegment === patternSegment;
  }

  const escaped = patternSegment.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`).test(pathSegment);
}

export const doctor = defineCommand({
  meta: {
    name: "doctor",
    description: "Diagnose Croco workspace configuration and framework boundaries",
  },
  args: {
    ...GLOBAL_OPTIONS,
    path: {
      type: "positional",
      required: false,
      description: "Workspace path to diagnose",
    },
    json: {
      type: "boolean",
      description: "Print the machine-readable doctor report",
    },
  },
  run({ args }) {
    const cwd =
      typeof args.cwd === "string"
        ? args.cwd
        : typeof args.path === "string"
          ? args.path
          : process.cwd();
    const report = runDoctor({ cwd });

    console.log(args.json ? JSON.stringify(report, null, 2) : formatDoctorReport(report));
    process.exitCode = getDoctorExitCode(report);
  },
});
