import "reflect-metadata";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Container, Context as FrameworkContext, LOGGER_TOKEN } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
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
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../libs/CrocoApp";
import {
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
import type { LambdaContext, LambdaEvent } from "../libs/types";

vi.mock("@hono/node-server", () => ({
  serve: vi.fn((_options: unknown, callback?: () => void) => {
    callback?.();
    return {};
  }),
}));

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

  it("should bootstrap when all required security middlewares are configured", async () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: createRequiredSecurityMiddlewares(),
      securityValidation: "enforce",
    });

    const response = await app.fetch(new Request("http://localhost/api/hello"));

    expect(response.status).toBe(200);
  });

  it("should fail bootstrap when required security middlewares are missing", () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: [securityHeadersMiddleware()],
      securityValidation: "enforce",
    });

    expect(() => app.lambdaHandler()).toThrow(/Missing required security middleware/);
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
