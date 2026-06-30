import type { DiagnosticCode } from "@croco/diagnostics-core";
import type { ProblemOptions } from "@croco/problems-core";

export const CLI_DIAGNOSTIC_CODES = {
  doctorWorkspaceNotFound: "CROCO_CLI_DOCTOR_001",
  doctorWorkspacePackagesEmpty: "CROCO_CLI_DOCTOR_002",
  doctorWorkspacePackageInvalid: "CROCO_CLI_DOCTOR_003",
  doctorRepositoryCoreDrizzleBoundary: "CROCO_CLI_DOCTOR_004",
  doctorLambdaTelemetryFlushMissing: "CROCO_CLI_DOCTOR_005",
  doctorWorkspaceVersionInconsistent: "CROCO_CLI_DOCTOR_006",
  doctorSpinePackageMissing: "CROCO_CLI_DOCTOR_007",
  doctorSpinePackageUnbuilt: "CROCO_CLI_DOCTOR_008",
  doctorContractGraphMissing: "CROCO_CLI_DOCTOR_009",
  doctorContractGraphInvalid: "CROCO_CLI_DOCTOR_010",
  doctorContractGraphErrors: "CROCO_CLI_DOCTOR_011",
  doctorProblemRegistryMissing: "CROCO_CLI_DOCTOR_012",
  doctorProblemRegistryInvalid: "CROCO_CLI_DOCTOR_013",
  doctorProblemRegistryDrift: "CROCO_CLI_DOCTOR_014",
  doctorRuntimeCapabilityManifestMissing: "CROCO_CLI_DOCTOR_015",
  doctorRuntimeCapabilityManifestInvalid: "CROCO_CLI_DOCTOR_016",
  doctorHttpSecurityValidationDisabled: "CROCO_CLI_DOCTOR_017",
  doctorHttpSecurityMiddlewareMissing: "CROCO_CLI_DOCTOR_018",
  doctorDiGraphManifestMissing: "CROCO_CLI_DOCTOR_019",
  doctorDiGraphBootstrapFailed: "CROCO_CLI_DOCTOR_020",
  doctorProviderCertificationGap: "CROCO_CLI_DOCTOR_021",
  usageDashboardTenantRequired: "CROCO_CLI_USAGE_DASHBOARD_001",
  usageDashboardTenantNotFound: "CROCO_CLI_USAGE_DASHBOARD_002",
  usageDashboardMeterNotFound: "CROCO_CLI_USAGE_DASHBOARD_003",
  usageDashboardProviderUnavailable: "CROCO_CLI_USAGE_DASHBOARD_004",
  opsInvalidTargetUrl: "CROCO_CLI_OPS_001",
  opsInvalidTimeout: "CROCO_CLI_OPS_002",
  jobsInvalidTargetUrl: "CROCO_CLI_JOBS_001",
  jobsInvalidNumber: "CROCO_CLI_JOBS_002",
  jobsMissingTargetUrl: "CROCO_CLI_JOBS_003",
  jobsHttpError: "CROCO_CLI_JOBS_004",
  jobsEndpointNotFound: "CROCO_CLI_JOBS_005",
  diCheckManifestInvalid: "CROCO_CLI_DI_CHECK_001",
  diCheckManifestFailed: "CROCO_CLI_DI_CHECK_002",
  diCheckDiagnosticUnknown: "CROCO_CLI_DI_CHECK_003",
  projectMapFrameworkManifestDiagnostic: "CROCO_CLI_PROJECT_MAP_001",
  projectMapContractRouteConflict: "CROCO_CLI_PROJECT_MAP_002",
  projectMapContractGraphDiagnostic: "CROCO_CLI_PROJECT_MAP_003",
  projectMapRuntimeTargetMissing: "CROCO_CLI_PROJECT_MAP_004",
  projectMapRuntimeTargetUnsupported: "CROCO_CLI_PROJECT_MAP_005",
  projectMapRuntimeCapabilityConflict: "CROCO_CLI_PROJECT_MAP_006",
  projectMapPackageManifestConflict: "CROCO_CLI_PROJECT_MAP_007",
  projectMapManifestMissing: "CROCO_CLI_PROJECT_MAP_008",
  projectMapManifestDrift: "CROCO_CLI_PROJECT_MAP_009",
} as const satisfies Record<string, DiagnosticCode>;

export const CLI_LEGACY_DIAGNOSTIC_CODES = {
  doctorWorkspaceNotFound: "doctor/workspace-not-found",
  doctorWorkspacePackagesEmpty: "doctor/workspace-packages-empty",
  doctorWorkspacePackageInvalid: "doctor/workspace-package-invalid",
  doctorRepositoryCoreDrizzleBoundary: "doctor/repository-core-drizzle-boundary",
  doctorLambdaTelemetryFlushMissing: "doctor/lambda-telemetry-flush-missing",
  doctorWorkspaceVersionInconsistent: "doctor/workspace-version-inconsistent",
  doctorSpinePackageMissing: "doctor/spine-package-missing",
  doctorSpinePackageUnbuilt: "doctor/spine-package-unbuilt",
  doctorContractGraphMissing: "doctor/contract-graph-missing",
  doctorContractGraphInvalid: "doctor/contract-graph-invalid",
  doctorContractGraphErrors: "doctor/contract-graph-errors",
  doctorProblemRegistryMissing: "doctor/problem-registry-missing",
  doctorProblemRegistryInvalid: "doctor/problem-registry-invalid",
  doctorProblemRegistryDrift: "doctor/problem-registry-drift",
  doctorRuntimeCapabilityManifestMissing: "doctor/runtime-capability-manifest-missing",
  doctorRuntimeCapabilityManifestInvalid: "doctor/runtime-capability-manifest-invalid",
  doctorHttpSecurityValidationDisabled: "doctor/http-security-validation-disabled",
  doctorHttpSecurityMiddlewareMissing: "doctor/http-security-middleware-missing",
  doctorDiGraphManifestMissing: "doctor/di-graph-manifest-missing",
  doctorDiGraphBootstrapFailed: "doctor/di-graph-bootstrap-failed",
  doctorProviderCertificationGap: "doctor/provider-certification-gap",
  usageDashboardTenantRequired: "usage-dashboard/tenant-required",
  usageDashboardTenantNotFound: "usage-dashboard/tenant-not-found",
  usageDashboardMeterNotFound: "usage-dashboard/meter-not-found",
  usageDashboardProviderUnavailable: "usage-dashboard/provider-unavailable",
  opsInvalidTargetUrl: "cli/invalid-ops-target-url",
  opsInvalidTimeout: "cli/invalid-ops-timeout",
  jobsInvalidTargetUrl: "cli/invalid-jobs-target-url",
  jobsInvalidNumber: "cli/invalid-jobs-number",
  jobsMissingTargetUrl: "cli/missing-jobs-target-url",
  jobsHttpError: "cli/jobs-http-error",
  jobsEndpointNotFound: "cli/jobs-endpoint-not-found",
  diCheckManifestInvalid: "cli/di-manifest-invalid",
  diCheckManifestFailed: "cli/di-manifest-failed",
  diCheckDiagnosticUnknown: "cli/di-diagnostic-unknown",
  projectMapContractRouteConflict: "project-map/contract-route-conflict",
  projectMapRuntimeTargetMissing: "project-map/runtime-target-missing",
  projectMapRuntimeTargetUnsupported: "project-map/runtime-target-unsupported",
  projectMapRuntimeCapabilityConflict: "project-map/runtime-capability-conflict",
  projectMapPackageManifestConflict: "project-map/package-manifest-conflict",
  projectMapManifestMissing: "project-map/manifest-missing",
  projectMapManifestDrift: "project-map/manifest-drift",
} as const satisfies Record<CliStaticLegacyDiagnosticKey, string>;

export type CliDiagnosticKey = keyof typeof CLI_DIAGNOSTIC_CODES;
export type CliDiagnosticCode = (typeof CLI_DIAGNOSTIC_CODES)[CliDiagnosticKey];
export type CliStaticLegacyDiagnosticKey = Exclude<
  CliDiagnosticKey,
  "projectMapFrameworkManifestDiagnostic" | "projectMapContractGraphDiagnostic"
>;

const LEGACY_TO_STABLE_DIAGNOSTIC_CODES = new Map<string, CliDiagnosticCode>();

for (const [key, legacyCode] of Object.entries(CLI_LEGACY_DIAGNOSTIC_CODES)) {
  if (!LEGACY_TO_STABLE_DIAGNOSTIC_CODES.has(legacyCode)) {
    LEGACY_TO_STABLE_DIAGNOSTIC_CODES.set(
      legacyCode,
      CLI_DIAGNOSTIC_CODES[key as CliStaticLegacyDiagnosticKey],
    );
  }
}

export function withLegacyCode(
  key: CliStaticLegacyDiagnosticKey,
  options: ProblemOptions = {},
): ProblemOptions {
  return withLegacyCodeValue(CLI_LEGACY_DIAGNOSTIC_CODES[key], options);
}

export function getStableCliDiagnosticCodeForLegacyCode(
  legacyCode: string,
): CliDiagnosticCode | undefined {
  return LEGACY_TO_STABLE_DIAGNOSTIC_CODES.get(legacyCode);
}

export function projectMapFrameworkManifestLegacyCode(sourceCode: string): string {
  return `project-map/framework-manifest-${sourceCode}`;
}

export function projectMapContractGraphLegacyCode(sourceCode: string): string {
  return `project-map/contract-graph-${sourceCode}`;
}

export function withLegacyCodeValue(
  legacyCode: string,
  options: ProblemOptions = {},
): ProblemOptions {
  return {
    ...options,
    extensions: {
      ...options.extensions,
      legacyCode,
    },
  };
}
