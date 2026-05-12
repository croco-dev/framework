import {
  context,
  type Exception,
  type SpanOptions as OtelSpanOptions,
  type Span,
  type Tracer,
  trace,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { TraceDecoratorOptions } from "../libs/decorators/Trace";
import { getTraceOptions, Trace } from "../libs/decorators/Trace";
import { getActiveTraceInfo, recordError, recordEvent, withSpan } from "../libs/span";
import * as tracerModule from "../libs/tracer";
import { getTracer } from "../libs/tracer";

const asyncContextManager = new AsyncLocalStorageContextManager().enable();
const isContextManagerRegistered = context.setGlobalContextManager(asyncContextManager);

if (!isContextManagerRegistered) {
  asyncContextManager.disable();
}

afterAll(() => {
  if (isContextManagerRegistered) {
    asyncContextManager.disable();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

function decorateMethodWithTrace(
  target: object,
  methodName: string,
  options: TraceDecoratorOptions,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
  if (!descriptor) {
    throw new Error(`Method descriptor not found: ${methodName}`);
  }

  const decoratedDescriptor = Trace(options)(target, methodName, descriptor) ?? descriptor;
  Object.defineProperty(target, methodName, decoratedDescriptor);
}

function createMockSpan() {
  const setAttribute = vi.fn();
  const setStatus = vi.fn();
  const recordException = vi.fn();
  const end = vi.fn();

  const spanContext = () => ({
    traceId: "00000000000000000000000000000001",
    spanId: "0000000000000001",
    traceFlags: 1,
    isRemote: false,
  });

  const span: Span = {
    spanContext,
    setAttribute,
    setAttributes: vi.fn(),
    addEvent: vi.fn(),
    addLink: vi.fn(),
    addLinks: vi.fn(),
    setStatus,
    updateName: vi.fn(),
    end,
    isRecording: vi.fn(() => true),
    recordException,
  } as unknown as Span;

  return {
    span,
    setAttribute,
    setStatus,
    recordException,
    end,
  };
}

function createMockTracer(mockSpan: Span): Tracer {
  return {
    startSpan: () => mockSpan,
    startActiveSpan: async <T>(_name: string, fn: (span: Span) => T, _options?: OtelSpanOptions) =>
      fn(mockSpan),
  } as Tracer;
}

describe("Trace", () => {
  it("should return descriptor when value is undefined", () => {
    const descriptor: PropertyDescriptor = { writable: true, enumerable: true, configurable: true };

    const result = Trace()({}, "method", descriptor);

    expect(result).toBe(descriptor);
  });

  it("should decorate async methods with tracing", async () => {
    class TestService {
      value = 0;

      async increment(): Promise<number> {
        this.value += 1;
        return this.value;
      }
    }

    decorateMethodWithTrace(TestService.prototype, "increment", { name: "test-operation" });

    const service = new TestService();
    const result = await service.increment();

    expect(result).toBe(1);
  });

  it("should preserve active span context after await", async () => {
    class TestService {
      async run(): Promise<void> {
        const spanBeforeAwait = trace.getSpan(context.active());
        if (!spanBeforeAwait) {
          throw new Error("Expected active span before await");
        }

        await Promise.resolve();
        const spanAfterMicrotaskAwait = trace.getSpan(context.active());
        if (!spanAfterMicrotaskAwait) {
          throw new Error("Expected active span after microtask await");
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
        const spanAfterMacrotaskAwait = trace.getSpan(context.active());
        if (!spanAfterMacrotaskAwait) {
          throw new Error("Expected active span after macrotask await");
        }

        expect(spanAfterMicrotaskAwait).toBe(spanBeforeAwait);
        expect(spanAfterMacrotaskAwait).toBe(spanBeforeAwait);
      }
    }

    decorateMethodWithTrace(TestService.prototype, "run", { name: "async-context-test" });

    const service = new TestService();

    await service.run();
  });

  it("should record exception details for decorated method errors", async () => {
    const mockSpan = createMockSpan();

    vi.spyOn(tracerModule, "getTracer").mockReturnValue(createMockTracer(mockSpan.span));

    class TestService {
      async failingMethod(): Promise<void> {
        throw new Error("Test error");
      }
    }

    decorateMethodWithTrace(TestService.prototype, "failingMethod", { name: "failing-operation" });

    const service = new TestService();

    await expect(service.failingMethod()).rejects.toThrow("Test error");

    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: expect.any(Number),
      message: "Test error",
    });
    expect(mockSpan.recordException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Error",
        message: "Test error",
        stack: expect.stringContaining("Test error"),
      }),
    );
  });

  it("should record non-Error exception messages for decorated method failures", async () => {
    const mockSpan = createMockSpan();

    vi.spyOn(tracerModule, "getTracer").mockReturnValue(createMockTracer(mockSpan.span));

    class TestService {
      async failingMethod(): Promise<void> {
        throw "string failure";
      }
    }

    decorateMethodWithTrace(TestService.prototype, "failingMethod", {
      name: "string-failure-operation",
    });

    const service = new TestService();

    await expect(service.failingMethod()).rejects.toBe("string failure");

    expect(mockSpan.recordException).toHaveBeenCalledWith({
      message: "string failure",
    });
  });

  it("should not set span status on successful completion", async () => {
    const mockSpan = createMockSpan();

    vi.spyOn(tracerModule, "getTracer").mockReturnValue(createMockTracer(mockSpan.span));

    class TestService {
      async succeed(): Promise<string> {
        return "ok";
      }
    }

    decorateMethodWithTrace(TestService.prototype, "succeed", { name: "success-without-status" });

    const service = new TestService();
    await expect(service.succeed()).resolves.toBe("ok");

    expect(mockSpan.setStatus).not.toHaveBeenCalled();
    expect(mockSpan.end).toHaveBeenCalledTimes(1);
  });

  it("should expose decorator options via getTraceOptions", () => {
    class TestService {
      async run(): Promise<void> {}
    }

    decorateMethodWithTrace(TestService.prototype, "run", {
      name: "stored-options-operation",
      attributes: { feature: "trace-options" },
    });

    const options = getTraceOptions(TestService.prototype, "run");
    expect(options).toEqual({
      name: "stored-options-operation",
      attributes: { feature: "trace-options" },
    });
  });

  it("should resolve inherited options from prototype chain", () => {
    class BaseService {
      async run(): Promise<void> {}
    }

    class ChildService extends BaseService {}

    decorateMethodWithTrace(BaseService.prototype, "run", {
      name: "base-operation",
      attributes: { level: "base" },
    });

    const options = getTraceOptions(ChildService.prototype, "run");
    expect(options).toEqual({
      name: "base-operation",
      attributes: { level: "base" },
    });
  });

  it("should return undefined when target is not an object", () => {
    const options = getTraceOptions("string", "method");
    expect(options).toBeUndefined();
  });

  it("should return undefined when target is null", () => {
    const options = getTraceOptions(null, "method");
    expect(options).toBeUndefined();
  });

  it("should return cloned options to prevent external mutation", () => {
    class TestService {
      async run(): Promise<void> {}
    }

    decorateMethodWithTrace(TestService.prototype, "run", {
      name: "clone-operation",
      attributes: { stable: "yes" },
    });

    const first = getTraceOptions(TestService.prototype, "run");
    expect(first).not.toBeUndefined();
    if (!first?.attributes) {
      throw new Error("Expected attributes to be defined");
    }
    first.attributes.stable = "mutated";

    const second = getTraceOptions(TestService.prototype, "run");
    expect(second?.attributes).toEqual({ stable: "yes" });
  });
});

describe("withSpan", () => {
  it("should wrap function execution with span", async () => {
    let capturedSpan!: unknown;

    const result = await withSpan(
      async (span) => {
        capturedSpan = span;
        return 42;
      },
      { name: "test-span", attributes: { key: "value" } },
    );

    expect(result).toBe(42);
    expect(capturedSpan).not.toBeUndefined();
  });

  it("should record errors and rethrow", async () => {
    await expect(
      withSpan(async () => {
        throw new Error("Test error");
      }),
    ).rejects.toThrow("Test error");
  });

  it("should not set span status on successful completion", async () => {
    const mockSpan = createMockSpan();

    vi.spyOn(tracerModule, "getTracer").mockReturnValue(createMockTracer(mockSpan.span));

    await expect(withSpan(async () => "ok", { name: "with-span-success" })).resolves.toBe("ok");

    expect(mockSpan.setStatus).not.toHaveBeenCalled();
    expect(mockSpan.end).toHaveBeenCalledTimes(1);
  });
});

describe("recordError", () => {
  it("should not throw when no active span", () => {
    expect(() => recordError(new Error("test"))).not.toThrow();
  });

  it("should not throw when active span exists", async () => {
    await withSpan(
      async () => {
        expect(() => recordError(new Error("test"))).not.toThrow();
      },
      { name: "test-operation" },
    );
  });

  it("should record Error name, message, and stack on the provided span", () => {
    const mockSpan = createMockSpan();
    const error = new TypeError("broken value");

    recordError(error, mockSpan.span);

    expect(mockSpan.recordException).toHaveBeenCalledWith(
      expect.objectContaining<Exception>({
        name: "TypeError",
        message: "broken value",
        stack: expect.stringContaining("TypeError: broken value"),
      }),
    );
    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: expect.any(Number),
      message: "broken value",
    });
  });
});

describe("recordEvent", () => {
  it("should not throw when no active span", () => {
    expect(() => recordEvent("test-event", { key: "value" })).not.toThrow();
  });

  it("should not throw when active span exists", async () => {
    await withSpan(
      async () => {
        expect(() => recordEvent("test-event", { key: "value" })).not.toThrow();
      },
      { name: "test-operation" },
    );
  });
});

describe("getActiveTraceInfo", () => {
  it("should return empty object when no active trace", () => {
    const info = getActiveTraceInfo();
    expect(info).toEqual({});
  });

  it("should return trace info when span is active", async () => {
    const info = await withSpan(
      async () => {
        return getActiveTraceInfo();
      },
      { name: "test-operation" },
    );

    expect(info).toHaveProperty("traceId");
    expect(info).toHaveProperty("spanId");
    expect(info).toHaveProperty("traceFlags");
    expect(info).toHaveProperty("isValid");
  });
});

describe("getTracer", () => {
  it("should return tracer instance", () => {
    const tracer = getTracer();
    expect(tracer).not.toBeUndefined();
  });

  it("should use custom name when provided", () => {
    const tracer = getTracer({ name: "custom-tracer" });
    expect(tracer).not.toBeUndefined();
  });
});

describe("@Trace + withSpan error recording", () => {
  it("should not record error twice when @Trace wraps withSpan", async () => {
    class TestService {
      async methodWithInnerSpan(): Promise<void> {
        await withSpan(
          async () => {
            throw new Error("Test error");
          },
          { name: "inner-operation" },
        );
      }
    }

    decorateMethodWithTrace(TestService.prototype, "methodWithInnerSpan", {
      name: "outer-operation",
    });

    const service = new TestService();

    try {
      await service.methodWithInnerSpan();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Test error");
    }
  });
});

describe("getTraceOptions", () => {
  it("should update existing options when decorating same method twice", () => {
    class TestService {
      async run(): Promise<void> {}
    }

    decorateMethodWithTrace(TestService.prototype, "run", {
      name: "first-operation",
      attributes: { version: "1" },
    });

    decorateMethodWithTrace(TestService.prototype, "run", {
      name: "second-operation",
      attributes: { version: "2" },
    });

    const options = getTraceOptions(TestService.prototype, "run");
    expect(options).toEqual({
      name: "second-operation",
      attributes: { version: "2" },
    });
  });
});
