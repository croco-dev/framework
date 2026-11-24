import {
  type CreateExecutionRecordParams,
  type Execution,
  type ExecutionManager,
  ExecutionManagerImpl,
  ExecutionProblems,
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
      get: vi.fn().mockResolvedValue({ id: "exec-1", status: "running", attempts: 1 }),
      start: vi
        .fn()
        .mockResolvedValue({ id: "exec-1", status: "running", attempts: 1, checkpoints: {} }),
      checkpoint: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    executor = new ChunkExecutor(executionManager);
  });

  describe("cooperative cancellation", () => {
    it.each([
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ])(
      "stops after an in-flight write and retains committed evidence (checkpoint=%s, total=%s)",
      async (checkpointed, hasTotal) => {
        const manager = new ExecutionManagerImpl(new TestExecutionStore());
        const execution = await manager.create({ type: "batch-job", maxAttempts: 3 });
        if (hasTotal) await manager.updateProgress(execution.id, { current: 0, total: 3 });
        const source = createCheckpointReader([1, 2, 3]);
        const reader = checkpointed ? source : { read: source.read };
        const entered = createBarrier();
        const release = createBarrier();
        const written: number[] = [];
        const writer = {
          write: vi.fn(async (items: number[]) => {
            entered.resolve();
            await release.promise;
            written.push(...items);
          }),
        };
        const fail = vi.spyOn(manager, "fail");
        const complete = vi.spyOn(manager, "complete");
        const step = new Step({ name: "cancelled-step", reader, writer, chunkSize: 1 });
        const running = new ChunkExecutor(manager).execute(execution.id, step);
        await entered.promise;
        const cancelled = await manager.cancel(execution.id, "operator request");
        release.resolve();
        await expect(running).resolves.toBeUndefined();
        expect(written).toEqual([1]);
        expect(writer.write).toHaveBeenCalledTimes(1);
        expect(source.read).toHaveBeenCalledTimes(1);
        expect(fail).not.toHaveBeenCalled();
        expect(complete).not.toHaveBeenCalled();
        const final = await manager.get(execution.id);
        expect(final).toMatchObject({
          status: "cancelled",
          attempts: 1,
          completedAt: cancelled.completedAt,
          metadata: { cancellationReason: "operator request" },
        });
        expect(final.error).toBeUndefined();
        expect(final.result).toBeUndefined();
        if (checkpointed) {
          expect(final.checkpoints).toEqual({
            "cancelled-step.chunkCheckpoint": {
              version: 1,
              cursor: { offset: 1 },
              processedCount: 1,
            },
          });
        } else {
          expect(final.checkpoints).toBeUndefined();
        }
        expect(final.progress).toEqual(
          hasTotal ? { current: 1, total: 3, percent: 33 } : undefined,
        );
      },
    );

    it.each(["reader", "processor", "eof", "filtered"] as const)(
      "discards uncommitted work cancelled during %s",
      async (boundary) => {
        const manager = new ExecutionManagerImpl(new TestExecutionStore());
        const execution = await manager.create({ type: "batch-job" });
        const entered = createBarrier();
        const release = createBarrier();
        let offset = 0;
        const reader = {
          read: vi.fn(async () => {
            offset += 1;
            if (boundary === "reader" || (boundary === "eof" && offset === 2)) {
              entered.resolve();
              await release.promise;
            }
            return offset === 1 ? 7 : null;
          }),
          getCheckpoint: () => ({ offset }),
          restoreCheckpoint: vi.fn(),
        };
        const processor = {
          process: vi.fn(async (item: number) => {
            if (boundary === "processor" || boundary === "filtered") {
              entered.resolve();
              await release.promise;
            }
            return boundary === "filtered" ? null : item;
          }),
        };
        const writer = { write: vi.fn() };
        const running = new ChunkExecutor(manager).execute(
          execution.id,
          new Step({ name: "awaiting", reader, processor, writer, chunkSize: 2 }),
        );
        await entered.promise;
        await manager.cancel(execution.id);
        release.resolve();
        await expect(running).resolves.toBeUndefined();
        expect(writer.write).not.toHaveBeenCalled();
        expect(await manager.get(execution.id)).toMatchObject({ status: "cancelled" });
        expect((await manager.get(execution.id)).checkpoints).toBeUndefined();
        if (boundary === "reader") expect(processor.process).not.toHaveBeenCalled();
      },
    );

    it.each(["cancel", "timeout"] as const)(
      "preserves a failed in-flight write without recording failure over %s",
      async (terminate) => {
        const manager = new ExecutionManagerImpl(new TestExecutionStore());
        const execution = await manager.create({ type: "batch-job", maxAttempts: 3 });
        const fail = vi.spyOn(manager, "fail");
        const entered = createBarrier();
        const release = createBarrier();
        const writeError = new Error("sink rejected write");
        const writer = {
          write: vi.fn(async () => {
            entered.resolve();
            await release.promise;
            throw writeError;
          }),
        };
        const running = new ChunkExecutor(manager).execute(
          execution.id,
          new Step({
            name: "failed-write",
            reader: createCheckpointReader([1, 2]),
            writer,
            chunkSize: 1,
          }),
        );
        const rejection = expect(running).rejects.toBe(writeError);
        await entered.promise;
        await manager[terminate](execution.id);
        release.resolve();
        await rejection;
        expect(fail).not.toHaveBeenCalled();
        expect(await manager.get(execution.id)).toMatchObject({
          status: terminate === "cancel" ? "cancelled" : "timed_out",
        });
        expect((await manager.get(execution.id)).checkpoints).toBeUndefined();
        expect(writer.write).toHaveBeenCalledTimes(1);
      },
    );

    it.each(["cancel", "timeout"] as const)(
      "treats %s racing with completion as a normal stop",
      async (terminate) => {
        const manager = new ExecutionManagerImpl(new TestExecutionStore());
        const execution = await manager.create({ type: "batch-job" });
        const originalComplete = manager.complete.bind(manager);
        vi.spyOn(manager, "complete").mockImplementation(async (id, result) => {
          await manager[terminate](id);
          return originalComplete(id, result);
        });
        const fail = vi.spyOn(manager, "fail");
        await expect(
          new ChunkExecutor(manager).execute(
            execution.id,
            new Step({
              name: "empty",
              reader: { read: async () => null },
              writer: { write: vi.fn() },
            }),
          ),
        ).resolves.toBeUndefined();
        expect(fail).not.toHaveBeenCalled();
        expect(await manager.get(execution.id)).toMatchObject({
          status: terminate === "cancel" ? "cancelled" : "timed_out",
        });
      },
    );

    it.each(["cancel", "timeout"] as const)(
      "does not hide a completion storage failure when %s also arrives",
      async (terminate) => {
        const manager = new ExecutionManagerImpl(new TestExecutionStore());
        const execution = await manager.create({ type: "batch-job" });
        const storageError = new Error("completion store unavailable");
        vi.spyOn(manager, "complete").mockImplementation(async (id) => {
          await manager[terminate](id);
          throw storageError;
        });
        const fail = vi.spyOn(manager, "fail");
        await expect(
          new ChunkExecutor(manager).execute(
            execution.id,
            new Step({
              name: "empty",
              reader: { read: async () => null },
              writer: { write: vi.fn() },
            }),
          ),
        ).rejects.toBe(storageError);
        expect(fail).not.toHaveBeenCalled();
        expect(await manager.get(execution.id)).toMatchObject({
          status: terminate === "cancel" ? "cancelled" : "timed_out",
        });
      },
    );

    it("does not start a later step after cancellation", async () => {
      const manager = new ExecutionManagerImpl(new TestExecutionStore());
      const execution = await manager.create({ type: "batch-job" });
      await manager.start(execution.id);
      await manager.cancel(execution.id);
      const reader = { read: vi.fn() };
      const writer = { write: vi.fn() };
      await expect(
        new ChunkExecutor(manager).execute(
          execution.id,
          new Step({ name: "later", reader, writer }),
          { startExecution: false },
        ),
      ).resolves.toBeUndefined();
      expect(reader.read).not.toHaveBeenCalled();
      expect(writer.write).not.toHaveBeenCalled();
    });
  });

  describe("attempt lifecycle admission", () => {
    it.each([
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ])(
      "retains a successful timed-out write without starting another (checkpoint=%s, total=%s)",
      async (checkpointed, hasTotal) => {
        const manager = new ExecutionManagerImpl(new TestExecutionStore());
        const execution = await manager.create({ type: "batch-job", maxAttempts: 3 });
        if (hasTotal) await manager.updateProgress(execution.id, { current: 0, total: 3 });
        const source = createCheckpointReader([11, 22, 33]);
        const reader = checkpointed ? source : { read: source.read };
        const entered = createBarrier();
        const release = createBarrier();
        const written: number[] = [];
        const writer = {
          write: vi.fn(async (items: number[]) => {
            entered.resolve();
            await release.promise;
            written.push(...items);
          }),
        };
        const fail = vi.spyOn(manager, "fail");
        const complete = vi.spyOn(manager, "complete");
        const running = new ChunkExecutor(manager).execute(
          execution.id,
          new Step({ name: "timed", reader, writer, chunkSize: 1 }),
        );
        await entered.promise;
        const terminal = await manager.timeout(execution.id);
        release.resolve();
        await expect(running).resolves.toBeUndefined();
        expect(written).toEqual([11]);
        expect(reader.read).toHaveBeenCalledTimes(1);
        expect(fail).not.toHaveBeenCalled();
        expect(complete).not.toHaveBeenCalled();
        expect(await manager.get(execution.id)).toMatchObject({
          status: "timed_out",
          attempts: 1,
          error: terminal.error,
          completedAt: terminal.completedAt,
        });
        expect((await manager.get(execution.id)).checkpoints).toEqual(
          checkpointed
            ? { "timed.chunkCheckpoint": { version: 1, cursor: { offset: 1 }, processedCount: 1 } }
            : undefined,
        );
        expect((await manager.get(execution.id)).progress).toEqual(
          hasTotal ? { current: 1, total: 3, percent: 33 } : undefined,
        );
      },
    );

    it.each(["reader", "processor", "eof", "filtered"] as const)(
      "does not commit uncommitted work timed out during %s",
      async (boundary) => {
        const manager = new ExecutionManagerImpl(new TestExecutionStore());
        const execution = await manager.create({ type: "batch-job" });
        const entered = createBarrier();
        const release = createBarrier();
        let offset = 0;
        const reader = {
          read: vi.fn(async () => {
            offset += 1;
            if (boundary === "reader" || (boundary === "eof" && offset === 2)) {
              entered.resolve();
              await release.promise;
            }
            return offset === 1 ? 7 : null;
          }),
          getCheckpoint: () => ({ offset }),
          restoreCheckpoint: vi.fn(),
        };
        const processor = {
          process: vi.fn(async (item: number) => {
            if (boundary === "processor" || boundary === "filtered") {
              entered.resolve();
              await release.promise;
            }
            return boundary === "filtered" ? null : item;
          }),
        };
        const writer = { write: vi.fn() };
        const running = new ChunkExecutor(manager).execute(
          execution.id,
          new Step({ name: "waiting", reader, processor, writer, chunkSize: 2 }),
        );
        await entered.promise;
        const terminal = await manager.timeout(execution.id);
        release.resolve();
        await expect(running).resolves.toBeUndefined();
        expect(writer.write).not.toHaveBeenCalled();
        expect(await manager.get(execution.id)).toEqual(terminal);
        if (boundary === "reader") expect(processor.process).not.toHaveBeenCalled();
      },
    );

    it.each([
      "failed",
      "retrying",
      "replacement-reader",
      "replacement-writer",
      "replacement-error",
    ] as const)("preserves %s execution state when the old attempt resumes", async (boundary) => {
      const store = new TestExecutionStore();
      const manager = new ExecutionManagerImpl(store);
      const execution = await manager.create({ type: "batch-job", maxAttempts: 3 });
      const entered = createBarrier();
      const release = createBarrier();
      const source = createCheckpointReader([11, 22]);
      const sinkError = new Error("old sink failure");
      const reader = {
        ...source,
        read: vi.fn(async () => {
          if (boundary !== "replacement-writer" && boundary !== "replacement-error") {
            entered.resolve();
            await release.promise;
          }
          return source.read();
        }),
      };
      const writer = {
        write: vi.fn(async () => {
          if (boundary === "replacement-writer" || boundary === "replacement-error") {
            entered.resolve();
            await release.promise;
            if (boundary === "replacement-error") throw sinkError;
          }
        }),
      };
      const running = new ChunkExecutor(manager).execute(
        execution.id,
        new Step({ name: "old", reader, writer, chunkSize: 1 }),
      );
      const settled =
        boundary === "replacement-error"
          ? expect(running).rejects.toBe(sinkError)
          : expect(running).resolves.toBeUndefined();
      await entered.promise;
      await manager.fail(execution.id, {
        message: "external failure",
        retryable: boundary !== "failed",
      });
      if (boundary.startsWith("replacement")) {
        await manager.start(execution.id);
        await manager.checkpoint(execution.id, "old.cursor", { offset: 99 });
        await manager.updateProgress(execution.id, { current: 99, total: 100 });
      }
      const replacement = await manager.get(execution.id);
      const fail = vi.spyOn(manager, "fail");
      const complete = vi.spyOn(manager, "complete");
      release.resolve();
      await settled;
      expect(await manager.get(execution.id)).toEqual(replacement);
      expect(fail).not.toHaveBeenCalled();
      expect(complete).not.toHaveBeenCalled();
      expect(writer.write).toHaveBeenCalledTimes(
        boundary === "replacement-writer" || boundary === "replacement-error" ? 1 : 0,
      );
    });
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])(
    "rejects invalid chunk size %s before starting or performing batch work",
    async (chunkSize) => {
      const reader = {
        read: vi.fn().mockResolvedValue(null),
        getCheckpoint: vi.fn().mockReturnValue({ offset: 0 }),
        restoreCheckpoint: vi.fn(),
      };
      const writer = {
        write: vi.fn().mockResolvedValue(undefined),
      };
      const options = {
        name: "invalid-chunk-step",
        reader: reader as unknown as ItemReader<number>,
        writer,
        chunkSize,
      };

      expect(() => new Step<number, number>(options)).toThrow(
        `Batch step.chunkSize must be a positive safe integer; received ${String(chunkSize)}.`,
      );

      await expect(
        executor.execute("exec-1", options as unknown as Step<number, number>),
      ).rejects.toMatchObject({
        code: "batch-core/invalid-chunk-size",
        detail: `Batch step.chunkSize must be a positive safe integer; received ${String(chunkSize)}.`,
        receivedChunkSize: String(chunkSize),
      });

      expect(executionManager.start).not.toHaveBeenCalled();
      expect(executionManager.checkpoint).not.toHaveBeenCalled();
      expect(executionManager.updateProgress).not.toHaveBeenCalled();
      expect(executionManager.complete).not.toHaveBeenCalled();
      expect(executionManager.fail).not.toHaveBeenCalled();
      expect(reader.read).not.toHaveBeenCalled();
      expect(reader.getCheckpoint).not.toHaveBeenCalled();
      expect(reader.restoreCheckpoint).not.toHaveBeenCalled();
      expect(writer.write).not.toHaveBeenCalled();
    },
  );

  it("defaults omitted chunk size to 10 and preserves chunk boundaries", async () => {
    const remaining = Array.from({ length: 11 }, (_, index) => index + 1);
    const reader = {
      read: vi.fn(async () => remaining.shift() ?? null),
    };
    const writer = {
      write: vi.fn().mockResolvedValue(undefined),
    };
    const step = new Step<number, number>({
      name: "default-chunk-step",
      reader,
      writer,
    });

    await executor.execute("exec-1", step);

    expect(step.chunkSize).toBe(10);
    expect(writer.write).toHaveBeenNthCalledWith(1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(writer.write).toHaveBeenNthCalledWith(2, [11]);
  });

  it.each(["", "   ", "\t\n"])(
    "should reject a structurally supplied blank step name %j before execution starts",
    async (name) => {
      const read = vi.fn().mockResolvedValue(null);
      const write = vi.fn().mockResolvedValue(undefined);

      await expect(
        executor.execute("exec-1", {
          name,
          reader: { read },
          writer: { write },
          chunkSize: 1,
        } as Step<unknown, unknown>),
      ).rejects.toMatchObject({ code: "batch-core/invalid-step-name" });

      expect(executionManager.start).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
      expect(executionManager.checkpoint).not.toHaveBeenCalled();
      expect(executionManager.complete).not.toHaveBeenCalled();
      expect(executionManager.fail).not.toHaveBeenCalled();
    },
  );

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
    expect(executionManager.complete).toHaveBeenCalledWith("exec-1", {
      processedCount: 2,
    });
    expect(executionManager.updateProgress).not.toHaveBeenCalled();
  });

  it("should update progress after each successful chunk when total is available", async () => {
    (executionManager.start as Mock).mockResolvedValue({
      id: "exec-1",
      status: "running",
      attempts: 1,
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
    expect(executionManager.complete).toHaveBeenCalledWith("exec-1", {
      processedCount: 3,
    });
  });

  it("should support checkpointing", async () => {
    const reader = {
      read: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(null),
      getCheckpoint: vi.fn().mockReturnValue({ offset: 10 }),
      restoreCheckpoint: vi.fn(),
    };

    (executionManager.start as Mock).mockResolvedValue({
      id: "exec-1",
      status: "running",
      attempts: 1,
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
    expect(executionManager.checkpoint).toHaveBeenCalledWith(
      "exec-1",
      "test-step.chunkCheckpoint",
      {
        version: 1,
        cursor: { offset: 10 },
        processedCount: 1,
      },
    );
  });

  it.each([false, true])(
    "records checkpoint restoration failures with retryable=%s before reading or writing",
    async (retryable) => {
      const manager = new ExecutionManagerImpl(new TestExecutionStore());
      const execution = await manager.create({ type: "batch-job", maxAttempts: 2 });
      await manager.checkpoint(execution.id, "restore-step.cursor", { offset: 2 });
      const fail = vi.spyOn(manager, "fail");
      const original = new Error("unsupported saved cursor");
      const reader = createCheckpointReader([1, 2, 3]);
      reader.restoreCheckpoint.mockImplementation(() => {
        throw original;
      });
      const writer = { write: vi.fn().mockResolvedValue(undefined) };
      const classifyFailure = vi.fn(() => ({ retryable, code: "invalid-cursor" }));

      await expect(
        new ChunkExecutor(manager).execute(
          execution.id,
          new Step<number, number>({
            name: "restore-step",
            reader,
            writer,
            chunkSize: 1,
            classifyFailure,
          }),
        ),
      ).rejects.toBe(original);

      expect(reader.restoreCheckpoint).toHaveBeenCalledExactlyOnceWith({ offset: 2 });
      expect(classifyFailure).toHaveBeenCalledExactlyOnceWith(original, {
        executionId: execution.id,
        stepName: "restore-step",
      });
      expect(fail).toHaveBeenCalledExactlyOnceWith(execution.id, {
        message: original.message,
        stack: original.stack,
        retryable,
        code: "invalid-cursor",
      });
      expect(await manager.get(execution.id)).toMatchObject({
        status: retryable ? "retrying" : "failed",
        checkpoints: { "restore-step.cursor": { offset: 2 } },
      });
      expect(reader.read).not.toHaveBeenCalled();
      expect(writer.write).not.toHaveBeenCalled();
    },
  );

  it("preserves start failures without classifying or recording a step failure", async () => {
    const original = new Error("cannot start execution");
    vi.mocked(executionManager.start).mockRejectedValue(original);
    const reader = createCheckpointReader([1]);
    const writer = { write: vi.fn() };
    const classifyFailure = vi.fn(() => false);

    await expect(
      executor.execute(
        "exec-1",
        new Step<number, number>({
          name: "restore-step",
          reader,
          writer,
          classifyFailure,
        }),
      ),
    ).rejects.toBe(original);

    expect(classifyFailure).not.toHaveBeenCalled();
    expect(executionManager.fail).not.toHaveBeenCalled();
    expect(reader.restoreCheckpoint).not.toHaveBeenCalled();
    expect(reader.read).not.toHaveBeenCalled();
    expect(writer.write).not.toHaveBeenCalled();
  });

  it.each([0, 1, 4, 5])(
    "should checkpoint all-filtered input at chunk boundaries and flush the remainder (%i items)",
    async (count) => {
      (executionManager.start as Mock).mockResolvedValue({
        id: "exec-1",
        status: "running",
        attempts: 1,
        checkpoints: {},
        progress: { current: 0, total: 5 },
      });
      const reader = createCheckpointReader(Array.from({ length: count }, (_, index) => index));
      const writer = { write: vi.fn().mockResolvedValue(undefined) };
      const checkpoints: number[] = [];
      const process = vi.fn(async () => {
        checkpoints.push((executionManager.checkpoint as Mock).mock.calls.length);
        return null;
      });

      await executor.execute(
        "exec-1",
        new Step<number, number>({
          name: "filtered-step",
          reader,
          processor: { process },
          writer,
          chunkSize: 2,
        }),
      );

      const offsets = Array.from({ length: Math.ceil(count / 2) }, (_, index) =>
        Math.min((index + 1) * 2, count),
      );
      expect((executionManager.checkpoint as Mock).mock.calls).toEqual(
        offsets.map((offset) => [
          "exec-1",
          "filtered-step.chunkCheckpoint",
          { version: 1, cursor: { offset }, processedCount: offset },
        ]),
      );
      expect((executionManager.updateProgress as Mock).mock.calls).toEqual(
        offsets.map((current) => ["exec-1", { current, total: 5 }]),
      );
      expect(checkpoints).toEqual(
        Array.from({ length: count }, (_, index) => Math.floor(index / 2)),
      );
      expect(writer.write).not.toHaveBeenCalled();
      expect(executionManager.complete).toHaveBeenCalledWith("exec-1", { processedCount: count });
    },
  );

  it("should count filtered input while writing only retained items in each input chunk", async () => {
    const reader = createCheckpointReader([1, 2, 3, 4, 5]);
    const writer = { write: vi.fn().mockResolvedValue(undefined) };

    await executor.execute(
      "exec-1",
      new Step<number, number>({
        name: "mixed-step",
        reader,
        processor: { process: async (item) => (item % 2 === 0 ? item * 10 : null) },
        writer,
        chunkSize: 2,
      }),
    );

    expect(writer.write.mock.calls).toEqual([[[20]], [[40]]]);
    expect((executionManager.checkpoint as Mock).mock.calls).toEqual([
      [
        "exec-1",
        "mixed-step.chunkCheckpoint",
        { version: 1, cursor: { offset: 2 }, processedCount: 2 },
      ],
      [
        "exec-1",
        "mixed-step.chunkCheckpoint",
        { version: 1, cursor: { offset: 4 }, processedCount: 4 },
      ],
      [
        "exec-1",
        "mixed-step.chunkCheckpoint",
        { version: 1, cursor: { offset: 5 }, processedCount: 5 },
      ],
    ]);
    expect(executionManager.updateProgress).not.toHaveBeenCalled();
    expect(executionManager.complete).toHaveBeenCalledWith("exec-1", { processedCount: 5 });
  });

  it.each(["reader", "processor", "writer"] as const)(
    "should resume filtered input after a %s failure without skipping an uncommitted chunk",
    async (failureSource) => {
      const realManager = new ExecutionManagerImpl(new TestExecutionStore());
      const realExecutor = new ChunkExecutor(realManager);
      const execution = await realManager.create({ type: "batch-job", maxAttempts: 2 });
      await realManager.updateProgress(execution.id, { current: 0, total: 5 });
      const reader = createCheckpointReader([1, 2, 3, 4, 5]);
      const failure = new Error("temporary batch failure");
      if (failureSource === "reader") {
        const read = reader.read.bind(reader);
        reader.read = async () => {
          if (reader.getCheckpoint().offset === 3) throw failure;
          return read();
        };
      }
      const processor = {
        process: vi.fn(async (item: number) => {
          if (failureSource === "processor" && item === 4) throw failure;
          return failureSource === "writer" && item === 4 ? item : null;
        }),
      };
      const writer = { write: vi.fn().mockRejectedValue(failure) };

      await expect(
        realExecutor.execute(
          execution.id,
          new Step<number, number>({
            name: "filtered-retry",
            reader,
            processor,
            writer,
            chunkSize: 2,
          }),
        ),
      ).rejects.toBe(failure);

      const retrying = await realManager.get(execution.id);
      expect(retrying.status).toBe("retrying");
      expect(retrying.checkpoints).toEqual({
        "filtered-retry.chunkCheckpoint": { version: 1, cursor: { offset: 2 }, processedCount: 2 },
      });
      expect(retrying.progress).toMatchObject({ current: 2, total: 5 });
      expect(writer.write.mock.calls).toEqual(failureSource === "writer" ? [[[4]]] : []);

      const resumedReader = createCheckpointReader([1, 2, 3, 4, 5]);
      const resumedProcessor = { process: vi.fn(async () => null) };
      const resumedWriter = { write: vi.fn().mockResolvedValue(undefined) };
      await realExecutor.execute(
        execution.id,
        new Step<number, number>({
          name: "filtered-retry",
          reader: resumedReader,
          processor: resumedProcessor,
          writer: resumedWriter,
          chunkSize: 2,
        }),
      );

      expect(resumedReader.restoreCheckpoint).toHaveBeenCalledWith({ offset: 2 });
      expect(resumedProcessor.process.mock.calls).toEqual([[3], [4], [5]]);
      expect(resumedWriter.write).not.toHaveBeenCalled();
      const completed = await realManager.get(execution.id);
      expect(completed.status).toBe("completed");
      expect(completed.checkpoints).toEqual({
        "filtered-retry.chunkCheckpoint": { version: 1, cursor: { offset: 5 }, processedCount: 5 },
      });
      expect(completed.progress).toMatchObject({ current: 5, total: 5, percent: 100 });
      expect(completed.result).toEqual({ processedCount: 5 });
    },
  );

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
    expect(executionManager.checkpoint).toHaveBeenCalledWith(
      "exec-1",
      "first-step.chunkCheckpoint",
      {
        version: 1,
        cursor: { offset: 1 },
        processedCount: 1,
      },
    );
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
      "extract.chunkCheckpoint": { version: 1, cursor: { offset: 1 }, processedCount: 1 },
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
      "extract.chunkCheckpoint": { version: 1, cursor: { offset: 1 }, processedCount: 1 },
      "load.chunkCheckpoint": { version: 1, cursor: { offset: 1 }, processedCount: 1 },
    });
    expect(firstWriter.write).toHaveBeenCalledWith([1]);
    expect(secondWriter.write).toHaveBeenCalledWith([2]);
  });

  it("should resume retryable failures from the last successful checkpoint", async () => {
    const realManager = new ExecutionManagerImpl(new TestExecutionStore());
    const realExecutor = new ChunkExecutor(realManager);
    const execution = await realManager.create({
      type: "batch-job",
      maxAttempts: 2,
    });
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
      "import-users.chunkCheckpoint": { version: 1, cursor: { offset: 2 }, processedCount: 2 },
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
      "import-users.chunkCheckpoint": { version: 1, cursor: { offset: 3 }, processedCount: 3 },
    });
    expect(completed.progress).toEqual({
      current: 3,
      total: 3,
      percent: 100,
    });
    expect(reader.restoreCheckpoint).toHaveBeenCalledWith({ offset: 2 });
    expect(writes).toEqual([[1, 2], [3], [3]]);
  });

  it.each(["writer", "processor", "checkpoint"] as const)(
    "replays all input with the same step after a first-chunk %s failure",
    async (boundary) => {
      const store = new TestExecutionStore();
      const manager = new ExecutionManagerImpl(store);
      const execution = await manager.create({ type: "import-users", maxAttempts: 2 });
      const failure = new Error("first chunk failed");
      if (boundary === "checkpoint") {
        vi.spyOn(store, "mergeCheckpoint").mockRejectedValueOnce(failure);
      }
      const processor = { process: vi.fn(async (item: number) => item) };
      if (boundary === "processor") processor.process.mockRejectedValueOnce(failure);
      const writer = { write: vi.fn(async (_items: number[]) => {}) };
      if (boundary === "writer") writer.write.mockRejectedValueOnce(failure);
      const step = new Step({
        name: "import-users",
        reader: createCheckpointReader([1, 2, 3, 4]),
        processor,
        writer,
        chunkSize: 2,
      });

      await expect(new ChunkExecutor(manager).execute(execution.id, step)).rejects.toBe(failure);
      expect(await manager.get(execution.id)).toMatchObject({ status: "retrying" });
      writer.write.mockClear();

      await new ChunkExecutor(manager).execute(execution.id, step);

      expect(writer.write.mock.calls).toEqual([[[1, 2]], [[3, 4]]]);
      expect(await manager.get(execution.id)).toMatchObject({
        status: "completed",
        attempts: 2,
        result: { processedCount: 4 },
      });
    },
  );

  it("does not start without a rewind if manual retry changes the observed failed status", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const execution = await manager.create({ type: "import-users", maxAttempts: 2 });
    const failure = new Error("temporary sink outage");
    const writer = { write: vi.fn(async (_items: number[]) => {}) };
    writer.write.mockRejectedValueOnce(failure);
    const step = new Step({
      name: "import-users",
      reader: createCheckpointReader([1, 2, 3, 4]),
      writer,
      chunkSize: 2,
      classifyFailure: () => false,
    });
    const executor = new ChunkExecutor(manager);
    await expect(executor.execute(execution.id, step)).rejects.toBe(failure);
    expect(await manager.get(execution.id)).toMatchObject({ status: "failed", attempts: 1 });

    const get = manager.get.bind(manager);
    vi.spyOn(manager, "get").mockImplementationOnce(async (id) => {
      const failed = await get(id);
      await manager.retry(id);
      return failed;
    });
    await expect(executor.execute(execution.id, step)).rejects.toMatchObject({
      code: "execution/invalid-state-transition",
    });
    expect(await manager.get(execution.id)).toMatchObject({ status: "retrying", attempts: 1 });

    await executor.execute(execution.id, step);
    expect(writer.write.mock.calls).toEqual([[[1, 2]], [[1, 2]], [[3, 4]]]);
    expect(await manager.get(execution.id)).toMatchObject({
      status: "completed",
      result: { processedCount: 4 },
    });
  });

  it("preserves the recovery Problem if a tracked reader's execution is indeterminate", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const execution = await manager.create({ type: "import-users", maxAttempts: 3 });
    const failure = new Error("temporary sink outage");
    const reader = createCheckpointReader([1, 2, 3, 4]);
    const writer = { write: vi.fn().mockRejectedValueOnce(failure) };
    const step = new Step({ name: "import-users", reader, writer, chunkSize: 2 });
    const executor = new ChunkExecutor(manager);
    await expect(executor.execute(execution.id, step)).rejects.toBe(failure);
    await manager.start(execution.id);
    await manager.timeout(execution.id);

    await expect(executor.execute(execution.id, step)).rejects.toMatchObject({
      code: "execution/indeterminate-retry-blocked",
    });
    expect(reader.restoreCheckpoint).not.toHaveBeenCalled();
    expect(await manager.get(execution.id)).toMatchObject({ status: "timed_out", attempts: 2 });
  });

  it("does not consume input when start advances past the prepared attempt", async () => {
    const originalManager = new ExecutionManagerImpl(new TestExecutionStore());
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const input = { type: "import-users", maxAttempts: 2 };
    const original = await originalManager.create(input);
    const execution = await manager.create(input);
    expect(execution.id).toBe(original.id);
    const failure = new Error("temporary sink outage");
    const writer = { write: vi.fn(async (_items: number[]) => {}) };
    writer.write.mockRejectedValueOnce(failure);
    const step = new Step({
      name: "import-users",
      reader: createCheckpointReader([1, 2, 3, 4]),
      writer,
      chunkSize: 2,
    });
    await expect(new ChunkExecutor(originalManager).execute(original.id, step)).rejects.toBe(
      failure,
    );

    const get = manager.get.bind(manager);
    vi.spyOn(manager, "get").mockImplementationOnce(async (id) => {
      const pending = await get(id);
      await manager.start(id);
      await manager.fail(id, { message: "another attempt failed", retryable: true });
      return pending;
    });
    writer.write.mockClear();
    const executor = new ChunkExecutor(manager);
    await expect(executor.execute(execution.id, step)).rejects.toMatchObject({
      code: "execution/conflict",
    });
    expect(writer.write).not.toHaveBeenCalled();
    expect(await manager.get(execution.id)).toMatchObject({ status: "running", attempts: 2 });

    await executor.execute(
      execution.id,
      new Step({
        name: step.name,
        reader: createCheckpointReader([1, 2, 3, 4]),
        writer,
        chunkSize: 2,
      }),
      { startExecution: false },
    );
    expect(writer.write.mock.calls).toEqual([[[1, 2]], [[3, 4]]]);
    expect(await manager.get(execution.id)).toMatchObject({
      status: "completed",
      attempts: 2,
      result: { processedCount: 4 },
    });
  });

  it("waits for a lazy reader to restore its unset starting cursor before starting", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const execution = await manager.create({ type: "import-users", maxAttempts: 2 });
    const items = [1, 2, 3, 4];
    let offset: number | undefined;
    let restores = 0;
    const restoring = createBarrier();
    const releaseRestore = createBarrier();
    const reader = {
      async read() {
        offset ??= 0;
        return items[offset++] ?? null;
      },
      getCheckpoint: () => (offset === undefined ? Promise.resolve(undefined) : offset),
      async restoreCheckpoint(cursor: unknown) {
        if (++restores > 1) throw new Error("already restored the cursor");
        restoring.resolve();
        await releaseRestore.promise;
        offset = typeof cursor === "number" ? cursor : undefined;
      },
    };
    const failure = new Error("temporary sink outage");
    const writer = { write: vi.fn(async (_items: number[]) => {}) };
    writer.write.mockRejectedValueOnce(failure);
    const step = new Step({ name: "import-users", reader, writer, chunkSize: 2 });
    const executor = new ChunkExecutor(manager);

    await expect(executor.execute(execution.id, step)).rejects.toBe(failure);
    const retry = executor.execute(execution.id, step);
    await restoring.promise;
    try {
      expect(await manager.get(execution.id)).toMatchObject({ status: "retrying", attempts: 1 });
      expect(writer.write.mock.calls).toEqual([[[1, 2]]]);
    } finally {
      releaseRestore.resolve();
      await retry;
    }

    expect(writer.write.mock.calls).toEqual([[[1, 2]], [[1, 2]], [[3, 4]]]);
    expect(restores).toBe(1);
    expect(await manager.get(execution.id)).toMatchObject({
      status: "completed",
      result: { processedCount: 4 },
    });
  });

  it.each([
    [true, "capture"],
    [true, "restore"],
    [false, "capture"],
    [false, "restore"],
  ] as const)(
    "preserves the retry for a fresh reader (startExecution=%s, cursor %s fails)",
    async (startExecution, boundary) => {
      const manager = new ExecutionManagerImpl(new TestExecutionStore());
      const execution = await manager.create({ type: "import-users", maxAttempts: 2 });
      const reader = createCheckpointReader([1, 2, 3, 4]);
      if (boundary === "capture") {
        reader.getCheckpoint.mockImplementationOnce(() => {
          throw new Error("reader has not started");
        });
      } else {
        reader.restoreCheckpoint.mockImplementation(async () => {
          throw new Error("reader cannot restore the initial cursor");
        });
      }
      const failure = new Error("temporary sink outage");
      const writer = { write: vi.fn(async (_items: number[]) => {}) };
      writer.write.mockRejectedValueOnce(failure);
      const step = new Step({ name: "import-users", reader, writer, chunkSize: 2 });
      const executor = new ChunkExecutor(manager);
      const options = { startExecution };

      if (!startExecution) await manager.start(execution.id);
      await expect(executor.execute(execution.id, step, options)).rejects.toBe(failure);
      if (!startExecution) await manager.start(execution.id);
      await expect(executor.execute(execution.id, step, options)).rejects.toMatchObject({
        code: "execution/conflict",
      });
      expect(await manager.get(execution.id)).toMatchObject(
        startExecution ? { status: "retrying", attempts: 1 } : { status: "running", attempts: 2 },
      );
      expect(writer.write.mock.calls).toEqual([[[1, 2]]]);

      await executor.execute(
        execution.id,
        new Step({
          name: step.name,
          reader: createCheckpointReader([1, 2, 3, 4]),
          writer,
          chunkSize: 2,
        }),
        options,
      );

      expect(writer.write.mock.calls).toEqual([[[1, 2]], [[1, 2]], [[3, 4]]]);
      expect(await manager.get(execution.id)).toMatchObject({
        status: "completed",
        result: { processedCount: 4 },
      });
    },
  );

  it("normalizes the initial cursor to the same representation as a stored cursor", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const execution = await manager.create({ type: "import-users", maxAttempts: 2 });
    const source = createCheckpointReader([1, 2, 3, 4]);
    const reader = {
      read: source.read,
      getCheckpoint: () => new Date(source.getCheckpoint().offset),
      restoreCheckpoint(cursor: unknown) {
        if (typeof cursor !== "string") throw new Error("expected a serialized cursor");
        source.restoreCheckpoint({ offset: Date.parse(cursor) });
      },
    };
    const failure = new Error("temporary sink outage");
    const writer = { write: vi.fn(async (_items: number[]) => {}) };
    writer.write.mockRejectedValueOnce(failure);
    const step = new Step({ name: "import-users", reader, writer, chunkSize: 2 });
    const executor = new ChunkExecutor(manager);

    await expect(executor.execute(execution.id, step)).rejects.toBe(failure);
    await executor.execute(execution.id, step);

    expect(writer.write.mock.calls).toEqual([[[1, 2]], [[1, 2]], [[3, 4]]]);
    expect(await manager.get(execution.id)).toMatchObject({
      status: "completed",
      result: { processedCount: 4 },
    });
  });

  it("counts input from zero when restoring a nonzero starting position", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const execution = await manager.create({ type: "import-users", maxAttempts: 2 });
    await manager.updateProgress(execution.id, { current: 2, total: 4 });
    const progress = vi.spyOn(manager, "updateProgress");
    const source = createCheckpointReader([-2, -1, 1, 2, 3, 4]);
    source.restoreCheckpoint({ offset: 2 });
    const reader = {
      ...source,
      getRestoredProcessedCount: () => source.getCheckpoint().offset,
    };
    const failure = new Error("temporary sink outage");
    const writer = { write: vi.fn(async (_items: number[]) => {}) };
    writer.write.mockRejectedValueOnce(failure);
    const step = new Step({ name: "import-users", reader, writer, chunkSize: 2 });
    const executor = new ChunkExecutor(manager);

    await expect(executor.execute(execution.id, step)).rejects.toBe(failure);
    await executor.execute(execution.id, step);

    expect(writer.write.mock.calls).toEqual([[[1, 2]], [[1, 2]], [[3, 4]]]);
    expect(progress.mock.calls.map(([, value]) => value.current)).toEqual([2, 4]);
    expect(await manager.get(execution.id)).toMatchObject({
      status: "completed",
      result: { processedCount: 4 },
    });
  });

  it("keeps the retry cursor when the same reader runs another execution", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const first = await manager.create({ type: "import-users", maxAttempts: 2 });
    const second = await manager.create({ type: "import-users", maxAttempts: 2 });
    const reader = createCheckpointReader([1, 2, 3, 4]);
    const failure = new Error("temporary sink outage");
    const writer = { write: vi.fn(async (_items: number[]) => {}) };
    writer.write.mockRejectedValueOnce(failure);
    const step = new Step({ name: "import-users", reader, writer, chunkSize: 2 });
    const executor = new ChunkExecutor(manager);

    await expect(executor.execute(first.id, step)).rejects.toBe(failure);
    reader.restoreCheckpoint({ offset: 0 });
    await executor.execute(second.id, step);
    writer.write.mockClear();
    await executor.execute(first.id, step);

    expect(writer.write.mock.calls).toEqual([[[1, 2]], [[3, 4]]]);
    expect(await manager.get(first.id)).toMatchObject({
      status: "completed",
      result: { processedCount: 4 },
    });
  });

  it("keeps retry cursors separate across stores with identical execution IDs", async () => {
    const firstManager = new ExecutionManagerImpl(new TestExecutionStore());
    const secondManager = new ExecutionManagerImpl(new TestExecutionStore());
    const first = await firstManager.create({ type: "import-users", maxAttempts: 2 });
    const second = await secondManager.create({ type: "import-users", maxAttempts: 2 });
    expect(second.id).toBe(first.id);
    const reader = createCheckpointReader([1, 2, 3, 4]);
    const failure = new Error("temporary sink outage");
    const writer = { write: vi.fn(async (_items: number[]) => {}) };
    writer.write.mockRejectedValueOnce(failure).mockRejectedValueOnce(failure);
    const step = new Step({ name: "import-users", reader, writer, chunkSize: 2 });
    const firstExecutor = new ChunkExecutor(firstManager);
    const secondExecutor = new ChunkExecutor(secondManager);

    await expect(firstExecutor.execute(first.id, step)).rejects.toBe(failure);
    reader.restoreCheckpoint({ offset: 2 });
    await expect(secondExecutor.execute(second.id, step)).rejects.toBe(failure);
    writer.write.mockClear();

    await secondExecutor.execute(second.id, step);
    expect(writer.write.mock.calls).toEqual([[[3, 4]]]);
    expect(await secondManager.get(second.id)).toMatchObject({
      status: "completed",
      result: { processedCount: 2 },
    });
  });

  it.each([
    "immediately",
    "after another execution",
    "after claiming a legacy replay key",
  ] as const)("keeps the retry available after a manager change %s", async (transition) => {
    const store = new TestExecutionStore();
    const originalManager = new ExecutionManagerImpl(store);
    const replacementManager = new ExecutionManagerImpl(store);
    const execution = await originalManager.create({ type: "import-users", maxAttempts: 2 });
    const failure = new Error("temporary sink outage");
    const writer = { write: vi.fn(async (_items: number[]) => {}) };
    writer.write.mockRejectedValueOnce(failure);
    const reader = createCheckpointReader([1, 2, 3, 4]);
    const step = new Step({
      name: "import-users",
      reader,
      writer,
      chunkSize: 2,
    });
    await expect(new ChunkExecutor(originalManager).execute(execution.id, step)).rejects.toBe(
      failure,
    );

    const executor = new ChunkExecutor(replacementManager);
    if (transition === "after another execution") {
      const other = await replacementManager.create({ type: "import-users", maxAttempts: 2 });
      reader.restoreCheckpoint({ offset: 0 });
      await executor.execute(
        other.id,
        new Step({
          name: step.name,
          reader,
          writer: { write: vi.fn() },
          chunkSize: 2,
        }),
      );
    }
    if (transition === "after claiming a legacy replay key") {
      await store.update(execution.id, {
        idempotencyKey: "claimed-key",
        requestFingerprint: "claimed-request",
      });
    }
    await expect(executor.execute(execution.id, step)).rejects.toMatchObject({
      code: "execution/conflict",
    });
    expect(await replacementManager.get(execution.id)).toMatchObject({
      status: "retrying",
      attempts: 1,
    });

    await executor.execute(
      execution.id,
      new Step({
        name: step.name,
        reader: createCheckpointReader([1, 2, 3, 4]),
        writer,
        chunkSize: 2,
      }),
    );
    expect(writer.write.mock.calls).toEqual([[[1, 2]], [[1, 2]], [[3, 4]]]);
    expect(await replacementManager.get(execution.id)).toMatchObject({
      status: "completed",
      result: { processedCount: 4 },
    });
  });

  it.each(["type", "fingerprint"] as const)(
    "runs a step first reached on retry when matching IDs differ by %s",
    async (distinction) => {
      const otherManager = new ExecutionManagerImpl(new TestExecutionStore());
      const prior = await otherManager.create(
        distinction === "type"
          ? { type: "other-job", maxAttempts: 2 }
          : {
              type: "import-users",
              maxAttempts: 2,
              idempotencyKey: "job",
              payload: { source: "old" },
            },
      );
      const reader = createCheckpointReader([1, 2, 3, 4]);
      const failure = new Error("temporary sink outage");
      const otherStep = new Step({
        name: "import-users",
        reader,
        writer: { write: vi.fn().mockRejectedValueOnce(failure) },
        chunkSize: 2,
      });
      await expect(new ChunkExecutor(otherManager).execute(prior.id, otherStep)).rejects.toBe(
        failure,
      );

      const manager = new ExecutionManagerImpl(new TestExecutionStore());
      const execution = await manager.create(
        distinction === "type"
          ? { type: "import-users", maxAttempts: 2 }
          : {
              type: "import-users",
              maxAttempts: 2,
              idempotencyKey: "job",
              payload: { source: "new" },
            },
      );
      expect(execution.id).toBe(prior.id);
      if (distinction === "fingerprint") {
        expect(prior.requestFingerprint).toBeDefined();
        expect(execution.requestFingerprint).toBeDefined();
        expect(execution.requestFingerprint).not.toBe(prior.requestFingerprint);
      }
      await manager.start(execution.id);
      await manager.fail(execution.id, { message: "earlier step failed", retryable: true });
      await manager.start(execution.id);
      reader.restoreCheckpoint({ offset: 0 });
      const writer = { write: vi.fn() };
      const step = new Step({ name: "import-users", reader, writer, chunkSize: 2 });

      await new ChunkExecutor(manager).execute(execution.id, step, { startExecution: false });

      expect(writer.write.mock.calls).toEqual([[[1, 2]], [[3, 4]]]);
      expect(await manager.get(execution.id)).toMatchObject({
        status: "completed",
        attempts: 2,
        result: { processedCount: 4 },
      });
    },
  );

  it("holds the reader until an asynchronous durable restore completes", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const execution = await manager.create({ type: "import-users", maxAttempts: 2 });
    const source = createCheckpointReader([1, 2, 3, 4]);
    const restoring = createBarrier();
    const release = createBarrier();
    const reader = {
      ...source,
      async restoreCheckpoint(cursor: unknown) {
        restoring.resolve();
        await release.promise;
        source.restoreCheckpoint(cursor);
      },
    };
    const failure = new Error("second chunk failed");
    const writer = { write: vi.fn(async (_items: number[]) => {}) };
    writer.write.mockResolvedValueOnce(undefined).mockRejectedValueOnce(failure);
    const step = new Step({ name: "import-users", reader, writer, chunkSize: 2 });
    const executor = new ChunkExecutor(manager);
    await expect(executor.execute(execution.id, step)).rejects.toBe(failure);

    const retry = executor.execute(execution.id, step);
    await restoring.promise;
    try {
      await expect(executor.execute(execution.id, step)).rejects.toMatchObject({
        code: "execution/conflict",
      });
      expect(await manager.get(execution.id)).toMatchObject({ status: "running", attempts: 2 });
      expect(writer.write.mock.calls).toEqual([[[1, 2]], [[3, 4]]]);
    } finally {
      release.resolve();
      await retry;
    }

    expect(writer.write.mock.calls).toEqual([[[1, 2]], [[3, 4]], [[3, 4]]]);
    expect(await manager.get(execution.id)).toMatchObject({
      status: "completed",
      result: { processedCount: 4 },
    });
  });

  it("keeps a retry available when the checkpointable reader is still in use", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const execution = await manager.create({ type: "import-users", maxAttempts: 2 });
    const executor = new ChunkExecutor(manager);
    const writing = createBarrier();
    const release = createBarrier();
    const writer = {
      write: vi.fn(async (_items: number[]) => {
        writing.resolve();
        await release.promise;
      }),
    };
    const step = new Step({
      name: "import-users",
      reader: createCheckpointReader([1, 2, 3, 4]),
      writer,
      chunkSize: 2,
    });

    const first = executor.execute(execution.id, step);
    await writing.promise;
    try {
      await manager.fail(execution.id, { message: "restart", retryable: true });
      await expect(executor.execute(execution.id, step)).rejects.toMatchObject({
        code: "execution/conflict",
      });
      expect(await manager.get(execution.id)).toMatchObject({ status: "retrying", attempts: 1 });
    } finally {
      release.resolve();
      await first;
    }

    expect((await manager.get(execution.id)).checkpoints).toMatchObject({
      "import-users.chunkCheckpoint": { cursor: { offset: 2 }, processedCount: 2 },
    });
    writer.write.mockClear();
    await executor.execute(execution.id, step);
    expect(writer.write.mock.calls).toEqual([[[3, 4]]]);
    expect(await manager.get(execution.id)).toMatchObject({
      status: "completed",
      result: { processedCount: 4 },
    });
  });

  it("retries the replacement reader from its own start after a superseded attempt settles", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const execution = await manager.create({ type: "import-users", maxAttempts: 3 });
    const executor = new ChunkExecutor(manager);
    const writing = createBarrier();
    const release = createBarrier();
    const originalReader = createCheckpointReader([1, 2, 3, 4]);
    originalReader.restoreCheckpoint({ offset: 2 });
    const original = executor.execute(
      execution.id,
      new Step({
        name: "import-users",
        reader: originalReader,
        writer: {
          async write() {
            writing.resolve();
            await release.promise;
          },
        },
        chunkSize: 2,
      }),
    );
    const failure = new Error("replacement writer failed");
    const writer = { write: vi.fn(async (_items: number[]) => {}) };
    writer.write.mockRejectedValueOnce(failure);
    const replacement = new Step({
      name: "import-users",
      reader: createCheckpointReader([1, 2, 3, 4]),
      writer,
      chunkSize: 2,
    });

    await writing.promise;
    try {
      await manager.fail(execution.id, { message: "restart", retryable: true });
      await expect(executor.execute(execution.id, replacement)).rejects.toBe(failure);
    } finally {
      release.resolve();
      await original;
    }

    await executor.execute(execution.id, replacement);
    expect(writer.write.mock.calls).toEqual([[[1, 2]], [[1, 2]], [[3, 4]]]);
    expect(await manager.get(execution.id)).toMatchObject({
      status: "completed",
      result: { processedCount: 4 },
    });
  });

  it("keeps a replacement reader's cursor after a late intermediate step returns", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const executor = new ChunkExecutor(manager);
    const execution = await manager.create({ type: "import-users", maxAttempts: 3 });
    const finishing = createBarrier();
    const release = createBarrier();
    const get = manager.get.bind(manager);
    const oldReader = {
      ...createCheckpointReader<number>([]),
      async read() {
        vi.spyOn(manager, "get")
          .mockImplementationOnce(get)
          .mockImplementationOnce(async (id) => {
            const current = await get(id);
            finishing.resolve();
            await release.promise;
            return current;
          });
        return null;
      },
    };
    const oldAttempt = executor.execute(
      execution.id,
      new Step({ name: "import-users", reader: oldReader, writer: { write: vi.fn() } }),
      { completeExecution: false },
    );
    const failure = new Error("replacement writer failed");
    const writer = { write: vi.fn(async (_items: number[]) => {}) };
    writer.write.mockRejectedValueOnce(failure);
    const replacement = new Step({
      name: "import-users",
      reader: createCheckpointReader([1, 2, 3, 4]),
      writer,
      chunkSize: 2,
    });

    await finishing.promise;
    try {
      await manager.fail(execution.id, { message: "restart", retryable: true });
      await expect(executor.execute(execution.id, replacement)).rejects.toBe(failure);
    } finally {
      release.resolve();
      await oldAttempt;
    }

    await executor.execute(execution.id, replacement);
    expect(writer.write.mock.calls).toEqual([[[1, 2]], [[1, 2]], [[3, 4]]]);
    expect(await manager.get(execution.id)).toMatchObject({
      status: "completed",
      attempts: 3,
      result: { processedCount: 4 },
    });
  });

  it.each(["before", "after"] as const)(
    "resumes cursor and input count together after a failure %s checkpoint commit",
    async (boundary) => {
      const store = new TestExecutionStore();
      const manager = new ExecutionManagerImpl(store);
      const execution = await manager.create({ type: "import-users", maxAttempts: 2 });
      const mergeCheckpoint = store.mergeCheckpoint.bind(store);
      const failure = new Error("checkpoint connection lost");
      vi.spyOn(store, "mergeCheckpoint").mockImplementationOnce(async (id, key, value) => {
        if (boundary === "after") await mergeCheckpoint(id, key, value);
        throw failure;
      });
      const writer = { write: vi.fn().mockResolvedValue(undefined) };
      const step = () =>
        new Step<number, number>({
          name: "import-users",
          reader: createCheckpointReader([1, 2, 3]),
          writer,
          chunkSize: 1,
        });

      await expect(new ChunkExecutor(manager).execute(execution.id, step())).rejects.toBe(failure);
      expect(await manager.get(execution.id)).toMatchObject({ status: "retrying" });

      await new ChunkExecutor(manager).execute(execution.id, step());

      expect(writer.write.mock.calls).toEqual(
        boundary === "before" ? [[[1]], [[1]], [[2]], [[3]]] : [[[1]], [[2]], [[3]]],
      );
      expect(await manager.get(execution.id)).toMatchObject({
        status: "completed",
        result: { processedCount: 3 },
      });
    },
  );

  it("recovers final progress when the last checkpoint was committed before progress failed", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const execution = await manager.create({ type: "import-users", maxAttempts: 2 });
    await manager.updateProgress(execution.id, { current: 0, total: 3 });
    const failure = new Error("progress connection lost");
    vi.spyOn(manager, "updateProgress").mockRejectedValueOnce(failure);
    const processor = { process: vi.fn(async () => null) };
    const writer = { write: vi.fn() };
    const step = () =>
      new Step<number, number>({
        name: "import-users",
        reader: createCheckpointReader([1, 2, 3]),
        processor,
        writer,
        chunkSize: 3,
      });

    await expect(new ChunkExecutor(manager).execute(execution.id, step())).rejects.toBe(failure);
    await new ChunkExecutor(manager).execute(execution.id, step());

    expect(processor.process.mock.calls).toEqual([[1], [2], [3]]);
    expect(writer.write).not.toHaveBeenCalled();
    expect(await manager.get(execution.id)).toMatchObject({
      status: "completed",
      progress: { current: 3, total: 3, percent: 100 },
      result: { processedCount: 3 },
    });
  });

  it("restores the final step's lower progress after its checkpoint committed", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const executor = new ChunkExecutor(manager);
    const execution = await manager.create({ type: "batch-job", maxAttempts: 2 });
    await manager.updateProgress(execution.id, { current: 0, total: 3 });
    const writer = { write: vi.fn().mockResolvedValue(undefined) };
    const extract = () =>
      new Step({
        name: "extract",
        reader: createCheckpointReader([1, 2, 3]),
        writer,
        chunkSize: 3,
      });
    const load = () =>
      new Step({ name: "load", reader: createCheckpointReader([4, 5]), writer, chunkSize: 2 });
    const failure = new Error("progress connection lost");

    await executor.execute(execution.id, extract(), { completeExecution: false });
    vi.spyOn(manager, "updateProgress").mockRejectedValueOnce(failure);
    await expect(executor.execute(execution.id, load(), { startExecution: false })).rejects.toBe(
      failure,
    );
    expect((await manager.get(execution.id)).progress?.current).toBe(3);

    await executor.execute(execution.id, extract(), { completeExecution: false });
    await executor.execute(execution.id, load(), { startExecution: false });

    expect(writer.write.mock.calls).toEqual([[[1, 2, 3]], [[4, 5]]]);
    expect(await manager.get(execution.id)).toMatchObject({
      status: "completed",
      progress: { current: 2, total: 3 },
      result: { processedCount: 2 },
    });
  });

  it("rejects a cursor that cannot be stored as a JSON property", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const execution = await manager.create({ type: "import-users" });
    const reader = {
      read: vi.fn().mockResolvedValueOnce(1).mockResolvedValue(null),
      getCheckpoint: () => undefined,
      restoreCheckpoint: vi.fn(),
    };

    await expect(
      new ChunkExecutor(manager).execute(
        execution.id,
        new Step({
          name: "import-users",
          reader,
          writer: { write: vi.fn().mockResolvedValue(undefined) },
          chunkSize: 1,
        }),
      ),
    ).rejects.toMatchObject({ code: "execution/checkpoint-store-conformance" });
    expect((await manager.get(execution.id)).checkpoints).toBeUndefined();
  });

  it("counts items committed before the retry when no progress total was declared", async () => {
    const realManager = new ExecutionManagerImpl(new TestExecutionStore());
    const realExecutor = new ChunkExecutor(realManager);
    const execution = await realManager.create({ type: "import-users", maxAttempts: 2 });

    let failOnce = true;
    const step = new Step<number, number>({
      name: "import-users",
      reader: createCheckpointReader([1, 2, 3, 4, 5]) as unknown as ItemReader<number>,
      writer: {
        write: async (items) => {
          if (failOnce && items.includes(3)) {
            failOnce = false;
            throw new Error("temporary sink outage");
          }
        },
      },
      chunkSize: 2,
    });

    await expect(realExecutor.execute(execution.id, step)).rejects.toThrow("temporary sink outage");
    expect(await realManager.get(execution.id)).toMatchObject({ status: "retrying" });
    expect((await realManager.get(execution.id)).checkpoints).toEqual({
      "import-users.chunkCheckpoint": { version: 1, cursor: { offset: 2 }, processedCount: 2 },
    });

    await realExecutor.execute(execution.id, step);

    expect(await realManager.get(execution.id)).toMatchObject({
      status: "completed",
      result: { processedCount: 5 },
    });
  });

  it("restores processedCount from progress.current for legacy checkpoint-only executions", async () => {
    const realManager = new ExecutionManagerImpl(new TestExecutionStore());
    const realExecutor = new ChunkExecutor(realManager);
    const execution = await realManager.create({ type: "import-users", maxAttempts: 2 });
    await realManager.start(execution.id);
    await realManager.updateProgress(execution.id, { current: 2, total: 5 });
    await realManager.checkpoint(execution.id, "import-users.cursor", { offset: 2 });
    await realManager.fail(execution.id, { message: "temporary sink outage", retryable: true });

    const step = new Step<number, number>({
      name: "import-users",
      reader: createCheckpointReader([1, 2, 3, 4, 5]) as unknown as ItemReader<number>,
      writer: { write: vi.fn().mockResolvedValue(undefined) },
      chunkSize: 2,
    });

    await realExecutor.execute(execution.id, step);

    expect(await realManager.get(execution.id)).toMatchObject({
      status: "completed",
      result: { processedCount: 5 },
    });
  });

  it("resumes each step independently when legacy and current checkpoints coexist", async () => {
    const manager = new ExecutionManagerImpl(new TestExecutionStore());
    const executor = new ChunkExecutor(manager);
    const execution = await manager.create({ type: "batch-job", maxAttempts: 2 });
    await manager.start(execution.id);
    await manager.checkpoint(execution.id, "extract.cursor", { offset: 1 });
    await manager.checkpoint(execution.id, "extract.processedCount", 1);
    await manager.checkpoint(execution.id, "load.cursor", { offset: 1 });
    await manager.checkpoint(execution.id, "load.processedCount", 1);
    await manager.checkpoint(execution.id, "load.chunkCheckpoint", {
      version: 1,
      cursor: { offset: 2 },
      processedCount: 2,
    });
    await manager.fail(execution.id, { message: "interrupted job", retryable: true });
    const extractWriter = { write: vi.fn().mockResolvedValue(undefined) };
    const loadWriter = { write: vi.fn().mockResolvedValue(undefined) };

    await executor.execute(
      execution.id,
      new Step({ name: "extract", reader: createCheckpointReader([1, 2]), writer: extractWriter }),
      { completeExecution: false },
    );
    expect(extractWriter.write.mock.calls).toEqual([[[2]]]);
    expect((await manager.get(execution.id)).checkpoints?.["extract.chunkCheckpoint"]).toEqual({
      version: 1,
      cursor: { offset: 2 },
      processedCount: 2,
    });

    await executor.execute(
      execution.id,
      new Step({ name: "load", reader: createCheckpointReader([10, 20, 30]), writer: loadWriter }),
      { startExecution: false },
    );
    expect(loadWriter.write.mock.calls).toEqual([[[30]]]);
    expect((await manager.get(execution.id)).result).toEqual({ processedCount: 3 });
  });

  it.each([
    { version: 2, cursor: { offset: 2 }, processedCount: 2 },
    { version: 1, cursor: { offset: 2 }, processedCount: "2" },
    { version: 1, processedCount: 2 },
  ])(
    "rejects an unsupported checkpoint even when a legacy cursor exists (%j)",
    async (checkpoint) => {
      const manager = new ExecutionManagerImpl(new TestExecutionStore());
      const execution = await manager.create({ type: "import-users" });
      await manager.checkpoint(execution.id, "import-users.cursor", { offset: 1 });
      await manager.checkpoint(execution.id, "import-users.chunkCheckpoint", checkpoint);
      const reader = createCheckpointReader([1, 2, 3]);
      const writer = { write: vi.fn() };

      await expect(
        new ChunkExecutor(manager).execute(
          execution.id,
          new Step({ name: "import-users", reader, writer }),
        ),
      ).rejects.toMatchObject({ code: "execution/checkpoint-store-conformance" });
      expect(reader.read).not.toHaveBeenCalled();
      expect(writer.write).not.toHaveBeenCalled();
    },
  );

  it("should not seed retry progress without a restored step checkpoint", async () => {
    const realManager = new ExecutionManagerImpl(new TestExecutionStore());
    const realExecutor = new ChunkExecutor(realManager);
    const execution = await realManager.create({
      type: "batch-job",
      maxAttempts: 2,
    });
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

    await expect(executor.execute("exec-1", step)).rejects.toBe(error);
    expect(executionManager.fail).toHaveBeenCalledWith(
      "exec-1",
      expect.objectContaining({
        message: "Read failed",
        retryable: true,
      }),
    );
  });

  it("should preserve the original error when failure recording rejects", async () => {
    const writerError = new Error("Write failed");
    const failureRecordError = new Error("Execution store unavailable");
    const reader = {
      read: vi.fn().mockResolvedValueOnce(1),
    };
    const writer = {
      write: vi.fn().mockRejectedValue(writerError),
    };
    const step = new Step<number, number>({
      name: "failure-record-step",
      reader,
      writer,
      chunkSize: 1,
    });
    (executionManager.fail as Mock).mockRejectedValue(failureRecordError);

    await expect(executor.execute("exec-1", step)).rejects.toBe(writerError);

    expect(executionManager.fail).toHaveBeenCalledWith(
      "exec-1",
      expect.objectContaining({
        message: "Write failed",
        retryable: true,
      }),
    );
    expect(Object.getOwnPropertyDescriptor(writerError, "batchFailureRecordError")).toEqual({
      configurable: true,
      enumerable: false,
      value: failureRecordError,
      writable: false,
    });
  });

  it.each([
    ["non-extensible", Object.preventExtensions(new Error("Write failed"))],
    ["primitive", "Write failed"],
  ] as const)(
    "should report failure recording errors for %s original failures",
    async (_errorKind, writerError) => {
      const failureRecordError = new Error("Execution store unavailable");
      const reader = {
        read: vi.fn().mockResolvedValueOnce(1),
      };
      const writer = {
        write: vi.fn().mockRejectedValue(writerError),
      };
      const step = new Step<number, number>({
        name: "failure-record-step",
        reader,
        writer,
        chunkSize: 1,
      });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      (executionManager.fail as Mock).mockRejectedValue(failureRecordError);

      try {
        await expect(executor.execute("exec-1", step)).rejects.toBe(writerError);

        expect(consoleError).toHaveBeenCalledWith(
          "[ChunkExecutor] Failed to record batch execution failure",
          {
            executionId: "exec-1",
            failureRecordError,
          },
        );
      } finally {
        consoleError.mockRestore();
      }
    },
  );

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

  async create(params: CreateExecutionRecordParams): Promise<Execution> {
    const execution: Execution = {
      id: `exec-${++this.idCounter}`,
      type: params.type,
      status: "pending",
      payload: params.payload,
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      idempotencyKey: params.idempotencyKey,
      requestFingerprint: params.requestFingerprint,
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

  async mergeCheckpoint(id: string, key: string, value: unknown): Promise<Execution> {
    const execution = this.executions.get(id);
    if (!execution) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }
    return this.update(id, {
      checkpoints: { ...execution.checkpoints, [key]: value },
    });
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

function createBarrier(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((release) => {
    resolve = release;
  });
  return { promise, resolve };
}
