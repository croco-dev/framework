import {
  ExecutionManagerImpl,
  type CreateExecutionParams,
  type Execution,
  type ExecutionManager,
  type ExecutionStore,
  type ListExecutionsOptions,
} from "@croco/execution-core";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ChunkExecutor } from "../libs/ChunkExecutor";
import type { ItemReader } from "../libs/interfaces/ItemReader";
import { Step } from "../libs/Step";

describe("ChunkExecutor", () => {
  let executionManager!: ExecutionManager;
  let executor!: ChunkExecutor;

  beforeEach(() => {
    executionManager = {
      start: vi.fn().mockResolvedValue({ id: "exec-1", checkpoints: {} }),
      checkpoint: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    executor = new ChunkExecutor(executionManager);
  });

  it("should execute a simple step", async () => {
    const reader = {
      read: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(null),
    };
    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const step = new Step<number, number>({
      name: "test-step",
      reader,
      writer,
      chunkSize: 2,
    });

    await executor.execute("exec-1", step);

    expect(executionManager.start).toHaveBeenCalledWith("exec-1");
    expect(reader.read).toHaveBeenCalledTimes(3);
    expect(writer.write).toHaveBeenCalledWith([1, 2]);
    expect(executionManager.complete).toHaveBeenCalledWith("exec-1", { processedCount: 2 });
    expect(executionManager.updateProgress).not.toHaveBeenCalled();
  });

  it("should update progress after each successful chunk when total is available", async () => {
    (executionManager.start as Mock).mockResolvedValue({
      id: "exec-1",
      checkpoints: {},
      progress: { current: 0, total: 3 },
    });

    const reader = {
      read: vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(null),
    };
    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const step = new Step<number, number>({
      name: "test-step",
      reader,
      writer,
      chunkSize: 2,
    });

    await executor.execute("exec-1", step);

    expect(executionManager.updateProgress).toHaveBeenNthCalledWith(1, "exec-1", {
      current: 2,
      total: 3,
    });
    expect(executionManager.updateProgress).toHaveBeenNthCalledWith(2, "exec-1", {
      current: 3,
      total: 3,
    });
    expect(executionManager.complete).toHaveBeenCalledWith("exec-1", { processedCount: 3 });
  });

  it("should support checkpointing", async () => {
    const reader = {
      read: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(null),
      getCheckpoint: vi.fn().mockReturnValue({ offset: 10 }),
      restoreCheckpoint: vi.fn(),
    };

    (executionManager.start as Mock).mockResolvedValue({
      id: "exec-1",
      checkpoints: { "test-step.cursor": { offset: 5 } },
    });

    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const step = new Step<number, number>({
      name: "test-step",
      reader: reader as unknown as ItemReader<number>,
      writer,
      chunkSize: 1,
    });

    await executor.execute("exec-1", step);

    expect(reader.restoreCheckpoint).toHaveBeenCalledWith({ offset: 5 });
    expect(reader.read).toHaveBeenCalledTimes(2);
    expect(writer.write).toHaveBeenCalledWith([3]);
    expect(executionManager.checkpoint).toHaveBeenCalledWith("exec-1", "test-step.cursor", {
      offset: 10,
    });
  });

  it("should keep multi-step executions open when completion is disabled", async () => {
    const reader = {
      read: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(null),
      getCheckpoint: vi.fn().mockReturnValue({ offset: 1 }),
      restoreCheckpoint: vi.fn(),
    };
    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };
    const step = new Step<number, number>({
      name: "first-step",
      reader: reader as unknown as ItemReader<number>,
      writer,
      chunkSize: 1,
    });

    await executor.execute("exec-1", step, { completeExecution: false });

    expect(writer.write).toHaveBeenCalledWith([1]);
    expect(executionManager.checkpoint).toHaveBeenCalledWith("exec-1", "first-step.cursor", {
      offset: 1,
    });
    expect(executionManager.complete).not.toHaveBeenCalled();
  });

  it("should continue a running execution across multiple steps", async () => {
    const realManager = new ExecutionManagerImpl(new TestExecutionStore());
    const realExecutor = new ChunkExecutor(realManager);
    const execution = await realManager.create({ type: "batch-job" });
    const firstReader = createCheckpointReader([1]);
    const firstWriter = { write: vi.fn().mockResolvedValue(undefined) };
    const secondReader = createCheckpointReader([2]);
    const secondWriter = { write: vi.fn().mockResolvedValue(undefined) };

    await realExecutor.execute(
      execution.id,
      new Step<number, number>({
        name: "extract",
        reader: firstReader as unknown as ItemReader<number>,
        writer: firstWriter,
        chunkSize: 1,
      }),
      { completeExecution: false },
    );

    const running = await realManager.get(execution.id);
    expect(running.status).toBe("running");
    expect(running.completedAt).toBeUndefined();
    expect(running.checkpoints).toEqual({
      "extract.cursor": { offset: 1 },
    });

    await realExecutor.execute(
      execution.id,
      new Step<number, number>({
        name: "load",
        reader: secondReader as unknown as ItemReader<number>,
        writer: secondWriter,
        chunkSize: 1,
      }),
      { startExecution: false },
    );

    const completed = await realManager.get(execution.id);
    expect(completed.status).toBe("completed");
    expect(completed.attempts).toBe(1);
    expect(completed.checkpoints).toEqual({
      "extract.cursor": { offset: 1 },
      "load.cursor": { offset: 1 },
    });
    expect(firstWriter.write).toHaveBeenCalledWith([1]);
    expect(secondWriter.write).toHaveBeenCalledWith([2]);
  });

  it("should resume retryable failures from the last successful checkpoint", async () => {
    const realManager = new ExecutionManagerImpl(new TestExecutionStore());
    const realExecutor = new ChunkExecutor(realManager);
    const execution = await realManager.create({ type: "batch-job", maxAttempts: 2 });
    await realManager.updateProgress(execution.id, { current: 0, total: 3 });

    const reader = createCheckpointReader([1, 2, 3]);
    const writes: number[][] = [];
    let shouldFailChunk = true;
    const writer = {
      write: vi.fn().mockImplementation(async (items: number[]) => {
        writes.push([...items]);
        if (shouldFailChunk && items.includes(3)) {
          shouldFailChunk = false;
          throw new Error("temporary sink outage");
        }
      }),
    };
    const step = new Step<number, number>({
      name: "import-users",
      reader: reader as unknown as ItemReader<number>,
      writer,
      chunkSize: 2,
    });

    await expect(realExecutor.execute(execution.id, step)).rejects.toThrow("temporary sink outage");

    const retrying = await realManager.get(execution.id);
    expect(retrying.status).toBe("retrying");
    expect(retrying.error).toEqual(
      expect.objectContaining({
        message: "temporary sink outage",
        retryable: true,
      }),
    );
    expect(retrying.checkpoints).toEqual({
      "import-users.cursor": { offset: 2 },
    });
    expect(retrying.progress).toEqual({
      current: 2,
      total: 3,
      percent: 67,
    });

    await realExecutor.execute(execution.id, step);

    const completed = await realManager.get(execution.id);
    expect(completed.status).toBe("completed");
    expect(completed.error).toBeUndefined();
    expect(completed.result).toEqual({ processedCount: 3 });
    expect(completed.checkpoints).toEqual({
      "import-users.cursor": { offset: 3 },
    });
    expect(completed.progress).toEqual({
      current: 3,
      total: 3,
      percent: 100,
    });
    expect(reader.restoreCheckpoint).toHaveBeenCalledWith({ offset: 2 });
    expect(writes).toEqual([[1, 2], [3], [3]]);
  });

  it("should not seed retry progress without a restored step checkpoint", async () => {
    const realManager = new ExecutionManagerImpl(new TestExecutionStore());
    const realExecutor = new ChunkExecutor(realManager);
    const execution = await realManager.create({ type: "batch-job", maxAttempts: 2 });
    await realManager.start(execution.id);
    await realManager.updateProgress(execution.id, { current: 2, total: 3 });
    await realManager.fail(execution.id, {
      message: "temporary sink outage",
      retryable: true,
    });

    const reader = {
      read: vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(null),
    };
    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };
    const step = new Step<number, number>({
      name: "non-checkpointable-import",
      reader,
      writer,
      chunkSize: 3,
    });

    await realExecutor.execute(execution.id, step);

    const completed = await realManager.get(execution.id);
    expect(completed.status).toBe("completed");
    expect(completed.result).toEqual({ processedCount: 3 });
    expect(completed.progress).toEqual({
      current: 3,
      total: 3,
      percent: 100,
    });
    expect(writer.write).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("should leave a failed writer chunk uncheckpointed for idempotent retry", async () => {
    const reader = createCheckpointReader([1, 2]);
    const writer = {
      write: vi.fn().mockRejectedValue(new Error("write failed before checkpoint")),
    };
    const step = new Step<number, number>({
      name: "write-step",
      reader: reader as unknown as ItemReader<number>,
      writer,
      chunkSize: 2,
    });

    await expect(executor.execute("exec-1", step)).rejects.toThrow(
      "write failed before checkpoint",
    );

    expect(writer.write).toHaveBeenCalledWith([1, 2]);
    expect(executionManager.checkpoint).not.toHaveBeenCalled();
    expect(executionManager.fail).toHaveBeenCalledWith(
      "exec-1",
      expect.objectContaining({
        message: "write failed before checkpoint",
        retryable: true,
      }),
    );
  });

  it("should record processor failure metadata for operator inspection", async () => {
    const realManager = new ExecutionManagerImpl(new TestExecutionStore());
    const realExecutor = new ChunkExecutor(realManager);
    const execution = await realManager.create({ type: "batch-job" });
    const processorError = Object.assign(new Error("invalid row"), {
      code: "BATCH_INVALID_ROW",
    });
    const reader = {
      read: vi.fn().mockResolvedValueOnce(1),
    };
    const processor = {
      process: vi.fn().mockRejectedValue(processorError),
    };
    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };
    const step = new Step<number, number>({
      name: "validate-row",
      reader,
      processor,
      writer,
      classifyFailure: () => ({ retryable: false }),
    });

    await expect(realExecutor.execute(execution.id, step)).rejects.toThrow("invalid row");

    const failed = await realManager.get(execution.id);
    expect(failed.status).toBe("failed");
    expect(failed.error).toEqual(
      expect.objectContaining({
        message: "invalid row",
        code: "BATCH_INVALID_ROW",
        retryable: false,
      }),
    );
    expect(writer.write).not.toHaveBeenCalled();
    expect(failed.checkpoints).toBeUndefined();
  });

  it("should handle errors", async () => {
    const error = new Error("Read failed");
    const reader = {
      read: vi.fn().mockRejectedValue(error),
    };
    const writer = { write: vi.fn() };

    const step = new Step<number, number>({
      name: "fail-step",
      reader: reader as unknown as ItemReader<number>,
      writer,
    });

    await expect(executor.execute("exec-1", step)).rejects.toThrow("Read failed");
    expect(executionManager.fail).toHaveBeenCalledWith(
      "exec-1",
      expect.objectContaining({
        message: "Read failed",
        retryable: true,
      }),
    );
  });

  it("should preserve non-retryable failure classification", async () => {
    const error = Object.assign(new Error("Validation failed"), {
      code: "VALIDATION_ERROR",
    });
    const classifyFailure = vi.fn().mockReturnValue({ retryable: false });
    const reader = {
      read: vi.fn().mockRejectedValue(error),
    };
    const writer = { write: vi.fn() };

    const step = new Step<number, number>({
      name: "non-retryable-step",
      reader: reader as unknown as ItemReader<number>,
      writer,
      classifyFailure,
    });

    await expect(executor.execute("exec-1", step)).rejects.toThrow("Validation failed");
    expect(classifyFailure).toHaveBeenCalledWith(error, {
      executionId: "exec-1",
      stepName: "non-retryable-step",
    });
    expect(executionManager.fail).toHaveBeenCalledWith(
      "exec-1",
      expect.objectContaining({
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        retryable: false,
      }),
    );
  });

  it("should record the original failure when classification throws", async () => {
    const error = new Error("Read failed");
    const classifyFailure = vi.fn().mockImplementation(() => {
      throw new Error("Classifier failed");
    });
    const reader = {
      read: vi.fn().mockRejectedValue(error),
    };
    const writer = { write: vi.fn() };

    const step = new Step<number, number>({
      name: "classifier-failure-step",
      reader: reader as unknown as ItemReader<number>,
      writer,
      classifyFailure,
    });

    await expect(executor.execute("exec-1", step)).rejects.toThrow("Read failed");
    expect(executionManager.fail).toHaveBeenCalledWith(
      "exec-1",
      expect.objectContaining({
        message: "Read failed",
        code: "batch-core/failure-classification-failed",
        retryable: true,
      }),
    );
  });

  it("should expose classifier failures even when the original error has a code", async () => {
    const error = Object.assign(new Error("Read failed"), {
      code: "UPSTREAM_READ_FAILED",
    });
    const classifyFailure = vi.fn().mockImplementation(() => {
      throw new Error("Classifier failed");
    });
    const reader = {
      read: vi.fn().mockRejectedValue(error),
    };
    const writer = { write: vi.fn() };

    const step = new Step<number, number>({
      name: "coded-classifier-failure-step",
      reader: reader as unknown as ItemReader<number>,
      writer,
      classifyFailure,
    });

    await expect(executor.execute("exec-1", step)).rejects.toThrow("Read failed");
    expect(executionManager.fail).toHaveBeenCalledWith(
      "exec-1",
      expect.objectContaining({
        message: "Read failed",
        code: "batch-core/failure-classification-failed",
        retryable: true,
      }),
    );
  });
});

class TestExecutionStore implements ExecutionStore {
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

type OffsetCheckpoint = {
  readonly offset: number;
};

function createCheckpointReader<T>(items: readonly T[]): ItemReader<T> & {
  readonly getCheckpoint: Mock<() => OffsetCheckpoint>;
  readonly restoreCheckpoint: Mock<(checkpoint: unknown) => void>;
} {
  let offset = 0;

  return {
    read: vi.fn(async () => {
      if (offset >= items.length) {
        return null;
      }

      return items[offset++];
    }),
    getCheckpoint: vi.fn(() => ({ offset })),
    restoreCheckpoint: vi.fn((checkpoint: unknown) => {
      if (isOffsetCheckpoint(checkpoint)) {
        offset = checkpoint.offset;
      }
    }),
  };
}

function isOffsetCheckpoint(checkpoint: unknown): checkpoint is OffsetCheckpoint {
  return (
    typeof checkpoint === "object" &&
    checkpoint !== null &&
    "offset" in checkpoint &&
    typeof checkpoint.offset === "number"
  );
}
