import type { ExecutionManager } from "@croco/execution-core";
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
});
