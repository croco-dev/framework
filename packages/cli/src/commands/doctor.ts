import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { defineCommand } from "citty";
import { isContractGraphSnapshot } from "@croco/protocols-core";
import { WORKSPACE_MAX_DEPTH } from "../libs/constants.js";
import { CLI_DIAGNOSTIC_CODES, CLI_LEGACY_DIAGNOSTIC_CODES } from "../libs/diagnosticCodes.js";
import type { CliDiagnosticCode } from "../libs/diagnosticCodes.js";
import { GLOBAL_OPTIONS } from "./options.js";

export type DoctorSeverity = "error" | "warning";
export type DoctorSummary = "healthy" | "issues_detected";
export type DoctorCheckStatus = "pass" | "fail" | "skipped";

export type DoctorLocation = {
  readonly file?: string;
  readonly line?: number;
  readonly packageName?: string;
  readonly symbol?: string;
};

export type DoctorDiagnostic = {
  readonly code: CliDiagnosticCode;
  readonly legacyCode?: string;
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

type PackageDependencyField =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

type PackageDependencyReference = {
  readonly owner: DoctorPackage;
  readonly field: PackageDependencyField;
  readonly name: string;
  readonly range: string;
};

type JsonReadResult =
  | { readonly kind: "valid"; readonly value: unknown }
  | { readonly kind: "invalid"; readonly message: string };

const sourceFileExtensions = [".ts", ".tsx", ".mts", ".cts", ".ts.hbs", ".tsx.hbs"];
const packageDependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const satisfies readonly PackageDependencyField[];
const contractGraphSnapshotPath = "contract-graph.snapshot.json";
const problemRegistryPath = join("docs", "problem-code-registry.json");
const runtimeCapabilityManifestPath = "croco-runtime-policy.manifest.json";
const providerProfileManifestPath = "croco-saas-profile.manifest.json";
const diGraphManifestPath = "croco.di-graph.manifest.json";
const requiredHttpSecurityMiddlewares = [
  "securityHeadersMiddleware",
  "corsMiddleware",
  "bodyLimitMiddleware",
  "rateLimitHttpMiddleware",
] as const;
const ignoredDirectories = new Set([
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "templates",
  "tests",
  "__tests__",
]);

export function runDoctor(options: RunDoctorOptions = {}): DoctorReport {
  const startDir = resolve(options.cwd ?? process.cwd());
  const rootDir = findWorkspaceRoot(startDir);

  if (!rootDir) {
    const diagnostic: DoctorDiagnostic = {
      code: CLI_DIAGNOSTIC_CODES.doctorWorkspaceNotFound,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorWorkspaceNotFound,
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
    workspaceVersionConsistencyCheck(rootDir, workspace.packages),
    spinePackageInstallBuildCheck(rootDir, workspace.packages),
    contractGraphCheck(rootDir),
    problemRegistryCheck(rootDir),
    runtimeCapabilityManifestCheck(rootDir),
    httpSecurityMiddlewareCheck(rootDir, workspace.packages),
    diGraphBootstrapCheck(rootDir),
    providerCertificationCheck(rootDir, workspace.packages),
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
      code: CLI_DIAGNOSTIC_CODES.doctorWorkspacePackagesEmpty,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorWorkspacePackagesEmpty,
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

function workspaceVersionConsistencyCheck(
  rootDir: string,
  packages: readonly DoctorPackage[],
): DoctorCheckResult {
  const checkId = "workspace-version-consistency";
  const packageNames = new Set(packages.map((workspacePackage) => workspacePackage.name));
  const diagnostics = packages.flatMap((workspacePackage) =>
    readPackageDependencyReferences(workspacePackage)
      .filter((dependency) => packageNames.has(dependency.name))
      .filter((dependency) => dependency.range !== "workspace:*")
      .map((dependency) => ({
        code: CLI_DIAGNOSTIC_CODES.doctorWorkspaceVersionInconsistent,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorWorkspaceVersionInconsistent,
        severity: "error" as const,
        checkId,
        cause: `${workspacePackage.name} depends on local workspace package ${dependency.name} with range '${dependency.range}'.`,
        location: {
          file: toPosixPath(relative(rootDir, join(workspacePackage.absoluteDir, "package.json"))),
          packageName: workspacePackage.name,
          symbol: dependency.field,
        },
        action:
          "Use workspace:* for Croco workspace-local dependencies so generated and publish checks do not drift from local package versions.",
      })),
  );

  return {
    id: checkId,
    title: "Workspace package version consistency",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note:
      diagnostics.length > 0
        ? `${diagnostics.length} local dependency range mismatch(es) found.`
        : "Workspace-local dependencies use workspace:* ranges.",
  };
}

function spinePackageInstallBuildCheck(
  rootDir: string,
  packages: readonly DoctorPackage[],
): DoctorCheckResult {
  const checkId = "spine-package-state";
  const catalogPackages = readSpineCatalogPackageNames(rootDir);
  const requiredPackages =
    catalogPackages.length > 0
      ? catalogPackages
      : collectDeclaredCrocoDependencies(rootDir, packages).map((dependency) => dependency.name);

  if (requiredPackages.length === 0) {
    return {
      id: checkId,
      title: "Spine package install/build state",
      status: "skipped",
      diagnostics: [],
      note: "No Croco spine package requirements were found.",
    };
  }

  const workspacePackageByName = new Map(
    packages.map((workspacePackage) => [workspacePackage.name, workspacePackage]),
  );
  const diagnostics: DoctorDiagnostic[] = [];

  for (const packageName of uniqueStrings(requiredPackages)) {
    const workspacePackage = workspacePackageByName.get(packageName);
    const packageDir =
      workspacePackage?.absoluteDir ?? join(rootDir, "node_modules", ...packageName.split("/"));
    const packageJsonPath = join(packageDir, "package.json");

    if (!existsSync(packageJsonPath)) {
      diagnostics.push({
        code: CLI_DIAGNOSTIC_CODES.doctorSpinePackageMissing,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorSpinePackageMissing,
        severity: "error",
        checkId,
        cause: `Required Croco spine package '${packageName}' is not present in the workspace or node_modules.`,
        location: { file: toPosixPath(relative(rootDir, packageJsonPath)), packageName },
        action:
          "Run pnpm install, or add the missing Croco spine package to the workspace before checking app readiness.",
      });
      continue;
    }

    if (!existsSync(join(packageDir, "dist"))) {
      diagnostics.push({
        code: CLI_DIAGNOSTIC_CODES.doctorSpinePackageUnbuilt,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorSpinePackageUnbuilt,
        severity: "error",
        checkId,
        cause: `Required Croco spine package '${packageName}' is present but has no dist build output.`,
        location: { file: toPosixPath(relative(rootDir, packageJsonPath)), packageName },
        action:
          "Run pnpm build for the workspace or install built Croco packages before using this app as a golden-path readiness target.",
      });
    }
  }

  return {
    id: checkId,
    title: "Spine package install/build state",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note:
      diagnostics.length > 0
        ? `${diagnostics.length} spine package install/build issue(s) found.`
        : `${uniqueStrings(requiredPackages).length} Croco spine package(s) are installed and built.`,
  };
}

function contractGraphCheck(rootDir: string): DoctorCheckResult {
  const checkId = "contract-graph";
  const snapshotFile = join(rootDir, contractGraphSnapshotPath);
  const rootScripts = readRootPackageScripts(rootDir);
  const hasContractSignal =
    existsSync(snapshotFile) ||
    Object.keys(rootScripts).some((scriptName) => scriptName.startsWith("contract:"));

  if (!hasContractSignal) {
    return {
      id: checkId,
      title: "ContractGraph presence and errors",
      status: "skipped",
      diagnostics: [],
      note: "No ContractGraph snapshot or contract scripts were found.",
    };
  }

  if (!existsSync(snapshotFile)) {
    const diagnostic: DoctorDiagnostic = {
      code: CLI_DIAGNOSTIC_CODES.doctorContractGraphMissing,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorContractGraphMissing,
      severity: "error",
      checkId,
      cause: `Contract scripts are present but ${contractGraphSnapshotPath} does not exist.`,
      location: { file: contractGraphSnapshotPath },
      action:
        "Run pnpm contract:snapshot or pnpm contract:verify so doctor can inspect the committed ContractGraph artifact.",
    };

    return {
      id: checkId,
      title: "ContractGraph presence and errors",
      status: "fail",
      diagnostics: [diagnostic],
    };
  }

  const snapshot = readJsonFile(snapshotFile);
  if (snapshot.kind === "invalid" || !isContractGraphSnapshot(snapshot.value)) {
    const diagnostic: DoctorDiagnostic = {
      code: CLI_DIAGNOSTIC_CODES.doctorContractGraphInvalid,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorContractGraphInvalid,
      severity: "error",
      checkId,
      cause:
        snapshot.kind === "invalid"
          ? snapshot.message
          : `${contractGraphSnapshotPath} is not croco.contract-graph.snapshot.v1.`,
      location: { file: contractGraphSnapshotPath },
      action:
        "Regenerate the ContractGraph snapshot from the current controller sources and review the artifact diff.",
    };

    return {
      id: checkId,
      title: "ContractGraph presence and errors",
      status: "fail",
      diagnostics: [diagnostic],
    };
  }

  const errorDiagnostics = snapshot.value.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );
  const diagnostics =
    errorDiagnostics.length === 0
      ? []
      : [
          {
            code: CLI_DIAGNOSTIC_CODES.doctorContractGraphErrors,
            legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorContractGraphErrors,
            severity: "error" as const,
            checkId,
            cause: `${contractGraphSnapshotPath} contains ${errorDiagnostics.length} error diagnostic(s).`,
            location: { file: contractGraphSnapshotPath },
            action:
              "Fix the route contract diagnostics, then rerun the app contract snapshot and verify scripts.",
          },
        ];

  return {
    id: checkId,
    title: "ContractGraph presence and errors",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note: `${snapshot.value.routeCount} route(s), ${errorDiagnostics.length} error diagnostic(s).`,
  };
}

function problemRegistryCheck(rootDir: string): DoctorCheckResult {
  const checkId = "problem-registry";
  const registryFile = join(rootDir, problemRegistryPath);
  const hasProblemRegistrySource =
    existsSync(registryFile) || existsSync(join(rootDir, "packages", "problems-core", "src"));

  if (!hasProblemRegistrySource) {
    return {
      id: checkId,
      title: "ProblemRegistry presence and drift",
      status: "skipped",
      diagnostics: [],
      note: "No ProblemRegistry source or generated registry artifact was found.",
    };
  }

  if (!existsSync(registryFile)) {
    const diagnostic: DoctorDiagnostic = {
      code: CLI_DIAGNOSTIC_CODES.doctorProblemRegistryMissing,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorProblemRegistryMissing,
      severity: "error",
      checkId,
      cause: `${problemRegistryPath} is missing while ProblemRegistry sources are present.`,
      location: { file: problemRegistryPath },
      action: "Run pnpm problem-registry:write and commit the generated registry artifact.",
    };

    return {
      id: checkId,
      title: "ProblemRegistry presence and drift",
      status: "fail",
      diagnostics: [diagnostic],
    };
  }

  const registry = readJsonFile(registryFile);
  const record =
    registry.kind === "valid" ? (isRecord(registry.value) ? registry.value : null) : null;
  const problems = Array.isArray(record?.problems) ? record.problems : null;
  const problemCount = typeof record?.problemCount === "number" ? record.problemCount : null;

  if (
    registry.kind === "invalid" ||
    !record ||
    record.version !== "croco.problem-code-registry.v1" ||
    !problems ||
    problemCount === null
  ) {
    const diagnostic: DoctorDiagnostic = {
      code: CLI_DIAGNOSTIC_CODES.doctorProblemRegistryInvalid,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorProblemRegistryInvalid,
      severity: "error",
      checkId,
      cause:
        registry.kind === "invalid"
          ? registry.message
          : `${problemRegistryPath} must be croco.problem-code-registry.v1 with problemCount and problems.`,
      location: { file: problemRegistryPath },
      action: "Regenerate the Problem registry artifact with pnpm problem-registry:write.",
    };

    return {
      id: checkId,
      title: "ProblemRegistry presence and drift",
      status: "fail",
      diagnostics: [diagnostic],
    };
  }

  const problemCodes = problems.flatMap((problem) => {
    const problemRecord = isRecord(problem) ? problem : null;
    return typeof problemRecord?.code === "string" ? [problemRecord.code] : [];
  });
  const duplicateCodes = findDuplicateStrings(problemCodes);
  const diagnostics: DoctorDiagnostic[] = [];

  if (
    problemCount !== problems.length ||
    duplicateCodes.length > 0 ||
    problemCodes.length !== problems.length
  ) {
    diagnostics.push({
      code: CLI_DIAGNOSTIC_CODES.doctorProblemRegistryDrift,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorProblemRegistryDrift,
      severity: "error",
      checkId,
      cause:
        duplicateCodes.length > 0
          ? `${problemRegistryPath} contains duplicate Problem code(s): ${duplicateCodes.join(", ")}.`
          : `${problemRegistryPath} problemCount does not match its Problem entries.`,
      location: { file: problemRegistryPath },
      action: "Run pnpm problem-registry:write and review the synchronized registry diff.",
    });
  }

  return {
    id: checkId,
    title: "ProblemRegistry presence and drift",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note: `${problems.length} Problem code(s) indexed.`,
  };
}

function runtimeCapabilityManifestCheck(rootDir: string): DoctorCheckResult {
  const checkId = "runtime-capability-manifest";
  const manifestFile = join(rootDir, runtimeCapabilityManifestPath);
  const rootScripts = readRootPackageScripts(rootDir);
  const hasRuntimeSignal =
    existsSync(manifestFile) ||
    existsSync(join(rootDir, providerProfileManifestPath)) ||
    Object.values(rootScripts).some((script) => script.includes("runtime-policy"));

  if (!hasRuntimeSignal) {
    return {
      id: checkId,
      title: "RuntimeCapabilityManifest presence",
      status: "skipped",
      diagnostics: [],
      note: "No runtime capability manifest signal was found.",
    };
  }

  if (!existsSync(manifestFile)) {
    const diagnostic: DoctorDiagnostic = {
      code: CLI_DIAGNOSTIC_CODES.doctorRuntimeCapabilityManifestMissing,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorRuntimeCapabilityManifestMissing,
      severity: "error",
      checkId,
      cause: `${runtimeCapabilityManifestPath} is required by this app but does not exist.`,
      location: { file: runtimeCapabilityManifestPath },
      action: "Generate the runtime capability manifest for the app runtime target.",
    };

    return {
      id: checkId,
      title: "RuntimeCapabilityManifest presence",
      status: "fail",
      diagnostics: [diagnostic],
    };
  }

  const manifest = readJsonFile(manifestFile);
  const record =
    manifest.kind === "valid" ? (isRecord(manifest.value) ? manifest.value : null) : null;
  const runtime = isRecord(record?.runtime) ? record.runtime : null;
  const target = readOptionalString(runtime?.platform) ?? readOptionalString(record?.target);
  const table = isRecord(record?.table) ? record.table : null;
  const plans = Array.isArray(table?.plans)
    ? table.plans
    : Array.isArray(record?.plans)
      ? record.plans
      : null;

  if (manifest.kind === "invalid" || !record || !target || !plans) {
    const diagnostic: DoctorDiagnostic = {
      code: CLI_DIAGNOSTIC_CODES.doctorRuntimeCapabilityManifestInvalid,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorRuntimeCapabilityManifestInvalid,
      severity: "error",
      checkId,
      cause:
        manifest.kind === "invalid"
          ? manifest.message
          : `${runtimeCapabilityManifestPath} must declare runtime.platform or target and table.plans.`,
      location: { file: runtimeCapabilityManifestPath },
      action:
        "Regenerate the runtime capability manifest or add runtime.platform/target and table.plans.",
    };

    return {
      id: checkId,
      title: "RuntimeCapabilityManifest presence",
      status: "fail",
      diagnostics: [diagnostic],
    };
  }

  return {
    id: checkId,
    title: "RuntimeCapabilityManifest presence",
    status: "pass",
    diagnostics: [],
    note: `${plans.length} runtime policy plan(s) for target '${target}'.`,
  };
}

function httpSecurityMiddlewareCheck(
  rootDir: string,
  packages: readonly DoctorPackage[],
): DoctorCheckResult {
  const checkId = "http-security-middleware";
  const candidateFiles = packages.flatMap((workspacePackage) =>
    listSourceFiles(workspacePackage.absoluteDir)
      .filter((file) => isApplicationHttpBootstrap(readFileSync(file, "utf-8")))
      .map((file) => ({ file, workspacePackage })),
  );

  if (candidateFiles.length === 0) {
    return {
      id: checkId,
      title: "HTTP security middleware contract",
      status: "skipped",
      diagnostics: [],
      note: "No Croco HTTP app bootstrap was found.",
    };
  }

  const diagnostics = candidateFiles.flatMap(({ file, workspacePackage }) => {
    const source = readFileSync(file, "utf-8");
    const sourceWithoutComments = stripTypeScriptComments(source);
    const relativeFile = toPosixPath(relative(rootDir, file));
    const fileDiagnostics: DoctorDiagnostic[] = [];

    if (
      /securityValidation\s*:\s*["']off["']/.test(sourceWithoutComments) ||
      /unsafeSkipSecurityValidation\s*:\s*true/.test(sourceWithoutComments)
    ) {
      fileDiagnostics.push({
        code: CLI_DIAGNOSTIC_CODES.doctorHttpSecurityValidationDisabled,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorHttpSecurityValidationDisabled,
        severity: "error",
        checkId,
        cause: "The HTTP app disables required security middleware validation.",
        location: {
          file: relativeFile,
          line: findFirstMatchingLine(
            sourceWithoutComments,
            /securityValidation|unsafeSkipSecurityValidation/,
          ),
          packageName: workspacePackage.name,
        },
        action:
          "Register the required security middleware and remove the validation opt-out from the app bootstrap.",
      });
    }

    const missingMiddlewares = requiredHttpSecurityMiddlewares.filter(
      (middleware) => !new RegExp(`\\b${middleware}\\b`).test(sourceWithoutComments),
    );

    if (missingMiddlewares.length > 0) {
      fileDiagnostics.push({
        code: CLI_DIAGNOSTIC_CODES.doctorHttpSecurityMiddlewareMissing,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorHttpSecurityMiddlewareMissing,
        severity: "error",
        checkId,
        cause: `The HTTP app bootstrap is missing required middleware: ${missingMiddlewares.join(", ")}.`,
        location: {
          file: relativeFile,
          line: findFirstMatchingLine(sourceWithoutComments, /createCrocoApp|new\s+CrocoApp/),
          packageName: workspacePackage.name,
        },
        action:
          "Register securityHeadersMiddleware, corsMiddleware, bodyLimitMiddleware, and rateLimitHttpMiddleware in the app bootstrap.",
      });
    }

    return fileDiagnostics;
  });

  return {
    id: checkId,
    title: "HTTP security middleware contract",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note:
      diagnostics.length > 0
        ? `${diagnostics.length} HTTP security issue(s) found.`
        : `${candidateFiles.length} HTTP app bootstrap file(s) include the required security middleware.`,
  };
}

function diGraphBootstrapCheck(rootDir: string): DoctorCheckResult {
  const checkId = "di-graph-bootstrap";
  const manifestFile = join(rootDir, diGraphManifestPath);
  const rootScripts = readRootPackageScripts(rootDir);
  const hasDiGraphSignal =
    existsSync(manifestFile) ||
    Object.values(rootScripts).some(
      (script) => script.includes("croco di check") || script.includes("di:check"),
    );

  if (!hasDiGraphSignal) {
    return {
      id: checkId,
      title: "DI graph bootstrap errors",
      status: "skipped",
      diagnostics: [],
      note: "No DI graph manifest or DI check script was found.",
    };
  }

  if (!existsSync(manifestFile)) {
    const diagnostic: DoctorDiagnostic = {
      code: CLI_DIAGNOSTIC_CODES.doctorDiGraphManifestMissing,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorDiGraphManifestMissing,
      severity: "error",
      checkId,
      cause: `A DI graph check is configured but ${diGraphManifestPath} does not exist.`,
      location: { file: diGraphManifestPath },
      action: "Generate the DI graph manifest or update the DI check script to point at it.",
    };

    return {
      id: checkId,
      title: "DI graph bootstrap errors",
      status: "fail",
      diagnostics: [diagnostic],
    };
  }

  const manifest = readJsonFile(manifestFile);
  const record =
    manifest.kind === "valid" ? (isRecord(manifest.value) ? manifest.value : null) : null;
  const manifestDiagnostics = Array.isArray(record?.diagnostics) ? record.diagnostics : [];
  const errorCount = manifestDiagnostics.filter((diagnostic) => {
    const diagnosticRecord = isRecord(diagnostic) ? diagnostic : null;
    return diagnosticRecord?.severity === "error";
  }).length;

  if (manifest.kind === "invalid" || !record || record.status === "failed" || errorCount > 0) {
    const diagnostic: DoctorDiagnostic = {
      code: CLI_DIAGNOSTIC_CODES.doctorDiGraphBootstrapFailed,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorDiGraphBootstrapFailed,
      severity: "error",
      checkId,
      cause:
        manifest.kind === "invalid"
          ? manifest.message
          : `DI graph manifest reports failed status or ${errorCount} error diagnostic(s).`,
      location: { file: diGraphManifestPath },
      action: "Fix DI graph bootstrap diagnostics and regenerate the manifest.",
    };

    return {
      id: checkId,
      title: "DI graph bootstrap errors",
      status: "fail",
      diagnostics: [diagnostic],
    };
  }

  return {
    id: checkId,
    title: "DI graph bootstrap errors",
    status: "pass",
    diagnostics: [],
    note: `${manifestDiagnostics.length} DI graph diagnostic(s), ${errorCount} error(s).`,
  };
}

function providerCertificationCheck(
  rootDir: string,
  packages: readonly DoctorPackage[],
): DoctorCheckResult {
  const checkId = "provider-certification";
  const manifestFile = join(rootDir, providerProfileManifestPath);

  if (!existsSync(manifestFile)) {
    return {
      id: checkId,
      title: "Provider certification gaps",
      status: "skipped",
      diagnostics: [],
      note: "No provider profile manifest was found.",
    };
  }

  const manifest = readJsonFile(manifestFile);
  const record =
    manifest.kind === "valid" ? (isRecord(manifest.value) ? manifest.value : null) : null;
  const compatibility = isRecord(record?.compatibility) ? record.compatibility : null;
  const requiredCapabilities = readStringArray(compatibility?.requiredCapabilities);
  const capabilities = Array.isArray(record?.capabilities) ? record.capabilities : [];
  const packageNames = readStringArray(record?.packages);

  if (
    manifest.kind === "invalid" ||
    !record ||
    requiredCapabilities.length === 0 ||
    capabilities.length === 0
  ) {
    const diagnostic: DoctorDiagnostic = {
      code: CLI_DIAGNOSTIC_CODES.doctorProviderCertificationGap,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorProviderCertificationGap,
      severity: "error",
      checkId,
      cause:
        manifest.kind === "invalid"
          ? manifest.message
          : `${providerProfileManifestPath} must include compatibility.requiredCapabilities and capabilities evidence.`,
      location: { file: providerProfileManifestPath },
      action: "Regenerate the provider profile or complete its compatibility capability evidence.",
    };

    return {
      id: checkId,
      title: "Provider certification gaps",
      status: "fail",
      diagnostics: [diagnostic],
    };
  }

  const capabilityNames = new Set(
    capabilities.flatMap((capability) => {
      const capabilityRecord = isRecord(capability) ? capability : null;
      return typeof capabilityRecord?.capability === "string" ? [capabilityRecord.capability] : [];
    }),
  );
  const declaredPackageNames = new Set(
    packages.flatMap((workspacePackage) =>
      readPackageDependencyReferences(workspacePackage).map((dependency) => dependency.name),
    ),
  );
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !capabilityNames.has(capability),
  );
  const undeclaredPackages = packageNames.filter(
    (packageName) => !declaredPackageNames.has(packageName),
  );
  const diagnostics: DoctorDiagnostic[] = [];

  if (missingCapabilities.length > 0) {
    diagnostics.push({
      code: CLI_DIAGNOSTIC_CODES.doctorProviderCertificationGap,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorProviderCertificationGap,
      severity: "error",
      checkId,
      cause: `Provider profile is missing capability evidence for: ${missingCapabilities.join(", ")}.`,
      location: { file: providerProfileManifestPath },
      action: "Add capability evidence for every required provider profile capability.",
    });
  }

  if (undeclaredPackages.length > 0) {
    diagnostics.push({
      code: CLI_DIAGNOSTIC_CODES.doctorProviderCertificationGap,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorProviderCertificationGap,
      severity: "error",
      checkId,
      cause: `Provider profile certifies packages not declared in workspace package manifests: ${undeclaredPackages.join(", ")}.`,
      location: { file: providerProfileManifestPath },
      action:
        "Declare the provider packages in the generated app package manifests or remove them from the profile.",
    });
  }

  return {
    id: checkId,
    title: "Provider certification gaps",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note:
      diagnostics.length > 0
        ? `${diagnostics.length} provider certification gap(s) found.`
        : `${requiredCapabilities.length} provider capability evidence item(s) are present.`,
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
      code: CLI_DIAGNOSTIC_CODES.doctorRepositoryCoreDrizzleBoundary,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorRepositoryCoreDrizzleBoundary,
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
          code: CLI_DIAGNOSTIC_CODES.doctorLambdaTelemetryFlushMissing,
          legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorLambdaTelemetryFlushMissing,
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

function readPackageDependencyReferences(
  workspacePackage: DoctorPackage,
): PackageDependencyReference[] {
  const manifest = readJsonFile(join(workspacePackage.absoluteDir, "package.json"));
  const record = manifest.kind === "valid" ? asRecord(manifest.value) : null;

  if (!record) {
    return [];
  }

  return packageDependencyFields.flatMap((field) => {
    const dependencies = asRecord(record[field]);

    return Object.entries(dependencies ?? {}).flatMap(([name, range]) =>
      typeof range === "string"
        ? [
            {
              owner: workspacePackage,
              field,
              name,
              range,
            },
          ]
        : [],
    );
  });
}

function collectDeclaredCrocoDependencies(
  rootDir: string,
  packages: readonly DoctorPackage[],
): PackageDependencyReference[] {
  const rootPackage = readRootPackage(rootDir);
  const packageSources = rootPackage ? [rootPackage, ...packages] : packages;

  return packageSources.flatMap((workspacePackage) =>
    readPackageDependencyReferences(workspacePackage).filter(
      (dependency) => dependency.name.startsWith("@croco/") || dependency.name === "@croco/cli",
    ),
  );
}

function readRootPackage(rootDir: string): DoctorPackage | null {
  const manifest = readJsonFile(join(rootDir, "package.json"));
  const record = manifest.kind === "valid" ? asRecord(manifest.value) : null;

  if (!record || typeof record.name !== "string") {
    return null;
  }

  return {
    name: record.name,
    absoluteDir: rootDir,
    relativeDir: ".",
  };
}

function readSpineCatalogPackageNames(rootDir: string): string[] {
  const catalogFile = join(rootDir, "docs", "package-catalog.json");

  if (!existsSync(catalogFile)) {
    return [];
  }

  const catalog = readJsonFile(catalogFile);
  const record = catalog.kind === "valid" ? asRecord(catalog.value) : null;
  const spine = asRecord(record?.spine);
  const packages = readStringArray(spine?.packages);

  return packages.map((packageName) =>
    packageName === "create-croco-app" ? packageName : `@croco/${packageName}`,
  );
}

function readRootPackageScripts(rootDir: string): Record<string, string> {
  const manifest = readJsonFile(join(rootDir, "package.json"));
  const record = manifest.kind === "valid" ? asRecord(manifest.value) : null;
  const scripts = asRecord(record?.scripts);

  return Object.fromEntries(
    Object.entries(scripts ?? {}).filter((entry): entry is [string, string] => {
      const [, value] = entry;
      return typeof value === "string";
    }),
  );
}

function readJsonFile(path: string): JsonReadResult {
  try {
    return {
      kind: "valid",
      value: JSON.parse(readFileSync(path, "utf-8")) as unknown,
    };
  } catch (error) {
    return {
      kind: "invalid",
      message: `Unable to read JSON '${path}': ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function isApplicationHttpBootstrap(source: string): boolean {
  const sourceWithoutComments = stripTypeScriptComments(source);

  return (
    /@croco\/transports-http/.test(sourceWithoutComments) &&
    (/\bcreateCrocoApp\s*\(/.test(sourceWithoutComments) ||
      /\bnew\s+CrocoApp\s*\(/.test(sourceWithoutComments))
  );
}

function findDuplicateStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }
    seen.add(value);
  }

  return [...duplicates].sort(compareStrings);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").sort(compareStrings)
    : [];
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
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
      code: CLI_DIAGNOSTIC_CODES.doctorWorkspacePackageInvalid,
      legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorWorkspacePackageInvalid,
      severity: "error",
      checkId: "workspace-discovery",
      cause,
      location: { file: toPosixPath(relative(rootDir, packageJsonPath)) },
      action: "Fix the package.json so it contains valid JSON and a string package name.",
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatLocation(location: DoctorLocation | null): string {
  if (!location) {
    return "unknown";
  }

  const line = typeof location.line === "number" ? `:${location.line}` : "";
  const symbol = location.symbol ? `#${location.symbol}` : "";
  const packageName = location.packageName ? ` (${location.packageName})` : "";
  return `${location.file ?? "unknown"}${line}${symbol}${packageName}`;
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
