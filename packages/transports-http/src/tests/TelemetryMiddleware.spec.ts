import {
  context,
  propagation,
  type Span,
  type SpanOptions,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import {
  Container,
  Context as FrameworkContext,
  type ILogger,
  LOGGER_TOKEN,
} from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { Context as HonoContext } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HTTP_CONTEXT_KEYS } from "../libs/contextKeys";
import { HttpContext } from "../libs/HttpContext";
import { parseTraceParent, telemetryMiddleware } from "../libs/middleware/telemetry";

class TestProblem extends Problem {
  constructor() {
    super("test/problem", ProblemCategory.BadRequest, "Test problem");
  }

  override get status(): number {
    return 418;
  }
}

describe("TelemetryMiddleware", () => {
  const createContext = (headers = new Headers()): HttpContext => {
    const mockCtx = {
      req: {
        method: "GET",
        url: "https://example.com/health",
        path: "/health",
        raw: {
          headers,
        },
        param: vi.fn(),
        query: vi.fn(),
        header: vi.fn(),
        json: vi.fn(),
      },
      text: vi.fn(),
      json: vi.fn(),
      header: vi.fn(),
      redirect: vi.fn(),
    };

    return new HttpContext(mockCtx as unknown as HonoContext);
  };

  const setupSpan = (): Span => {
    const span: Span = {
      spanContext: vi.fn(() => ({
        traceId: "11111111111111111111111111111111",
        spanId: "3333333333333333",
        traceFlags: 1,
        isRemote: false,
      })),
      setStatus: vi.fn(),
      setAttributes: vi.fn(),
      setAttribute: vi.fn(),
      addEvent: vi.fn(),
      addLink: vi.fn(),
      addLinks: vi.fn(),
      updateName: vi.fn(),
      isRecording: vi.fn(() => true),
      recordException: vi.fn(),
      end: vi.fn(),
    };
    const tracer = {
      startSpan: vi.fn(() => span),
      startActiveSpan: vi.fn(
        <T>(_name: string, fn: (activeSpan: typeof span) => T, _options?: SpanOptions) => fn(span),
      ),
    };

    vi.spyOn(trace, "getTracer").mockReturnValue(tracer as ReturnType<typeof trace.getTracer>);

    return span;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    Container.reset();
  });

  it("should create the server span from propagation-extracted context", async () => {
    const ctx = createContext(
      new Headers({ traceparent: "00-11111111111111111111111111111111-2222222222222222-01" }),
    );
    const next = vi.fn().mockResolvedValue(undefined);
    const extractedContext = trace.setSpanContext(context.active(), {
      traceId: "11111111111111111111111111111111",
      spanId: "2222222222222222",
      traceFlags: 1,
      isRemote: true,
    });
    const span: Span = {
      spanContext: vi.fn(() => ({
        traceId: "11111111111111111111111111111111",
        spanId: "3333333333333333",
        traceFlags: 1,
        isRemote: false,
      })),
      setStatus: vi.fn(),
      setAttributes: vi.fn(),
      setAttribute: vi.fn(),
      addEvent: vi.fn(),
      addLink: vi.fn(),
      addLinks: vi.fn(),
      updateName: vi.fn(),
      isRecording: vi.fn(() => true),
      recordException: vi.fn(),
      end: vi.fn(),
    };
    const startSpan = vi.fn(() => span);
    const tracer = {
      startSpan,
      startActiveSpan: vi.fn(
        <T>(_name: string, fn: (activeSpan: typeof span) => T, _options?: SpanOptions) => fn(span),
      ),
    };

    vi.spyOn(propagation, "extract").mockReturnValue(extractedContext);
    vi.spyOn(trace, "getTracer").mockReturnValue(tracer as ReturnType<typeof trace.getTracer>);

    await telemetryMiddleware("/health")(ctx, next);

    expect(propagation.extract).toHaveBeenCalledWith(
      context.active(),
      ctx.req.headers,
      expect.any(Object),
    );
    expect(startSpan).toHaveBeenCalledWith(
      "HTTP GET /health",
      expect.objectContaining({ kind: expect.any(Number) }),
      extractedContext,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should mark degraded mode and continue pipeline when telemetry setup fails", async () => {
    const ctx = createContext();
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    } as unknown as ILogger;
    const next = vi.fn().mockResolvedValue(undefined);
    const setupError = new TypeError("header access failure");

    Container.set(LOGGER_TOKEN, logger);
    const middleware = telemetryMiddleware("/health");
    const headerSpy = vi.spyOn(ctx, "header").mockImplementation(() => {
      throw setupError;
    });

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.get(HTTP_CONTEXT_KEYS.telemetryDegraded)).toBe(true);
    expect(ctx.get(HTTP_CONTEXT_KEYS.traceId)).toMatch(/^telemetry-degraded-/);
    expect(ctx.get(HTTP_CONTEXT_KEYS.telemetryDegradedReason)).toBe("telemetry_setup_failed");
    expect(ctx.get(HTTP_CONTEXT_KEYS.telemetryDegradedError)).toEqual({
      name: "TypeError",
      message: setupError.message,
    });
    expect(ctx.raw.header).toHaveBeenCalledWith(
      "X-Croco-Telemetry-Degraded",
      "telemetry_setup_failed",
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "[TelemetryMiddleware] Telemetry setup failed; continuing in degraded mode",
      expect.objectContaining({
        errorCategory: "telemetry_setup_failed",
        errorMessage: setupError.message,
        errorName: "TypeError",
        method: "GET",
        path: "/health",
        route: "/health",
        traceId: ctx.get(HTTP_CONTEXT_KEYS.traceId),
      }),
    );

    headerSpy.mockRestore();
  });

  it("should keep degraded fallback when logger warning fails", async () => {
    const ctx = createContext();
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(() => {
        throw new Error("logger unavailable");
      }),
      error: vi.fn(),
      child: vi.fn(),
    } as unknown as ILogger;
    const next = vi.fn().mockResolvedValue(undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    Container.set(LOGGER_TOKEN, logger);
    const middleware = telemetryMiddleware("/health");
    vi.spyOn(ctx, "header").mockImplementation(() => {
      throw new Error("header access failure");
    });

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.get(HTTP_CONTEXT_KEYS.telemetryDegraded)).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(ctx.raw.header).toHaveBeenCalledWith(
      "X-Croco-Telemetry-Degraded",
      "telemetry_setup_failed",
    );
    expect(consoleWarn).toHaveBeenCalledWith(
      "[TelemetryMiddleware] Telemetry setup failed; continuing in degraded mode",
      expect.objectContaining({
        errorCategory: "telemetry_setup_failed",
        route: "/health",
        traceId: ctx.get(HTTP_CONTEXT_KEYS.traceId),
      }),
    );
  });

  it("should preserve evidence when the degraded response header cannot be emitted", async () => {
    const ctx = createContext();
    const next = vi.fn().mockResolvedValue(undefined);
    const headerError = Object.assign(new Error("response headers already committed"), {
      authorization: "secret-bearer-token",
    });
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    vi.spyOn(ctx, "header").mockImplementation(() => {
      throw new Error("telemetry setup failure");
    });
    vi.mocked(ctx.raw.header).mockImplementation(() => {
      throw headerError;
    });

    await telemetryMiddleware("/health")(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalledWith(
      "[TelemetryMiddleware] Failed to emit telemetry degradation header",
      {
        header: "X-Croco-Telemetry-Degraded",
        errorName: "Error",
      },
    );
    expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain("secret-bearer-token");
  });

  it("should leave client error responses as unset span status", async () => {
    const span = setupSpan();
    const ctx = createContext();
    const next = vi.fn(async () => {
      ctx.res.status = 404;
    });

    await telemetryMiddleware("/health")(ctx, next);

    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.UNSET });
    expect(span.setAttribute).toHaveBeenCalledWith("http.status_code", 404);
  });

  it("should mark server error responses as error span status", async () => {
    const span = setupSpan();
    const ctx = createContext();
    const next = vi.fn(async () => {
      ctx.res.status = 503;
    });

    await telemetryMiddleware("/health")(ctx, next);

    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
    expect(span.setAttribute).toHaveBeenCalledWith("http.status_code", 503);
  });

  it("should not call next twice when downstream throws after span setup", async () => {
    const ctx = createContext();
    const nextError = new Error("downstream failure");
    const next = vi.fn().mockRejectedValue(nextError);

    const middleware = telemetryMiddleware("/health");

    await expect(middleware(ctx, next)).rejects.toThrow(nextError);

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.get(HTTP_CONTEXT_KEYS.telemetryDegraded)).toBeUndefined();
  });

  it("should expose server span trace metadata through the framework request context", async () => {
    setupSpan();
    const ctx = createContext();
    let traceId: string | null = null;
    let runtimeTraceId: string | undefined;

    await FrameworkContext.run(
      {
        requestId: "request-1",
        runtime: {
          platform: "node",
          requestId: "request-1",
          capabilities: {
            env: true,
            filesystem: true,
            logger: false,
            nodeApi: true,
            requestLifecycle: true,
            trace: false,
            waitUntil: false,
            flush: false,
            streamingResponse: true,
            deadline: false,
            abortSignal: true,
            shutdown: false,
          },
          waitUntil: () => undefined,
          flush: async () => undefined,
          shutdown: async () => undefined,
        },
      },
      async () => {
        await telemetryMiddleware("/health")(ctx, async () => {
          traceId = FrameworkContext.getActiveTraceId();
          runtimeTraceId = FrameworkContext.getRuntimeContext()?.trace?.traceId;
        });
      },
    );

    expect(traceId).toBe("11111111111111111111111111111111");
    expect(runtimeTraceId).toBe("11111111111111111111111111111111");
    expect(ctx.get(HTTP_CONTEXT_KEYS.spanId)).toBe("3333333333333333");
  });

  it("should record Problem metadata when the request pipeline fails", async () => {
    const span = setupSpan();
    const ctx = createContext();
    const problem = new TestProblem();

    await expect(
      telemetryMiddleware("/health")(ctx, async () => {
        throw problem;
      }),
    ).rejects.toBe(problem);

    expect(ctx.res.status).toBe(418);
    expect(span.recordException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "TestProblem",
        message: "Test problem",
      }),
    );
    expect(span.setAttribute).toHaveBeenCalledWith("http.status_code", 418);
    expect(span.setAttribute).toHaveBeenCalledWith("croco.failure.kind", "problem");
    expect(span.setAttribute).toHaveBeenCalledWith("croco.problem.code", "test/problem");
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.UNSET });
    expect(span.addEvent).toHaveBeenCalledWith(
      "croco.problem",
      expect.objectContaining({
        "croco.problem.code": "test/problem",
        "http.status_code": 418,
      }),
    );
  });
});

describe("parseTraceParent", () => {
  it.each([
    "00-00000000000000000000000000000000-2222222222222222-01",
    "00-11111111111111111111111111111111-0000000000000000-01",
  ])("should reject all-zero trace identifiers in %s", (header) => {
    expect(parseTraceParent(header)).toBeNull();
  });

  it.each([
    {
      header: "00-11111111111111111111111111111111-2222222222222222-01",
      traceId: "11111111111111111111111111111111",
      spanId: "2222222222222222",
    },
    {
      header: "00-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA-BBBBBBBBBBBBBBBB-01",
      traceId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      spanId: "BBBBBBBBBBBBBBBB",
    },
  ])(
    "should preserve valid nonzero hexadecimal identifiers in $header",
    ({ header, traceId, spanId }) => {
      expect(parseTraceParent(header)).toEqual({
        traceId,
        spanId,
        traceFlags: 1,
      });
    },
  );
});
