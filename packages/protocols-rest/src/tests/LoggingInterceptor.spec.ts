import "reflect-metadata";
import type { ILogger } from "@croco/framework-context";
import { Container, LOGGER_TOKEN } from "@croco/framework-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoggingInterceptor } from "../libs/interceptors/LoggingInterceptor";
import type { CallHandler } from "../libs/interfaces/CallHandler";
import type { ExecutionContext } from "../libs/interfaces/ExecutionContext";

describe("LoggingInterceptor", () => {
  type LoggerMock = ILogger & {
    child: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let interceptor!: LoggingInterceptor;
  let mockContext!: ExecutionContext;
  let mockNext!: CallHandler;
  let mockLogger!: LoggerMock;

  beforeEach(() => {
    Container.reset();

    mockLogger = {
      child: vi.fn<ILogger["child"]>(),
      debug: vi.fn<ILogger["debug"]>(),
      error: vi.fn<ILogger["error"]>(),
      fatal: vi.fn<ILogger["fatal"]>(),
      info: vi.fn<ILogger["info"]>(),
      warn: vi.fn<ILogger["warn"]>(),
    };
    mockLogger.child.mockReturnValue(mockLogger);
    interceptor = new LoggingInterceptor(mockLogger);

    mockContext = {
      getRequest: vi.fn(),
      getClass: vi.fn(),
      getHandler: vi.fn(),
      getPath: vi.fn().mockReturnValue("/test/path"),
      getMethod: vi.fn().mockReturnValue("GET"),
    } as unknown as ExecutionContext;

    mockNext = {
      handle: vi.fn(),
    } as unknown as CallHandler;
  });

  afterEach(() => {
    Container.reset();
    vi.restoreAllMocks();
  });

  it("should log request method and path", async () => {
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: "test" });

    await interceptor.intercept(mockContext, mockNext);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "HTTP request completed",
      expect.objectContaining({ method: "GET", path: "/test/path" }),
    );
  });

  it("should log duration after handler completes", async () => {
    (mockNext.handle as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      return new Promise((resolve) => setTimeout(() => resolve({}), 10));
    });

    await interceptor.intercept(mockContext, mockNext);

    const logContext = vi.mocked(mockLogger.info).mock.calls[0]?.[1] as { durationMs: number };
    expect(logContext.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should pass through handler result", async () => {
    const expectedResult = { data: "test-result", id: 123 };
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue(expectedResult);

    const result = await interceptor.intercept(mockContext, mockNext);

    expect(result).toEqual(expectedResult);
  });

  it("should log different HTTP methods", async () => {
    (mockContext.getMethod as ReturnType<typeof vi.fn>).mockReturnValue("POST");
    (mockContext.getPath as ReturnType<typeof vi.fn>).mockReturnValue("/api/users");
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await interceptor.intercept(mockContext, mockNext);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "HTTP request completed",
      expect.objectContaining({ method: "POST", path: "/api/users" }),
    );
  });

  it("should handle long path strings", async () => {
    const longPath = "/api/v1/users/123/posts/456/comments/789";
    (mockContext.getPath as ReturnType<typeof vi.fn>).mockReturnValue(longPath);
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await interceptor.intercept(mockContext, mockNext);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "HTTP request completed",
      expect.objectContaining({ path: longPath }),
    );
  });

  it("should work with different HTTP verbs", async () => {
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

    for (const method of methods) {
      (mockContext.getMethod as ReturnType<typeof vi.fn>).mockReturnValue(method);
      (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await interceptor.intercept(mockContext, mockNext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "HTTP request completed",
        expect.objectContaining({ method }),
      );
    }
  });

  it("should round duration to nearest millisecond", async () => {
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await interceptor.intercept(mockContext, mockNext);

    const logContext = vi.mocked(mockLogger.info).mock.calls[0]?.[1] as { durationMs: number };
    expect(Number.isInteger(logContext.durationMs)).toBe(true);
  });

  it("should log structured method, path, and duration fields", async () => {
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await interceptor.intercept(mockContext, mockNext);

    expect(mockLogger.info).toHaveBeenCalledWith("HTTP request completed", {
      method: "GET",
      path: "/test/path",
      durationMs: expect.any(Number),
    });
  });

  it("should work even when handler returns undefined", async () => {
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await interceptor.intercept(mockContext, mockNext);

    expect(result).toBeUndefined();
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it("should log for DELETE method", async () => {
    (mockContext.getMethod as ReturnType<typeof vi.fn>).mockReturnValue("DELETE");
    (mockContext.getPath as ReturnType<typeof vi.fn>).mockReturnValue("/api/items/123");
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await interceptor.intercept(mockContext, mockNext);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "HTTP request completed",
      expect.objectContaining({ method: "DELETE", path: "/api/items/123" }),
    );
  });

  it("should resolve its default logger from the container", async () => {
    Container.set(LOGGER_TOKEN, mockLogger);
    const containerBackedInterceptor = new LoggingInterceptor();
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await containerBackedInterceptor.intercept(mockContext, mockNext);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "HTTP request completed",
      expect.objectContaining({ method: "GET", path: "/test/path" }),
    );
  });
});
