import {
  context,
  propagation,
  type Span,
  type SpanOptions,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { Container, type ILogger, LOGGER_TOKEN } from "@croco/framework-context";
import type { Context as HonoContext } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpContext } from "../libs/HttpContext";
import { telemetryMiddleware } from "../libs/middleware/telemetry";

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
    expect(ctx.get("telemetryDegraded")).toBe(true);
    expect(ctx.get("traceId")).toMatch(/^telemetry-degraded-/);
    expect(ctx.get("telemetryDegradedReason")).toBe("telemetry_setup_failed");
    expect(ctx.get("telemetryDegradedError")).toEqual({
      name: "TypeError",
      message: setupError.message,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "[TelemetryMiddleware] Telemetry setup failed; continuing in degraded mode",
      expect.objectContaining({
        errorCategory: "telemetry_setup_failed",
        errorMessage: setupError.message,
        errorName: "TypeError",
        method: "GET",
        path: "/health",
        route: "/health",
        traceId: ctx.get("traceId"),
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
    expect(ctx.get("telemetryDegraded")).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalledWith(
      "[TelemetryMiddleware] Telemetry setup failed; continuing in degraded mode",
      expect.objectContaining({
        errorCategory: "telemetry_setup_failed",
        route: "/health",
        traceId: ctx.get("traceId"),
      }),
    );
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
    expect(ctx.get("telemetryDegraded")).toBeUndefined();
  });
});
