import "reflect-metadata";
import { Container, Context as FrameworkContext } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Problem, ProblemCategory, ProblemFactory } from "@croco/problems-core";
import type { ExceptionFilter } from "@croco/protocols-rest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HTTP_CONTEXT_KEYS } from "../libs/contextKeys";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HttpExecutionContext } from "../libs/HttpExecutionContext";
import { PipelineRunner, describeHttpPipelineGraph } from "../libs/PipelineRunner";
import type { CrocoHttpContext } from "../libs/types";

function createMockHttpContext(): CrocoHttpContext {
  const request = new Request("http://localhost/test");

  const req = {
    method: "GET",
    url: request.url,
    path: "/test",
    params: {},
    query: {},
    headers: {},
  };

  const res = {
    status: 200,
    headers: {},
  };

  return {
    req,
    res,
    raw: {
      req: {
        raw: request,
      },
    } as CrocoHttpContext["raw"],
    param: vi.fn(),
    query: vi.fn(),
    header: vi.fn(),
    json: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    text: vi
      .fn()
      .mockImplementation((body: string, status: number = 200) => new Response(body, { status })),
    jsonResponse: vi
      .fn()
      .mockImplementation(
        (body: unknown, status: number = 200) => new Response(JSON.stringify(body), { status }),
      ),
    redirect: vi
      .fn()
      .mockImplementation((url: string, status: number = 302) => Response.redirect(url, status)),
  };
}

class OperatorOnlyProblem extends Problem {
  constructor() {
    super(
      "transports-http/di-bootstrap-validation",
      ProblemCategory.InternalServerError,
      "DI bootstrap failed for tenant secret-tenant",
      {
        extensions: {
          issues: [{ message: "container token missing" }],
          reason: "di_failure",
          rawProviderResponse: { token: "secret-provider-token" },
        },
      },
    );
  }
}

describe("PipelineRunner", () => {
  let logger!: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  function createRunner(): PipelineRunner {
    return new PipelineRunner(Container.get(ErrorHandler));
  }

  beforeEach(() => {
    Container.reset();
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    Container.set(Logger, logger as unknown as Logger);
    Container.set(ErrorHandler, new ErrorHandler(logger as unknown as Logger));
  });

  it("BUG-03 명시적 의존성으로 PipelineRunner 생성 가능", () => {
    expect(() => createRunner()).not.toThrow();
  });

  it("BUG-01 다중 ExceptionFilter 중 매칭 필터 실행", async () => {
    const runner = createRunner();
    const execContext = new HttpExecutionContext(
      createMockHttpContext(),
      class TestController {},
      "handler",
    );
    const httpProblem = ProblemFactory.badRequest("BAD_REQUEST", "bad request");

    const httpProblemFilter: ExceptionFilter<unknown, HttpExecutionContext> = {
      catch: vi.fn().mockImplementation((error: unknown) => {
        if (error instanceof Problem) {
          return "http-problem-filter";
        }
        throw error;
      }),
    };

    const genericFilter: ExceptionFilter<unknown, HttpExecutionContext> = {
      catch: vi.fn().mockReturnValue("generic-filter"),
    };

    const httpProblemResult = await runner.run(
      execContext,
      async () => {
        throw httpProblem;
      },
      {
        guards: [],
        interceptors: [],
        filters: [httpProblemFilter, genericFilter],
      },
    );

    expect(httpProblemResult).toBe("http-problem-filter");
    expect(httpProblemFilter.catch).toHaveBeenCalledTimes(1);
    expect(genericFilter.catch).not.toHaveBeenCalled();

    const genericErrorResult = await runner.run(
      execContext,
      async () => {
        throw new TypeError("generic failure");
      },
      {
        guards: [],
        interceptors: [],
        filters: [httpProblemFilter, genericFilter],
      },
    );

    expect(genericErrorResult).toBe("generic-filter");
    expect(httpProblemFilter.catch).toHaveBeenCalledTimes(2);
    expect(genericFilter.catch).toHaveBeenCalledTimes(1);
  });

  it("BUG-02 ErrorHandler가 Logger를 가져야 함", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    Container.set(Logger, logger as unknown as Logger);
    Container.set(ErrorHandler, new ErrorHandler(logger as unknown as Logger));

    const runner = createRunner();
    const execContext = new HttpExecutionContext(
      createMockHttpContext(),
      class TestController {},
      "handler",
    );

    const result = await runner.run(
      execContext,
      async () => {
        throw new TypeError("boom");
      },
      {
        guards: [],
        interceptors: [],
        filters: [],
      },
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(500);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("should preserve the original business error when a filter throws", async () => {
    const runner = createRunner();
    const execContext = new HttpExecutionContext(
      createMockHttpContext(),
      class TestController {},
      "handler",
    );
    const originalProblem = ProblemFactory.badRequest("BAD_REQUEST", "original business error");

    const brokenFilter: ExceptionFilter<unknown, HttpExecutionContext> = {
      catch: vi.fn().mockImplementation(() => {
        throw new Error("filter failure");
      }),
    };

    const result = await runner.run(
      execContext,
      async () => {
        throw originalProblem;
      },
      {
        guards: [],
        interceptors: [],
        filters: [brokenFilter],
      },
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
    expect(await (result as Response).json()).toMatchObject({
      code: "BAD_REQUEST",
      detail: "original business error",
      status: 400,
    });
  });

  it("should redact Problem Details returned from async exception filters", async () => {
    const runner = createRunner();
    const httpContext = createMockHttpContext();
    httpContext.get = vi.fn((key: string) =>
      key === HTTP_CONTEXT_KEYS.traceId ? "filter-trace" : undefined,
    ) as CrocoHttpContext["get"];
    const execContext = new HttpExecutionContext(httpContext, class TestController {}, "handler");
    const filter: ExceptionFilter<unknown, HttpExecutionContext> = {
      catch: vi.fn().mockImplementation(async (error: unknown) => {
        if (error instanceof Problem) {
          return {
            status: error.status,
            headers: { "Content-Type": "application/problem+json" },
            body: error.toJSON(),
          };
        }

        throw error;
      }),
    };

    const result = await FrameworkContext.run({ requestId: "filter-request" }, () =>
      runner.run(
        execContext,
        async () => {
          throw new OperatorOnlyProblem();
        },
        {
          guards: [],
          interceptors: [],
          filters: [filter],
        },
      ),
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(500);

    const body = await (result as Response).json();
    expect(body).toEqual(
      expect.objectContaining({
        status: 500,
        code: "transports-http/di-bootstrap-validation",
        detail: "An internal error occurred",
        instance: "http://localhost/test",
        traceId: "filter-trace",
        requestId: "filter-request",
      }),
    );
    expect(body).not.toHaveProperty("issues");
    expect(body).not.toHaveProperty("reason");
    expect(body).not.toHaveProperty("rawProviderResponse");
    expect(JSON.stringify(body)).not.toContain("secret-tenant");
    expect(JSON.stringify(body)).not.toContain("secret-provider-token");
  });

  it("should fail closed for unrecognized application/problem+json FilterResponse bodies", async () => {
    const runner = createRunner();
    const execContext = new HttpExecutionContext(
      createMockHttpContext(),
      class TestController {},
      "handler",
    );
    const filter: ExceptionFilter<unknown, HttpExecutionContext> = {
      catch: vi.fn().mockImplementation(async (error: unknown) => {
        if (error instanceof Problem) {
          return {
            status: 500,
            headers: {
              "Cache-Control": "no-store",
              "Content-Digest": "sha-256=:stale-digest:",
              "Content-Encoding": "gzip",
              "Content-Length": "999",
              "Content-MD5": "stale-md5",
              "Content-Type": "Application/Problem+Json",
              Digest: "sha-256=:stale-digest:",
              ETag: '"stale-etag"',
              "Repr-Digest": "sha-256=:stale-repr-digest:",
            },
            body: {
              leak: "secret-provider-token",
              rawProviderResponse: { tenant: "secret-tenant" },
              status: 500,
            },
          };
        }

        throw error;
      }),
    };

    const result = await runner.run(
      execContext,
      async () => {
        throw new OperatorOnlyProblem();
      },
      {
        guards: [],
        interceptors: [],
        filters: [filter],
      },
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(500);
    expect((result as Response).headers.get("Cache-Control")).toBe("no-store");
    expect((result as Response).headers.get("Content-Digest")).toBeNull();
    expect((result as Response).headers.get("Content-Encoding")).toBeNull();
    expect((result as Response).headers.get("Content-Length")).toBeNull();
    expect((result as Response).headers.get("Content-MD5")).toBeNull();
    expect((result as Response).headers.get("Digest")).toBeNull();
    expect((result as Response).headers.get("ETag")).toBeNull();
    expect((result as Response).headers.get("Repr-Digest")).toBeNull();

    const body = await (result as Response).json();
    expect(body).toEqual(
      expect.objectContaining({
        status: 500,
        code: "transports-http/di-bootstrap-validation",
        detail: "An internal error occurred",
        instance: "http://localhost/test",
      }),
    );
    expect(JSON.stringify(body)).not.toContain("secret-provider-token");
    expect(JSON.stringify(body)).not.toContain("secret-tenant");
    expect(JSON.stringify(body)).not.toContain("rawProviderResponse");
  });

  it("should redact application/problem+json Response returned from async exception filters", async () => {
    const runner = createRunner();
    const execContext = new HttpExecutionContext(
      createMockHttpContext(),
      class TestController {},
      "handler",
    );
    const filter: ExceptionFilter<unknown, HttpExecutionContext> = {
      catch: vi.fn().mockImplementation(async (error: unknown) => {
        if (error instanceof Problem) {
          return new Response(JSON.stringify(error.toJSON()), {
            status: error.status,
            headers: {
              "Cache-Control": "no-store",
              "Content-Digest": "sha-256=:stale-digest:",
              "Content-Encoding": "gzip",
              "Content-Length": "999",
              "Content-MD5": "stale-md5",
              "Content-Type": "Application/Problem+Json",
              Digest: "sha-256=:stale-digest:",
              ETag: '"stale-etag"',
              "Repr-Digest": "sha-256=:stale-repr-digest:",
            },
          });
        }

        throw error;
      }),
    };

    const result = await runner.run(
      execContext,
      async () => {
        throw new OperatorOnlyProblem();
      },
      {
        guards: [],
        interceptors: [],
        filters: [filter],
      },
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(500);
    expect((result as Response).headers.get("Cache-Control")).toBe("no-store");
    expect((result as Response).headers.get("Content-Digest")).toBeNull();
    expect((result as Response).headers.get("Content-Encoding")).toBeNull();
    expect((result as Response).headers.get("Content-Length")).toBeNull();
    expect((result as Response).headers.get("Content-MD5")).toBeNull();
    expect((result as Response).headers.get("Digest")).toBeNull();
    expect((result as Response).headers.get("ETag")).toBeNull();
    expect((result as Response).headers.get("Repr-Digest")).toBeNull();

    const body = await (result as Response).json();
    expect(body).toEqual(
      expect.objectContaining({
        status: 500,
        code: "transports-http/di-bootstrap-validation",
        detail: "An internal error occurred",
        instance: "http://localhost/test",
      }),
    );
    expect(body).not.toHaveProperty("issues");
    expect(body).not.toHaveProperty("reason");
    expect(body).not.toHaveProperty("rawProviderResponse");
    expect(JSON.stringify(body)).not.toContain("secret-tenant");
    expect(JSON.stringify(body)).not.toContain("secret-provider-token");
  });

  it.each([
    { name: "malformed JSON", responseBody: "{not-json secret-provider-token" },
    { name: "non-object JSON", responseBody: JSON.stringify(["secret-provider-token"]) },
    {
      name: "unrecognized object",
      responseBody: JSON.stringify({ leak: "secret-provider-token", status: 500 }),
    },
  ])(
    "should fail closed for $name application/problem+json Response bodies returned from filters",
    async ({ responseBody }) => {
      const runner = createRunner();
      const execContext = new HttpExecutionContext(
        createMockHttpContext(),
        class TestController {},
        "handler",
      );
      const filter: ExceptionFilter<unknown, HttpExecutionContext> = {
        catch: vi.fn().mockResolvedValue(
          new Response(responseBody, {
            status: 500,
            headers: {
              "Cache-Control": "no-store",
              "Content-Digest": "sha-256=:stale-digest:",
              "Content-Encoding": "gzip",
              "Content-Length": "999",
              "Content-MD5": "stale-md5",
              "Content-Type": "application/problem+json",
              Digest: "sha-256=:stale-digest:",
              ETag: '"stale-etag"',
              "Repr-Digest": "sha-256=:stale-repr-digest:",
            },
          }),
        ),
      };

      const result = await runner.run(
        execContext,
        async () => {
          throw new OperatorOnlyProblem();
        },
        {
          guards: [],
          interceptors: [],
          filters: [filter],
        },
      );

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(500);
      expect((result as Response).headers.get("Cache-Control")).toBe("no-store");
      expect((result as Response).headers.get("Content-Digest")).toBeNull();
      expect((result as Response).headers.get("Content-Encoding")).toBeNull();
      expect((result as Response).headers.get("Content-Length")).toBeNull();
      expect((result as Response).headers.get("Content-MD5")).toBeNull();
      expect((result as Response).headers.get("Digest")).toBeNull();
      expect((result as Response).headers.get("ETag")).toBeNull();
      expect((result as Response).headers.get("Repr-Digest")).toBeNull();

      const body = await (result as Response).json();
      expect(body).toEqual(
        expect.objectContaining({
          status: 500,
          code: "transports-http/di-bootstrap-validation",
          detail: "An internal error occurred",
          instance: "http://localhost/test",
        }),
      );
      expect(JSON.stringify(body)).not.toContain("secret-provider-token");
      expect(JSON.stringify(body)).not.toContain("rawProviderResponse");
    },
  );

  it("should describe deterministic middleware, guard, interceptor, handler, and filter order", () => {
    function firstMiddleware() {}
    function secondMiddleware() {}

    class AuthGuard {
      canActivate() {
        return true;
      }
    }

    class EnvelopeInterceptor {
      async intercept(_context: unknown, next: { handle(): Promise<unknown> }) {
        return next.handle();
      }
    }

    class AuditInterceptor {
      async intercept(_context: unknown, next: { handle(): Promise<unknown> }) {
        return next.handle();
      }
    }

    class HttpProblemFilter {
      catch(error: unknown) {
        return error;
      }
    }

    const graph = describeHttpPipelineGraph({
      target: "GET /orders/:id",
      handlerId: "handler:OrdersController.get",
      handlerLabel: "OrdersController.get",
      middlewares: [firstMiddleware, secondMiddleware],
      guards: [new AuthGuard()],
      interceptors: [new EnvelopeInterceptor(), new AuditInterceptor()],
      filters: [new HttpProblemFilter()],
    });

    expect(graph.successOrder).toEqual([
      "middleware:0:before",
      "middleware:1:before",
      "guard:0",
      "interceptor:0:before",
      "interceptor:1:before",
      "handler:OrdersController.get",
      "interceptor:1:after",
      "interceptor:0:after",
      "middleware:1:after",
      "middleware:0:after",
    ]);
    expect(graph.executionOrder).toEqual(graph.successOrder);
    expect(graph.errorOrder).toEqual([
      "middleware:0:before",
      "middleware:1:before",
      "guard:0",
      "interceptor:0:before",
      "interceptor:1:before",
      "handler:OrdersController.get",
      "interceptor:1:after",
      "interceptor:0:after",
      "filter:0",
      "middleware:1:after",
      "middleware:0:after",
    ]);
    expect(graph.phaseOrder.error).toEqual(["filter:0"]);
    expect(graph.nodes.find((node) => node.id === "filter:0")?.failurePropagation).toBe(
      "handle-error",
    );
    expect(graph.debugDump).toContain("request-pipeline GET /orders/:id");
    expect(graph.debugDump).toContain("middleware middleware:0:before (short-circuit)");
  });
});
