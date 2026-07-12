import {
  type CreateExecutionParams,
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

  async create(params: CreateExecutionParams): Promise<Execution> {
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
});
