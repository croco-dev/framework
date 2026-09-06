import type {
  getJobExitCode as getJobExitCodeFn,
  getJobsListExitCode as getJobsListExitCodeFn,
  runJobsCancel as runJobsCancelFn,
  runJobsList as runJobsListFn,
  runJobsLogs as runJobsLogsFn,
  runJobsReplay as runJobsReplayFn,
  runJobsShow as runJobsShowFn,
} from "@croco/cli";
import { createCrocoApp } from "../app";
import { SaasDemoSmokeProblem } from "../problems";
import { getSaasRuntimeState, runSaasDemoFlow, type SaasRuntime } from "../saasDemo";
import { assertSaasSmokeContract } from "./saasSmokeContract";

type CliJobsModule = {
  getJobExitCode: typeof getJobExitCodeFn;
  getJobsListExitCode: typeof getJobsListExitCodeFn;
  runJobsCancel: typeof runJobsCancelFn;
  runJobsList: typeof runJobsListFn;
  runJobsLogs: typeof runJobsLogsFn;
  runJobsReplay: typeof runJobsReplayFn;
  runJobsShow: typeof runJobsShowFn;
};

const CLI_JOBS_MODULE = "@croco/cli/jobs";
const JOBS_BASE_URL = "http://localhost/ops";

async function main(): Promise<void> {
  const app = await createCrocoApp({ profileMode: "zero-credential" });
  try {
    const runtime = app.applicationRuntime.run(() => getSaasRuntimeState().current);
    const snapshot = await runSaasDemoFlow(runtime);
    assertSaasSmokeContract(snapshot);

    const failed = await seedFailedBillingSyncJob(runtime);
    const running = await seedRunningUsageRollupJob(runtime);
    const {
      getJobExitCode,
      getJobsListExitCode,
      runJobsCancel,
      runJobsList,
      runJobsLogs,
      runJobsReplay,
      runJobsShow,
    } = (await import(CLI_JOBS_MODULE)) as CliJobsModule;
    const jobsOptions = {
      fetch: (input: string, init?: RequestInit) => app.fetch(new Request(input, init)),
      timeoutMs: 1000,
    };

    const listReport = await runJobsList(JOBS_BASE_URL, jobsOptions, { type: "billing-sync" });
    const completed = await runJobsShow(snapshot.jobs.id, JOBS_BASE_URL, jobsOptions);
    const failedDetails = await runJobsShow(failed.id, JOBS_BASE_URL, jobsOptions);
    const logs = await runJobsLogs(failed.id, JOBS_BASE_URL, jobsOptions);
    const cancelled = await runJobsCancel(running.id, JOBS_BASE_URL, jobsOptions, {
      reason: "operator stop",
    });
    const replayed = await runJobsReplay(failed.id, JOBS_BASE_URL, jobsOptions, {
      reason: "provider restored",
    });
    const replayExecution = await runtime.executionManager.get(replayed.id);
    const replayList = await runJobsList(JOBS_BASE_URL, jobsOptions, { replayOf: failed.id });

    const failures = [
      listReport.summary !== "attention" ? "jobs list did not report attention" : undefined,
      getJobsListExitCode(listReport) !== 1
        ? "jobs list did not use a non-zero attention exit code"
        : undefined,
      completed.status !== "completed" ? "completed billing-sync was not inspectable" : undefined,
      getJobExitCode(completed) !== 0
        ? "completed billing-sync returned a non-zero exit code"
        : undefined,
      failedDetails.status !== "failed" ? "failed billing-sync was not inspectable" : undefined,
      failedDetails.failurePolicy.needsAttention !== true
        ? "failed billing-sync did not require operator attention"
        : undefined,
      getJobExitCode(failedDetails) !== 1
        ? "failed billing-sync did not use a non-zero attention exit code"
        : undefined,
      logs.some((entry) => entry.message === "Billing sync failed before provider checkpoint")
        ? undefined
        : "jobs logs did not include the failed billing-sync log entry",
      cancelled.status !== "cancelled" ? "jobs cancel did not cancel the running job" : undefined,
      getJobExitCode(cancelled) !== 0 ? "cancelled job returned a non-zero exit code" : undefined,
      replayed.id === failed.id ? "jobs replay reused the source execution id" : undefined,
      replayed.status !== "pending" ? "jobs replay did not create a pending execution" : undefined,
      replayed.replayOf !== failed.id ? "jobs replay did not expose replayOf" : undefined,
      replayExecution.idempotencyKey !== undefined
        ? "jobs replay reused or created an idempotency key"
        : undefined,
      replayList.jobs.some((job) => job.id === replayed.id && job.replayOf === failed.id)
        ? undefined
        : "jobs replay was not listable by replayOf",
    ].filter((failure): failure is string => failure !== undefined);

    if (failures.length > 0) {
      throw new SaasDemoSmokeProblem(failures);
    }

    console.log(
      JSON.stringify(
        {
          summary: listReport.summary,
          attentionExitCode: getJobsListExitCode(listReport),
          completed: completed.id,
          failed: failedDetails.id,
          cancelled: cancelled.id,
          replayed: {
            id: replayed.id,
            replayOf: replayed.replayOf,
            idempotencyKey: replayExecution.idempotencyKey ?? null,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await app.disposeApplicationRuntime();
  }
}

async function seedFailedBillingSyncJob(runtime: SaasRuntime) {
  const execution = await runtime.executionManager.create({
    type: "billing-sync",
    payload: { tenantId: "tenant_attention" },
    maxAttempts: 1,
    idempotencyKey: "billing-sync:tenant_attention",
    metadata: { workflowName: "billing.sync" },
  });
  await runtime.executionManager.start(execution.id);
  await runtime.executionManager.recordLog(execution.id, {
    message: "Billing sync failed before provider checkpoint",
    data: { tenantId: "tenant_attention" },
    level: "warn",
  });
  return runtime.executionManager.fail(execution.id, {
    message: "Billing provider unavailable",
    code: "BILLING_PROVIDER_UNAVAILABLE",
    retryable: true,
  });
}

async function seedRunningUsageRollupJob(runtime: SaasRuntime) {
  const execution = await runtime.executionManager.create({
    type: "usage-rollup",
    payload: { tenantId: "tenant_attention" },
    maxAttempts: 1,
    metadata: { workflowName: "usage.rollup" },
  });
  await runtime.executionManager.start(execution.id);
  await runtime.executionManager.recordLog(execution.id, {
    message: "Usage rollup started",
    data: { tenantId: "tenant_attention" },
  });
  return execution;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
