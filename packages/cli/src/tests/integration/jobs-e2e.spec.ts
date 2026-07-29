import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  type CreateExecutionParams,
  createExecutionJobsOperations,
  type Execution,
  type ExecutionLogEntry,
  type ExecutionLogStore,
  ExecutionManagerImpl,
  type ExecutionStore,
  type JobsOperations,
  type ListExecutionsOptions,
} from "@croco/execution-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobDetails, JobListReport, JobLogEntry } from "../../commands/jobs.js";
import { jobs } from "../../commands/jobs.js";

class TestExecutionStore implements ExecutionStore, ExecutionLogStore {
  private readonly executions = new Map<string, Execution>();
  private idCounter = 0;

  async create(params: CreateExecutionParams): Promise<Execution> {
    if (params.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(params.idempotencyKey);
      if (existing) return existing;
    }

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
    const execution = await this.findById(id);
    if (!execution) {
      throw new Error(`Execution with id '${id}' not found`);
    }

    const updated = { ...execution, ...data };
    this.executions.set(id, updated);
    return updated;
  }

  async mergeCheckpoint(id: string, key: string, value: unknown): Promise<Execution> {
    const execution = this.executions.get(id);
    if (!execution) {
      throw new Error(`Execution with id '${id}' not found`);
    }
    const updated = {
      ...execution,
      checkpoints: { ...execution.checkpoints, [key]: value },
    };
    this.executions.set(id, updated);
    return updated;
  }

  async updateIfStatus(
    id: string,
    expectedStatus: Execution["status"],
    data: Partial<Execution>,
  ): Promise<Execution | null> {
    const execution = this.executions.get(id);
    return execution?.status === expectedStatus ? this.update(id, data) : null;
  }

  async listRunning(options: { afterId?: string; limit: number }): Promise<Execution[]> {
    return [...this.executions.values()]
      .filter(
        (execution) =>
          execution.status === "running" &&
          (options.afterId === undefined || execution.id > options.afterId),
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, options.limit);
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
    if (options.parentId !== undefined) {
      executions = executions.filter((execution) => execution.parentId === options.parentId);
    }
    if (options.replayOf !== undefined) {
      executions = executions.filter((execution) => execution.replayOf === options.replayOf);
    }

    const offset = options.offset ?? 0;
    return executions.slice(offset, options.limit ? offset + options.limit : undefined);
  }

  async delete(id: string): Promise<void> {
    this.executions.delete(id);
  }
}

type RunnableCommand = {
  run(input: { readonly args: Record<string, unknown> }): Promise<void> | void;
};

type JobsCommandName = "list" | "show" | "logs" | "cancel" | "replay";

type CommandRunResult = {
  readonly exitCode: number;
  readonly stdout: string;
};

let activeServer: Server | undefined;

describe("jobs command e2e", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;

    if (activeServer) {
      await new Promise<void>((resolve, reject) => {
        activeServer?.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      activeServer = undefined;
    }
  });

  it("lists, shows, logs, cancels, and replays jobs over HTTP with attention exit codes", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const operations = createExecutionJobsOperations(manager);
    const serverUrl = await startJobsServer(operations);
    const completed = await seedCompletedBillingSync(manager);
    const failed = await seedFailedBillingSync(manager);
    const running = await seedRunningUsageRollup(manager);

    const list = await runJobsCommand("list", {
      url: `${serverUrl}/ops`,
      type: "billing-sync",
      json: true,
    });
    const listReport = JSON.parse(list.stdout) as JobListReport;
    expect(list.exitCode).toBe(1);
    expect(listReport).toMatchObject({
      summary: "attention",
      attentionCount: 1,
    });
    expect(listReport.jobs.map((job) => job.id)).toEqual([completed.id, failed.id]);

    const shown = await runJobsCommand("show", {
      id: failed.id,
      url: `${serverUrl}/ops`,
      json: true,
    });
    const shownJob = JSON.parse(shown.stdout) as JobDetails;
    expect(shown.exitCode).toBe(1);
    expect(shownJob.failurePolicy).toMatchObject({
      state: "retry_exhausted",
      needsAttention: true,
      replayable: true,
    });

    const logs = await runJobsCommand("logs", {
      id: failed.id,
      url: `${serverUrl}/ops`,
      json: true,
    });
    const logEntries = JSON.parse(logs.stdout) as readonly JobLogEntry[];
    expect(logs.exitCode).toBe(0);
    expect(logEntries).toEqual([
      expect.objectContaining({
        level: "warn",
        message: "Billing sync failed before provider checkpoint",
      }),
    ]);

    const cancelled = await runJobsCommand("cancel", {
      id: running.id,
      url: `${serverUrl}/ops`,
      reason: "operator stop",
      json: true,
    });
    const cancelledJob = JSON.parse(cancelled.stdout) as JobDetails;
    expect(cancelled.exitCode).toBe(0);
    expect(cancelledJob).toMatchObject({
      id: running.id,
      status: "cancelled",
      failurePolicy: { needsAttention: false },
    });

    const replayed = await runJobsCommand("replay", {
      id: failed.id,
      url: `${serverUrl}/ops`,
      reason: "provider restored",
      json: true,
    });
    const replayedJob = JSON.parse(replayed.stdout) as JobDetails;
    const replayExecution = await manager.get(replayedJob.id);
    const replayList = await runJobsCommand("list", {
      url: `${serverUrl}/ops`,
      replayOf: failed.id,
      json: true,
    });
    const replayListReport = JSON.parse(replayList.stdout) as JobListReport;

    expect(replayed.exitCode).toBe(0);
    expect(replayedJob).toMatchObject({
      status: "pending",
      replayOf: failed.id,
    });
    expect(replayedJob.id).not.toBe(failed.id);
    expect(replayExecution.idempotencyKey).toBeUndefined();
    expect(replayList.exitCode).toBe(0);
    expect(replayListReport.jobs.map((job) => job.id)).toContain(replayedJob.id);
  });
});

async function runJobsCommand(
  commandName: JobsCommandName,
  args: Record<string, unknown>,
): Promise<CommandRunResult> {
  const subCommands = jobs.subCommands as Record<JobsCommandName, RunnableCommand> | undefined;
  const command = subCommands?.[commandName];
  if (!command) {
    throw new Error(`Missing jobs subcommand ${commandName}`);
  }

  const output: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
    output.push(String(message ?? ""));
  });

  process.exitCode = undefined;
  try {
    await command.run({ args });
  } finally {
    log.mockRestore();
  }

  return {
    exitCode: typeof process.exitCode === "number" ? process.exitCode : 0,
    stdout: output.join("\n"),
  };
}

async function startJobsServer(operations: JobsOperations): Promise<string> {
  activeServer = createServer((request, response) => {
    void handleJobsRequest(operations, request, response);
  });

  await new Promise<void>((resolve) => {
    activeServer?.listen(0, "127.0.0.1", resolve);
  });

  const address = activeServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Jobs e2e server did not expose a TCP address");
  }

  return `http://127.0.0.1:${address.port}`;
}

async function handleJobsRequest(
  operations: JobsOperations,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathParts = requestUrl.pathname.split("/").filter(Boolean);

    if (pathParts[0] !== "ops" || pathParts[1] !== "jobs") {
      writeJson(response, 404, { detail: "not found" });
      return;
    }

    if (request.method === "GET" && pathParts.length === 2) {
      writeJson(response, 200, await operations.list(readListOptions(requestUrl)));
      return;
    }

    const executionId = pathParts[2];
    if (!executionId) {
      writeJson(response, 404, { detail: "missing execution id" });
      return;
    }

    if (request.method === "GET" && pathParts.length === 3) {
      writeJson(response, 200, await operations.show(executionId));
      return;
    }

    if (request.method === "GET" && pathParts[3] === "logs") {
      writeJson(response, 200, await operations.logs(executionId));
      return;
    }

    const body = await readJsonBody(request);
    const reason = isRecord(body) && typeof body.reason === "string" ? body.reason : undefined;

    if (request.method === "POST" && pathParts[3] === "cancel") {
      writeJson(response, 200, await operations.cancel(executionId, { reason }));
      return;
    }

    if (request.method === "POST" && pathParts[3] === "replay") {
      writeJson(response, 200, await operations.replay(executionId, { reason }));
      return;
    }

    writeJson(response, 404, { detail: "not found" });
  } catch (error) {
    writeJson(response, 500, {
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function readListOptions(url: URL): ListExecutionsOptions {
  return {
    status: readSearchParam(url, "status") as ListExecutionsOptions["status"],
    type: readSearchParam(url, "type"),
    parentId: readSearchParam(url, "parentId"),
    replayOf: readSearchParam(url, "replayOf"),
    limit: readOptionalInteger(url, "limit"),
    offset: readOptionalInteger(url, "offset"),
  };
}

function readSearchParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name);
  return value && value.length > 0 ? value : undefined;
}

function readOptionalInteger(url: URL, name: string): number | undefined {
  const value = readSearchParam(url, name);
  return value === undefined ? undefined : Number(value);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body.length === 0 ? null : (JSON.parse(body) as unknown);
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function seedCompletedBillingSync(manager: ExecutionManagerImpl): Promise<Execution> {
  const execution = await manager.create({
    type: "billing-sync",
    payload: { tenantId: "tenant_completed" },
    maxAttempts: 2,
    idempotencyKey: "billing-sync:tenant_completed",
    metadata: { workflowName: "billing.sync" },
  });
  await manager.start(execution.id);
  await manager.recordLog(execution.id, { message: "Billing sync started" });
  await manager.recordLog(execution.id, {
    message: "Billing subscription active",
  });
  return manager.complete(execution.id, { subscriptionStatus: "active" });
}

async function seedFailedBillingSync(manager: ExecutionManagerImpl): Promise<Execution> {
  const execution = await manager.create({
    type: "billing-sync",
    payload: { tenantId: "tenant_failed" },
    maxAttempts: 1,
    idempotencyKey: "billing-sync:tenant_failed",
    metadata: { workflowName: "billing.sync" },
  });
  await manager.start(execution.id);
  await manager.recordLog(execution.id, {
    message: "Billing sync failed before provider checkpoint",
    level: "warn",
  });
  return manager.fail(execution.id, {
    message: "Billing provider unavailable",
    code: "BILLING_PROVIDER_UNAVAILABLE",
    retryable: true,
  });
}

async function seedRunningUsageRollup(manager: ExecutionManagerImpl): Promise<Execution> {
  const execution = await manager.create({
    type: "usage-rollup",
    payload: { tenantId: "tenant_failed" },
    maxAttempts: 1,
    metadata: { workflowName: "usage.rollup" },
  });
  await manager.start(execution.id);
  await manager.recordLog(execution.id, { message: "Usage rollup started" });
  return manager.get(execution.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
