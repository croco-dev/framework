import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { defineCommand } from "citty";
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
  readonly version: string | null;
  readonly relativeDir: string;
  readonly absoluteDir: string;
  readonly dependencies: readonly DoctorPackageDependency[];
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

export type DoctorPackageDependency = {
  readonly name: string;
  readonly range: string;
  readonly field: PackageDependencyField;
  readonly importerDir: string;
  readonly importerName: string;
};

type PackageDependencyField =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

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

type SourceSlice = {
  readonly source: string;
  readonly maskedSource: string;
};

const sourceFileExtensions = [".ts", ".tsx", ".mts", ".cts", ".ts.hbs", ".tsx.hbs"];
const packageDependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const satisfies readonly PackageDependencyField[];
const ignoredDirectories = new Set([
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "tests",
  "__tests__",
]);
const requiredHttpSecurityMiddleware = [
  "securityHeadersMiddleware",
  "corsMiddleware",
  "bodyLimitMiddleware",
  "rateLimitHttpMiddleware",
] as const;
const requiredSaasProviderCapabilities = [
  "runtime",
  "auth",
  "billing",
  "metering",
  "storage",
  "tasks",
  "telemetry",
  "webhookVerification",
] as const;
const defaultContractGraphSnapshotPath = "contract-graph.snapshot.json";
const defaultProblemRegistryPath = "docs/problem-code-registry.json";
const defaultProblemCookbookPath =
  "packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md";
const defaultRuntimeCapabilityManifestPath = "croco-runtime-capability.manifest.json";
const legacyRuntimePolicyManifestPath = "croco-runtime-policy.manifest.json";
const defaultDiGraphManifestPath = ".croco/build/di-graph.manifest.json";
const defaultProviderProfileManifestPath = "croco-saas-profile.manifest.json";
const problemRegistryCheckTimeoutMs = 30_000;
const commandOutputMaxLength = 500;

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
    spinePackageStateCheck(rootDir, workspace.packages),
    contractGraphReadinessCheck(rootDir),
    problemRegistryReadinessCheck(rootDir),
    runtimeCapabilityManifestCheck(rootDir),
    httpSecurityMiddlewareContractCheck(rootDir, workspace.packages),
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
    if (diagnostic.legacyCode) {
      lines.push(`  Legacy code: ${diagnostic.legacyCode}`);
    }
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
  const workspacePackages = new Map(
    packages.map((workspacePackage) => [workspacePackage.name, workspacePackage]),
  );
  const diagnostics = collectDeclaredDependencies(rootDir, packages)
    .filter((dependency) => workspacePackages.has(dependency.name))
    .filter((dependency) => !isWorkspaceConsistentRange(dependency, workspacePackages))
    .map((dependency) => ({
      code: CLI_DIAGNOSTIC_CODES.doctorWorkspaceVersionConflict,
      severity: "error" as const,
      checkId,
      cause: `${dependency.importerName} references workspace package ${dependency.name} with range '${dependency.range}'.`,
      location: {
        file: toPosixPath(relative(rootDir, join(dependency.importerDir, "package.json"))),
        packageName: dependency.importerName,
      },
      action:
        "Use a workspace: range for local workspace package dependencies, or align the dependency range with the referenced package version.",
    }));

  return {
    id: checkId,
    title: "Workspace package version consistency",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note:
      diagnostics.length > 0
        ? `${diagnostics.length} inconsistent workspace dependency range(s) found.`
        : `${packages.length} workspace package manifest(s) use consistent local dependency ranges.`,
  };
}

function spinePackageStateCheck(
  rootDir: string,
  packages: readonly DoctorPackage[],
): DoctorCheckResult {
  const checkId = "spine-package-state";
  const workspacePackageNames = new Set(packages.map((workspacePackage) => workspacePackage.name));
  const spineDependencies = collectDeclaredDependencies(rootDir, packages)
    .filter((dependency) => dependency.name.startsWith("@croco/"))
    .filter((dependency) => !workspacePackageNames.has(dependency.name))
    .filter(uniqueDependencyByName);

  if (spineDependencies.length === 0) {
    return {
      id: checkId,
      title: "Spine package install and build state",
      status: "skipped",
      diagnostics: [],
      note: "No external @croco spine package dependencies were declared.",
    };
  }

  const diagnostics = spineDependencies.flatMap((dependency): DoctorDiagnostic[] => {
    const installedPackage = findInstalledPackage(dependency, rootDir);

    if (!installedPackage) {
      return [
        {
          code: CLI_DIAGNOSTIC_CODES.doctorSpinePackageNotInstalled,
          severity: "error" as const,
          checkId,
          cause: `${dependency.name} is declared with range '${dependency.range}', but it is not installed under node_modules.`,
          location: { file: "node_modules", packageName: dependency.name },
          action: "Run pnpm install, then rerun croco doctor.",
        },
      ];
    }

    const manifest = readJsonObject(installedPackage.packageJsonPath);
    if (manifest.kind === "invalid") {
      return [
        {
          code: CLI_DIAGNOSTIC_CODES.doctorSpinePackageManifestInvalid,
          severity: "error" as const,
          checkId,
          cause: `${dependency.name} package.json could not be parsed: ${manifest.message}`,
          location: {
            file: toPosixPath(relative(rootDir, installedPackage.packageJsonPath)),
            packageName: dependency.name,
          },
          action: "Reinstall dependencies so the package manifest is restored.",
        },
      ];
    }

    const missingTargets = readPackageBuildTargets(manifest.value)
      .filter((target) => target.startsWith("./dist/") || target === "./dist")
      .filter((target) => !existsSync(join(installedPackage.packageDir, target)));

    return missingTargets.map((target) => ({
      code: CLI_DIAGNOSTIC_CODES.doctorSpinePackageNotBuilt,
      severity: "error" as const,
      checkId,
      cause: `${dependency.name} declares build output ${target}, but that file is missing.`,
      location: {
        file: toPosixPath(relative(rootDir, join(installedPackage.packageDir, target))),
        packageName: dependency.name,
      },
      action:
        "Rebuild the source package or reinstall from a packed/published package that includes its dist artifacts.",
    }));
  });

  return {
    id: checkId,
    title: "Spine package install and build state",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note:
      diagnostics.length > 0
        ? `${diagnostics.length} spine package install/build issue(s) found.`
        : `${spineDependencies.length} external @croco spine package(s) are installed with declared build artifacts.`,
  };
}

function contractGraphReadinessCheck(rootDir: string): DoctorCheckResult {
  const checkId = "contract-graph-readiness";
  const snapshotPath = join(rootDir, defaultContractGraphSnapshotPath);
  const rootScripts = readRootScripts(rootDir);
  const expectsContractGraph =
    existsSync(snapshotPath) ||
    hasAnyScript(rootScripts, ["contract:check", "contract:snapshot", "contract:verify"]);

  if (!expectsContractGraph) {
    return {
      id: checkId,
      title: "ContractGraph artifact",
      status: "skipped",
      diagnostics: [],
      note: "No contract graph script or snapshot artifact was found.",
    };
  }

  if (!existsSync(snapshotPath)) {
    return {
      id: checkId,
      title: "ContractGraph artifact",
      status: "fail",
      diagnostics: [
        {
          code: CLI_DIAGNOSTIC_CODES.doctorContractGraphMissing,
          severity: "error",
          checkId,
          cause: `${defaultContractGraphSnapshotPath} is required by the declared contract scripts but is missing.`,
          location: { file: defaultContractGraphSnapshotPath },
          action: "Run pnpm contract:snapshot, commit the snapshot, then rerun croco doctor.",
        },
      ],
    };
  }

  const snapshot = readJsonObject(snapshotPath);
  if (snapshot.kind === "invalid" || !isContractGraphSnapshotRecord(snapshot.value)) {
    return {
      id: checkId,
      title: "ContractGraph artifact",
      status: "fail",
      diagnostics: [
        {
          code: CLI_DIAGNOSTIC_CODES.doctorContractGraphInvalid,
          severity: "error",
          checkId,
          cause:
            snapshot.kind === "invalid"
              ? `${defaultContractGraphSnapshotPath} could not be parsed: ${snapshot.message}`
              : `${defaultContractGraphSnapshotPath} is not a croco.contract-graph.snapshot.v1 artifact.`,
          location: { file: defaultContractGraphSnapshotPath },
          action: "Regenerate the snapshot with pnpm contract:snapshot.",
        },
      ],
    };
  }

  const graphDiagnostics = readDiagnosticRecords(snapshot.value.diagnostics);
  const graphErrors = graphDiagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const diagnostics: DoctorDiagnostic[] = graphErrors.map((diagnostic) => ({
    code: CLI_DIAGNOSTIC_CODES.doctorContractGraphErrors,
    severity: "error" as const,
    checkId,
    cause: `ContractGraph reports ${diagnostic.code}: ${diagnostic.message}`,
    location: { file: defaultContractGraphSnapshotPath },
    action: "Fix the controller contract diagnostic, then rerun pnpm contract:snapshot.",
  }));

  return {
    id: checkId,
    title: "ContractGraph artifact",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note:
      diagnostics.length > 0
        ? `${diagnostics.length} ContractGraph error diagnostic(s) found.`
        : `${readNumber(snapshot.value, "routeCount", 0)} route(s) captured with ${graphDiagnostics.length} diagnostic(s).`,
  };
}

function problemRegistryReadinessCheck(rootDir: string): DoctorCheckResult {
  const checkId = "problem-registry-readiness";
  const registryPath = join(rootDir, defaultProblemRegistryPath);
  const cookbookPath = join(rootDir, defaultProblemCookbookPath);
  const rootScripts = readRootScripts(rootDir);
  const expectsProblemRegistry =
    existsSync(registryPath) ||
    existsSync(cookbookPath) ||
    Boolean(rootScripts["problem-registry:check"]) ||
    existsSync(join(rootDir, "packages", "problems-core"));

  if (!expectsProblemRegistry) {
    return {
      id: checkId,
      title: "ProblemRegistry artifact drift gate",
      status: "skipped",
      diagnostics: [],
      note: "No ProblemRegistry artifact or drift-check script was found.",
    };
  }

  const missingArtifacts = [defaultProblemRegistryPath, defaultProblemCookbookPath].filter(
    (artifactPath) => !existsSync(join(rootDir, artifactPath)),
  );
  const missingDiagnostics = missingArtifacts.map((artifactPath) => ({
    code: CLI_DIAGNOSTIC_CODES.doctorProblemRegistryMissing,
    severity: "error" as const,
    checkId,
    cause: `ProblemRegistry artifact ${artifactPath} is missing.`,
    location: { file: artifactPath },
    action: "Run pnpm problem-registry:write, then commit the generated registry artifacts.",
  }));

  if (missingDiagnostics.length > 0) {
    return {
      id: checkId,
      title: "ProblemRegistry artifact drift gate",
      status: "fail",
      diagnostics: missingDiagnostics,
    };
  }

  const registry = readJsonObject(registryPath);
  if (registry.kind === "invalid" || !isProblemCodeRegistryRecord(registry.value)) {
    return {
      id: checkId,
      title: "ProblemRegistry artifact drift gate",
      status: "fail",
      diagnostics: [
        {
          code: CLI_DIAGNOSTIC_CODES.doctorProblemRegistryInvalid,
          severity: "error",
          checkId,
          cause:
            registry.kind === "invalid"
              ? `${defaultProblemRegistryPath} could not be parsed: ${registry.message}`
              : `${defaultProblemRegistryPath} is not a croco.problem-code-registry.v1 artifact.`,
          location: { file: defaultProblemRegistryPath },
          action: "Run pnpm problem-registry:write, then rerun croco doctor.",
        },
      ],
      note: "ProblemRegistry artifact is invalid.",
    };
  }

  const driftDiagnostic = rootScripts["problem-registry:check"]
    ? runProblemRegistryDriftCheck(rootDir, checkId)
    : null;
  if (driftDiagnostic) {
    return {
      id: checkId,
      title: "ProblemRegistry artifact drift gate",
      status: "fail",
      diagnostics: [driftDiagnostic],
      note: "ProblemRegistry drift check failed.",
    };
  }

  return {
    id: checkId,
    title: "ProblemRegistry artifact drift gate",
    status: "pass",
    diagnostics: [],
    note: `ProblemRegistry has ${readNumber(registry.value, "problemCount", 0)} code(s); drift gate script ${rootScripts["problem-registry:check"] ? "passed" : "is not declared"}.`,
  };
}

function runtimeCapabilityManifestCheck(rootDir: string): DoctorCheckResult {
  const checkId = "runtime-capability-manifest";
  const defaultManifestPath = join(rootDir, defaultRuntimeCapabilityManifestPath);
  const legacyManifestPath = join(rootDir, legacyRuntimePolicyManifestPath);
  const manifestPath = existsSync(defaultManifestPath) ? defaultManifestPath : legacyManifestPath;
  const manifestArtifact = existsSync(defaultManifestPath)
    ? defaultRuntimeCapabilityManifestPath
    : legacyRuntimePolicyManifestPath;
  const rootScripts = readRootScripts(rootDir);
  const expectsManifest =
    existsSync(defaultManifestPath) ||
    existsSync(legacyManifestPath) ||
    Boolean(rootScripts["runtime-policy:check"]);

  if (!expectsManifest) {
    return {
      id: checkId,
      title: "RuntimeCapabilityManifest presence",
      status: "skipped",
      diagnostics: [],
      note: "No runtime capability manifest or runtime-policy check script was found.",
    };
  }

  if (!existsSync(manifestPath)) {
    return {
      id: checkId,
      title: "RuntimeCapabilityManifest presence",
      status: "fail",
      diagnostics: [
        {
          code: CLI_DIAGNOSTIC_CODES.doctorRuntimeCapabilityManifestMissing,
          severity: "error",
          checkId,
          cause:
            `${defaultRuntimeCapabilityManifestPath} is required by runtime-policy:check but is missing. ` +
            `${legacyRuntimePolicyManifestPath} is accepted only for compatibility with older generated apps.`,
          location: { file: defaultRuntimeCapabilityManifestPath },
          action:
            "Regenerate the runtime capability manifest or remove the stale runtime-policy check script.",
        },
      ],
    };
  }

  const manifest = readJsonObject(manifestPath);
  if (manifest.kind === "invalid" || !isRuntimeCapabilityManifestRecord(manifest.value)) {
    return {
      id: checkId,
      title: "RuntimeCapabilityManifest presence",
      status: "fail",
      diagnostics: [
        {
          code: CLI_DIAGNOSTIC_CODES.doctorRuntimeCapabilityManifestInvalid,
          severity: "error",
          checkId,
          cause:
            manifest.kind === "invalid"
              ? `${manifestArtifact} could not be parsed: ${manifest.message}`
              : `${manifestArtifact} must declare RuntimeCapabilityManifest v1 or legacy runtime policy fields.`,
          location: { file: manifestArtifact },
          action: "Regenerate croco-runtime-capability.manifest.json and rerun croco doctor.",
        },
      ],
      note: "Runtime capability manifest is invalid.",
    };
  }

  return {
    id: checkId,
    title: "RuntimeCapabilityManifest presence",
    status: "pass",
    diagnostics: [],
    note: `Runtime target ${readRuntimePlatform(manifest.value)} from ${manifestArtifact}.`,
  };
}

function httpSecurityMiddlewareContractCheck(
  rootDir: string,
  packages: readonly DoctorPackage[],
): DoctorCheckResult {
  const checkId = "http-security-middleware-contract";
  const httpPackages = packages.filter((workspacePackage) =>
    workspacePackage.dependencies.some(
      (dependency) => dependency.name === "@croco/transports-http",
    ),
  );
  const appSourceFiles = httpPackages.flatMap((workspacePackage) =>
    listSourceFiles(workspacePackage.absoluteDir)
      .map((file) => {
        const source = stripTypeScriptComments(readFileSync(file, "utf-8"));
        return {
          file,
          packageName: workspacePackage.name,
          source,
          maskedSource: maskTypeScriptStringLiterals(source),
        };
      })
      .filter(({ maskedSource }) => /\bcreateApp\s*\(/.test(maskedSource)),
  );

  if (appSourceFiles.length === 0) {
    return {
      id: checkId,
      title: "HTTP security middleware contract",
      status: "skipped",
      diagnostics: [],
      note: "No @croco/transports-http createApp source was discovered.",
    };
  }

  const diagnostics = appSourceFiles.flatMap(({ file, packageName, source, maskedSource }) =>
    extractCreateAppOptionSources(source, maskedSource).flatMap((optionsSlice) => {
      const middlewareSource = extractPropertyValueSource(
        optionsSlice.maskedSource,
        "middlewares",
        "[",
        "]",
      );
      const disabledDiagnostics =
        /securityValidation\s*:\s*["']off["']/.test(optionsSlice.source) ||
        /unsafeSkipSecurityValidation\s*:\s*true/.test(optionsSlice.source)
          ? [
              {
                code: CLI_DIAGNOSTIC_CODES.doctorHttpSecurityValidationDisabled,
                severity: "error" as const,
                checkId,
                cause: "The HTTP app disables security middleware validation.",
                location: {
                  file: toPosixPath(relative(rootDir, file)),
                  packageName,
                },
                action:
                  "Remove the securityValidation escape hatch and configure Croco security headers, CORS, body limit, and rate-limit middleware.",
              },
            ]
          : [];
      const missingMiddlewares = requiredHttpSecurityMiddleware.filter(
        (middlewareName) =>
          middlewareSource === null ||
          !hasRequiredHttpMiddlewareCall(middlewareName, middlewareSource, maskedSource),
      );
      const missingMiddlewareDiagnostics =
        missingMiddlewares.length > 0
          ? [
              {
                code: CLI_DIAGNOSTIC_CODES.doctorHttpSecurityMiddlewareMissing,
                severity: "error" as const,
                checkId,
                cause: `The HTTP app is missing required middleware: ${missingMiddlewares.join(", ")}.`,
                location: {
                  file: toPosixPath(relative(rootDir, file)),
                  packageName,
                },
                action:
                  "Add the missing middleware to createApp({ middlewares: [...] }) before deployment.",
              },
            ]
          : [];

      return [...disabledDiagnostics, ...missingMiddlewareDiagnostics];
    }),
  );

  return {
    id: checkId,
    title: "HTTP security middleware contract",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note:
      diagnostics.length > 0
        ? `${diagnostics.length} HTTP security contract issue(s) found.`
        : `${appSourceFiles.length} HTTP app factory file(s) include the required security middleware.`,
  };
}

function diGraphBootstrapCheck(rootDir: string): DoctorCheckResult {
  const checkId = "di-graph-bootstrap";
  const manifestPath = join(rootDir, defaultDiGraphManifestPath);

  if (!existsSync(manifestPath)) {
    return {
      id: checkId,
      title: "DI graph bootstrap errors",
      status: "skipped",
      diagnostics: [],
      note: `${defaultDiGraphManifestPath} was not found.`,
    };
  }

  const manifest = readJsonObject(manifestPath);
  if (manifest.kind === "invalid" || !isRecord(manifest.value)) {
    return {
      id: checkId,
      title: "DI graph bootstrap errors",
      status: "fail",
      diagnostics: [
        {
          code: CLI_DIAGNOSTIC_CODES.doctorDiGraphManifestInvalid,
          severity: "error",
          checkId,
          cause:
            manifest.kind === "invalid"
              ? `${defaultDiGraphManifestPath} could not be parsed: ${manifest.message}`
              : `${defaultDiGraphManifestPath} must be a JSON object.`,
          location: { file: defaultDiGraphManifestPath },
          action: "Regenerate the DI graph manifest and rerun croco doctor.",
        },
      ],
    };
  }

  const manifestDiagnostics = readDiagnosticRecords(manifest.value.diagnostics);
  const manifestErrors = manifestDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );
  const failedWithoutDiagnostics =
    manifest.value.status === "failed" && manifestDiagnostics.length === 0;
  const diagnostics = [
    ...manifestErrors.map((diagnostic) => ({
      code: CLI_DIAGNOSTIC_CODES.doctorDiBootstrapErrors,
      severity: "error" as const,
      checkId,
      cause: `DI graph reports ${diagnostic.code}: ${diagnostic.message}`,
      location: { file: defaultDiGraphManifestPath },
      action:
        "Register the missing provider, fix the DI cycle/scope mismatch, then regenerate the DI graph manifest.",
    })),
    ...(failedWithoutDiagnostics
      ? [
          {
            code: CLI_DIAGNOSTIC_CODES.doctorDiBootstrapErrors,
            severity: "error" as const,
            checkId,
            cause: "DI graph manifest status is failed but it does not include diagnostics.",
            location: { file: defaultDiGraphManifestPath },
            action: "Regenerate the DI graph manifest so bootstrap diagnostics are inspectable.",
          },
        ]
      : []),
  ];

  return {
    id: checkId,
    title: "DI graph bootstrap errors",
    status: diagnostics.length > 0 ? "fail" : "pass",
    diagnostics,
    note:
      diagnostics.length > 0
        ? `${diagnostics.length} DI bootstrap error(s) found.`
        : `${manifestDiagnostics.length} DI diagnostic(s) recorded with no errors.`,
  };
}

function providerCertificationCheck(
  rootDir: string,
  packages: readonly DoctorPackage[],
): DoctorCheckResult {
  const checkId = "provider-certification";
  const manifestPath = join(rootDir, defaultProviderProfileManifestPath);

  if (!existsSync(manifestPath)) {
    return {
      id: checkId,
      title: "Provider certification gaps",
      status: "skipped",
      diagnostics: [],
      note: `${defaultProviderProfileManifestPath} was not found.`,
    };
  }

  const manifest = readJsonObject(manifestPath);
  if (manifest.kind === "invalid" || !isProviderProfileManifestRecord(manifest.value)) {
    return {
      id: checkId,
      title: "Provider certification gaps",
      status: "fail",
      diagnostics: [
        {
          code: CLI_DIAGNOSTIC_CODES.doctorProviderProfileInvalid,
          severity: "error",
          checkId,
          cause:
            manifest.kind === "invalid"
              ? `${defaultProviderProfileManifestPath} could not be parsed: ${manifest.message}`
              : `${defaultProviderProfileManifestPath} is not a croco.saas-provider-profile/v1 artifact.`,
          location: { file: defaultProviderProfileManifestPath },
          action: "Regenerate the provider profile artifacts and rerun croco doctor.",
        },
      ],
    };
  }

  const declaredPackages = new Set(
    collectDeclaredDependencies(rootDir, packages).map((dependency) => dependency.name),
  );
  const requiredPackages = [...readStringArray(manifest.value.packages)].sort(compareStrings);
  const missingPackages = requiredPackages.filter(
    (packageName) => !declaredPackages.has(packageName),
  );
  const capabilities = readCapabilityRecords(manifest.value.capabilities);
  const capabilityNames = new Set(capabilities.map((capability) => capability.capability));
  const missingCapabilities = requiredSaasProviderCapabilities.filter(
    (capability) => !capabilityNames.has(capability),
  );
  const documentedCapabilities = capabilities.filter(
    (capability) => capability.status === "documented",
  );

  const diagnostics = [
    ...missingPackages.map((packageName) => ({
      code: CLI_DIAGNOSTIC_CODES.doctorProviderPackageMissing,
      severity: "error" as const,
      checkId,
      cause: `Provider profile requires ${packageName}, but no package manifest declares it.`,
      location: { file: defaultProviderProfileManifestPath, packageName },
      action: "Add the required provider package dependency or regenerate the provider profile.",
    })),
    ...missingCapabilities.map((capability) => ({
      code: CLI_DIAGNOSTIC_CODES.doctorProviderCertificationGap,
      severity: "error" as const,
      checkId,
      cause: `Provider profile is missing required capability '${capability}'.`,
      location: { file: defaultProviderProfileManifestPath },
      action: "Regenerate the provider profile from a certified profile definition.",
    })),
    ...documentedCapabilities.map((capability) => ({
      code: CLI_DIAGNOSTIC_CODES.doctorProviderCertificationDocumented,
      severity: "warning" as const,
      checkId,
      cause: `Provider capability '${capability.capability}' is documented for ${capability.provider}, not zero-credential configured.`,
      location: { file: defaultProviderProfileManifestPath },
      action:
        "Run the documented real-provider smoke only after provider credentials are configured.",
    })),
  ];
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "error");

  return {
    id: checkId,
    title: "Provider certification gaps",
    status: hasErrors ? "fail" : "pass",
    diagnostics,
    note:
      diagnostics.length > 0
        ? `${diagnostics.length} provider certification diagnostic(s) found.`
        : `${capabilities.length} provider capability declaration(s) are complete.`,
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

function hasRequiredHttpMiddlewareCall(
  middlewareName: string,
  middlewareSource: string,
  fileSource: string,
): boolean {
  if (new RegExp(`\\b${escapeRegExp(middlewareName)}\\s*\\(`).test(middlewareSource)) {
    return true;
  }

  return extractFunctionCallNames(middlewareSource).some((functionName) => {
    const functionBody = extractNamedFunctionBody(fileSource, functionName);
    return Boolean(
      functionBody && new RegExp(`\\b${escapeRegExp(middlewareName)}\\s*\\(`).test(functionBody),
    );
  });
}

function extractFunctionCallNames(source: string): string[] {
  const names: string[] = [];
  const pattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    names.push(match[1]);
  }

  return uniqueStrings(names);
}

function extractNamedFunctionBody(source: string, functionName: string): string | null {
  const pattern = new RegExp(`\\bfunction\\s+${escapeRegExp(functionName)}\\s*\\(`, "g");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const bodyStart = source.indexOf("{", match.index);
    if (bodyStart === -1) {
      continue;
    }

    const bodyEnd = findBalancedDelimitedEnd(source, bodyStart, "{", "}");
    return bodyEnd === null ? source.slice(bodyStart) : source.slice(bodyStart, bodyEnd + 1);
  }

  return null;
}

function extractCreateAppOptionSources(
  source: string,
  maskedSource: string = source,
): SourceSlice[] {
  const optionSources: SourceSlice[] = [];
  const createAppPattern = /\bcreateApp\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = createAppPattern.exec(maskedSource)) !== null) {
    const callStart = maskedSource.indexOf("(", match.index);
    const callEnd = findBalancedDelimitedEnd(maskedSource, callStart, "(", ")");
    if (callEnd === null) {
      continue;
    }

    const callArguments = source.slice(callStart + 1, callEnd);
    const maskedCallArguments = maskedSource.slice(callStart + 1, callEnd);
    const objectStart = maskedCallArguments.indexOf("{");
    if (objectStart === -1) {
      optionSources.push({ source: "", maskedSource: "" });
      continue;
    }

    const objectEnd = findBalancedDelimitedEnd(maskedCallArguments, objectStart, "{", "}");
    if (objectEnd === null) {
      optionSources.push({
        source: callArguments.slice(objectStart),
        maskedSource: maskedCallArguments.slice(objectStart),
      });
      continue;
    }

    optionSources.push({
      source: callArguments.slice(objectStart, objectEnd + 1),
      maskedSource: maskedCallArguments.slice(objectStart, objectEnd + 1),
    });
  }

  return optionSources;
}

function extractPropertyValueSource(
  source: string,
  propertyName: string,
  openDelimiter: string,
  closeDelimiter: string,
): string | null {
  const propertyMatch = new RegExp(`\\b${propertyName}\\s*:`).exec(source);
  if (!propertyMatch || propertyMatch.index === undefined) {
    return null;
  }

  const valueStart = skipWhitespace(source, propertyMatch.index + propertyMatch[0].length);
  if (source[valueStart] !== openDelimiter) {
    return null;
  }

  const valueEnd = findBalancedDelimitedEnd(source, valueStart, openDelimiter, closeDelimiter);
  return valueEnd === null ? null : source.slice(valueStart, valueEnd + 1);
}

function skipWhitespace(source: string, startIndex: number): number {
  let index = startIndex;
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }

  return index;
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
  return findBalancedDelimitedEnd(source, startIndex, "{", "}");
}

function findBalancedDelimitedEnd(
  source: string,
  startIndex: number,
  openDelimiter: string,
  closeDelimiter: string,
): number | null {
  let depth = 0;
  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === openDelimiter) {
      depth += 1;
      continue;
    }

    if (character === closeDelimiter) {
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

function maskTypeScriptStringLiterals(source: string): string {
  let masked = "";
  let quote: "'" | '"' | "`" | null = null;
  let escaping = false;

  for (const character of source) {
    if (quote === null) {
      if (character === "'" || character === '"' || character === "`") {
        quote = character;
        masked += character;
        continue;
      }

      masked += character;
      continue;
    }

    if (escaping) {
      escaping = false;
      masked += " ";
      continue;
    }

    if (character === "\\") {
      escaping = true;
      masked += " ";
      continue;
    }

    if (character === quote) {
      quote = null;
      masked += character;
      continue;
    }

    masked += character === "\n" || character === "\r" ? character : " ";
  }

  return masked;
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
        version: typeof parsed.version === "string" ? parsed.version : null,
        absoluteDir,
        relativeDir: toPosixPath(relative(rootDir, absoluteDir)),
        dependencies: readPackageDependencies(parsed, absoluteDir, parsed.name),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPackageDependencies(
  manifest: Record<string, unknown>,
  importerDir: string,
  importerName: string,
): DoctorPackageDependency[] {
  return packageDependencyFields.flatMap((field) => {
    const dependencies = manifest[field];
    if (!isRecord(dependencies)) {
      return [];
    }

    return Object.entries(dependencies).flatMap(([name, range]) =>
      typeof range === "string" ? [{ name, range, field, importerDir, importerName }] : [],
    );
  });
}

function collectDeclaredDependencies(
  rootDir: string,
  packages: readonly DoctorPackage[],
): DoctorPackageDependency[] {
  const rootPackage = readJsonObject(join(rootDir, "package.json"));
  const rootDependencies =
    rootPackage.kind === "valid" && isRecord(rootPackage.value)
      ? readPackageDependencies(rootPackage.value, rootDir, readPackageName(rootPackage.value))
      : [];

  return [
    ...rootDependencies,
    ...packages.flatMap((workspacePackage) => workspacePackage.dependencies),
  ];
}

function readPackageName(manifest: Record<string, unknown>): string {
  return typeof manifest.name === "string" ? manifest.name : "<workspace-root>";
}

function findInstalledPackage(
  dependency: DoctorPackageDependency,
  rootDir: string,
): { readonly packageDir: string; readonly packageJsonPath: string } | null {
  for (const baseDir of uniqueStrings([dependency.importerDir, rootDir])) {
    const packageDir = join(baseDir, "node_modules", ...dependency.name.split("/"));
    const packageJsonPath = join(packageDir, "package.json");

    if (existsSync(packageJsonPath)) {
      return { packageDir, packageJsonPath };
    }
  }

  return null;
}

function uniqueStrings(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function uniqueDependencyByName(
  dependency: DoctorPackageDependency,
  index: number,
  dependencies: readonly DoctorPackageDependency[],
): boolean {
  return dependencies.findIndex((candidate) => candidate.name === dependency.name) === index;
}

function isWorkspaceConsistentRange(
  dependency: DoctorPackageDependency,
  workspacePackages: ReadonlyMap<string, DoctorPackage>,
): boolean {
  if (dependency.range.startsWith("workspace:")) {
    return true;
  }

  const workspacePackage = workspacePackages.get(dependency.name);
  return Boolean(workspacePackage?.version && dependency.range === workspacePackage.version);
}

function readPackageBuildTargets(manifest: Record<string, unknown>): string[] {
  const publishConfig = isRecord(manifest.publishConfig) ? manifest.publishConfig : {};
  return uniqueStrings([
    ...readManifestBuildTargets(manifest),
    ...readManifestBuildTargets(publishConfig),
  ]);
}

function readManifestBuildTargets(manifest: Record<string, unknown>): string[] {
  return [
    readOptionalString(manifest.main),
    readOptionalString(manifest.module),
    readOptionalString(manifest.types),
    ...readExportTargets(manifest.exports),
  ].filter((target): target is string => target !== null);
}

function readExportTargets(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(readExportTargets);
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.values(value).flatMap(readExportTargets);
}

function runProblemRegistryDriftCheck(rootDir: string, checkId: string): DoctorDiagnostic | null {
  const command = resolvePackageManagerCommand();
  const result = spawnSync(command.command, command.args, {
    cwd: rootDir,
    encoding: "utf-8",
    timeout: problemRegistryCheckTimeoutMs,
  });
  const commandText = [command.command, ...command.args].join(" ");

  if (result.error) {
    const errorCode = readNodeErrorCode(result.error);
    const timedOut = errorCode === "ETIMEDOUT";
    return {
      code: timedOut
        ? CLI_DIAGNOSTIC_CODES.doctorProblemRegistryCheckTimeout
        : CLI_DIAGNOSTIC_CODES.doctorProblemRegistryCheckFailed,
      severity: "error",
      checkId,
      cause: `${commandText} could not complete: ${result.error.message}`,
      location: { file: "package.json" },
      action: timedOut
        ? "Run pnpm problem-registry:check manually, fix the timeout, then rerun croco doctor."
        : "Ensure pnpm is available, run pnpm problem-registry:check manually, then rerun croco doctor.",
    };
  }

  if (result.status !== 0) {
    const output = formatCommandOutput(result.stdout, result.stderr);
    const status =
      result.status === null ? `signal ${result.signal ?? "unknown"}` : `exit ${result.status}`;
    return {
      code: CLI_DIAGNOSTIC_CODES.doctorProblemRegistryDrift,
      severity: "error",
      checkId,
      cause: `${commandText} failed with ${status}${output ? `: ${output}` : "."}`,
      location: { file: defaultProblemRegistryPath },
      action:
        "Run pnpm problem-registry:write, commit the generated artifacts, then rerun croco doctor.",
    };
  }

  return null;
}

function resolvePackageManagerCommand(): {
  readonly command: string;
  readonly args: readonly string[];
} {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath?.includes("pnpm")) {
    return {
      command: process.execPath,
      args: [npmExecPath, "run", "problem-registry:check"],
    };
  }

  return {
    command: "pnpm",
    args: ["run", "problem-registry:check"],
  };
}

function readNodeErrorCode(error: Error): string | null {
  const nodeError = error as Error & { readonly code?: unknown };
  return typeof nodeError.code === "string" ? nodeError.code : null;
}

function formatCommandOutput(stdout: string | null, stderr: string | null): string {
  const output = [stdout, stderr]
    .filter((chunk): chunk is string => Boolean(chunk))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();

  return output.length > commandOutputMaxLength
    ? `${output.slice(0, commandOutputMaxLength)}...`
    : output;
}

function readRootScripts(rootDir: string): Record<string, string> {
  const rootPackage = readJsonObject(join(rootDir, "package.json"));
  if (rootPackage.kind === "invalid" || !isRecord(rootPackage.value)) {
    return {};
  }

  const scripts = rootPackage.value.scripts;
  if (!isRecord(scripts)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(scripts).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function hasAnyScript(
  scripts: Readonly<Record<string, string>>,
  scriptNames: readonly string[],
): boolean {
  return scriptNames.some((scriptName) => Boolean(scripts[scriptName]));
}

function readJsonObject(
  path: string,
):
  | { readonly kind: "valid"; readonly value: Record<string, unknown> }
  | { readonly kind: "invalid"; readonly message: string } {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    if (!isRecord(parsed)) {
      return { kind: "invalid", message: "JSON value must be an object." };
    }

    return { kind: "valid", value: parsed };
  } catch (error) {
    return {
      kind: "invalid",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function isContractGraphSnapshotRecord(value: Record<string, unknown>): boolean {
  return (
    value.snapshotVersion === "croco.contract-graph.snapshot.v1" &&
    value.graphVersion === "croco.contract-graph.v1" &&
    Array.isArray(value.controllers) &&
    Array.isArray(value.routes) &&
    Array.isArray(value.diagnostics)
  );
}

function isProblemCodeRegistryRecord(value: Record<string, unknown>): boolean {
  if (value.version !== "croco.problem-code-registry.v1" || !Array.isArray(value.problems)) {
    return false;
  }

  return typeof value.problemCount !== "number" || value.problemCount === value.problems.length;
}

function isRuntimeCapabilityManifestRecord(value: Record<string, unknown>): boolean {
  if (value.version === "croco.runtime-capability.manifest.v1") {
    return (
      typeof value.platform === "string" &&
      isRecord(value.capabilities) &&
      Array.isArray(value.diagnostics)
    );
  }

  const runtime = isRecord(value.runtime) ? value.runtime : null;
  const table = isRecord(value.table) ? value.table : null;

  return (
    (value.schemaVersion === "croco.runtime-policy/v1" ||
      value.version === "croco.runtime-policy/v1") &&
    typeof runtime?.platform === "string" &&
    Array.isArray(table?.plans)
  );
}

function readRuntimePlatform(value: Record<string, unknown>): string {
  if (typeof value.platform === "string") {
    return value.platform;
  }

  const runtime = isRecord(value.runtime) ? value.runtime : null;
  return readOptionalString(runtime?.platform) ?? "unknown";
}

function isProviderProfileManifestRecord(value: Record<string, unknown>): boolean {
  return (
    value.schemaVersion === "croco.saas-provider-profile/v1" &&
    isRecord(value.profile) &&
    typeof value.profile.name === "string" &&
    Array.isArray(value.packages) &&
    Array.isArray(value.capabilities)
  );
}

function readDiagnosticRecords(value: unknown): Array<{
  readonly code: string;
  readonly severity: DoctorSeverity;
  readonly message: string;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    return [
      {
        code: readOptionalString(entry.code) ?? "unknown",
        severity: entry.severity === "warning" ? "warning" : "error",
        message: readOptionalString(entry.message) ?? "No diagnostic message was provided.",
      },
    ];
  });
}

function readCapabilityRecords(value: unknown): Array<{
  readonly capability: string;
  readonly provider: string;
  readonly status: string;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const capability = readOptionalString(entry.capability);
    const provider = readOptionalString(entry.provider);
    const status = readOptionalString(entry.status);

    return capability && provider && status ? [{ capability, provider, status }] : [];
  });
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function readNumber(value: Record<string, unknown>, key: string, fallback: number): number {
  const result = value[key];
  return typeof result === "number" ? result : fallback;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
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

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
