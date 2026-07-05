import "reflect-metadata";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  Component,
  Container,
  Context as FrameworkContext,
  type ILogger,
  LOGGER_TOKEN,
} from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  type ArgumentMetadata,
  Body,
  Controller,
  Get,
  Param,
  type ParamMetadata,
  ParamType,
  type PipeTransform,
  type PipeTransformConstructor,
  Post,
  Raw,
  REST_PARAMS_KEY,
} from "@croco/protocols-rest";
import {
  createSlidingWindowPolicy,
  RateLimiter,
  RateLimitKeyBuilder,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp as createCrocoApp } from "../libs/CrocoApp";
import {
  CrocoLambdaAdapter,
  getLambdaContext,
  getLambdaEvent,
  type LambdaExecutionContext,
} from "../libs/CrocoLambdaAdapter";
import { toLambdaHandler } from "../libs/adapters/LambdaAdapter";
import { CrocoRouteRegistrar } from "../libs/CrocoRouteRegistrar";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import { bodyLimitMiddleware, mb } from "../libs/middleware/BodyLimitMiddleware";
import { corsMiddleware } from "../libs/middleware/CorsMiddleware";
import { rateLimitHttpMiddleware } from "../libs/middleware/RateLimitMiddleware";
import { securityHeadersMiddleware } from "../libs/middleware/SecurityHeadersMiddleware";
import {
  declareSecurityMiddlewareCapabilities,
  getSecurityMiddlewareCapabilities,
} from "../libs/middleware/SecurityMiddlewareMarker";
import { getRuntimeContextInitFromEnv } from "../libs/runtimeContext";
import type { LambdaContext, LambdaEvent, MiddlewareFunction } from "../libs/types";

vi.mock("@hono/node-server", () => ({
  serve: vi.fn((_options: unknown, callback?: () => void) => {
    callback?.();
    return {};
  }),
}));

function createApp(config: Parameters<typeof createCrocoApp>[0]) {
  return createCrocoApp({ securityValidation: "off", ...config });
}

type ProblemCorrelationResponse = {
  title: string;
  status: number;
  code: string;
  detail: string;
  instance: string;
  traceId?: string;
  requestId?: string;
};

class TestProblem extends Problem {
  constructor(detail: string) {
    super("test/problem", ProblemCategory.BadRequest, detail);
  }
}

describe("CrocoApp", () => {
  let lambdaWaitUntilCompleted = false;

  beforeEach(() => {
    Container.reset();
    lambdaWaitUntilCompleted = false;
    vi.mocked(serve).mockClear();
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger;
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
  });

  @Controller("/api")
  class TestController {
    @Get("/hello")
    hello() {
      return { message: "Hello, World!" };
    }

    @Get("/empty")
    empty() {
      return null;
    }

    @Get("/runtime-context")
    getRuntimeContext() {
      const runtime = FrameworkContext.getRuntimeContext();

      return {
        platform: runtime?.platform ?? null,
        requestId: runtime?.requestId ?? null,
        traceId: runtime?.trace?.traceId ?? null,
        waitUntil: runtime?.capabilities.waitUntil ?? null,
        env: runtime?.capabilities.env ?? null,
        filesystem: runtime?.capabilities.filesystem ?? null,
        logger: runtime?.capabilities.logger ?? null,
        nodeApi: runtime?.capabilities.nodeApi ?? null,
        requestLifecycle: runtime?.capabilities.requestLifecycle ?? null,
      };
    }

    @Get("/problem")
    getProblem() {
      throw new TestProblem("Transport problem for correlation metadata");
    }

    @Get("/users/:id")
    getUser(@Param("id") id: string) {
      return { id, name: "Test User" };
    }

    @Get("/assets/:...id")
    getAsset(@Param("id") id: string) {
      return { id };
    }

    @Post("/users")
    createUser(@Body() body: unknown) {
      return { created: true, data: body };
    }
  }

  @Controller("/lambda")
  class LambdaController {
    @Post("/binary-echo")
    async binaryEcho(@Raw() raw: unknown): Promise<Response> {
      const request = (raw as { req: { raw: Request } }).req.raw;
      const body = await request.arrayBuffer();
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "image/png",
        },
      });
    }

    @Get("/single-cookie")
    singleCookie(): Response {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: [
          ["content-type", "application/json"],
          ["set-cookie", "session=abc; Path=/; HttpOnly"],
          ["x-cookie-test", "single"],
        ],
      });
    }

    @Get("/multiple-cookies")
    multipleCookies(): Response {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: [
          ["content-type", "application/json"],
          ["set-cookie", "session=abc; Path=/; HttpOnly"],
          ["set-cookie", "theme=dark; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/"],
          ["x-cookie-test", "multiple"],
        ],
      });
    }

    @Get("/trace-context")
    getTraceContext(): Record<string, string | null> {
      const context = FrameworkContext.get() as {
        traceId?: string;
        spanId?: string;
        traceFlags?: string;
      } | null;

      return {
        traceId: context?.traceId ?? null,
        spanId: context?.spanId ?? null,
        traceFlags: context?.traceFlags ?? null,
      };
    }

    @Get("/event-metadata")
    getEventMetadata(@Raw() raw: unknown) {
      const env =
        typeof raw === "object" && raw !== null && "env" in raw
          ? (
              raw as {
                env?: {
                  event?: {
                    cookies?: string[];
                    requestContext?: {
                      stage?: string;
                      authorizer?: Record<string, unknown>;
                    };
                  };
                  lambdaContext?: {
                    awsRequestId?: string;
                  };
                };
              }
            ).env
          : undefined;

      return {
        stage: env?.event?.requestContext?.stage ?? null,
        cookies: env?.event?.cookies ?? [],
        authorizer: env?.event?.requestContext?.authorizer ?? null,
        awsRequestId: env?.lambdaContext?.awsRequestId ?? null,
      };
    }

    @Get("/helper-metadata")
    getHelperMetadata(@Raw() raw: unknown) {
      const lambdaRaw = raw as LambdaExecutionContext;
      const event = getLambdaEvent(lambdaRaw);
      const context = getLambdaContext(lambdaRaw);

      return {
        stage: event?.requestContext?.stage ?? null,
        cookies: event?.cookies ?? [],
        awsRequestId: context?.awsRequestId ?? null,
      };
    }

    @Get("/request-headers")
    getRequestHeaders(@Raw() raw: unknown) {
      const request = (raw as { req: { raw: Request } }).req.raw;

      return {
        cookie: request.headers.get("cookie"),
        customHeader: request.headers.get("x-custom-header"),
      };
    }

    @Get("/runtime-context")
    getRuntimeContext() {
      const runtime = FrameworkContext.getRuntimeContext();
      const native = runtime?.native;
      const lambdaContext =
        native && "lambdaContext" in native
          ? (native.lambdaContext as { awsRequestId?: string })
          : undefined;

      runtime?.waitUntil(
        Promise.resolve().then(() => {
          lambdaWaitUntilCompleted = true;
        }),
      );

      return {
        platform: runtime?.platform ?? null,
        requestId: runtime?.requestId ?? null,
        awsRequestId: lambdaContext?.awsRequestId ?? null,
        waitUntil: runtime?.capabilities.waitUntil ?? null,
        flush: runtime?.capabilities.flush ?? null,
        env: runtime?.capabilities.env ?? null,
        filesystem: runtime?.capabilities.filesystem ?? null,
        nodeApi: runtime?.capabilities.nodeApi ?? null,
        requestLifecycle: runtime?.capabilities.requestLifecycle ?? null,
      };
    }

    @Get("/runtime-context-rejected-wait-until")
    getRuntimeContextRejectedWaitUntil() {
      const runtime = FrameworkContext.getRuntimeContext();

      runtime?.waitUntil(
        Promise.resolve().then(() => {
          throw new Error("lambda waitUntil failed");
        }),
      );

      return { ok: true };
    }

    @Get("/problem")
    getProblem() {
      throw new TestProblem("Lambda transport problem for correlation metadata");
    }
  }

  const lambdaContext: LambdaContext = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: "test-function",
    functionVersion: "$LATEST",
    invokedFunctionArn: "arn:aws:lambda:ap-northeast-2:123456789012:function:test-function",
    logGroupName: "/aws/lambda/test-function",
    logStreamName: "2026/03/17/[$LATEST]abcdef",
    memoryLimitInMB: "128",
    awsRequestId: "req-123",
    done: () => undefined,
    getRemainingTimeInMillis: () => 5000,
    fail: () => undefined,
    succeed: () => undefined,
  };

  function createLambdaEvent(overrides: Partial<LambdaEvent> = {}): LambdaEvent {
    return {
      version: "2.0",
      routeKey: "$default",
      rawPath: "/",
      rawQueryString: "",
      headers: {},
      requestContext: {
        accountId: "123456789012",
        apiId: "api-123",
        domainName: "example.execute-api.ap-northeast-2.amazonaws.com",
        domainPrefix: "example",
        http: {
          method: "GET",
          path: "/",
          protocol: "HTTP/1.1",
          sourceIp: "127.0.0.1",
          userAgent: "vitest",
        },
        requestId: "gateway-req-123",
        routeKey: "$default",
        stage: "$default",
        time: "17/Mar/2026:12:00:00 +0000",
        timeEpoch: 1710676800000,
      },
      isBase64Encoded: false,
      ...overrides,
    };
  }

  function createRequestContext(method: string, path: string): LambdaEvent["requestContext"] {
    const baseEvent = createLambdaEvent();

    return {
      ...baseEvent.requestContext,
      http: {
        ...baseEvent.requestContext.http,
        method,
        path,
      },
    };
  }

  function createRequiredSecurityMiddlewares() {
    const rateLimiter = new RateLimiter(
      new SlidingWindowInMemoryStore(),
      new RateLimitKeyBuilder(["ip"]),
      {
        failOpen: false,
      },
    );

    return [
      securityHeadersMiddleware(),
      corsMiddleware({ origins: ["https://example.com"] }),
      bodyLimitMiddleware({ limit: mb(1) }),
      rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("test", 100, 60000),
      }),
    ];
  }

  function hideMiddlewareSource(middleware: MiddlewareFunction): MiddlewareFunction {
    Object.defineProperty(middleware, "toString", {
      configurable: true,
      value: () => "async()=>{}",
    });

    return middleware;
  }

  function wrapSecurityMiddlewareWithDeclaredCapabilities(
    middleware: MiddlewareFunction,
  ): MiddlewareFunction {
    const wrapped: MiddlewareFunction = async (ctx, next) => middleware(ctx, next);

    declareSecurityMiddlewareCapabilities(wrapped, getSecurityMiddlewareCapabilities(middleware));

    return hideMiddlewareSource(wrapped);
  }

  function createSourceSpoofingMiddleware(source: string): MiddlewareFunction {
    const middleware: MiddlewareFunction = async (_ctx, next) => {
      await next();
    };

    Object.defineProperty(middleware, "toString", {
      configurable: true,
      value: () => source,
    });

    return middleware;
  }

  function createSourceSpoofingSecurityMiddlewares(): MiddlewareFunction[] {
    return [
      createSourceSpoofingMiddleware("X-Content-Type-Options"),
      createSourceSpoofingMiddleware("Access-Control-Allow-Origin"),
      createSourceSpoofingMiddleware("content-length"),
      createSourceSpoofingMiddleware("rateLimitHeaders applyRateLimitHeaders"),
    ];
  }

  async function createStaticFixture(files: Record<string, string>): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "croco-transports-http-"));

    await Promise.all(
      Object.entries(files).map(async ([filePath, contents]) => {
        const absolutePath = join(directory, filePath);
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, contents);
      }),
    );

    return directory;
  }

  it("should bootstrap operational routes without pre-registered transport services", async () => {
    Container.reset();
    Container.register(Logger, "singleton");

    const app = createApp({
      controllers: [],
      securityValidation: "off",
    });

    const health = await app.fetch(new Request("http://localhost/health"));
    const ready = await app.fetch(new Request("http://localhost/ready"));
    const metrics = await app.fetch(new Request("http://localhost/metrics"));

    expect(health.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(metrics.status).toBe(200);
    expect(Container.has(LOGGER_TOKEN)).toBe(true);
    expect(Container.has(ErrorHandler)).toBe(true);
    expect(Container.has(HealthCheckRegistry)).toBe(true);
  });

  it("should handle GET request", async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request("http://localhost/api/hello"));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ message: "Hello, World!" });
  });

  it("should run HTTP middlewares around the controller handler", async () => {
    const afterStatuses: number[] = [];
    const app = createApp({
      controllers: [TestController],
      middlewares: [
        async (ctx, next) => {
          await next();
          afterStatuses.push(ctx.res.status);
        },
      ],
      securityValidation: "off",
    });

    const response = await app.fetch(new Request("http://localhost/api/empty"));

    expect(response.status).toBe(204);
    expect(afterStatuses).toEqual([204]);
  });

  it("should expose registered request pipeline graphs with telemetry and app middleware", () => {
    function appMiddleware() {}

    const app = createApp({
      controllers: [TestController],
      middlewares: [appMiddleware],
      securityValidation: "off",
    });

    const graph = app
      .describeRequestPipelineGraphs()
      .find((entry) => entry.target === "GET /api/hello");

    expect(graph?.successOrder).toEqual([
      "middleware:0:before",
      "middleware:1:before",
      "handler:TestController.hello",
      "middleware:1:after",
      "middleware:0:after",
    ]);
    expect(graph?.errorOrder).toEqual(graph?.successOrder);
    expect(graph?.nodes.find((node) => node.id === "middleware:0:before")?.label).toBe(
      "middleware[0].before",
    );
    expect(graph?.nodes.find((node) => node.id === "middleware:1:before")?.label).toBe(
      "appMiddleware.before",
    );
  });

  it("should preserve middleware short-circuit responses", async () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: [bodyLimitMiddleware({ limit: 4 })],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "16",
        },
        body: JSON.stringify({ ok: true }),
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "Request body too large",
      limit: 4,
      received: 16,
    });
  });

  it("should expose Node runtime context with request id and trace metadata", async () => {
    const app = createApp({ controllers: [TestController] });
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const spanId = "00f067aa0ba902b7";

    const response = await app.fetch(
      new Request("http://localhost/api/runtime-context", {
        headers: {
          traceparent: `00-${traceId}-${spanId}-01`,
          "x-request-id": "node-req-1",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      platform: "node",
      requestId: "node-req-1",
      traceId,
      waitUntil: false,
      env: true,
      filesystem: true,
      logger: true,
      nodeApi: true,
      requestLifecycle: true,
    });
  });

  it("should include Node traceparent and request id metadata in Problem responses", async () => {
    const app = createApp({ controllers: [TestController] });
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const spanId = "00f067aa0ba902b7";

    const response = await app.fetch(
      new Request("http://localhost/api/problem", {
        headers: {
          traceparent: `00-${traceId}-${spanId}-01`,
          "x-request-id": "node-problem-req-1",
        },
      }),
    );

    const body = (await response.json()) as ProblemCorrelationResponse;

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      title: "Bad Request",
      status: 400,
      code: "test/problem",
      detail: "Transport problem for correlation metadata",
      instance: "http://localhost/api/problem",
      traceId,
      requestId: "node-problem-req-1",
    });
  });

  it("should run the Lambda handler flush callback after queued runtime work", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler({ flush });

    const response = await handler(
      createLambdaEvent({
        rawPath: "/lambda/runtime-context",
        requestContext: createRequestContext("GET", "/lambda/runtime-context"),
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(lambdaWaitUntilCompleted).toBe(true);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("should pass Lambda handler options through the public helper", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ controllers: [LambdaController] });
    const handler = toLambdaHandler(app, { flush });

    const response = await handler(
      createLambdaEvent({
        rawPath: "/lambda/runtime-context",
        requestContext: createRequestContext("GET", "/lambda/runtime-context"),
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("should fail the Lambda handler when the flush callback fails", async () => {
    const flush = vi.fn().mockRejectedValue(new Error("telemetry flush failed"));
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler({ flush });

    await expect(
      handler(
        createLambdaEvent({
          rawPath: "/lambda/runtime-context",
          requestContext: createRequestContext("GET", "/lambda/runtime-context"),
        }),
        lambdaContext,
      ),
    ).rejects.toThrow("telemetry flush failed");
  });

  it("should drain Lambda waitUntil work when Hono fetch throws", async () => {
    let waitUntilCompleted = false;
    const routeError = new Error("lambda fetch failed");
    const hono = new Hono();
    hono.onError((error) => {
      throw error;
    });
    hono.get("/lambda/fetch-throws", (c) => {
      const runtime = getRuntimeContextInitFromEnv(c.env);
      runtime?.waitUntil?.(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            waitUntilCompleted = true;
            resolve();
          }, 0);
        }),
      );

      throw routeError;
    });
    const handler = new CrocoLambdaAdapter(hono).createHandler();

    await expect(
      handler(
        createLambdaEvent({
          rawPath: "/lambda/fetch-throws",
          requestContext: createRequestContext("GET", "/lambda/fetch-throws"),
        }),
        lambdaContext,
      ),
    ).rejects.toBe(routeError);
    expect(waitUntilCompleted).toBe(true);
  });

  it("should run the Lambda handler flush callback when Hono fetch throws", async () => {
    const routeError = new Error("lambda fetch failed");
    const flush = vi.fn().mockResolvedValue(undefined);
    const hono = new Hono();
    hono.onError((error) => {
      throw error;
    });
    hono.get("/lambda/fetch-throws", () => {
      throw routeError;
    });
    const handler = new CrocoLambdaAdapter(hono).createHandler({ flush });

    await expect(
      handler(
        createLambdaEvent({
          rawPath: "/lambda/fetch-throws",
          requestContext: createRequestContext("GET", "/lambda/fetch-throws"),
        }),
        lambdaContext,
      ),
    ).rejects.toBe(routeError);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("should preserve Lambda fetch and flush failures together", async () => {
    const routeError = new Error("lambda fetch failed");
    const flushError = new Error("telemetry flush failed");
    const flush = vi.fn().mockRejectedValue(flushError);
    const hono = new Hono();
    hono.onError((error) => {
      throw error;
    });
    hono.get("/lambda/fetch-throws", () => {
      throw routeError;
    });
    const handler = new CrocoLambdaAdapter(hono).createHandler({ flush });

    let thrownError: unknown;
    try {
      await handler(
        createLambdaEvent({
          rawPath: "/lambda/fetch-throws",
          requestContext: createRequestContext("GET", "/lambda/fetch-throws"),
        }),
        lambdaContext,
      );
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    const boundaryError = thrownError as Error & {
      code?: string;
      originalError?: unknown;
      flushErrors?: readonly unknown[];
    };
    expect(boundaryError.name).toBe("LambdaFlushBoundaryError");
    expect(boundaryError.code).toBe("transports-http/lambda-flush-boundary-failed");
    expect(boundaryError.originalError).toBe(routeError);
    expect(boundaryError.flushErrors).toEqual([flushError]);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("should bootstrap when all required security middlewares are configured", async () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: createRequiredSecurityMiddlewares(),
      securityValidation: "enforce",
    });

    const response = await app.fetch(new Request("http://localhost/api/hello"));

    expect(response.status).toBe(200);
  });

  it("should bootstrap when packaged security middleware source is minified", async () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: createRequiredSecurityMiddlewares().map(hideMiddlewareSource),
      securityValidation: "enforce",
    });

    const response = await app.fetch(new Request("http://localhost/api/hello"));

    expect(response.status).toBe(200);
  });

  it("should bootstrap when wrapped security middleware copies declared capabilities", async () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: createRequiredSecurityMiddlewares().map(
        wrapSecurityMiddlewareWithDeclaredCapabilities,
      ),
      securityValidation: "enforce",
    });

    const response = await app.fetch(new Request("http://localhost/api/hello"));

    expect(response.status).toBe(200);
  });

  it("should bootstrap when custom middleware declares required security capabilities", async () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: [
        declareSecurityMiddlewareCapabilities(async (_ctx, next) => next(), ["security-headers"]),
        declareSecurityMiddlewareCapabilities(async (_ctx, next) => next(), ["cors"]),
        declareSecurityMiddlewareCapabilities(async (_ctx, next) => next(), ["body-limit"]),
        declareSecurityMiddlewareCapabilities(async (_ctx, next) => next(), ["rate-limit"]),
      ],
      securityValidation: "enforce",
    });

    const response = await app.fetch(new Request("http://localhost/api/hello"));

    expect(response.status).toBe(200);
  });

  it("should reject unmarked middleware that only mimics security source text", () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: createSourceSpoofingSecurityMiddlewares(),
      securityValidation: "enforce",
    });

    let error: unknown;
    try {
      app.lambdaHandler();
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: "CROCO_HTTP_SECURITY_001",
    });
    expect((error as Error).message).toMatch(/Missing required security middleware/);
  });

  it("should fail bootstrap when required security middlewares are missing", () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: [securityHeadersMiddleware()],
      securityValidation: "enforce",
    });

    let error: unknown;
    try {
      app.lambdaHandler();
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: "CROCO_HTTP_SECURITY_001",
      extensions: {
        legacyCode: "transports-http/security-middleware-validation",
      },
    });
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/Missing required security middleware/);
  });

  it("should allow bootstrap when securityValidation is set to off", async () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: [securityHeadersMiddleware()],
      securityValidation: "off",
    });

    const response = await app.fetch(new Request("http://localhost/api/hello"));

    expect(response.status).toBe(200);
  });

  it("should fail bootstrap when diValidation is enforce and a controller is not registered", () => {
    const app = createApp({
      controllers: [TestController],
      diValidation: "enforce",
    });

    let error: unknown;
    try {
      app.lambdaHandler();
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: "transports-http/di-bootstrap-validation",
    });
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("Provider TestController is not registered");
  });

  it("should enforce DI validation by default in production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousDiValidation = process.env.CROCO_HTTP_DI_VALIDATION;
    process.env.NODE_ENV = "production";
    delete process.env.CROCO_HTTP_DI_VALIDATION;

    try {
      const app = createApp({
        controllers: [TestController],
      });

      expect(() => app.lambdaHandler()).toThrow(/Provider TestController is not registered/);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousDiValidation === undefined) {
        delete process.env.CROCO_HTTP_DI_VALIDATION;
      } else {
        process.env.CROCO_HTTP_DI_VALIDATION = previousDiValidation;
      }
    }
  });

  it("should warn and bootstrap when diValidation is warn", async () => {
    const warn = vi.fn();
    const logger: ILogger = {
      debug: () => undefined,
      info: () => undefined,
      warn,
      error: () => undefined,
      child: () => logger,
    };
    Container.set(LOGGER_TOKEN, logger);

    const app = createApp({
      controllers: [TestController],
      diValidation: "warn",
    });

    const response = await app.fetch(new Request("http://localhost/api/hello"));

    expect(response.status).toBe(200);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Provider TestController is not registered"),
    );
  });

  it("should keep the explicit diValidation off migration path silent", async () => {
    const warn = vi.fn();
    const logger: ILogger = {
      debug: () => undefined,
      info: () => undefined,
      warn,
      error: () => undefined,
      child: () => logger,
    };
    Container.set(LOGGER_TOKEN, logger);

    const app = createApp({
      controllers: [TestController],
      diValidation: "off",
    });

    const response = await app.fetch(new Request("http://localhost/api/hello"));

    expect(response.status).toBe(200);
    expect(warn).not.toHaveBeenCalled();
  });

  it("should keep the unsafe DI validation escape hatch on the legacy fallback", async () => {
    const warn = vi.fn();
    const logger: ILogger = {
      debug: () => undefined,
      info: () => undefined,
      warn,
      error: () => undefined,
      child: () => logger,
    };
    Container.set(LOGGER_TOKEN, logger);

    const app = createApp({
      controllers: [TestController],
      unsafeSkipDiValidation: true,
    });

    const response = await app.fetch(new Request("http://localhost/api/hello"));

    expect(response.status).toBe(200);
    expect(warn).not.toHaveBeenCalled();
  });

  it("should bootstrap in diValidation enforce when the controller is registered", async () => {
    Container.set(TestController, new TestController());

    const app = createApp({
      controllers: [TestController],
      diValidation: "enforce",
    });

    const response = await app.fetch(new Request("http://localhost/api/hello"));

    expect(response.status).toBe(200);
  });

  it("should fail bootstrap for circular DI graphs when diValidation is enforce", () => {
    class ServiceA {
      constructor(_service: ServiceB) {}
    }

    class ServiceB {
      constructor(_service: ServiceA) {}
    }

    Reflect.defineMetadata("design:paramtypes", [ServiceB], ServiceA);
    Reflect.defineMetadata("design:paramtypes", [ServiceA], ServiceB);
    Component({ scope: "singleton" })(ServiceA);
    Component({ scope: "singleton" })(ServiceB);

    const app = createApp({
      controllers: [],
      diValidation: "enforce",
    });

    expect(() => app.lambdaHandler()).toThrow(/Circular dependency detected/);
  });

  it("should fail bootstrap for singleton to request scope mismatch when diValidation is enforce", () => {
    class RequestRepository {}

    class UserService {
      constructor(_repository: RequestRepository) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], RequestRepository);
    Reflect.defineMetadata("design:paramtypes", [RequestRepository], UserService);
    Component({ scope: "request" })(RequestRepository);
    Component({ scope: "singleton" })(UserService);

    const app = createApp({
      controllers: [],
      diValidation: "enforce",
    });

    expect(() => app.lambdaHandler()).toThrow(
      /Singleton-scoped component UserService cannot depend on request-scoped component RequestRepository/,
    );
  });

  it("should extract path params", async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request("http://localhost/api/users/123"));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ id: "123", name: "Test User" });
  });

  it("should extract catch-all path params under the declared parameter name", async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request("http://localhost/api/assets/icons/logo.svg"));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ id: "icons/logo.svg" });
  });

  it("should return headers without a response body for HEAD requests", async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request("http://localhost/api/hello", { method: "HEAD" }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("should handle POST with body", async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New User" }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.created).toBe(true);
    expect(json.data).toEqual({ name: "New User" });
  });

  it("should resolve parameter pipes through the app container", async () => {
    class PipeDependency {
      format(value: string): string {
        return `container:${value}`;
      }
    }

    class ContainerBackedPipe implements PipeTransform<unknown, string> {
      constructor(private readonly dependency: PipeDependency) {}

      transform(value: unknown, metadata: ArgumentMetadata): string {
        void metadata;
        const input =
          value && typeof value === "object" && "name" in value
            ? (value as { name?: unknown }).name
            : value;
        return this.dependency.format(String(input));
      }
    }

    const ContainerBackedPipeCtor = ContainerBackedPipe as unknown as PipeTransformConstructor;

    @Controller("/pipes")
    class PipeController {
      @Post("/body")
      create(value: string) {
        return { value };
      }
    }

    const params = new Map<string | symbol, ParamMetadata[]>();
    params.set("create", [
      {
        type: ParamType.BODY,
        index: 0,
        pipes: [ContainerBackedPipeCtor],
      },
    ]);
    Reflect.defineMetadata(REST_PARAMS_KEY, params, PipeController);

    Container.set(ContainerBackedPipe, new ContainerBackedPipe(new PipeDependency()));

    const app = createApp({
      controllers: [PipeController],
      securityValidation: "off",
    });

    const response = await app.fetch(
      new Request("http://localhost/pipes/body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "croco" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ value: "container:croco" });
  });

  it("should return 404 for unknown routes", async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request("http://localhost/unknown"));

    expect(response.status).toBe(404);
  });

  it("should serve static assets and keep listen callback compatibility", async () => {
    const app = createApp({ controllers: [TestController] });
    const staticDir = await createStaticFixture({
      "index.html": "<html><body>spa</body></html>",
      "assets/app.js": 'console.log("app")',
    });
    const callback = vi.fn();

    try {
      await app.listen(3000, callback);

      expect(vi.mocked(serve)).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledTimes(1);

      await app.listen(3001, { staticDir, spaFallback: true }, callback);

      expect(vi.mocked(serve)).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledTimes(2);

      const assetResponse = await app.fetch(new Request("http://localhost/assets/app.js"));

      expect(assetResponse.status).toBe(200);
      expect(assetResponse.headers.get("content-type")).toContain("text/javascript");
      expect(await assetResponse.text()).toContain("console.log");
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  it("should return index.html for SPA routes when fallback is enabled", async () => {
    const app = createApp({ controllers: [TestController] });
    const staticDir = await createStaticFixture({
      "index.html": "<html><body>spa shell</body></html>",
    });

    try {
      await app.listen(3000, { staticDir, spaFallback: true });

      const response = await app.fetch(
        new Request("http://localhost/dashboard", {
          headers: { Accept: "text/html,application/xhtml+xml" },
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(await response.text()).toContain("spa shell");

      const apiResponse = await app.fetch(new Request("http://localhost/api/hello"));

      expect(apiResponse.status).toBe(200);
      expect(await apiResponse.json()).toEqual({ message: "Hello, World!" });
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  it("should not use SPA fallback for extension paths or non-html accept headers", async () => {
    const app = createApp({ controllers: [TestController] });
    const staticDir = await createStaticFixture({
      "index.html": "<html><body>spa shell</body></html>",
    });

    try {
      await app.listen(3000, { staticDir, spaFallback: true });

      const assetLikeResponse = await app.fetch(
        new Request("http://localhost/missing.js", {
          headers: { Accept: "text/html" },
        }),
      );

      const jsonResponse = await app.fetch(
        new Request("http://localhost/dashboard", {
          headers: { Accept: "application/json" },
        }),
      );

      expect(assetLikeResponse.status).toBe(404);
      expect(jsonResponse.status).toBe(404);
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  it("should return 404 for missing assets inside asset directories", async () => {
    const app = createApp({ controllers: [TestController] });
    const staticDir = await createStaticFixture({
      "index.html": "<html><body>spa shell</body></html>",
      "assets/app.js": 'console.log("app")',
    });

    try {
      await app.listen(3000, { staticDir, spaFallback: true });

      const response = await app.fetch(
        new Request("http://localhost/assets/missing.js", {
          headers: { Accept: "text/html,application/xhtml+xml" },
        }),
      );

      expect(response.status).toBe(404);
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  it("should not return SPA html for application json requests", async () => {
    const app = createApp({ controllers: [TestController] });
    const staticDir = await createStaticFixture({
      "index.html": "<html><body>spa shell</body></html>",
    });

    try {
      await app.listen(3000, { staticDir, spaFallback: true });

      const response = await app.fetch(
        new Request("http://localhost/dashboard", {
          headers: { Accept: "application/json" },
        }),
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")?.includes("text/html") ?? false).toBe(false);
      expect(await response.text()).not.toContain("spa shell");
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  it("should preserve binary body through lambda request/response", async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();
    const binaryBody = Buffer.from([0xc3, 0x28, 0xff, 0xfe, 0x00, 0x61, 0x80]);

    const response = await handler(
      createLambdaEvent({
        requestContext: {
          accountId: "123456789012",
          apiId: "api-123",
          domainName: "example.execute-api.ap-northeast-2.amazonaws.com",
          domainPrefix: "example",
          http: {
            method: "POST",
            path: "/lambda/binary-echo",
            protocol: "HTTP/1.1",
            sourceIp: "127.0.0.1",
            userAgent: "vitest",
          },
          requestId: "gateway-req-123",
          routeKey: "$default",
          stage: "$default",
          time: "17/Mar/2026:12:00:00 +0000",
          timeEpoch: 1710676800000,
        },
        rawPath: "/lambda/binary-echo",
        rawQueryString: "",
        headers: { "content-type": "application/octet-stream" },
        body: binaryBody.toString("base64"),
        isBase64Encoded: true,
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(response.isBase64Encoded).toBe(true);
    expect(response.body).not.toBeUndefined();

    const decoded = Buffer.from(response.body ?? "", "base64");
    expect(Buffer.compare(decoded, binaryBody)).toBe(0);
  });

  it("should map a single Lambda Set-Cookie response header to API Gateway v2 cookies", async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        requestContext: createRequestContext("GET", "/lambda/single-cookie"),
        rawPath: "/lambda/single-cookie",
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers).toEqual({
      "content-type": "application/json",
      "x-cookie-test": "single",
    });
    expect(response.cookies).toEqual(["session=abc; Path=/; HttpOnly"]);
    expect(response.body).toBe(JSON.stringify({ ok: true }));
    expect(response.isBase64Encoded).toBe(false);
  });

  it("should map multiple Lambda Set-Cookie response headers without comma splitting", async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        requestContext: createRequestContext("GET", "/lambda/multiple-cookies"),
        rawPath: "/lambda/multiple-cookies",
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers).toEqual({
      "content-type": "application/json",
      "x-cookie-test": "multiple",
    });
    expect(response.cookies).toEqual([
      "session=abc; Path=/; HttpOnly",
      "theme=dark; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/",
    ]);
    expect(response.body).toBe(JSON.stringify({ ok: true }));
    expect(response.isBase64Encoded).toBe(false);
  });

  it("should fail fast for unsupported route methods instead of registering all routes", () => {
    const hono = {
      all: () => {
        throw new Error("should not register unsupported methods as all");
      },
      get: () => {},
      post: () => {},
      put: () => {},
      patch: () => {},
      delete: () => {},
      options: () => {},
    };

    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger;

    const registrar = new CrocoRouteRegistrar(hono as never, new ErrorHandler(logger), [], logger);

    expect(() => {
      registrar.register({
        method: "TRACE",
        path: "/trace",
        methodName: "trace",
        handler: async () => undefined,
      });
    }).toThrow("Unsupported route method: TRACE");
  });

  it("should keep json lambda response behavior unchanged", async () => {
    const app = createApp({ controllers: [TestController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        requestContext: {
          accountId: "123456789012",
          apiId: "api-123",
          domainName: "example.execute-api.ap-northeast-2.amazonaws.com",
          domainPrefix: "example",
          http: {
            method: "GET",
            path: "/api/hello",
            protocol: "HTTP/1.1",
            sourceIp: "127.0.0.1",
            userAgent: "vitest",
          },
          requestId: "gateway-req-123",
          routeKey: "$default",
          stage: "$default",
          time: "17/Mar/2026:12:00:00 +0000",
          timeEpoch: 1710676800000,
        },
        rawPath: "/api/hello",
        rawQueryString: "",
        headers: { "content-type": "application/json" },
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(response.isBase64Encoded).toBe(false);
    expect(JSON.parse(response.body ?? "{}")).toEqual({ message: "Hello, World!" });
  });

  it("should expose Lambda runtime context and drain waitUntil work before responding", async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        requestContext: {
          accountId: "123456789012",
          apiId: "api-123",
          domainName: "example.execute-api.ap-northeast-2.amazonaws.com",
          domainPrefix: "example",
          http: {
            method: "GET",
            path: "/lambda/runtime-context",
            protocol: "HTTP/1.1",
            sourceIp: "127.0.0.1",
            userAgent: "vitest",
          },
          requestId: "gateway-req-123",
          routeKey: "$default",
          stage: "$default",
          time: "17/Mar/2026:12:00:00 +0000",
          timeEpoch: 1710676800000,
        },
        rawPath: "/lambda/runtime-context",
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      platform: "lambda",
      requestId: "gateway-req-123",
      awsRequestId: "req-123",
      waitUntil: true,
      flush: true,
      env: true,
      filesystem: true,
      nodeApi: true,
      requestLifecycle: true,
    });
    expect(lambdaWaitUntilCompleted).toBe(true);
  });

  it("should include API Gateway request id metadata in Lambda Problem responses", async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        requestContext: {
          ...createRequestContext("GET", "/lambda/problem"),
          requestId: "gateway-problem-req-123",
        },
        rawPath: "/lambda/problem",
      }),
      lambdaContext,
    );
    const body = JSON.parse(response.body ?? "{}") as ProblemCorrelationResponse;

    expect(response.statusCode).toBe(400);
    expect(body).toMatchObject({
      title: "Bad Request",
      status: 400,
      code: "test/problem",
      detail: "Lambda transport problem for correlation metadata",
      instance: "https://lambda.local/lambda/problem",
      requestId: "gateway-problem-req-123",
    });
  });

  it("should log rejected Lambda waitUntil work after draining", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger & { error: ReturnType<typeof vi.fn> };
    Container.set(Logger, logger);
    Container.set(LOGGER_TOKEN, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        requestContext: {
          accountId: "123456789012",
          apiId: "api-123",
          domainName: "example.execute-api.ap-northeast-2.amazonaws.com",
          domainPrefix: "example",
          http: {
            method: "GET",
            path: "/lambda/runtime-context-rejected-wait-until",
            protocol: "HTTP/1.1",
            sourceIp: "127.0.0.1",
            userAgent: "vitest",
          },
          requestId: "gateway-req-123",
          routeKey: "$default",
          stage: "$default",
          time: "17/Mar/2026:12:00:00 +0000",
          timeEpoch: 1710676800000,
        },
        rawPath: "/lambda/runtime-context-rejected-wait-until",
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({ ok: true });
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith("Lambda waitUntil task rejected", {
      taskIndex: 0,
      reason: expect.any(Error),
    });
    const [, context] = logger.error.mock.calls[0] as [
      string,
      { taskIndex: number; reason: Error },
    ];
    expect(context.reason.message).toBe("lambda waitUntil failed");
  });

  it("should parse traceparent with traceId spanId and traceFlags", async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const spanId = "00f067aa0ba902b7";
    const traceFlagsHex = "01";
    const expectedTraceFlags = 1; // Number.parseInt('01', 16)

    const response = await handler(
      createLambdaEvent({
        requestContext: {
          accountId: "123456789012",
          apiId: "api-123",
          domainName: "example.execute-api.ap-northeast-2.amazonaws.com",
          domainPrefix: "example",
          http: {
            method: "GET",
            path: "/lambda/trace-context",
            protocol: "HTTP/1.1",
            sourceIp: "127.0.0.1",
            userAgent: "vitest",
          },
          requestId: "gateway-req-123",
          routeKey: "$default",
          stage: "$default",
          time: "17/Mar/2026:12:00:00 +0000",
          timeEpoch: 1710676800000,
        },
        rawPath: "/lambda/trace-context",
        rawQueryString: "",
        headers: {
          traceparent: `00-${traceId}-${spanId}-${traceFlagsHex}`,
        },
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      traceId,
      spanId,
      traceFlags: expectedTraceFlags,
    });
  });

  it("should join API Gateway v2 cookies into the Lambda Fetch Cookie header", async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        routeKey: "GET /lambda/request-headers",
        rawPath: "/lambda/request-headers",
        cookies: ["session=abc", "theme=dark"],
        headers: {
          "X-Custom-Header": "case-insensitive-value",
        },
        requestContext: createRequestContext("GET", "/lambda/request-headers"),
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      cookie: "session=abc; theme=dark",
      customHeader: "case-insensitive-value",
    });
  });

  it("should preserve an explicit Cookie header over API Gateway v2 cookies", async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        routeKey: "GET /lambda/request-headers",
        rawPath: "/lambda/request-headers",
        cookies: ["session=event", "theme=event"],
        headers: {
          Cookie: "session=header; theme=header",
        },
        requestContext: createRequestContext("GET", "/lambda/request-headers"),
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      cookie: "session=header; theme=header",
      customHeader: null,
    });
  });

  it("should preserve an explicit lowercase cookie header over API Gateway v2 cookies", async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        routeKey: "GET /lambda/request-headers",
        rawPath: "/lambda/request-headers",
        cookies: ["session=event"],
        headers: {
          cookie: "session=lowercase-header",
        },
        requestContext: createRequestContext("GET", "/lambda/request-headers"),
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      cookie: "session=lowercase-header",
      customHeader: null,
    });
  });

  it("should not synthesize a Cookie header from an empty API Gateway v2 cookies array", async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        routeKey: "GET /lambda/request-headers",
        rawPath: "/lambda/request-headers",
        cookies: [],
        requestContext: createRequestContext("GET", "/lambda/request-headers"),
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      cookie: null,
      customHeader: null,
    });
  });

  it("should preserve lambda event metadata in raw hono env", async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        version: "2.0",
        routeKey: "GET /lambda/event-metadata",
        rawPath: "/lambda/event-metadata",
        rawQueryString: "",
        cookies: ["session=abc", "theme=dark"],
        headers: { "content-type": "application/json" },
        requestContext: {
          accountId: "123456789012",
          apiId: "api-123",
          domainName: "example.execute-api.ap-northeast-2.amazonaws.com",
          domainPrefix: "example",
          http: {
            method: "GET",
            path: "/lambda/event-metadata",
            protocol: "HTTP/1.1",
            sourceIp: "127.0.0.1",
            userAgent: "vitest",
          },
          requestId: "gateway-req-123",
          routeKey: "GET /lambda/event-metadata",
          stage: "$default",
          time: "17/Mar/2026:12:00:00 +0000",
          timeEpoch: 1710676800000,
          authorizer: {
            jwt: {
              claims: {
                sub: "user-123",
                tenantId: "tenant-456",
              },
              scopes: ["read:users"],
            },
          },
        },
        isBase64Encoded: false,
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      stage: "$default",
      cookies: ["session=abc", "theme=dark"],
      authorizer: {
        jwt: {
          claims: {
            sub: "user-123",
            tenantId: "tenant-456",
          },
          scopes: ["read:users"],
        },
      },
      awsRequestId: "req-123",
    });
  });

  it("should expose lambda event and context through exported helpers", async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        version: "2.0",
        routeKey: "GET /lambda/helper-metadata",
        rawPath: "/lambda/helper-metadata",
        rawQueryString: "",
        cookies: ["helper=event"],
        headers: { "content-type": "application/json" },
        requestContext: {
          accountId: "123456789012",
          apiId: "api-123",
          domainName: "example.execute-api.ap-northeast-2.amazonaws.com",
          domainPrefix: "example",
          http: {
            method: "GET",
            path: "/lambda/helper-metadata",
            protocol: "HTTP/1.1",
            sourceIp: "127.0.0.1",
            userAgent: "vitest",
          },
          requestId: "gateway-req-123",
          routeKey: "GET /lambda/helper-metadata",
          stage: "$default",
          time: "17/Mar/2026:12:00:00 +0000",
          timeEpoch: 1710676800000,
        },
        isBase64Encoded: false,
      }),
      lambdaContext,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "{}")).toEqual({
      stage: "$default",
      cookies: ["helper=event"],
      awsRequestId: "req-123",
    });
  });
});
