import {
  createExecutionJobsOperations,
  ExecutionManagerImpl,
  type CreateExecutionParams,
  type Execution,
  type ExecutionLogEntry,
  type ExecutionLogStore,
  type ExecutionStore,
  type ListExecutionsOptions,
} from "@croco/execution-core";
import { Container } from "typedi";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatJobDetails,
  formatJobLogs,
  formatJobsListReport,
  getJobExitCode,
  getJobsListExitCode,
  jobs,
  runJobsCancel,
  runJobsList,
  runJobsLogs,
  runJobsReplay,
  runJobsShow,
} from "../commands/jobs.js";
import type { JobsCommandClient, JobsStatusFetch } from "../commands/jobs.js";
import { CLI_DIAGNOSTIC_CODES, CLI_LEGACY_DIAGNOSTIC_CODES } from "../libs/diagnosticCodes.js";

class TestExecutionStore implements ExecutionStore, ExecutionLogStore {
  private readonly executions = new Map<string, Execution>();
  private idCounter = 0;

  async create(params: CreateExecutionParams): Promise<Execution> {
    const execution: Execution = {
      id: `exec-${++this.idCounter}`,
      type: params.type,
      status: "pending",
      payload: params.payload,
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      idempotencyKey: params.idempotencyKey,
      replayOf: params.replayOf,
      logs: params.logs,
      metadata: params.metadata,
      parentId: params.parentId,
      scheduledFor: params.scheduledFor,
      timeout: params.timeout,
    };

    this.executions.set(execution.id, execution);
    return execution;
  }

  async findById(id: string): Promise<Execution | null> {
    return this.executions.get(id) ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<Execution | null> {
    return (
      [...this.executions.values()].find((execution) => execution.idempotencyKey === key) ?? null
    );
  }

  async update(id: string, data: Partial<Execution>): Promise<Execution> {
    const execution = this.executions.get(id);
    if (!execution) {
      throw new Error(`Execution with id '${id}' not found`);
    }

    const updated = { ...execution, ...data };
    this.executions.set(id, updated);
    return updated;
  }

  async appendLog(id: string, entry: ExecutionLogEntry): Promise<Execution> {
    const execution = await this.findById(id);
    if (!execution) {
      throw new Error(`Execution with id '${id}' not found`);
    }

    return this.update(id, {
      logs: [...(execution.logs ?? []), entry],
    });
  }

  async list(options: ListExecutionsOptions = {}): Promise<Execution[]> {
    let executions = [...this.executions.values()];
    if (options.status) {
      executions = executions.filter((execution) => execution.status === options.status);
    }
    if (options.type) {
      executions = executions.filter((execution) => execution.type === options.type);
    }

    const offset = options.offset ?? 0;
    return executions.slice(offset, options.limit ? offset + options.limit : undefined);
  }

  async delete(id: string): Promise<void> {
    this.executions.delete(id);
  }
}

describe("jobs command", () => {
  beforeEach(() => {
    Container.reset();
    vi.restoreAllMocks();
  });

  it("registers Jobs v1 subcommands", () => {
    expect(Object.keys(jobs.subCommands ?? {})).toEqual([
      "list",
      "show",
      "logs",
      "cancel",
      "replay",
    ]);
  });

  it("lists, shows, logs, cancels, and replays jobs against ExecutionManagerImpl", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const healthy = await manager.create({
      type: "workflow",
      metadata: { workflowName: "onboarding.flow" },
    });
    await manager.start(healthy.id);
    await manager.complete(healthy.id);

    const failed = await manager.create({
      type: "billing-sync",
      payload: { tenantId: "tenant_1" },
      maxAttempts: 1,
    });
    await manager.start(failed.id);
    await manager.recordLog(failed.id, { message: "Billing sync failed" });
    await manager.fail(failed.id, { message: "provider unavailable", retryable: true });

    const running = await manager.create({ type: "usage-rollup" });
    await manager.start(running.id);

    const operations = createExecutionJobsOperations(manager);
    const client: JobsCommandClient = {
      list: (options) => operations.list(options as ListExecutionsOptions),
      show: operations.show,
      logs: operations.logs,
      cancel: operations.cancel,
      replay: operations.replay,
    };
    const report = await runJobsList("", { client }, { type: "billing-sync" });
    const shown = await runJobsShow(failed.id, "", { client });
    const logs = await runJobsLogs(failed.id, "", { client });
    const cancelled = await runJobsCancel(running.id, "", { client }, { reason: "operator stop" });
    const replayed = await runJobsReplay(
      failed.id,
      "",
      { client },
      { reason: "provider restored" },
    );

    expect(report.summary).toBe("attention");
    expect(report.jobs).toEqual([
      expect.objectContaining({
        id: failed.id,
        failurePolicy: expect.objectContaining({
          state: "retry_exhausted",
          needsAttention: true,
        }),
      }),
    ]);
    expect(formatJobsListReport(report)).toContain("Croco jobs: attention");
    expect(getJobsListExitCode(report)).toBe(1);
    expect(shown.payload).toEqual({ tenantId: "tenant_1" });
    expect(formatJobDetails(shown)).toContain("policy=retry_exhausted");
    expect(getJobExitCode(shown)).toBe(1);
    expect(logs).toEqual([
      expect.objectContaining({
        message: "Billing sync failed",
        level: "info",
      }),
    ]);
    expect(formatJobLogs(logs)).toContain("INFO Billing sync failed");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.failurePolicy.needsAttention).toBe(false);
    expect(replayed.status).toBe("pending");
    expect(replayed.replayOf).toBe(failed.id);
  });

  it("calls the conventional HTTP jobs endpoints", async () => {
    const calls: FetchCall[] = [];
    const fetchJobs: JobsStatusFetch = async (input, init) => {
      calls.push({ input, init });

      if (input.endsWith("/jobs?status=failed&replayOf=exec-1&limit=10")) {
        return Response.json({
          summary: "attention",
          generatedAt: "2026-01-01T00:00:00.000Z",
          total: 1,
          attentionCount: 1,
          jobs: [],
        });
      }
      if (input.endsWith("/jobs/exec-1")) {
        return Response.json(createHttpJob("exec-1"));
      }
      if (input.endsWith("/jobs/exec-1/logs")) {
        return Response.json([
          { timestamp: "2026-01-01T00:00:00.000Z", level: "info", message: "started" },
        ]);
      }
      if (input.endsWith("/jobs/exec-1/cancel")) {
        return Response.json(createHttpJob("exec-1", "cancelled"));
      }
      if (input.endsWith("/jobs/exec-1/replay")) {
        return Response.json(createHttpJob("exec-2", "pending"));
      }

      return Response.json({ detail: "not found" }, { status: 404 });
    };

    await expect(
      runJobsList(
        "https://api.example.test/ops",
        {
          fetch: fetchJobs,
          token: "secret",
        },
        {
          status: "failed",
          replayOf: "exec-1",
          limit: 10,
        },
      ),
    ).resolves.toMatchObject({
      summary: "attention",
    });
    await expect(
      runJobsShow("exec-1", "https://api.example.test/ops", { fetch: fetchJobs }),
    ).resolves.toMatchObject({
      id: "exec-1",
    });
    await expect(
      runJobsLogs("exec-1", "https://api.example.test/ops", { fetch: fetchJobs }),
    ).resolves.toHaveLength(1);
    await expect(
      runJobsCancel(
        "exec-1",
        "https://api.example.test/ops",
        { fetch: fetchJobs },
        { reason: "stop" },
      ),
    ).resolves.toMatchObject({
      status: "cancelled",
    });
    await expect(
      runJobsReplay(
        "exec-1",
        "https://api.example.test/ops",
        { fetch: fetchJobs },
        { reason: "retry" },
      ),
    ).resolves.toMatchObject({
      id: "exec-2",
    });

    expect(calls[0].input).toBe(
      "https://api.example.test/ops/jobs?status=failed&replayOf=exec-1&limit=10",
    );
    expect(new Headers(calls[0].init?.headers).get("X-Diagnostics-Token")).toBe("secret");
    expect(calls[3].input).toBe("https://api.example.test/ops/jobs/exec-1/cancel");
    expect(calls[3].init?.method).toBe("POST");
    expect(calls[3].init?.body).toBe(JSON.stringify({ reason: "stop" }));
    expect(calls[4].input).toBe("https://api.example.test/ops/jobs/exec-1/replay");
    expect(calls[4].init?.method).toBe("POST");
  });

  it("surfaces invalid targets and HTTP failures as Problem details", async () => {
    await expect(runJobsList("not-a-url")).rejects.toMatchObject({
      code: CLI_DIAGNOSTIC_CODES.jobsInvalidTargetUrl,
      extensions: {
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.jobsInvalidTargetUrl,
      },
      status: 400,
    });

    await expect(
      runJobsShow("missing", "https://api.example.test", {
        fetch: async () => Response.json({ detail: "missing job" }, { status: 404 }),
      }),
    ).rejects.toMatchObject({
      code: CLI_DIAGNOSTIC_CODES.jobsEndpointNotFound,
      extensions: {
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.jobsEndpointNotFound,
      },
      status: 404,
    });

    await expect(
      runJobsShow("unavailable", "https://api.example.test", {
        fetch: async () => Response.json({ detail: "jobs unavailable" }, { status: 503 }),
      }),
    ).rejects.toMatchObject({
      code: CLI_DIAGNOSTIC_CODES.jobsHttpError,
      extensions: {
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.jobsHttpError,
      },
      status: 409,
    });
  });
});

function createHttpJob(id: string, status = "completed") {
  return {
    id,
    type: "workflow",
    status,
    attempts: 1,
    maxAttempts: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    logCount: 0,
    logs: [],
    failurePolicy: {
      state: status === "cancelled" ? "cancelled" : "succeeded",
      needsAttention: false,
      retryable: false,
      replayable: false,
      recoveryAction: "none",
      reason: "ok",
    },
  };
}

type FetchCall = {
  readonly input: string;
  readonly init?: RequestInit;
};
