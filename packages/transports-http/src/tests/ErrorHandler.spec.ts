import "reflect-metadata";
import { Container, Context as FrameworkContext, LOGGER_TOKEN } from "@croco/framework-context";
import type { Logger } from "@croco/framework-logger";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { beforeEach, describe, expect, it } from "vitest";
import { HTTP_CONTEXT_KEYS } from "../libs/contextKeys";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HttpRequestBodyTooLargeProblem } from "../libs/problems/HttpRequestBodyProblems";
import type { CrocoHttpContext } from "../libs/types";

type TestProblemOptions = {
  code?: string;
  category?: ProblemCategory;
  detail?: string;
  extensions?: Record<string, unknown>;
};

class TestProblem extends Problem {
  constructor(options: TestProblemOptions = {}) {
    super(
      options.code ?? "test/error",
      options.category ?? ProblemCategory.BadRequest,
      options.detail,
      options.extensions === undefined ? undefined : { extensions: options.extensions },
    );
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
      error: () => {},
      debug: () => {},
    } as unknown as Logger;

    errorHandler = new ErrorHandler(mockLogger);

    mockCtx = {
      req: {
        url: "/test",
        method: "GET",
        headers: new Headers(),
      },
      jsonResponse: (body: unknown, status: number) => {
        return new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/problem+json" },
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

  describe("RFC 7807 Standard Field Protection", () => {
    it("should protect standard fields from extensions override", async () => {
      const problem = new TestProblem({
        detail: "Test error",
        extensions: {
          type: "https://malicious.example.com/error",
          title: "Hacked Title",
          status: 999,
          code: "HACKED_CODE",
          detail: "Hacked detail",
          instance: "/hacked",
          issues: ["safe-field"],
          metadata: { secret: "operator-only" },
        },
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
      const problem = new TestProblem({
        detail: "Not found",
        extensions: { status: 404 },
      });

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
});
