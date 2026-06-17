import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import type { LifecycleRun, LifecycleRunStatus, LifecycleRunStore } from "../types";

const DEFAULT_RUN_LIMIT = 20;
const RUN_STATUSES: readonly LifecycleRunStatus[] = ["succeeded", "failed", "skipped"];

export type LifecycleDiagnosticsRunDetails = {
  readonly id: string;
  readonly ruleId: string;
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

export type LifecycleDiagnosticsDetails = {
  readonly runCount: number;
  readonly runsByStatus: Record<LifecycleRunStatus, number>;
  readonly failedRunCount: number;
  readonly failedActionCount: number;
  readonly latestRuns: readonly LifecycleDiagnosticsRunDetails[];
};

export type LifecycleDiagnosticsProviderOptions = {
  readonly runLimit?: number;
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
    const status = runsByStatus.failed > 0 || failedActionCount > 0 ? "degraded" : "healthy";

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
        latestRuns: latestRuns.map(summarizeRun),
      } satisfies LifecycleDiagnosticsDetails,
      lastChecked: new Date().toISOString(),
    };
  }
}
