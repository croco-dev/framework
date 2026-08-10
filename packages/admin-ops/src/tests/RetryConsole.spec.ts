import type {
  CreateExecutionParams,
  Execution,
  ExecutionInspectionManager,
  ExecutionLogEntry,
  ExecutionLogStore,
  ExecutionReplayManager,
  ListExecutionsOptions,
} from "@croco/execution-core";
import { ExecutionManagerImpl, ExecutionProblems, ExecutionStore } from "@croco/execution-core";
import type {
  LifecycleFinalizedRun,
  LifecycleIndeterminateRun,
  LifecycleRun,
  LifecycleRunClaim,
  LifecycleRunClaimResult,
  LifecycleRunListOptions,
  LifecycleRunStore,
} from "@croco/lifecycle-core";
import { describe, expect, it, vi } from "vitest";
import type {
  RetryConsoleAuditDescriptor,
  RetryConsolePermissionDescriptor,
  RetryConsolePermissionGrant,
  RetryConsoleRecoveryInput,
} from "../index";
import {
  createBatchRetryConsoleSource,
  createLifecycleRetryConsoleSource,
  createRetryConsole,
  createTaskRetryConsoleSource,
  createWorkflowRetryConsoleSource,
} from "../index";

class MemoryExecutionStore extends ExecutionStore implements ExecutionLogStore {
  private executions = new Map<string, Execution>();
  private idCounter = 0;

  constructor(initialExecutions: readonly Execution[] = []) {
    super();
    for (const execution of initialExecutions) {
      this.executions.set(execution.id, execution);
      const numericId = /^exec-(\d+)$/.exec(execution.id)?.[1];
      if (numericId) {
        this.idCounter = Math.max(this.idCounter, Number(numericId));
      }
    }
  }

  async create(params: CreateExecutionParams): Promise<Execution> {
    const id = `exec-${++this.idCounter}`;
    const execution: Execution = {
      id,
      type: params.type,
      status: "pending",
      payload: params.payload,
      maxAttempts: params.maxAttempts ?? 1,
      timeout: params.timeout,
      scheduledFor: params.scheduledFor,
      idempotencyKey: params.idempotencyKey,
      replayOf: params.replayOf,
      logs: params.logs,
      parentId: params.parentId,
      metadata: params.metadata,
      attempts: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    this.executions.set(id, execution);
    return execution;
  }

  async findById(id: string): Promise<Execution | null> {
    return this.executions.get(id) ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<Execution | null> {
    for (const execution of this.executions.values()) {
      if (execution.idempotencyKey === key) {
        return execution;
      }
    }
    return null;
  }

  async update(id: string, data: Partial<Execution>): Promise<Execution> {
    const existing = this.executions.get(id);
    if (!existing) {
      throw new Error(`Execution with id '${id}' not found`);
    }

    const updated = { ...existing, ...data };
    this.executions.set(id, updated);
    return updated;
  }

  async mergeCheckpoint(id: string, key: string, value: unknown): Promise<Execution> {
    const execution = this.executions.get(id);
    if (!execution) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
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
    const existing = this.executions.get(id);
    return existing?.status === expectedStatus ? this.update(id, data) : null;
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

  async list(options: ListExecutionsOptions = {}): Promise<Execution[]> {
    let executions = Array.from(this.executions.values());

    if (options.status) {
      executions = executions.filter((execution) => execution.status === options.status);
    }

    if (options.type) {
      executions = executions.filter((execution) => execution.type === options.type);
    }

    return executions;
  }

  async delete(id: string): Promise<void> {
    this.executions.delete(id);
  }

  async appendLog(id: string, entry: ExecutionLogEntry): Promise<Execution> {
    const existing = this.executions.get(id);
    if (!existing) {
      throw new Error(`Execution with id '${id}' not found`);
    }

    return this.update(id, {
      logs: [...(existing.logs ?? []), entry],
    });
  }
}

class MemoryLifecycleRunStore implements LifecycleRunStore {
  constructor(private readonly runs: readonly LifecycleRun[]) {}

  async claim(
    claim: LifecycleRunClaim,
    dispatchingRun: LifecycleIndeterminateRun,
  ): Promise<LifecycleRunClaimResult> {
    void claim;
    void dispatchingRun;
    return { claimed: true };
  }

  async abortClaim(runId: string, idempotencyKey: string): Promise<void> {
    void runId;
    void idempotencyKey;
  }

  async finalizeDispatch(run: LifecycleFinalizedRun) {
    void run;
    return { finalized: false, reason: "dispatch_not_found" } as const;
  }

  async save(run: LifecycleFinalizedRun): Promise<void> {
    void run;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<LifecycleRun | null> {
    return this.runs.find((run) => run.idempotencyKey === idempotencyKey) ?? null;
  }

  async findLatestForRule(tenantId: string, ruleId: string): Promise<LifecycleRun | null> {
    return this.runs.find((run) => run.tenantId === tenantId && run.ruleId === ruleId) ?? null;
  }

  async list(options?: LifecycleRunListOptions): Promise<readonly LifecycleRun[]> {
    if (options?.tenantId) {
      return this.runs.filter((run) => run.tenantId === options.tenantId);
    }
    return this.runs;
  }
}

const audit: RetryConsoleAuditDescriptor = {
  actorId: "ops-user-1",
  reason: "Retry after upstream outage recovered",
  idempotencyKey: "ops-recovery-1",
};

const granted: RetryConsolePermissionGrant = {
  granted: true,
  descriptor: permission("retry", "task", "exec-1"),
  checkedAt: "2026-01-01T00:00:01.000Z",
};

function permission(
  action: "inspect" | "replay" | "retry",
  kind: "batch" | "lifecycle" | "task" | "workflow",
  id: string,
): RetryConsolePermissionDescriptor {
  return {
    action: `admin-ops:${action}`,
    resource: `${kind}:${id}`,
    scope: "admin-ops:recovery",
  };
}

function execution(overrides: Partial<Execution>): Execution {
  return {
    id: "exec-1",
    type: "send-email",
    status: "failed",
    payload: { userId: "user-1" },
    attempts: 1,
    maxAttempts: 3,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    startedAt: new Date("2026-01-01T00:00:02.000Z"),
    completedAt: new Date("2026-01-01T00:00:03.000Z"),
    idempotencyKey: "task-key-1",
    metadata: {
      traceId: "trace-1",
      requestId: "request-1",
    },
    error: {
      code: "UPSTREAM_UNAVAILABLE",
      message: "Email provider unavailable",
      retryable: true,
    },
    ...overrides,
  };
}

describe("RetryConsole", () => {
  it("runs a retryable task recovery with permission, audit metadata, and idempotency evidence", async () => {
    const manager = new ExecutionManagerImpl(new MemoryExecutionStore([execution({})]));
    const console = createRetryConsole([createTaskRetryConsoleSource(manager)]);

    const result = await console.recover({
      itemId: "exec-1",
      actionId: "retry",
      permission: granted,
      audit,
    });

    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") {
      throw new Error("Expected successful retry");
    }
    expect(result.item.state).toBe("running");
    expect(result.item.correlationIds.traceId).toBe("trace-1");
    expect(result.item.correlationIds.requestId).toBe("request-1");
    expect(result.audit.idempotencyKey).toBe("ops-recovery-1");

    const updated = await manager.get("exec-1");
    expect(updated.status).toBe("retrying");
    expect(updated.logs?.[0]).toMatchObject({
      level: "info",
      message: "Admin recovery retry requested",
      data: {
        actorId: "ops-user-1",
        idempotencyKey: "ops-recovery-1",
      },
    });
  });

  it("denies retry before touching the provider when permission is not granted", async () => {
    const manager = new ExecutionManagerImpl(new MemoryExecutionStore([execution({})]));
    const retrySpy = vi.spyOn(manager, "retry");
    const console = createRetryConsole([createTaskRetryConsoleSource(manager)]);

    const result = await console.recover({
      itemId: "exec-1",
      actionId: "retry",
      permission: {
        granted: false,
        deniedReason: "Missing admin-ops:recovery scope",
      },
      audit,
    });

    expect(result.status).toBe("denied");
    if (result.status !== "denied") {
      throw new Error("Expected denied retry");
    }
    expect(result.problem.code).toBe("admin-ops/recovery-permission-denied");
    expect(result.problem.message).toBe("Missing admin-ops:recovery scope");
    expect(retrySpy).not.toHaveBeenCalled();
  });

  it("denies recovery before touching the provider when no explicit action is selected", async () => {
    const manager = new ExecutionManagerImpl(new MemoryExecutionStore([execution({})]));
    const retrySpy = vi.spyOn(manager, "retry");
    const console = createRetryConsole([createTaskRetryConsoleSource(manager)]);

    const result = await console.recover({
      itemId: "exec-1",
      permission: granted,
      audit,
    } as unknown as RetryConsoleRecoveryInput);

    expect(result.status).toBe("denied");
    if (result.status !== "denied") {
      throw new Error("Expected selector denial");
    }
    expect(result.problem.code).toBe("admin-ops/recovery-action-selector-required");
    expect(retrySpy).not.toHaveBeenCalled();
  });

  it("denies retry when the permission descriptor does not match the selected action", async () => {
    const manager = new ExecutionManagerImpl(new MemoryExecutionStore([execution({})]));
    const retrySpy = vi.spyOn(manager, "retry");
    const console = createRetryConsole([createTaskRetryConsoleSource(manager)]);

    const result = await console.recover({
      itemId: "exec-1",
      actionId: "retry",
      permission: {
        granted: true,
        descriptor: {
          action: "admin-ops:inspect",
          resource: "task:exec-1",
          scope: "admin-ops:recovery",
        },
      },
      audit,
    });

    expect(result.status).toBe("denied");
    if (result.status !== "denied") {
      throw new Error("Expected descriptor mismatch denial");
    }
    expect(result.problem.code).toBe("admin-ops/recovery-permission-descriptor-mismatch");
    expect(retrySpy).not.toHaveBeenCalled();
  });

  it("deduplicates replay recovery by audit idempotency key", async () => {
    const manager = new ExecutionManagerImpl(
      new MemoryExecutionStore([
        execution({
          attempts: 3,
          maxAttempts: 3,
          error: {
            code: "UPSTREAM_UNAVAILABLE",
            message: "Email provider unavailable after retries",
            retryable: true,
          },
        }),
      ]),
    );
    const replaySpy = vi.spyOn(manager, "replay");
    const firstConsole = createRetryConsole([createTaskRetryConsoleSource(manager)]);
    const request = {
      itemId: "exec-1",
      actionId: "replay",
      permission: {
        granted: true,
        descriptor: permission("replay", "task", "exec-1"),
      },
      audit,
    } satisfies RetryConsoleRecoveryInput;

    const first = await firstConsole.recover(request);
    const second = await firstConsole.recover(request);
    const secondConsole = createRetryConsole([createTaskRetryConsoleSource(manager)]);
    const third = await secondConsole.recover(request);

    expect([first.status, second.status, third.status]).toEqual([
      "succeeded",
      "succeeded",
      "succeeded",
    ]);
    const executions = await manager.list();
    expect(executions.filter((candidate) => candidate.replayOf === "exec-1")).toHaveLength(1);
    expect(executions.find((candidate) => candidate.replayOf === "exec-1")?.metadata).toMatchObject(
      {
        recoveryActorId: "ops-user-1",
        recoveryAuditIdempotencyKey: "ops-recovery-1",
      },
    );
    expect(replaySpy).toHaveBeenCalledTimes(1);
  });

  it("keeps non-retryable failures distinct and preserves Problem details", async () => {
    const manager = new ExecutionManagerImpl(
      new MemoryExecutionStore([
        execution({
          error: {
            code: "VALIDATION_FAILED",
            message: "Payload cannot be repaired by retry",
            retryable: false,
          },
        }),
      ]),
    );
    const console = createRetryConsole([createTaskRetryConsoleSource(manager)]);

    const items = await console.list();
    expect(items).toHaveLength(1);
    expect(items[0].state).toBe("non_retryable");
    expect(items[0].retryable).toBe(false);
    expect(items[0].problem).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Payload cannot be repaired by retry",
      retryable: false,
    });
    expect(items[0].attempts).toEqual({ current: 1, max: 3 });
    expect(items[0].timestamps.completedAt).toBe("2026-01-01T00:00:03.000Z");
    expect(items[0].recoveryActions[0]).toMatchObject({
      kind: "inspect",
      allowed: true,
    });
  });

  it("returns failed result state when an external recovery provider fails", async () => {
    const failingManager: ExecutionManagerImpl &
      Pick<ExecutionInspectionManager, "recordLog"> &
      Pick<ExecutionReplayManager, "replay"> = new ExecutionManagerImpl(
      new MemoryExecutionStore([execution({})]),
    );
    vi.spyOn(failingManager, "retry").mockRejectedValue(new Error("provider queue is down"));

    const console = createRetryConsole([createTaskRetryConsoleSource(failingManager)]);

    const result = await console.recover({
      itemId: "exec-1",
      actionId: "retry",
      permission: granted,
      audit,
    });

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      throw new Error("Expected failed provider recovery");
    }
    expect(result.problem).toMatchObject({
      code: "admin-ops/provider-recovery-failed",
      message: "provider queue is down",
    });
  });

  it("exposes task, workflow, batch, lifecycle, running, succeeded, and terminal states", async () => {
    const manager = new ExecutionManagerImpl(
      new MemoryExecutionStore([
        execution({ id: "task-1", type: "send-email" }),
        execution({
          id: "workflow-1",
          type: "workflow",
          metadata: { workflowName: "onboarding" },
        }),
        execution({
          id: "batch-1",
          type: "batch",
          metadata: { batchName: "daily-import" },
          status: "failed",
          attempts: 3,
          maxAttempts: 3,
          error: {
            code: "IMPORT_FAILED",
            message: "Import failed after retries",
            retryable: true,
          },
        }),
        execution({
          id: "running-1",
          type: "send-sms",
          status: "running",
          error: undefined,
        }),
        execution({
          id: "succeeded-1",
          type: "send-push",
          status: "completed",
          error: undefined,
        }),
      ]),
    );
    const lifecycleRecover = vi.fn(async () => ({
      providerResult: { accepted: true },
    }));
    const lifecycleRun: LifecycleRun = {
      id: "lifecycle-1",
      ruleId: "past-due-recovery",
      ruleVersion: "1.0.0",
      ruleFingerprint: "past-due-recovery-v1",
      tenantId: "tenant-1",
      signalType: "billing.subscription.updated",
      signalId: "signal-1",
      severity: "high",
      status: "failed",
      idempotencyKey: "lifecycle-key-1",
      actionResults: [
        {
          actionId: "notify",
          type: "webhook",
          status: "failure",
          error: {
            code: "WEBHOOK_DOWN",
            message: "Webhook provider failed",
          },
        },
      ],
      startedAt: new Date("2026-01-01T00:00:04.000Z"),
      completedAt: new Date("2026-01-01T00:00:05.000Z"),
    };
    const indeterminateLifecycleRun: LifecycleRun = {
      ...lifecycleRun,
      id: "lifecycle-indeterminate-1",
      status: "indeterminate",
      idempotencyKey: "lifecycle-key-indeterminate-1",
      actionResults: [],
    };

    const console = createRetryConsole([
      createTaskRetryConsoleSource(manager),
      createWorkflowRetryConsoleSource(manager),
      createBatchRetryConsoleSource(manager),
      createLifecycleRetryConsoleSource({
        store: new MemoryLifecycleRunStore([lifecycleRun, indeterminateLifecycleRun]),
        recover: lifecycleRecover,
      }),
    ]);

    const items = await console.list({ includeSucceeded: true });

    expect(items.map((item) => [item.id, item.source.kind, item.state])).toEqual(
      expect.arrayContaining([
        ["task-1", "task", "retryable"],
        ["workflow-1", "workflow", "retryable"],
        ["batch-1", "batch", "terminal_failed"],
        ["lifecycle-1", "lifecycle", "terminal_failed"],
        ["lifecycle-indeterminate-1", "lifecycle", "reconciliation_required"],
        ["running-1", "task", "running"],
        ["succeeded-1", "task", "succeeded"],
      ]),
    );
    expect(items.find((item) => item.id === "lifecycle-1")?.correlationIds).toMatchObject({
      lifecycleRunId: "lifecycle-1",
      lifecycleRuleId: "past-due-recovery",
      tenantId: "tenant-1",
      signalId: "signal-1",
      idempotencyKey: "lifecycle-key-1",
    });
    expect(items.find((item) => item.id === "lifecycle-indeterminate-1")).toMatchObject({
      retryable: false,
      problem: {
        code: "lifecycle-core/run-indeterminate",
        retryable: false,
      },
      recoveryActions: [
        {
          kind: "inspect",
          allowed: true,
        },
      ],
    });
    expect(items.find((item) => item.id === "running-1")?.recoveryActions[0]).toMatchObject({
      kind: "wait",
      label: "Wait",
      allowed: false,
    });
    expect(items.find((item) => item.id === "succeeded-1")?.recoveryActions[0]).toMatchObject({
      kind: "none",
      label: "None",
      allowed: false,
    });
  });

  it("deduplicates lifecycle recovery by audit idempotency key", async () => {
    const lifecycleRun: LifecycleRun = {
      id: "lifecycle-1",
      ruleId: "past-due-recovery",
      ruleVersion: "1.0.0",
      ruleFingerprint: "past-due-recovery-v1",
      tenantId: "tenant-1",
      signalType: "billing.subscription.updated",
      signalId: "signal-1",
      severity: "high",
      status: "failed",
      idempotencyKey: "lifecycle-key-1",
      actionResults: [],
      startedAt: new Date("2026-01-01T00:00:04.000Z"),
      completedAt: new Date("2026-01-01T00:00:05.000Z"),
    };
    const lifecycleRecover = vi.fn(async () => ({
      providerResult: { accepted: true },
    }));
    const console = createRetryConsole([
      createLifecycleRetryConsoleSource({
        store: new MemoryLifecycleRunStore([lifecycleRun]),
        recover: lifecycleRecover,
      }),
    ]);
    const request = {
      itemId: "lifecycle-1",
      actionId: "replay",
      permission: {
        granted: true,
        descriptor: permission("replay", "lifecycle", "lifecycle-1"),
      },
      audit,
    } satisfies RetryConsoleRecoveryInput;

    const first = await console.recover(request);
    const second = await console.recover(request);

    expect([first.status, second.status]).toEqual(["succeeded", "succeeded"]);
    expect(lifecycleRecover).toHaveBeenCalledTimes(1);
  });
});
