import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import type { LifecycleRuleRegistry } from "../LifecycleRuleRegistry";
import type {
  LifecycleDryRunStore,
  LifecycleRuleInspection,
  LifecycleRun,
  LifecycleRunStatus,
  LifecycleRunStore,
} from "../types";

const DEFAULT_RUN_LIMIT = 20;
const RUN_STATUSES: readonly LifecycleRunStatus[] = ["succeeded", "failed", "skipped"];

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
};

export type LifecycleDiagnosticsProviderOptions = {
  readonly runLimit?: number;
  readonly dryRunLimit?: number;
  readonly registry?: LifecycleRuleRegistry;
  readonly dryRunStore?: LifecycleDryRunStore;
};

function createStatusCounts(runs: readonly LifecycleRun[]): Record<LifecycleRunStatus, number> {
  return Object.fromEntries(
    RUN_STATUSES.map((status) => [status, runs.filter((run) => run.status === status).length]),
  ) as Record<LifecycleRunStatus, number>;
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
    const recentDryRuns = (
      this.options.dryRunStore?.list({
        limit: this.options.dryRunLimit ?? DEFAULT_RUN_LIMIT,
      }) ?? []
    ).map((result) => ({
      ruleId: result.ruleId,
      ruleVersion: result.ruleVersion,
      state: result.state,
      matched: result.matched,
      suppressed: result.suppression.suppressed,
      problemCodes: result.problems.map((problem) => problem.code),
      evaluatedAt: result.evaluatedAt.toISOString(),
    }));
    const status =
      runsByStatus.failed > 0 ||
      failedActionCount > 0 ||
      unavailableRegistrations.length > 0 ||
      versionMismatchCount > 0
        ? "degraded"
        : "healthy";

    return {
      status,
      component: "lifecycle",
      ...(status === "degraded"
        ? {
            message: `${runsByStatus.failed} lifecycle run(s) and ${failedActionCount} action(s) need attention`,
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
      } satisfies LifecycleDiagnosticsDetails,
      lastChecked: new Date().toISOString(),
    };
  }
}
