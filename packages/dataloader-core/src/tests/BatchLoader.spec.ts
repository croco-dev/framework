import type { ILogger } from "@croco/framework-context";
import { Context } from "@croco/framework-context";
import type { Span } from "@opentelemetry/api";
import * as otelApi from "@opentelemetry/api";
import { ROOT_CONTEXT } from "@opentelemetry/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BatchResultLengthMismatchProblem } from "../index";
import { createBatchLoader } from "../libs/createBatchLoader";

describe("BatchLoader", () => {
  const createSpan = (): Span => ({
    spanContext: vi.fn(() => ({
      traceId: "11111111111111111111111111111111",
      spanId: "2222222222222222",
      traceFlags: 1,
      isRemote: false,
    })),
    setAttribute: vi.fn(),
    setAttributes: vi.fn(),
    addEvent: vi.fn(),
    addLink: vi.fn(),
    addLinks: vi.fn(),
    setStatus: vi.fn(),
    updateName: vi.fn(),
    end: vi.fn(),
    isRecording: vi.fn(() => true),
    recordException: vi.fn(),
  });

  const batchFn = vi.fn(
    async (keys: ReadonlyArray<number>): Promise<ReadonlyArray<string | Error | null>> => {
      return keys.map((key) => {
        if (key === -1) return new Error("Error for -1");
        if (key === 0) return null;
        return `Value: ${key}`;
      });
    },
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should batch requests in the same tick", async () => {
    await Context.run({ requestId: "test" }, async () => {
      const loader = createBatchLoader({
        name: "test-loader",
        batchFn: batchFn,
      });

      const p1 = loader.load(1);
      const p2 = loader.load(2);
      const p3 = loader.load(3);

      const results = await Promise.all([p1, p2, p3]);

      expect(results).toEqual(["Value: 1", "Value: 2", "Value: 3"]);
      expect(batchFn).toHaveBeenCalledTimes(1);
      expect(batchFn).toHaveBeenCalledWith([1, 2, 3]);
    });
  });

  it("should cache results within the same context", async () => {
    await Context.run({ requestId: "test" }, async () => {
      const loader = createBatchLoader<number, string>({
        name: "test-loader",
        batchFn: batchFn,
      });

      await loader.load(1);
      await loader.load(1);

      expect(batchFn).toHaveBeenCalledTimes(1);
    });
  });

  it("should not cache results across different contexts", async () => {
    await Context.run({ requestId: "req1" }, async () => {
      const loader = createBatchLoader<number, string>({
        name: "test-loader",
        batchFn: batchFn,
      });
      await loader.load(1);
    });

    await Context.run({ requestId: "req2" }, async () => {
      const loader = createBatchLoader<number, string>({
        name: "test-loader",
        batchFn: batchFn,
      });
      await loader.load(1);
    });

    expect(batchFn).toHaveBeenCalledTimes(2);
  });

  it("should handle errors correctly", async () => {
    await Context.run({ requestId: "test" }, async () => {
      const loader = createBatchLoader<number, string>({
        name: "test-loader",
        batchFn: batchFn,
      });

      await expect(loader.load(-1)).rejects.toThrow("Error for -1");

      const [r1, r2] = await Promise.allSettled([loader.load(1), loader.load(-1)]);

      expect(r1.status).toBe("fulfilled");

      expect(r2.status).toBe("rejected");
    });
  });

  it("should mark batch span as ERROR when an item fails", async () => {
    const span = createSpan();
    vi.spyOn(otelApi.trace, "getTracer").mockReturnValue({
      startActiveSpan: async <T>(_name: string, fn: (activeSpan: Span) => T) => fn(span),
      startSpan: vi.fn(() => span),
    } as ReturnType<typeof otelApi.trace.getTracer>);

    const loader = createBatchLoader<number, string>({
      name: "item-failure-loader",
      batchFn,
    });

    await expect(loader.load(-1)).rejects.toThrow("Error for -1");

    expect(span.recordException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Error for -1" }),
    );
    expect(span.setStatus).toHaveBeenCalledWith({
      code: expect.any(Number),
      message: "Error for -1",
    });
  });

  it("should handle maxBatchSize", async () => {
    await Context.run({ requestId: "test" }, async () => {
      const loader = createBatchLoader<number, string>({
        name: "test-loader",
        batchFn: batchFn,
        maxBatchSize: 2,
      });

      const p1 = loader.load(1);
      const p2 = loader.load(2);
      const p3 = loader.load(3);

      await Promise.all([p1, p2, p3]);

      expect(batchFn).toHaveBeenCalledTimes(2);
      expect(batchFn).toHaveBeenCalledWith([1, 2]);
      expect(batchFn).toHaveBeenCalledWith([3]);
    });
  });

  it("should use 100 as the default maxBatchSize", async () => {
    await Context.run({ requestId: "test-default-batch-size" }, async () => {
      const loader = createBatchLoader<number, string>({
        name: "default-batch-size-loader",
        batchFn: batchFn,
      });

      await Promise.all(Array.from({ length: 101 }, (_, index) => loader.load(index + 1)));

      expect(batchFn).toHaveBeenCalledTimes(2);
      expect(batchFn).toHaveBeenNthCalledWith(
        1,
        Array.from({ length: 100 }, (_, index) => index + 1),
      );
      expect(batchFn).toHaveBeenNthCalledWith(2, [101]);
    });
  });

  it("should work without cache when disabled", async () => {
    await Context.run({ requestId: "test" }, async () => {
      const loader = createBatchLoader<number, string>({
        name: "test-loader",
        batchFn: batchFn,
        cache: false,
      });

      await loader.load(1);
      await loader.load(1);

      expect(batchFn).toHaveBeenCalledTimes(2);
    });
  });

  it("should not cache errors", async () => {
    await Context.run({ requestId: "test-error-cache" }, async () => {
      const fn = vi.fn(
        async (keys: ReadonlyArray<number>): Promise<ReadonlyArray<string | Error | null>> =>
          keys.map((_k) => new Error("fail")),
      );
      const loader = createBatchLoader<number, string>({ name: "error-loader", batchFn: fn });

      await expect(loader.load(1)).rejects.toThrow("fail");
      await expect(loader.load(1)).rejects.toThrow("fail");

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  it("should not cache results outside request context for the same loader instance", async () => {
    const loader = createBatchLoader<number, string>({
      name: "outside-context-loader",
      batchFn,
    });

    await loader.load(1);
    await loader.load(1);

    expect(batchFn).toHaveBeenCalledTimes(2);
  });

  it("should clear cache when batch function throws so next load can retry", async () => {
    let attempts = 0;
    const fn = vi.fn(
      async (keys: ReadonlyArray<number>): Promise<ReadonlyArray<string | Error | null>> => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("batch failed");
        }

        return keys.map((key) => `Value: ${key}`);
      },
    );

    await Context.run({ requestId: "test-batch-level-failure" }, async () => {
      const loader = createBatchLoader<number, string>({
        name: "batch-failure-loader",
        batchFn: fn,
      });

      await expect(loader.load(1)).rejects.toThrow("batch failed");
      await expect(loader.load(1)).resolves.toBe("Value: 1");

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  it("should mark batch span as ERROR when the batch function throws", async () => {
    const span = createSpan();
    vi.spyOn(otelApi.trace, "getTracer").mockReturnValue({
      startActiveSpan: async <T>(_name: string, fn: (activeSpan: Span) => T) => fn(span),
      startSpan: vi.fn(() => span),
    } as ReturnType<typeof otelApi.trace.getTracer>);

    const loader = createBatchLoader<number, string>({
      name: "batch-failure-loader",
      batchFn: async () => {
        throw new Error("batch failed");
      },
    });

    await expect(loader.load(1)).rejects.toThrow("batch failed");

    expect(span.recordException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "batch failed" }),
    );
    expect(span.setStatus).toHaveBeenCalledWith({
      code: expect.any(Number),
      message: "batch failed",
    });
  });

  it("should preserve active OpenTelemetry context across nextTick dispatch", async () => {
    const activeContext = ROOT_CONTEXT;
    const activeSpy = vi.spyOn(otelApi.context, "active").mockReturnValue(activeContext);
    const originalWith = otelApi.context.with.bind(otelApi.context);
    const withSpy = vi
      .spyOn(otelApi.context, "with")
      .mockImplementation((context, fn, thisArg, ...args) => {
        return originalWith(context, fn, thisArg, ...args);
      });

    const loader = createBatchLoader<number, string>({
      name: "otel-context-loader",
      batchFn,
    });

    await loader.load(1);

    expect(activeSpy).toHaveBeenCalled();
    expect(withSpy).toHaveBeenCalledWith(activeContext, expect.any(Function));

    activeSpy.mockRestore();
    withSpy.mockRestore();
  });

  it("should reject with a Problem when batch result length does not match keys", async () => {
    const loader = createBatchLoader<number, string>({
      name: "mismatch-loader",
      batchFn: async () => ["only-one-result"],
    });

    const results = await loader.loadMany([1, 2]);

    expect(results[0]).toBeInstanceOf(BatchResultLengthMismatchProblem);
    expect(results[1]).toBeInstanceOf(BatchResultLengthMismatchProblem);
  });

  describe("prime", () => {
    it("should cache rejected promise and log error when priming with Error", async () => {
      const mockLogger: ILogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(function (this: ILogger) {
          return this;
        }),
      };

      const { BatchLoaderImpl: BatchLoaderClass } = await import("../libs/BatchLoader");
      const loader = new BatchLoaderClass(
        {
          name: "test-loader",
          batchFn: batchFn,
        },
        mockLogger,
      );

      const error = new Error("Primed error");
      loader.prime(1, error);

      await expect(loader.load(1)).rejects.toThrow("Primed error");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Prime rejected error cached",
        expect.objectContaining({
          key: 1,
          error: error,
        }),
      );
    });

    it("should cache resolved promise when priming with value", async () => {
      const mockLogger: ILogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(function (this: ILogger) {
          return this;
        }),
      };

      const { BatchLoaderImpl: BatchLoaderClass } = await import("../libs/BatchLoader");
      const loader = new BatchLoaderClass(
        {
          name: "test-loader",
          batchFn: batchFn,
        },
        mockLogger,
      );

      loader.prime(1, "Primed value");

      const result = await loader.load(1);
      expect(result).toBe("Primed value");

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
