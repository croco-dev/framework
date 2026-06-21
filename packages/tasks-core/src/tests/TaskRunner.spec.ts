import type { ExecutionManager } from "@croco/execution-core";
import type { ILogger } from "@croco/framework-context";
import { Component, Container, MetadataStorage } from "@croco/framework-context";
import * as telemetry from "@croco/telemetry-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Task } from "../libs/decorators/Task";
import { TaskRunnerDIFailureProblem } from "../libs/problems/TasksProblems";
import { TaskRegistry } from "../libs/TaskRegistry";
import { TaskRunner } from "../libs/TaskRunner";
import type { TaskMetadata } from "../libs/types";

describe("TaskRunner", () => {
  let mockExecutionManager!: ExecutionManager;
  let registry!: TaskRegistry;

  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
    TaskRegistry.getInstance().reset();
    registry = new TaskRegistry();

    mockExecutionManager = {
      create: vi.fn().mockResolvedValue({
        id: "exec-123",
        type: "test-task",
        payload: { data: "test" },
        status: "pending",
        createdAt: new Date(),
      }),
      start: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      checkpoint: vi.fn().mockResolvedValue(undefined),
      timeout: vi.fn().mockResolvedValue(undefined),
    };

    @Component()
    class TestTaskHandler {
      @Task({ name: "test-task" })
      async handle(payload: { data: string }): Promise<string> {
        return `processed: ${payload.data}`;
      }

      @Task({ name: "failing-task", maxAttempts: 3 })
      async fail(_payload: unknown): Promise<string> {
        throw new Error("Task failed");
      }
    }

    new TestTaskHandler();
    Container.set(TestTaskHandler, new TestTaskHandler());
    registry.collectFromMetadata();
  });

  it("should execute task and return result", async () => {
    const runner = new TaskRunner(mockExecutionManager, registry);

    const result = await runner.execute("test-task", { data: "test" });

    expect(result).toBe("processed: test");
    expect(mockExecutionManager.create).toHaveBeenCalledWith({
      type: "test-task",
      payload: { data: "test" },
      maxAttempts: undefined,
      timeout: undefined,
      idempotencyKey: undefined,
    });
    expect(mockExecutionManager.start).toHaveBeenCalledWith("exec-123");
    expect(mockExecutionManager.complete).toHaveBeenCalledWith("exec-123", "processed: test");
  });

  it("should pass task options to execution manager", async () => {
    const runner = new TaskRunner(mockExecutionManager, registry);

    await expect(runner.execute("failing-task", { test: "data" })).rejects.toThrow("Task failed");

    expect(mockExecutionManager.create).toHaveBeenCalledWith({
      type: "failing-task",
      payload: { test: "data" },
      maxAttempts: 3,
      timeout: undefined,
      idempotencyKey: undefined,
    });
  });

  it("should pass parent execution metadata when provided", async () => {
    const runner = new TaskRunner(mockExecutionManager, registry);

    await runner.execute(
      "test-task",
      { data: "test" },
      {
        parentId: "workflow-1",
        metadata: { workflowName: "billing-sync", workflowStep: "sync" },
      },
    );

    expect(mockExecutionManager.create).toHaveBeenCalledWith({
      type: "test-task",
      payload: { data: "test" },
      maxAttempts: undefined,
      timeout: undefined,
      idempotencyKey: undefined,
      parentId: "workflow-1",
      metadata: { workflowName: "billing-sync", workflowStep: "sync" },
    });
  });

  it("should pass execution-level idempotency key when provided", async () => {
    const runner = new TaskRunner(mockExecutionManager, registry);

    await runner.execute("test-task", { data: "test" }, { idempotencyKey: "workflow-1:sync" });

    expect(mockExecutionManager.create).toHaveBeenCalledWith({
      type: "test-task",
      payload: { data: "test" },
      maxAttempts: undefined,
      timeout: undefined,
      idempotencyKey: "workflow-1:sync",
    });
  });

  it("should compose execution-level idempotency key with configured task key", async () => {
    @Component()
    class IdempotentTaskHandler {
      @Task({ name: "configured-idempotent-task", idempotencyKey: "configured-key" })
      async process(payload: { data: string }): Promise<string> {
        return `processed: ${payload.data}`;
      }
    }

    Container.set(IdempotentTaskHandler, new IdempotentTaskHandler());
    registry.collectFromMetadata();
    const runner = new TaskRunner(mockExecutionManager, registry);

    await runner.execute(
      "configured-idempotent-task",
      { data: "test" },
      { idempotencyKey: "workflow-1:configured" },
    );

    expect(mockExecutionManager.create).toHaveBeenCalledWith({
      type: "configured-idempotent-task",
      payload: { data: "test" },
      maxAttempts: undefined,
      timeout: undefined,
      idempotencyKey: "workflow-1:configured:task:configured-key",
    });
  });

  it("should return completed idempotent execution result without restarting it", async () => {
    mockExecutionManager.create = vi.fn().mockResolvedValue({
      id: "exec-completed",
      type: "test-task",
      payload: { data: "test" },
      result: "processed: cached",
      status: "completed",
      createdAt: new Date(),
    });
    const runner = new TaskRunner(mockExecutionManager, registry);

    const result = await runner.execute("test-task", { data: "test" }, { idempotencyKey: "key" });

    expect(result).toBe("processed: cached");
    expect(mockExecutionManager.start).not.toHaveBeenCalled();
    expect(mockExecutionManager.complete).not.toHaveBeenCalled();
  });

  it("should throw error for non-existent task", async () => {
    const runner = new TaskRunner(mockExecutionManager, registry);

    await expect(runner.execute("non-existent-task", {})).rejects.toThrow(
      "Task not found: 'non-existent-task'",
    );
  });

  it("should handle task execution failure", async () => {
    const runner = new TaskRunner(mockExecutionManager, registry);

    await expect(runner.execute("failing-task", {})).rejects.toThrow("Task failed");

    expect(mockExecutionManager.fail).toHaveBeenCalledWith(
      "exec-123",
      expect.objectContaining({
        message: "Task failed",
        retryable: false,
      }),
    );
  });

  it("should extract retryable flag from error", async () => {
    @Component()
    class RetryableTaskHandler {
      @Task({ name: "retryable-fail" })
      async failWithRetryable(): Promise<string> {
        const error = new Error("Retryable error") as Error & { retryable: boolean };
        error.retryable = true;
        throw error;
      }
    }

    new RetryableTaskHandler();
    Container.set(RetryableTaskHandler, new RetryableTaskHandler());
    registry.register(
      "retryable-fail",
      RetryableTaskHandler,
      "failWithRetryable",
      registry.get("retryable-fail")?.metadata ??
        ({
          name: "retryable-fail",
          target: RetryableTaskHandler,
          methodName: "failWithRetryable",
        } as TaskMetadata),
    );

    const runner = new TaskRunner(mockExecutionManager, registry);

    await expect(runner.execute("retryable-fail", {})).rejects.toThrow("Retryable error");

    expect(mockExecutionManager.fail).toHaveBeenCalledWith(
      "exec-123",
      expect.objectContaining({
        message: "Retryable error",
        retryable: true,
      }),
    );
  });

  it("should extract code from error", async () => {
    @Component()
    class TaskWithCodeError {
      @Task({ name: "code-error-task" })
      async failWithCode(): Promise<string> {
        const error = new Error("Error with code") as Error & { code: string };
        error.code = "ERR_CUSTOM";
        throw error;
      }
    }

    new TaskWithCodeError();
    Container.set(TaskWithCodeError, new TaskWithCodeError());
    registry.register(
      "code-error-task",
      TaskWithCodeError,
      "failWithCode",
      registry.get("code-error-task")?.metadata ??
        ({
          name: "code-error-task",
          target: TaskWithCodeError,
          methodName: "failWithCode",
        } as TaskMetadata),
    );

    const runner = new TaskRunner(mockExecutionManager, registry);

    await expect(runner.execute("code-error-task", {})).rejects.toThrow("Error with code");

    expect(mockExecutionManager.fail).toHaveBeenCalledWith(
      "exec-123",
      expect.objectContaining({
        code: "ERR_CUSTOM",
      }),
    );
  });

  it("should resolve class constructors through the container", async () => {
    @Component()
    class StatelessTaskHandler {
      @Task({ name: "stateless-task" })
      async process(payload: { value: number }): Promise<number> {
        return payload.value * 2;
      }
    }

    Container.set(StatelessTaskHandler, new StatelessTaskHandler());
    registry.collectFromMetadata();
    const getSpy = vi.spyOn(Container, "get");
    const runner = new TaskRunner(mockExecutionManager, registry);

    const result = await runner.execute("stateless-task", { value: 21 });

    expect(result).toBe(42);
    expect(getSpy).toHaveBeenCalledWith(StatelessTaskHandler);
  });

  it("should handle non-Error objects in error handling", async () => {
    @Component()
    class NonErrorTaskHandler {
      @Task({ name: "non-error-task" })
      async throwString(): Promise<string> {
        throw "String error";
      }
    }

    new NonErrorTaskHandler();
    Container.set(NonErrorTaskHandler, new NonErrorTaskHandler());
    registry.register(
      "non-error-task",
      NonErrorTaskHandler,
      "throwString",
      registry.get("non-error-task")?.metadata ??
        ({
          name: "non-error-task",
          target: NonErrorTaskHandler,
          methodName: "throwString",
        } as TaskMetadata),
    );

    const runner = new TaskRunner(mockExecutionManager, registry);

    await expect(runner.execute("non-error-task", {})).rejects.toThrow("String error");

    expect(mockExecutionManager.fail).toHaveBeenCalledWith(
      "exec-123",
      expect.objectContaining({
        message: "String error",
      }),
    );
  });

  it("should throw Problem when DI resolution fails", async () => {
    class DITaskHandler {
      @Task({ name: "di-fail-task" })
      async process(payload: { value: number }): Promise<number> {
        return payload.value * 2;
      }
    }

    new DITaskHandler();
    registry.collectFromMetadata();

    const mockLogger: ILogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };

    const recordErrorSpy = vi.spyOn(telemetry, "recordError").mockImplementation(() => {});

    const containerError = new Error("DI resolution failed");
    vi.spyOn(Container, "get").mockImplementation(() => {
      throw containerError;
    });

    const runner = new TaskRunner(mockExecutionManager, registry, mockLogger);

    await expect(runner.execute("di-fail-task", { value: 5 })).rejects.toBeInstanceOf(
      TaskRunnerDIFailureProblem,
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "DI resolution failed while creating task instance",
      {
        target: "DITaskHandler",
        error: "DI resolution failed",
      },
    );
    expect(recordErrorSpy).toHaveBeenCalledWith(containerError);
    expect(mockExecutionManager.fail).toHaveBeenCalledWith(
      "exec-123",
      expect.objectContaining({
        message: "Failed to resolve task 'DITaskHandler'",
        retryable: false,
        code: "tasks-core/task-runner-di-failure",
      }),
    );

    recordErrorSpy.mockRestore();
  });
});
