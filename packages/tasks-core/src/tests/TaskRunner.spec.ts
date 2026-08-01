import type { Execution, ExecutionManager } from "@croco/execution-core";
import type { ILogger } from "@croco/framework-context";
import { Component, Container, MetadataStorage } from "@croco/framework-context";
import * as telemetry from "@croco/telemetry-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Task } from "../libs/decorators/Task";
import {
  TaskExecutionTimeoutProblem,
  TaskNotFoundProblem,
  TaskRunnerDIFailureProblem,
} from "../libs/problems/TasksProblems";
import { TaskRegistry } from "../libs/TaskRegistry";
import { TaskRunner } from "../libs/TaskRunner";
import type { TaskExecutionContext, TaskMetadata } from "../libs/types";

function execution(overrides: Partial<Execution> = {}): Execution {
  return {
    id: "exec-123",
    type: "test-task",
    status: "pending",
    attempts: 0,
    maxAttempts: 1,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("TaskRunner", () => {
  let mockExecutionManager!: ExecutionManager;
  let registry!: TaskRegistry;
  let createdExecution!: Execution;

  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
    TaskRegistry.getInstance().reset();
    registry = new TaskRegistry();

    mockExecutionManager = {
      get: vi.fn().mockResolvedValue(execution()),
      create: vi.fn().mockImplementation(async (params) => {
        createdExecution = execution({
          type: params.type,
          payload: params.payload,
          maxAttempts: params.maxAttempts ?? 1,
          timeout: params.timeout,
        });
        return createdExecution;
      }),
      start: vi.fn().mockImplementation(async (id: string) => ({
        ...createdExecution,
        id,
        status: "running",
        attempts: 1,
        startedAt: new Date(),
      })),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      checkpoint: vi.fn().mockResolvedValue(undefined),
      timeout: vi.fn().mockResolvedValue(undefined),
      reconcileTimedOut: vi.fn().mockResolvedValue({ scanned: 0, timedOut: 0 }),
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

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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
      idempotencyKey: expect.stringMatching(/^task:v2:[a-f0-9]{64}$/),
      legacyIdempotencyKeys: ["workflow-1:sync"],
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
      idempotencyKey: expect.stringMatching(/^task:v2:[a-f0-9]{64}$/),
      legacyIdempotencyKeys: ["workflow-1:configured:task:configured-key"],
    });
  });

  it("should keep long unicode runtime keys within the persisted key limit", async () => {
    const runner = new TaskRunner(mockExecutionManager, registry);
    const runtimeKey = "한".repeat(255);

    await runner.execute("test-task", { data: "test" }, { idempotencyKey: runtimeKey });

    expect(mockExecutionManager.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^task:v2:[a-f0-9]{64}$/),
        legacyIdempotencyKeys: [runtimeKey],
      }),
    );
    const params = vi.mocked(mockExecutionManager.create).mock.calls[0][0];
    expect(params.idempotencyKey).toHaveLength(72);
  });

  it("should namespace configured-only keys away from runtime key text", async () => {
    @Component()
    class ConfiguredTaskHandler {
      @Task({ name: "configured-only-task", idempotencyKey: "task:v2:caller-text" })
      process(): string {
        return "processed";
      }
    }

    Container.set(ConfiguredTaskHandler, new ConfiguredTaskHandler());
    registry.collectFromMetadata();
    const runner = new TaskRunner(mockExecutionManager, registry);

    await runner.execute("configured-only-task", {});

    expect(mockExecutionManager.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^task:v2:[a-f0-9]{64}$/),
        legacyIdempotencyKeys: ["task:v2:caller-text"],
      }),
    );
  });

  it("should return completed idempotent execution result without restarting it", async () => {
    mockExecutionManager.create = vi.fn().mockResolvedValue(
      execution({
        id: "exec-completed",
        payload: { data: "test" },
        result: "processed: cached",
        status: "completed",
      }),
    );
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

  it("should preserve the task failure when failure recording also fails", async () => {
    const taskFailure = new Error("Task failed");
    const recordingFailure = new Error("Execution persistence failed");
    const mockLogger: ILogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };

    @Component()
    class DoublyFailingTaskHandler {
      @Task({ name: "doubly-failing-task" })
      async handle(): Promise<never> {
        throw taskFailure;
      }
    }

    Container.set(DoublyFailingTaskHandler, new DoublyFailingTaskHandler());
    registry.collectFromMetadata();
    mockExecutionManager.fail = vi.fn().mockRejectedValue(recordingFailure);
    const recordErrorSpy = vi.spyOn(telemetry, "recordError").mockImplementation(() => {});
    const runner = new TaskRunner(mockExecutionManager, registry, mockLogger);

    await expect(runner.execute("doubly-failing-task", {})).rejects.toBe(taskFailure);

    expect((taskFailure as Error & { cause?: unknown }).cause).toBe(recordingFailure);
    expect(mockLogger.error).toHaveBeenCalledWith("Failed to record task execution failure", {
      executionId: "exec-123",
      taskError: taskFailure,
      recordingError: recordingFailure,
    });
    expect(recordErrorSpy).toHaveBeenCalledWith(recordingFailure);
  });

  it("should attach failure-recording evidence to a Croco Problem with an undefined cause", async () => {
    const taskFailure = new TaskNotFoundProblem("nested-task");
    const recordingFailure = new Error("Execution persistence failed");

    @Component()
    class ProblemFailingTaskHandler {
      @Task({ name: "problem-failing-task" })
      async handle(): Promise<never> {
        throw taskFailure;
      }
    }

    Container.set(ProblemFailingTaskHandler, new ProblemFailingTaskHandler());
    registry.collectFromMetadata();
    mockExecutionManager.fail = vi.fn().mockRejectedValue(recordingFailure);
    const runner = new TaskRunner(mockExecutionManager, registry);

    await expect(runner.execute("problem-failing-task", {})).rejects.toBe(taskFailure);

    expect(taskFailure.cause).toBe(recordingFailure);
  });

  it("should preserve an existing task error cause with failure-recording evidence", async () => {
    const domainCause = new Error("Domain dependency failed");
    const recordingFailure = new Error("Execution persistence failed");
    const taskFailure = new Error("Task failed") as Error & { cause?: unknown };
    taskFailure.cause = domainCause;

    @Component()
    class CausedFailureTaskHandler {
      @Task({ name: "caused-failure-task" })
      async handle(): Promise<never> {
        throw taskFailure;
      }
    }

    Container.set(CausedFailureTaskHandler, new CausedFailureTaskHandler());
    registry.collectFromMetadata();
    mockExecutionManager.fail = vi.fn().mockRejectedValue(recordingFailure);
    const runner = new TaskRunner(mockExecutionManager, registry);

    await expect(runner.execute("caused-failure-task", {})).rejects.toBe(taskFailure);

    expect(taskFailure.cause).toMatchObject({
      name: "TaskFailureRecordingAggregateError",
      message: "Task failure includes execution failure-recording evidence",
    });
    expect((taskFailure.cause as Error & { errors: readonly unknown[] }).errors).toEqual([
      domainCause,
      recordingFailure,
    ]);
  });

  it("should preserve the task failure when secondary failure logging also fails", async () => {
    const taskFailure = new Error("Task failed");
    const recordingFailure = new Error("Execution persistence failed");
    const loggingFailure = new Error("Failure logging failed");
    const mockLogger: ILogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(() => {
        throw loggingFailure;
      }),
      child: vi.fn().mockReturnThis(),
    };

    @Component()
    class LoggingFailureTaskHandler {
      @Task({ name: "logging-failure-task" })
      async handle(): Promise<never> {
        throw taskFailure;
      }
    }

    Container.set(LoggingFailureTaskHandler, new LoggingFailureTaskHandler());
    registry.collectFromMetadata();
    mockExecutionManager.fail = vi.fn().mockRejectedValue(recordingFailure);
    const recordErrorSpy = vi.spyOn(telemetry, "recordError").mockImplementation(() => {});
    const runner = new TaskRunner(mockExecutionManager, registry, mockLogger);

    await expect(runner.execute("logging-failure-task", {})).rejects.toBe(taskFailure);

    expect(recordErrorSpy).toHaveBeenCalledWith(loggingFailure);
    expect(recordErrorSpy).toHaveBeenCalledWith(recordingFailure);
  });

  it("should retain timeout ownership when failure recording loses a timeout race", async () => {
    const recordingFailure = new Error("Execution persistence failed");
    const runningExecution = execution({
      type: "failing-task",
      status: "running",
      attempts: 1,
      startedAt: new Date(),
      timeout: 100,
    });
    mockExecutionManager.start = vi.fn().mockResolvedValue(runningExecution);
    mockExecutionManager.fail = vi.fn().mockRejectedValue(recordingFailure);
    mockExecutionManager.get = vi.fn().mockResolvedValue({
      ...runningExecution,
      status: "timed_out",
      completedAt: new Date(),
    });
    const runner = new TaskRunner(mockExecutionManager, registry);

    await expect(runner.execute("failing-task", {})).rejects.toBeInstanceOf(
      TaskExecutionTimeoutProblem,
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

    await expect(runner.execute("non-error-task", {})).rejects.toEqual(new Error("String error"));

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

  it("should abort cooperative handlers and persist timeout at the deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let receivedContext: TaskExecutionContext | undefined;

    @Component()
    class TimedTaskHandler {
      @Task({ name: "timed-task", timeout: 100 })
      async handle(_payload: unknown, context: TaskExecutionContext): Promise<never> {
        receivedContext = context;
        return new Promise((_resolve, reject) => {
          context.signal.addEventListener("abort", () => reject(context.signal.reason), {
            once: true,
          });
        });
      }
    }

    Container.set(TimedTaskHandler, new TimedTaskHandler());
    registry.collectFromMetadata();
    mockExecutionManager.start = vi.fn().mockResolvedValue(
      execution({
        type: "timed-task",
        payload: {},
        status: "running",
        attempts: 1,
        startedAt: new Date(),
        timeout: 100,
      }),
    );
    const runner = new TaskRunner(mockExecutionManager, registry);

    const result = runner.execute("timed-task", {});
    const rejection = expect(result).rejects.toBeInstanceOf(TaskExecutionTimeoutProblem);
    await vi.advanceTimersByTimeAsync(100);

    await rejection;
    expect(receivedContext).toMatchObject({ executionId: "exec-123", attempt: 1 });
    expect(receivedContext?.signal.aborted).toBe(true);
    expect(mockExecutionManager.timeout).toHaveBeenCalledWith("exec-123");
    expect(mockExecutionManager.complete).not.toHaveBeenCalled();
    expect(mockExecutionManager.fail).not.toHaveBeenCalled();
  });

  it("should use injected time and scheduling boundaries for deterministic timeouts", async () => {
    let now = new Date("2026-01-01T00:00:00.000Z").getTime();
    let scheduledTimeout: (() => void) | undefined;
    let receivedContext: TaskExecutionContext | undefined;

    @Component()
    class ControlledTimedTaskHandler {
      @Task({ name: "controlled-timed-task", timeout: 100 })
      async handle(_payload: unknown, context: TaskExecutionContext): Promise<never> {
        receivedContext = context;
        return new Promise((_resolve, reject) => {
          context.signal.addEventListener("abort", () => reject(context.signal.reason), {
            once: true,
          });
        });
      }
    }

    Container.set(ControlledTimedTaskHandler, new ControlledTimedTaskHandler());
    registry.collectFromMetadata();
    mockExecutionManager.start = vi.fn().mockResolvedValue(
      execution({
        type: "controlled-timed-task",
        payload: {},
        status: "running",
        attempts: 1,
        startedAt: new Date(now),
        timeout: 100,
      }),
    );
    const runner = new TaskRunner(mockExecutionManager, registry, undefined, {
      now: () => now,
      schedule: (callback) => {
        scheduledTimeout = callback;
        return () => {
          scheduledTimeout = undefined;
        };
      },
    });

    const result = runner.execute("controlled-timed-task", {});
    await vi.waitFor(() => expect(scheduledTimeout).toBeDefined());
    now += 100;
    scheduledTimeout?.();

    await expect(result).rejects.toBeInstanceOf(TaskExecutionTimeoutProblem);
    expect(receivedContext?.signal.aborted).toBe(true);
    expect(mockExecutionManager.timeout).toHaveBeenCalledWith("exec-123");
  });

  it("should ignore a handler result that arrives after timeout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let resolveHandler!: (value: string) => void;

    @Component()
    class LateTaskHandler {
      @Task({ name: "late-task", timeout: 50 })
      async handle(): Promise<string> {
        return new Promise((resolve) => {
          resolveHandler = resolve;
        });
      }
    }

    Container.set(LateTaskHandler, new LateTaskHandler());
    registry.collectFromMetadata();
    mockExecutionManager.start = vi.fn().mockResolvedValue(
      execution({
        type: "late-task",
        status: "running",
        attempts: 1,
        startedAt: new Date(),
        timeout: 50,
      }),
    );
    const runner = new TaskRunner(mockExecutionManager, registry);

    const result = runner.execute("late-task", {});
    const rejection = expect(result).rejects.toBeInstanceOf(TaskExecutionTimeoutProblem);
    await vi.advanceTimersByTimeAsync(50);
    await rejection;
    resolveHandler("late success");
    await Promise.resolve();

    expect(mockExecutionManager.complete).not.toHaveBeenCalled();
    expect(mockExecutionManager.fail).not.toHaveBeenCalled();
  });

  it("should treat handler settlement at the persisted deadline as timed out", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    @Component()
    class BoundaryTaskHandler {
      @Task({ name: "boundary-task", timeout: 100 })
      async handle(): Promise<string> {
        return new Promise((resolve) => {
          setTimeout(() => resolve("boundary success"), 100);
        });
      }
    }

    Container.set(BoundaryTaskHandler, new BoundaryTaskHandler());
    registry.collectFromMetadata();
    mockExecutionManager.start = vi.fn().mockResolvedValue(
      execution({
        type: "boundary-task",
        status: "running",
        attempts: 1,
        startedAt: new Date(),
        timeout: 100,
      }),
    );
    const runner = new TaskRunner(mockExecutionManager, registry);

    const result = runner.execute("boundary-task", {});
    const rejection = expect(result).rejects.toBeInstanceOf(TaskExecutionTimeoutProblem);
    await vi.advanceTimersByTimeAsync(100);

    await rejection;
    expect(mockExecutionManager.timeout).toHaveBeenCalledWith("exec-123");
    expect(mockExecutionManager.complete).not.toHaveBeenCalled();
  });

  it("should chunk timeout scheduling beyond the Node timer limit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const largeTimeout = 2_147_483_648;

    mockExecutionManager.start = vi.fn().mockResolvedValue(
      execution({
        type: "test-task",
        payload: { data: "large timeout" },
        status: "running",
        attempts: 1,
        startedAt: new Date(),
        timeout: largeTimeout,
      }),
    );
    const runner = new TaskRunner(mockExecutionManager, registry);

    await expect(runner.execute("test-task", { data: "large timeout" })).resolves.toBe(
      "processed: large timeout",
    );

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2_147_483_647);
    expect(mockExecutionManager.timeout).not.toHaveBeenCalled();
  });

  it("should not invoke the handler when DI resolution consumes the deadline", async () => {
    vi.useFakeTimers();
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(startedAt);
    const handle = vi.fn().mockResolvedValue("too late");

    @Component()
    class SlowSetupTaskHandler {
      @Task({ name: "slow-setup-task", timeout: 100 })
      async handle(): Promise<string> {
        return handle();
      }
    }

    const instance = new SlowSetupTaskHandler();
    Container.set(SlowSetupTaskHandler, instance);
    registry.collectFromMetadata();
    mockExecutionManager.start = vi.fn().mockResolvedValue(
      execution({
        type: "slow-setup-task",
        status: "running",
        attempts: 1,
        startedAt,
        timeout: 100,
      }),
    );
    vi.spyOn(Container, "get").mockImplementation(() => {
      vi.setSystemTime(new Date(startedAt.getTime() + 100));
      return instance;
    });
    const runner = new TaskRunner(mockExecutionManager, registry);

    await expect(runner.execute("slow-setup-task", {})).rejects.toBeInstanceOf(
      TaskExecutionTimeoutProblem,
    );

    expect(handle).not.toHaveBeenCalled();
    expect(mockExecutionManager.timeout).toHaveBeenCalledWith("exec-123");
  });

  it("should preserve the typed timeout when reconciliation wins the timeout transition", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    @Component()
    class ReconciledTaskHandler {
      @Task({ name: "reconciled-task", timeout: 25 })
      async handle(): Promise<never> {
        return new Promise(() => {});
      }
    }

    Container.set(ReconciledTaskHandler, new ReconciledTaskHandler());
    registry.collectFromMetadata();
    const running = execution({
      type: "reconciled-task",
      status: "running",
      attempts: 1,
      startedAt: new Date(),
      timeout: 25,
    });
    mockExecutionManager.start = vi.fn().mockResolvedValue(running);
    mockExecutionManager.timeout = vi.fn().mockRejectedValue(new Error("transition lost"));
    mockExecutionManager.get = vi.fn().mockResolvedValue({
      ...running,
      status: "timed_out",
      completedAt: new Date(),
    });
    const runner = new TaskRunner(mockExecutionManager, registry);

    const result = runner.execute("reconciled-task", {});
    const rejection = expect(result).rejects.toBeInstanceOf(TaskExecutionTimeoutProblem);
    await vi.advanceTimersByTimeAsync(25);

    await rejection;
    expect(mockExecutionManager.get).toHaveBeenCalledWith("exec-123");
    expect(mockExecutionManager.fail).not.toHaveBeenCalled();
  });

  it("should observe but not persist a handler rejection after timeout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let rejectHandler!: (error: Error) => void;

    @Component()
    class LateRejectingTaskHandler {
      @Task({ name: "late-rejecting-task", timeout: 25 })
      async handle(): Promise<never> {
        return new Promise((_resolve, reject) => {
          rejectHandler = reject;
        });
      }
    }

    Container.set(LateRejectingTaskHandler, new LateRejectingTaskHandler());
    registry.collectFromMetadata();
    mockExecutionManager.start = vi.fn().mockResolvedValue(
      execution({
        type: "late-rejecting-task",
        status: "running",
        attempts: 1,
        startedAt: new Date(),
        timeout: 25,
      }),
    );
    const runner = new TaskRunner(mockExecutionManager, registry);

    const result = runner.execute("late-rejecting-task", {});
    const rejection = expect(result).rejects.toBeInstanceOf(TaskExecutionTimeoutProblem);
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    rejectHandler(new Error("late failure"));
    await Promise.resolve();

    expect(mockExecutionManager.fail).not.toHaveBeenCalled();
    expect(mockExecutionManager.complete).not.toHaveBeenCalled();
  });

  it("should retry the original execution without creating a replacement", async () => {
    const timedOut = execution({
      id: "exec-timeout",
      type: "test-task",
      payload: { data: "retry" },
      status: "timed_out",
      attempts: 1,
      maxAttempts: 2,
      timeout: 100,
    });
    mockExecutionManager.get = vi.fn().mockResolvedValue(timedOut);
    mockExecutionManager.retry = vi.fn().mockResolvedValue({
      ...timedOut,
      status: "retrying",
    });
    mockExecutionManager.start = vi.fn().mockResolvedValue({
      ...timedOut,
      status: "running",
      attempts: 2,
      startedAt: new Date(),
      timeout: undefined,
    });
    const runner = new TaskRunner(mockExecutionManager, registry);

    const result = await runner.retry("exec-timeout");

    expect(result).toBe("processed: retry");
    expect(mockExecutionManager.get).toHaveBeenCalledWith("exec-timeout");
    expect(mockExecutionManager.retry).toHaveBeenCalledWith("exec-timeout");
    expect(mockExecutionManager.create).not.toHaveBeenCalled();
    expect(mockExecutionManager.complete).toHaveBeenCalledWith("exec-timeout", "processed: retry");
  });

  it("should leave timed-out execution unchanged when retry task registration is missing", async () => {
    mockExecutionManager.get = vi
      .fn()
      .mockResolvedValue(
        execution({ id: "exec-missing", type: "missing-task", status: "timed_out" }),
      );
    const runner = new TaskRunner(mockExecutionManager, registry);

    await expect(runner.retry("exec-missing")).rejects.toThrow("Task not found: 'missing-task'");
    expect(mockExecutionManager.retry).not.toHaveBeenCalled();
    expect(mockExecutionManager.start).not.toHaveBeenCalled();
  });
});
