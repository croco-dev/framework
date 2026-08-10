import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import type { LifecycleRuleRegistry } from "../LifecycleRuleRegistry";
import { MONETIZATION_SIGNAL_DESCRIPTORS } from "../monetization";
import { validateMonetizationRecipeCapabilities } from "../monetization";
import type {
  MonetizationCapabilitySource,
  MonetizationRecipeCapabilityDiagnostic,
  MonetizationRecipeDefinition,
  MonetizationSignalType,
  MonetizationThresholdStore,
} from "../monetization";
import type {
  LifecycleDryRunStore,
  LifecycleRuleInspection,
  LifecycleRun,
  LifecycleRunStatus,
  LifecycleRunStore,
} from "../types";

const DEFAULT_RUN_LIMIT = 20;
const DEFAULT_MONETIZATION_DIAGNOSTICS_TIMEOUT_MS = 5_000;
const RUN_STATUSES: readonly LifecycleRunStatus[] = [
  "indeterminate",
  "succeeded",
  "failed",
  "skipped",
];

export type LifecycleDiagnosticsRunDetails = {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly ruleFingerprint: string;
  readonly tenantId: string;
  readonly signalType: string;
  readonly status: LifecycleRunStatus;
  readonly severity: string;
  readonly skipReason?: string;
  readonly actionCount: number;
  readonly failedActionCount: number;
  readonly completedAt: string;
  readonly errorMessage?: string;
};

export type LifecycleDiagnosticsDryRunDetails = {
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly state: string;
  readonly matched: boolean;
  readonly suppressed: boolean;
  readonly problemCodes: readonly string[];
  readonly evaluatedAt: string;
};

export type LifecycleDiagnosticsDetails = {
  readonly runCount: number;
  readonly runsByStatus: Record<LifecycleRunStatus, number>;
  readonly failedRunCount: number;
  readonly failedActionCount: number;
  readonly activeVersions: readonly LifecycleRuleInspection[];
  readonly pausedRules: readonly LifecycleRuleInspection[];
  readonly unavailableRegistrations: readonly LifecycleRuleInspection[];
  readonly versionMismatchCount: number;
  readonly recentDryRuns: readonly LifecycleDiagnosticsDryRunDetails[];
  readonly latestRuns: readonly LifecycleDiagnosticsRunDetails[];
  readonly monetizationSignalsByType: Readonly<Partial<Record<MonetizationSignalType, number>>>;
  readonly suppressedMonetizationCrossingCount: number;
  readonly expiredMonetizationThresholdClaimCount: number;
  readonly latestMonetizationRecovery: {
    readonly signalId?: string;
    readonly status: LifecycleRunStatus;
    readonly completedAt: string;
  } | null;
  readonly monetizationCapabilityDiagnostics: readonly MonetizationRecipeCapabilityDiagnostic[];
  readonly monetizationOperationalDiagnostics: readonly LifecycleMonetizationOperationalDiagnostic[];
};

export type LifecycleMonetizationOperationalDiagnostic = {
  readonly code:
    | "lifecycle-core/monetization-capability-source-missing"
    | "lifecycle-core/monetization-capability-source-failed"
    | "lifecycle-core/monetization-capability-source-timeout"
    | "lifecycle-core/monetization-threshold-diagnostics-failed"
    | "lifecycle-core/monetization-threshold-diagnostics-timeout";
  readonly message: string;
  readonly cause?: string;
};

export type LifecycleDiagnosticsProviderOptions = {
  readonly runLimit?: number;
  readonly dryRunLimit?: number;
  readonly registry?: LifecycleRuleRegistry;
  readonly dryRunStore?: LifecycleDryRunStore;
  readonly monetizationThresholdStore?: MonetizationThresholdStore;
  readonly monetizationRecipes?: readonly MonetizationRecipeDefinition[];
  readonly monetizationCapabilitySource?: MonetizationCapabilitySource;
  readonly monetizationDiagnosticsTimeoutMs?: number;
};

function createStatusCounts(runs: readonly LifecycleRun[]): Record<LifecycleRunStatus, number> {
  return Object.fromEntries(
    RUN_STATUSES.map((status) => [status, runs.filter((run) => run.status === status).length]),
  ) as Record<LifecycleRunStatus, number>;
}

const MONETIZATION_SIGNAL_TYPES = new Set<MonetizationSignalType>(
  MONETIZATION_SIGNAL_DESCRIPTORS.map((descriptor) => descriptor.type),
);

function isMonetizationSignalType(signalType: string): signalType is MonetizationSignalType {
  return (MONETIZATION_SIGNAL_TYPES as ReadonlySet<string>).has(signalType);
}

type DiagnosticOperationResult<T> =
  | { readonly value: T; readonly diagnostic?: never }
  | { readonly value?: never; readonly diagnostic: LifecycleMonetizationOperationalDiagnostic };

async function runDiagnosticOperation<T>(
  operation: () => T | Promise<T>,
  timeoutMs: number,
  codes: {
    readonly failed: LifecycleMonetizationOperationalDiagnostic["code"];
    readonly timeout: LifecycleMonetizationOperationalDiagnostic["code"];
  },
  name: string,
): Promise<DiagnosticOperationResult<T>> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve()
        .then(operation)
        .then((value) => ({ value }) as const),
      new Promise<DiagnosticOperationResult<T>>((resolve) => {
        timeout = setTimeout(
          () =>
            resolve({
              diagnostic: {
                code: codes.timeout,
                message: `${name} exceeded the ${timeoutMs}ms diagnostics deadline`,
              },
            }),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    return {
      diagnostic: {
        code: codes.failed,
        message: `${name} failed`,
        cause: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function summarizeRun(run: LifecycleRun): LifecycleDiagnosticsRunDetails {
  const failedActionCount = run.actionResults.filter(
    (result) => result.status === "failure",
  ).length;

  return {
    id: run.id,
    ruleId: run.ruleId,
    ruleVersion: run.ruleVersion,
    ruleFingerprint: run.ruleFingerprint,
    tenantId: run.tenantId,
    signalType: run.signalType,
    status: run.status,
    severity: run.severity,
    skipReason: run.skipReason,
    actionCount: run.actionResults.length,
    failedActionCount,
    completedAt: run.completedAt.toISOString(),
    errorMessage: run.error?.message,
  };
}

export class LifecycleDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "lifecycle";

  constructor(
    private readonly runStore: LifecycleRunStore,
    private readonly options: LifecycleDiagnosticsProviderOptions = {},
  ) {}

  async getHealth(_signal?: AbortSignal): Promise<HealthStatus> {
    const limit = this.options.runLimit ?? DEFAULT_RUN_LIMIT;
    const runs = await this.runStore.list();
    const latestRuns = await this.runStore.list({ limit });
    const runsByStatus = createStatusCounts(runs);
    const failedActionCount = runs.reduce(
      (count, run) =>
        count + run.actionResults.filter((result) => result.status === "failure").length,
      0,
    );
    const inspections = (await this.options.registry?.inspect()) ?? [];
    const activeVersions = inspections.filter((rule) => rule.state === "active");
    const pausedRules = inspections.filter((rule) => rule.state === "paused");
    const unavailableRegistrations = inspections.filter((rule) => rule.state === "unavailable");
    const versionMismatchCount =
      this.options.registry === undefined
        ? 0
        : runs.filter((run) => {
            const registration = this.options.registry?.getRegistration(
              run.ruleId,
              run.ruleVersion,
            );
            return (
              registration === undefined ||
              registration.descriptor.fingerprint !== run.ruleFingerprint
            );
          }).length;
    const dryRunResults =
      (await this.options.dryRunStore?.list({
        limit: this.options.dryRunLimit ?? DEFAULT_RUN_LIMIT,
      })) ?? [];
    const recentDryRuns = dryRunResults.map((result) => ({
      ruleId: result.ruleId,
      ruleVersion: result.ruleVersion,
      state: result.state,
      matched: result.matched,
      suppressed: result.suppression.suppressed,
      problemCodes: result.problems.map((problem) => problem.code),
      evaluatedAt: result.evaluatedAt.toISOString(),
    }));
    const monetizationRuns = runs.filter((run) => isMonetizationSignalType(run.signalType));
    const uniqueMonetizationSignals = [
      ...new Map(
        monetizationRuns.map((run) => [`${run.signalType}:${run.signalId ?? run.id}`, run]),
      ).values(),
    ];
    const monetizationSignalsByType = Object.fromEntries(
      [...new Set(uniqueMonetizationSignals.map((run) => run.signalType))]
        .sort()
        .map((signalType) => [
          signalType,
          uniqueMonetizationSignals.filter((run) => run.signalType === signalType).length,
        ]),
    );
    const diagnosticsTimeoutMs =
      this.options.monetizationDiagnosticsTimeoutMs ?? DEFAULT_MONETIZATION_DIAGNOSTICS_TIMEOUT_MS;
    const [thresholdResult, capabilityResult] = await Promise.all([
      this.options.monetizationThresholdStore
        ? runDiagnosticOperation(
            () => this.options.monetizationThresholdStore?.getDiagnostics(),
            diagnosticsTimeoutMs,
            {
              failed: "lifecycle-core/monetization-threshold-diagnostics-failed",
              timeout: "lifecycle-core/monetization-threshold-diagnostics-timeout",
            },
            "Monetization threshold diagnostics",
          )
        : Promise.resolve(undefined),
      this.options.monetizationCapabilitySource
        ? runDiagnosticOperation(
            () => this.options.monetizationCapabilitySource?.getCapabilities(),
            diagnosticsTimeoutMs,
            {
              failed: "lifecycle-core/monetization-capability-source-failed",
              timeout: "lifecycle-core/monetization-capability-source-timeout",
            },
            "Monetization capability discovery",
          )
        : Promise.resolve(undefined),
    ]);
    const thresholdDiagnostics = thresholdResult?.value;
    const latestRecoveryRun = monetizationRuns
      .filter((run) => run.signalType === "billing.subscription.recovered")
      .sort((left, right) => right.completedAt.getTime() - left.completedAt.getTime())[0];
    const monetizationCapabilities = capabilityResult?.value;
    const monetizationCapabilityDiagnostics =
      monetizationCapabilities === undefined
        ? []
        : (this.options.monetizationRecipes ?? []).flatMap((recipe) =>
            validateMonetizationRecipeCapabilities(recipe, monetizationCapabilities),
          );
    const monetizationOperationalDiagnostics = [
      ...(thresholdResult?.diagnostic ? [thresholdResult.diagnostic] : []),
      ...(capabilityResult?.diagnostic ? [capabilityResult.diagnostic] : []),
      ...((this.options.monetizationRecipes?.length ?? 0) > 0 &&
      this.options.monetizationCapabilitySource === undefined
        ? [
            {
              code: "lifecycle-core/monetization-capability-source-missing" as const,
              message: "Monetization recipes are configured without a capability source",
            },
          ]
        : []),
    ];
    const status =
      runsByStatus.indeterminate > 0 ||
      runsByStatus.failed > 0 ||
      failedActionCount > 0 ||
      unavailableRegistrations.length > 0 ||
      versionMismatchCount > 0 ||
      monetizationCapabilityDiagnostics.length > 0 ||
      monetizationOperationalDiagnostics.length > 0
        ? "degraded"
        : "healthy";

    return {
      status,
      component: "lifecycle",
      ...(status === "degraded"
        ? {
            message: `${runsByStatus.indeterminate} indeterminate lifecycle dispatch(es), ${runsByStatus.failed} failed lifecycle run(s), ${failedActionCount} failed action(s), ${unavailableRegistrations.length} unavailable registration(s), ${versionMismatchCount} version mismatch(es), ${monetizationCapabilityDiagnostics.length} monetization capability mismatch(es), and ${monetizationOperationalDiagnostics.length} monetization diagnostics failure(s) need attention`,
          }
        : {}),
      details: {
        runCount: runs.length,
        runsByStatus,
        failedRunCount: runsByStatus.failed,
        failedActionCount,
        activeVersions,
        pausedRules,
        unavailableRegistrations,
        versionMismatchCount,
        recentDryRuns,
        latestRuns: latestRuns.map(summarizeRun),
        monetizationSignalsByType,
        suppressedMonetizationCrossingCount: thresholdDiagnostics?.suppressedDuplicateCount ?? 0,
        expiredMonetizationThresholdClaimCount: thresholdDiagnostics?.expiredClaimCount ?? 0,
        latestMonetizationRecovery: latestRecoveryRun
          ? {
              signalId: latestRecoveryRun.signalId,
              status: latestRecoveryRun.status,
              completedAt: latestRecoveryRun.completedAt.toISOString(),
            }
          : null,
        monetizationCapabilityDiagnostics,
        monetizationOperationalDiagnostics,
      } satisfies LifecycleDiagnosticsDetails,
      lastChecked: new Date().toISOString(),
    };
  }
}
