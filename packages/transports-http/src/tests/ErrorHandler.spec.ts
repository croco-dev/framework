import "reflect-metadata";
import { Container, Context as FrameworkContext, LOGGER_TOKEN } from "@croco/framework-context";
import type { Logger } from "@croco/framework-logger";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { HttpExceptionFilter } from "@croco/protocols-rest";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HTTP_CONTEXT_KEYS } from "../libs/contextKeys";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HttpContext } from "../libs/HttpContext";
import { HttpRequestBodyTooLargeProblem } from "../libs/problems/HttpRequestBodyProblems";
import type { CrocoHttpContext } from "../libs/types";

type TestProblemOptions = {
  code?: string;
  category?: ProblemCategory;
  detail?: string;
  extensions?: Record<string, unknown>;
  instance?: string;
  cause?: Error;
  status?: number;
};

class TestProblem extends Problem {
  private readonly statusOverride?: number;

  override get status(): number {
    return this.statusOverride ?? super.status;
  }
  constructor(options: TestProblemOptions = {}) {
    super(
      options.code ?? "test/error",
      options.category ?? ProblemCategory.BadRequest,
      options.detail,
      { extensions: options.extensions, instance: options.instance, cause: options.cause },
    );
    this.statusOverride = options.status;
  }
}

describe("ErrorHandler", () => {
  let errorHandler!: ErrorHandler;
  let mockCtx!: CrocoHttpContext;
  let mockLogger!: Logger;

  beforeEach(() => {
    Container.reset();

    mockLogger = {
      info: () => {},
      warn: () => {},
      error: vi.fn(),
      debug: () => {},
      fatal: vi.fn(),
      child: () => mockLogger,
    } as unknown as Logger;

    errorHandler = new ErrorHandler(mockLogger);

    mockCtx = {
      req: {
        url: "/test",
        path: "/test",
        method: "GET",
        headers: new Headers(),
      },
      res: {
        status: 200,
        headers: {},
      },
      jsonResponse: (body: unknown, status: number) => {
        return new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      },
    } as unknown as CrocoHttpContext;
  });

  it("should resolve its logger token when constructed by the container", () => {
    Container.register(ErrorHandler, "singleton");
    Container.set(LOGGER_TOKEN, mockLogger);

    const handler = Container.get(ErrorHandler);

    expect(handler).toBeInstanceOf(ErrorHandler);
    expect(Reflect.get(handler, "logger")).toBe(mockLogger);
  });

  describe("Problem Details media type", () => {
    it.each([
      {
        name: "Problem",
        error: new TestProblem({ detail: "Invalid request" }),
        status: 400,
        body: {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          code: "test/error",
          detail: "Invalid request",
          instance: "http://localhost/test",
        },
      },
      {
        name: "Error",
        error: new Error("private error detail"),
        status: 500,
        body: {
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
          detail: "An internal error occurred",
        },
      },
      {
        name: "non-Error exception",
        error: "private thrown value",
        status: 500,
        body: {
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
          detail: "An unexpected error occurred",
        },
      },
    ])(
      "should return application/problem+json for $name through Hono",
      async ({ error, status, body }) => {
        const app = new Hono();
        let context: HttpContext | undefined;
        app.get("/test", (raw) => {
          context = new HttpContext(raw);
          return errorHandler.handleError(error, context);
        });

        const response = await app.request("/test");

        expect(response.status).toBe(status);
        expect(response.headers.get("content-type")).toBe("application/problem+json");
        expect(context?.res.headers["content-type"]).toBe(
          error instanceof Problem ? "application/problem+json" : undefined,
        );
        expect(await response.json()).toEqual(body);
      },
    );

    it("should preserve application/json for successful responses", async () => {
      const app = new Hono();
      app.get("/test", (raw) => new HttpContext(raw).jsonResponse({ ok: true }));

      const response = await app.request("/test");

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toEqual({ ok: true });
    });
  });

  describe("RFC 7807 Standard Field Protection", () => {
    it("should protect standard fields from extensions override", async () => {
      const problem = new TestProblem({ detail: "Test error" });
      Object.defineProperty(problem, "extensions", {
        configurable: true,
        enumerable: true,
        value: {
          type: "https://malicious.example.com/error",
          title: "Hacked Title",
          status: 999,
          code: "HACKED_CODE",
          detail: "Hacked detail",
          instance: "/hacked",
          issues: ["safe-field"],
          metadata: { secret: "operator-only" },
        },
        writable: true,
      });

      const response = errorHandler.handleError(problem, mockCtx);
      const body = await response.json();

      expect(body.type).toBe("about:blank");
      expect(body.title).toBe("Bad Request");
      expect(body.status).toBe(400);
      expect(body.code).toBe("test/error");
      expect(body.detail).toBe("Test error");
      expect(body.instance).toBe("/test");
      expect(body.issues).toEqual(["safe-field"]);
      expect(body).not.toHaveProperty("metadata");
    });

    it("should handle Problem without extensions", async () => {
      const problem = new TestProblem({ detail: "Simple error" });

      const response = errorHandler.handleError(problem, mockCtx);
      const body = await response.json();

      expect(body).toEqual({
        type: "about:blank",
        title: "Bad Request",
        status: 400,
        code: "test/error",
        detail: "Simple error",
        instance: "/test",
      });
    });

    it("should include only public allowlisted extensions", async () => {
      const problem = new TestProblem({
        detail: "Error with metadata",
        extensions: {
          metadata: { key: "value" },
          errors: ["field1", "field2"],
          limit: 10,
          token: "secret-token",
        },
      });

      const response = errorHandler.handleError(problem, mockCtx);
      const body = await response.json();

      expect(body).toEqual({
        type: "about:blank",
        title: "Bad Request",
        status: 400,
        code: "test/error",
        detail: "Error with metadata",
        instance: "/test",
        errors: ["field1", "field2"],
        limit: 10,
      });
      expect(body).not.toHaveProperty("metadata");
      expect(body).not.toHaveProperty("token");
    });
  });

  describe("createFilterResponseBody", () => {
    it("should drop prototype-polluting keys from untrusted Problem Details bodies", () => {
      const body = JSON.parse(
        `{
          "type": "about:blank",
          "title": "Bad Request",
          "status": 400,
          "code": "test/error",
          "detail": "Filter body",
          "instance": "/filter",
          "errors": ["safe-field"],
          "__proto__": { "polluted": true },
          "constructor": { "polluted": true },
          "prototype": { "polluted": true }
        }`,
      ) as Record<string, unknown>;

      const result = errorHandler.createFilterResponseBody(
        new TestProblem({ code: "test/error", detail: "Source body" }),
        body,
        mockCtx,
      );

      expect(result).toEqual(
        expect.objectContaining({
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          code: "test/error",
          detail: "Filter body",
          instance: "/test",
          errors: ["safe-field"],
        }),
      );
      expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(result, "constructor")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(result, "prototype")).toBe(false);
    });
  });

  describe("handleProblem", () => {
    it.each([500, 503, 599])(
      "should log status %i with the original Problem and response correlation",
      async (status) => {
        const cause = new Error("upstream connection refused");
        const problem = new TestProblem({
          category: ProblemCategory.InternalServerError,
          detail: "Provider failed",
          cause,
          status,
        });
        mockCtx.get = ((key: string) =>
          key === HTTP_CONTEXT_KEYS.traceId
            ? "trace-server"
            : undefined) as CrocoHttpContext["get"];
        const response = await FrameworkContext.run({ requestId: "request-server" }, () =>
          errorHandler.handleError(problem, mockCtx),
        );
        const body = await response.json();

        expect(response.status).toBe(status);
        expect(response.headers.get("Content-Type")).toBe("application/problem+json");
        expect(body).toMatchObject({
          status,
          detail: "An internal error occurred",
          traceId: "trace-server",
          requestId: "request-server",
        });
        expect(mockLogger.error).toHaveBeenCalledExactlyOnceWith("Server problem:", {
          problem,
          traceId: body.traceId,
          requestId: body.requestId,
        });
        const [, context] = vi.mocked(mockLogger.error).mock.calls[0];
        expect(context).toHaveProperty("problem", problem);
        expect(problem.cause).toBe(cause);
      },
    );

    it.each([400, 499])("should not log status %i", (status) => {
      errorHandler.handleError(new TestProblem({ status }), mockCtx);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it.each(["throw", "reject"])(
      "should preserve the Problem response when logging fails by %s",
      async (failure) => {
        const problem = new TestProblem({
          category: ProblemCategory.InternalServerError,
          detail: "secret provider failure",
        });
        const expected = errorHandler.handleError(problem, mockCtx);
        vi.mocked(mockLogger.error).mockClear();
        vi.mocked(mockLogger.error).mockImplementation(() => {
          const error = new Error("log sink failed");
          if (failure === "throw") throw error;
          return Promise.reject(error);
        });
        const response = errorHandler.handleError(problem, mockCtx);
        expect(response.status).toBe(expected.status);
        expect([...response.headers]).toEqual([...expected.headers]);
        expect(await response.json()).toEqual(await expected.json());
        expect(mockLogger.error).toHaveBeenCalledOnce();
      },
    );

    it.each([
      { name: "divergent source instance", sourceInstance: "/source-instance" },
      { name: "absent source instance", sourceInstance: undefined },
    ])("should match the protocol filter public payload with $name", ({ sourceInstance }) => {
      const requestPath = "/test";
      const secretQuery = "token=secret-reset-token";
      const requestUrl = `https://example.test${requestPath}?${secretQuery}`;
      const problem = new TestProblem({
        code: "protocols-rest/request-validation-failed",
        category: ProblemCategory.ValidationError,
        detail: "body.email is invalid",
        instance: sourceInstance,
        extensions: {
          issues: [{ path: "body.email", message: "must be an email" }],
          metadata: { token: "secret-token" },
        },
      });
      const transportContext = {
        ...mockCtx,
        req: { ...mockCtx.req, url: requestUrl, path: requestPath },
      } as CrocoHttpContext;
      const filterContext = {
        getRequest: () => new Request(requestUrl),
      } as never;

      const transportBody = errorHandler.createProblemResponseBody(problem, transportContext);
      const filterBody = new HttpExceptionFilter().catch(problem, filterContext).body;

      expect(transportBody).toEqual(filterBody);
      expect(transportBody.instance).toBe(`https://example.test${requestPath}`);
      expect(JSON.stringify(transportBody)).not.toContain("secret-token");
      expect(JSON.stringify(transportBody)).not.toContain(secretQuery);
    });

    it("should honor an explicit Problem status override in the response and body", async () => {
      const problem = new HttpRequestBodyTooLargeProblem({
        limit: 4,
        status: 422,
        detail: "Body exceeds route policy",
        instance: "/source-instance",
      });

      const response = errorHandler.handleError(problem, mockCtx);
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toMatchObject({
        title: "Payload Too Large",
        status: 422,
        code: "transports-http/request-body-too-large",
        detail: "Body exceeds route policy",
        instance: "/test",
        limit: 4,
      });
    });

    it("should correctly map Problem category to HTTP status", async () => {
      const problem = new TestProblem({ detail: "Not found" });

      const response = errorHandler.handleError(problem, mockCtx);
      expect(response.status).toBe(400);
    });

    it("should apply public registry redaction to registered validation Problems", async () => {
      const problem = new TestProblem({
        code: "protocols-rest/request-validation-failed",
        category: ProblemCategory.ValidationError,
        detail: "body.email is invalid",
        extensions: {
          issues: [{ path: "body.email", message: "must be an email" }],
          rawProviderResponse: { token: "secret-provider-token" },
          metadata: { tenantId: "tenant-secret" },
        },
      });

      const response = errorHandler.handleError(problem, mockCtx);
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual(
        expect.objectContaining({
          title: "Validation Error",
          status: 422,
          code: "protocols-rest/request-validation-failed",
          detail: "body.email is invalid",
          issues: [{ path: "body.email", message: "must be an email" }],
        }),
      );
      expect(JSON.stringify(body)).not.toContain("secret-provider-token");
      expect(JSON.stringify(body)).not.toContain("tenant-secret");
    });

    it("should apply safe-message registry redaction without exposing diagnostics", async () => {
      const problem = new TestProblem({
        code: "ACCESS_DENIED",
        category: ProblemCategory.Forbidden,
        detail: "Access denied",
        extensions: {
          reason: "policy_denied",
          provider: "clerk",
          diagnostics: { token: "secret-token" },
        },
      });

      const response = errorHandler.handleError(problem, mockCtx);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual(
        expect.objectContaining({
          title: "Forbidden",
          status: 403,
          code: "ACCESS_DENIED",
          detail: "Access denied",
          reason: "policy_denied",
        }),
      );
      expect(body).not.toHaveProperty("provider");
      expect(body).not.toHaveProperty("diagnostics");
      expect(JSON.stringify(body)).not.toContain("secret-token");
    });

    it("should redact detail and all extensions for registered operator-only Problems", async () => {
      const store = new Map<string, unknown>([[HTTP_CONTEXT_KEYS.traceId, "trace-operator"]]);
      mockCtx.get = ((key: string) => store.get(key)) as CrocoHttpContext["get"];
      const problem = new TestProblem({
        code: "transports-http/di-bootstrap-validation",
        category: ProblemCategory.InternalServerError,
        detail: "DI bootstrap failed for tenant secret-tenant",
        extensions: {
          issues: [{ message: "container token missing" }],
          reason: "di_failure",
          rawProviderResponse: { token: "secret-provider-token" },
        },
      });

      const response = await FrameworkContext.run({ requestId: "request-operator" }, () =>
        errorHandler.handleError(problem, mockCtx),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual(
        expect.objectContaining({
          title: "Internal Server Error",
          status: 500,
          code: "transports-http/di-bootstrap-validation",
          detail: "An internal error occurred",
          traceId: "trace-operator",
          requestId: "request-operator",
        }),
      );
      expect(body).not.toHaveProperty("issues");
      expect(body).not.toHaveProperty("reason");
      expect(body).not.toHaveProperty("rawProviderResponse");
      expect(JSON.stringify(body)).not.toContain("secret-tenant");
      expect(JSON.stringify(body)).not.toContain("secret-provider-token");
    });

    it("should fall back to category redaction for unknown Problem codes", async () => {
      const problem = new TestProblem({
        code: "unknown/internal-error",
        category: ProblemCategory.InternalServerError,
        detail: "database password leaked in detail",
        extensions: {
          issues: [{ message: "internal diagnostic" }],
          metadata: { password: "secret-password" },
        },
      });

      const response = errorHandler.handleError(problem, mockCtx);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual(
        expect.objectContaining({
          status: 500,
          code: "unknown/internal-error",
          detail: "An internal error occurred",
        }),
      );
      expect(body).not.toHaveProperty("issues");
      expect(body).not.toHaveProperty("metadata");
      expect(JSON.stringify(body)).not.toContain("secret-password");
      expect(JSON.stringify(body)).not.toContain("database password");
    });

    it("should include request trace metadata in Problem Details", async () => {
      const store = new Map<string, unknown>([[HTTP_CONTEXT_KEYS.traceId, "trace-1"]]);
      mockCtx.get = ((key: string) => store.get(key)) as CrocoHttpContext["get"];

      const response = await FrameworkContext.run({ requestId: "request-1" }, () =>
        errorHandler.handleError(new TestProblem({ detail: "metadata" }), mockCtx),
      );
      const body = await response.json();

      expect(body).toEqual(
        expect.objectContaining({
          traceId: "trace-1",
          requestId: "request-1",
        }),
      );
    });

    it("should include sanitized telemetry degradation metadata in Problem Details", async () => {
      const store = new Map<string, unknown>([
        [HTTP_CONTEXT_KEYS.telemetryDegraded, true],
        [HTTP_CONTEXT_KEYS.telemetryDegradedReason, "telemetry_setup_failed"],
        [
          HTTP_CONTEXT_KEYS.telemetryDegradedError,
          {
            name: "TypeError",
            message: "header access failure",
          },
        ],
      ]);
      mockCtx.get = ((key: string) => store.get(key)) as CrocoHttpContext["get"];

      const response = errorHandler.handleError(new TestProblem({ detail: "metadata" }), mockCtx);
      const body = await response.json();

      expect(body).toEqual(
        expect.objectContaining({
          telemetry: {
            degraded: true,
            reason: "telemetry_setup_failed",
          },
        }),
      );
      expect(JSON.stringify(body)).not.toContain("header access failure");
    });

    it("should keep safe transport correlation metadata ahead of Problem extensions", async () => {
      const store = new Map<string, unknown>([
        [HTTP_CONTEXT_KEYS.traceId, "safe-trace-1"],
        [HTTP_CONTEXT_KEYS.telemetryDegraded, true],
        [HTTP_CONTEXT_KEYS.telemetryDegradedReason, "telemetry_setup_failed"],
        [
          HTTP_CONTEXT_KEYS.telemetryDegradedError,
          {
            name: "TypeError",
            message: "secret setup failure",
          },
        ],
      ]);
      mockCtx.get = ((key: string) => store.get(key)) as CrocoHttpContext["get"];

      const response = await FrameworkContext.run({ requestId: "safe-request-1" }, () =>
        errorHandler.handleError(
          new TestProblem({
            detail: "metadata",
            extensions: {
              traceId: "extension-trace",
              requestId: "extension-request",
              telemetry: { degraded: false, reason: "extension" },
            },
          }),
          mockCtx,
        ),
      );
      const body = await response.json();

      expect(body).toEqual(
        expect.objectContaining({
          traceId: "safe-trace-1",
          requestId: "safe-request-1",
          telemetry: {
            degraded: true,
            reason: "telemetry_setup_failed",
          },
        }),
      );
      expect(JSON.stringify(body)).not.toContain("secret setup failure");
    });

    it("should emit a golden REST Problem Details response with correlation metadata", async () => {
      const store = new Map<string, unknown>([[HTTP_CONTEXT_KEYS.traceId, "trace-golden-rest"]]);
      mockCtx.get = ((key: string) => store.get(key)) as CrocoHttpContext["get"];
      const problem = new TestProblem({
        code: "protocols-rest/request-validation-failed",
        category: ProblemCategory.ValidationError,
        detail: "body.email is invalid",
        extensions: {
          issues: [{ path: "body.email", message: "must be an email" }],
          traceId: "extension-trace",
          requestId: "extension-request",
          telemetry: { degraded: false },
          metadata: { token: "secret-extension-token" },
        },
      });

      const response = await FrameworkContext.run({ requestId: "request-golden-rest" }, () =>
        errorHandler.handleError(problem, mockCtx),
      );
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(response.headers.get("Content-Type")).toBe("application/problem+json");
      expect(body).toEqual({
        type: "about:blank",
        title: "Validation Error",
        status: 422,
        code: "protocols-rest/request-validation-failed",
        detail: "body.email is invalid",
        instance: "/test",
        issues: [{ path: "body.email", message: "must be an email" }],
        traceId: "trace-golden-rest",
        requestId: "request-golden-rest",
      });
      expect(JSON.stringify(body)).not.toContain("secret-extension-token");
    });

    it("should emit a golden redacted REST Problem Details response for operator-only Problems", async () => {
      const store = new Map<string, unknown>([
        [HTTP_CONTEXT_KEYS.traceId, "trace-golden-redacted"],
      ]);
      mockCtx.get = ((key: string) => store.get(key)) as CrocoHttpContext["get"];
      const problem = new TestProblem({
        code: "transports-http/di-bootstrap-validation",
        category: ProblemCategory.InternalServerError,
        detail: "DI bootstrap failed for tenant secret-tenant",
        extensions: {
          issues: [{ message: "container token missing" }],
          reason: "di_failure",
          rawProviderResponse: { token: "secret-provider-token" },
        },
      });

      const response = await FrameworkContext.run({ requestId: "request-golden-redacted" }, () =>
        errorHandler.handleError(problem, mockCtx),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        code: "transports-http/di-bootstrap-validation",
        detail: "An internal error occurred",
        instance: "/test",
        traceId: "trace-golden-redacted",
        requestId: "request-golden-redacted",
      });
      expect(JSON.stringify(body)).not.toContain("secret-tenant");
      expect(JSON.stringify(body)).not.toContain("secret-provider-token");
    });
  });

  describe("handleGenericError", () => {
    it("should return the sanitized 500 response when logging throws", async () => {
      const originalError = new Error("database password: secret-password");
      const loggingError = new Error("log sink unavailable");
      const throwingLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(() => {
          throw loggingError;
        }),
        debug: vi.fn(),
        fatal: vi.fn(),
        child: () => throwingLogger,
      } as unknown as Logger;
      const handler = new ErrorHandler(throwingLogger);

      const response = handler.handleError(originalError, mockCtx);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail: "An internal error occurred",
      });
      expect(throwingLogger.error).toHaveBeenCalledOnce();
      expect(throwingLogger.error).toHaveBeenCalledWith("Unhandled error:", originalError);
      expect(JSON.stringify(body)).not.toContain(originalError.message);
      expect(JSON.stringify(body)).not.toContain(loggingError.message);
    });

    it("should report the original error through a healthy logger", () => {
      const originalError = new Error("request failed");
      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
        child: () => logger,
      } as unknown as Logger;
      const handler = new ErrorHandler(logger);

      handler.handleError(originalError, mockCtx);

      expect(logger.error).toHaveBeenCalledOnce();
      expect(logger.error).toHaveBeenCalledWith("Unhandled error:", originalError);
    });

    it("should consume a rejected logger promise while returning the sanitized response", async () => {
      const originalError = new Error("request failed");
      const loggingError = new Error("async log sink unavailable");
      const rejectedLogging = Promise.reject(loggingError);
      const catchSpy = vi.spyOn(rejectedLogging, "catch");
      const asyncLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(() => rejectedLogging),
        debug: vi.fn(),
        fatal: vi.fn(),
        child: () => asyncLogger,
      } as unknown as Logger;
      const handler = new ErrorHandler(asyncLogger);

      try {
        const response = handler.handleError(originalError, mockCtx);

        expect(response.status).toBe(500);
        expect(catchSpy).toHaveBeenCalledOnce();
        expect(asyncLogger.error).toHaveBeenCalledWith("Unhandled error:", originalError);
      } finally {
        await rejectedLogging.catch(() => undefined);
      }
    });
  });
});
