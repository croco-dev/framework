import {
  type CreateExecutionRecordParams,
  type Execution,
  ExecutionManagerImpl,
  ExecutionProblems,
  ExecutionStore,
  type ExecutionStatus,
  type ListExecutionsOptions,
  type ListRunningExecutionsOptions,
} from "@croco/execution-core";
import { Component, Container, MetadataStorage } from "@croco/framework-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Task } from "../libs/decorators/Task";
import { TaskExecutionTimeoutProblem } from "../libs/problems/TasksProblems";
import { TaskRegistry } from "../libs/TaskRegistry";
import { TaskRunner } from "../libs/TaskRunner";
import type { TaskExecutionContext } from "../libs/types";

class MemoryExecutionStore extends ExecutionStore {
  private readonly executions = new Map<string, Execution>();
  private sequence = 0;

  async create(params: CreateExecutionRecordParams): Promise<Execution> {
    const execution: Execution = {
      id: `exec-${String(++this.sequence).padStart(4, "0")}`,
      type: params.type,
      status: "pending",
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 1,
      createdAt: new Date(),
      ...(params.payload !== undefined ? { payload: params.payload } : {}),
      ...(params.timeout !== undefined ? { timeout: params.timeout } : {}),
      ...(params.idempotencyKey !== undefined ? { idempotencyKey: params.idempotencyKey } : {}),
      requestFingerprint: params.requestFingerprint,
      ...(params.parentId !== undefined ? { parentId: params.parentId } : {}),
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
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
    const current = this.executions.get(id);
    if (!current) throw ExecutionProblems.notFound(`Missing execution ${id}`);
    const updated = { ...current, ...data };
    this.executions.set(id, updated);
    return updated;
  }

  async mergeCheckpoint(id: string, key: string, value: unknown): Promise<Execution> {
    const current = this.executions.get(id);
    if (!current) throw ExecutionProblems.notFound(`Missing execution ${id}`);
    return this.update(id, {
      checkpoints: { ...current.checkpoints, [key]: value },
    });
  }

  async updateIfStatus(
    id: string,
    expectedStatus: ExecutionStatus,
    data: Partial<Execution>,
  ): Promise<Execution | null> {
    const current = this.executions.get(id);
    if (!current || current.status !== expectedStatus) return null;
    return this.update(id, data);
  }

  async listRunning(options: ListRunningExecutionsOptions): Promise<Execution[]> {
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
    return [...this.executions.values()].filter(
      (execution) =>
        (options.status === undefined || execution.status === options.status) &&
        (options.type === undefined || execution.type === options.type),
    );
  }

  async delete(id: string): Promise<void> {
    this.executions.delete(id);
  }
}

describe("TaskRunner integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    Container.reset();
    MetadataStorage.clear();
    TaskRegistry.getInstance().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should enforce a persisted deadline and retry the same execution through a real store", async () => {
    @Component()
    class RetriableTimedTask {
      @Task({ name: "retriable-timed-task", timeout: 50, maxAttempts: 2 })
      async handle(payload: { value: string }, context: TaskExecutionContext): Promise<string> {
        if (context.attempt === 2) return `retried: ${payload.value}`;
        return new Promise((_resolve, reject) => {
          context.signal.addEventListener("abort", () => reject(context.signal.reason), {
            once: true,
          });
        });
      }
    }

    Container.set(RetriableTimedTask, new RetriableTimedTask());
    const registry = TaskRegistry.fromMetadata();
    const manager = new ExecutionManagerImpl(new MemoryExecutionStore());
    const runner = new TaskRunner(manager, registry);

    const firstAttempt = runner.execute("retriable-timed-task", { value: "payload" });
    const firstAttemptRejection = firstAttempt.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(50);

    let executionId: string | undefined;
    const timeoutError = await firstAttemptRejection;
    expect(timeoutError).toBeInstanceOf(TaskExecutionTimeoutProblem);
    executionId = (timeoutError as TaskExecutionTimeoutProblem).extensions?.executionId as string;

    expect(executionId).toBeDefined();
    const timedOut = await manager.get(executionId as string);
    expect(timedOut).toMatchObject({ status: "timed_out", attempts: 1, maxAttempts: 2 });

    const result = await runner.retry(executionId as string);

    expect(result).toBe("retried: payload");
    expect(await manager.get(executionId as string)).toMatchObject({
      status: "completed",
      attempts: 2,
      result: "retried: payload",
    });
  });

  it("should reconcile an overdue persisted execution after manager restart", async () => {
    const store = new MemoryExecutionStore();
    const firstManager = new ExecutionManagerImpl(store);
    const created = await firstManager.create({ type: "abandoned-task", timeout: 25 });
    await firstManager.start(created.id);
    vi.setSystemTime(new Date("2026-01-01T00:00:00.025Z"));

    const restartedManager = new ExecutionManagerImpl(store);
    const result = await restartedManager.reconcileTimedOut({ now: new Date(), batchSize: 1 });

    expect(result).toEqual({ scanned: 1, timedOut: 1 });
    expect(await restartedManager.get(created.id)).toMatchObject({
      status: "timed_out",
      attempts: 1,
      completedAt: new Date(),
    });
  });

  it("should scope the same runtime idempotency key to each task contract", async () => {
    @Component()
    class FirstTask {
      @Task({ name: "first-task" })
      handle(payload: { value: string }): string {
        return `first: ${payload.value}`;
      }
    }

    @Component()
    class SecondTask {
      @Task({ name: "second-task" })
      handle(payload: { value: string }): string {
        return `second: ${payload.value}`;
      }
    }

    Container.set(FirstTask, new FirstTask());
    Container.set(SecondTask, new SecondTask());
    const manager = new ExecutionManagerImpl(new MemoryExecutionStore());
    const runner = new TaskRunner(manager, TaskRegistry.fromMetadata());

    await expect(
      runner.execute("first-task", { value: "one" }, { idempotencyKey: "same" }),
    ).resolves.toBe("first: one");
    await expect(
      runner.execute("second-task", { value: "two" }, { idempotencyKey: "same" }),
    ).resolves.toBe("second: two");

    const executions = await manager.list();
    expect(executions).toHaveLength(2);
    expect(executions.map((execution) => execution.idempotencyKey)).toEqual([
      expect.stringMatching(/^task:v2:[a-f0-9]{64}$/),
      expect.stringMatching(/^task:v2:[a-f0-9]{64}$/),
    ]);
    expect(executions[0].idempotencyKey).not.toBe(executions[1].idempotencyKey);
  });

  it("should reuse only an identical task request for the same runtime key", async () => {
    let invocationCount = 0;

    @Component()
    class IdempotentTask {
      @Task({ name: "idempotent-task" })
      handle(payload: { value: string }): string {
        invocationCount += 1;
        return `processed: ${payload.value}`;
      }
    }

    Container.set(IdempotentTask, new IdempotentTask());
    const manager = new ExecutionManagerImpl(new MemoryExecutionStore());
    const runner = new TaskRunner(manager, TaskRegistry.fromMetadata());

    await expect(
      runner.execute("idempotent-task", { value: "one" }, { idempotencyKey: "same" }),
    ).resolves.toBe("processed: one");
    await expect(
      runner.execute("idempotent-task", { value: "one" }, { idempotencyKey: "same" }),
    ).resolves.toBe("processed: one");
    await expect(
      runner.execute("idempotent-task", { value: "two" }, { idempotencyKey: "same" }),
    ).rejects.toMatchObject({
      code: "execution/idempotency-conflict",
    });
    expect(invocationCount).toBe(1);
  });

  it("should reuse only a matching legacy runtime key during scoped-key rollout", async () => {
    let invocationCount = 0;

    @Component()
    class MigratedTask {
      @Task({ name: "migrated-task" })
      handle(): string {
        invocationCount += 1;
        return "new-result";
      }
    }

    Container.set(MigratedTask, new MigratedTask());
    const manager = new ExecutionManagerImpl(new MemoryExecutionStore());
    const matchingLegacy = await manager.create({
      type: "migrated-task",
      payload: { value: "same" },
      idempotencyKey: "matching-legacy",
    });
    await manager.start(matchingLegacy.id);
    await manager.complete(matchingLegacy.id, "legacy-result");
    await manager.create({
      type: "other-task",
      payload: { value: "other" },
      idempotencyKey: "conflicting-legacy",
    });
    const runner = new TaskRunner(manager, TaskRegistry.fromMetadata());

    await expect(
      runner.execute("migrated-task", { value: "same" }, { idempotencyKey: "matching-legacy" }),
    ).resolves.toBe("legacy-result");
    await expect(
      runner.execute("migrated-task", { value: "new" }, { idempotencyKey: "conflicting-legacy" }),
    ).resolves.toBe("new-result");
    expect(invocationCount).toBe(1);
  });
});
