import "reflect-metadata";
import {
  Component,
  Context as FrameworkContext,
  Container,
  type DependencyGraphProvider,
} from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import {
  Body,
  type CallHandler,
  type Constructor,
  Controller,
  type ExecutionContext,
  Get,
  Header,
  type Interceptor,
  Param,
  Post,
  Query,
  UseInterceptors,
} from "@croco/protocols-rest";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createApp,
  type CrocoApp,
  ErrorHandler,
  HealthCheckRegistry,
  type LambdaContext,
  type LambdaEvent,
} from "../index";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const TRACEPARENT = `00-${TRACE_ID}-00f067aa0ba902b7-01`;

const RawCreateWidgetSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
});

const CreateWidgetSchema = RawCreateWidgetSchema as unknown as Parameters<typeof Body>[0];

type CreateWidgetBody = z.infer<typeof RawCreateWidgetSchema>;

type ContextResponse = {
  id: string;
  expand: string | null;
  tenantHeader: string | null;
  contextActive: boolean;
  requestId: string | null;
  traceId: string | null;
};

type ValidationProblemResponse = {
  title: string;
  status: number;
  code: string;
  detail: string;
  instance: string;
  issues: Array<{
    path: string;
    message: string;
  }>;
};

type LifecycleResponse = {
  result: {
    value: string;
  };
  lifecycle: {
    handler: string;
    method: string;
    path: string;
  };
};

type DiLifecycleGraphProvider = {
  token: string;
  scope: DependencyGraphProvider["scope"] | null;
  dependencies: readonly string[];
};

type DiLifecycleResponse = {
  id: string;
  contextActive: boolean;
  requestId: string | null;
  singletonId: string;
  injectedRequestScopedId: string;
  directRequestScopedId: string;
  repeatedRequestScopedId: string;
  graph: {
    status: "ready" | "failed";
    roots: readonly string[];
    providers: readonly DiLifecycleGraphProvider[];
    diagnostics: readonly {
      code: string;
      token: string;
      status: string;
      path: readonly string[];
    }[];
  };
};

let lifecycleInstanceSequence = 0;

class HttpSingletonLifecycleProvider {
  readonly id = `singleton-${++lifecycleInstanceSequence}`;
}

class HttpRequestScopedLifecycleProvider {
  readonly id = `request-${++lifecycleInstanceSequence}`;
}

@Controller("/framework/integration/di")
class DiLifecycleController {
  constructor(
    private readonly singletonProvider: HttpSingletonLifecycleProvider,
    private readonly requestScopedProvider: HttpRequestScopedLifecycleProvider,
  ) {}

  @Get("/lifecycle/:id")
  lifecycle(@Param("id") id: string): DiLifecycleResponse {
    const directRequestScoped = Container.get(HttpRequestScopedLifecycleProvider);
    const repeatedRequestScoped = Container.get(HttpRequestScopedLifecycleProvider);
    const manifest = Container.createDependencyGraphManifest({ roots: [DiLifecycleController] });
    const context = FrameworkContext.get();

    return {
      id,
      contextActive: FrameworkContext.isActive(),
      requestId: context?.requestId ?? null,
      singletonId: this.singletonProvider.id,
      injectedRequestScopedId: this.requestScopedProvider.id,
      directRequestScopedId: directRequestScoped.id,
      repeatedRequestScopedId: repeatedRequestScoped.id,
      graph: {
        status: manifest.status,
        roots: manifest.roots,
        providers: manifest.providers.map((provider) => ({
          token: provider.token,
          scope: provider.scope ?? null,
          dependencies: provider.dependencies,
        })),
        diagnostics: manifest.diagnostics.map((diagnostic) => ({
          code: diagnostic.code,
          token: diagnostic.token,
          status: diagnostic.status,
          path: diagnostic.path,
        })),
      },
    };
  }
}

Reflect.defineMetadata("design:paramtypes", [], HttpSingletonLifecycleProvider);
Reflect.defineMetadata("design:paramtypes", [], HttpRequestScopedLifecycleProvider);
Reflect.defineMetadata(
  "design:paramtypes",
  [HttpSingletonLifecycleProvider, HttpRequestScopedLifecycleProvider],
  DiLifecycleController,
);
const DiLifecycleControllerToken = DiLifecycleController as unknown as Constructor;

class ResponseEnvelopeInterceptor implements Interceptor<ExecutionContext> {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<unknown> {
    const result = await next.handle();

    return {
      result,
      lifecycle: {
        handler: String(context.getHandler()),
        method: context.getMethod(),
        path: context.getPath(),
      },
    };
  }
}

@Controller("/framework/integration")
class FrameworkIntegrationController {
  @Get("/context/:id")
  context(
    @Param("id") id: string,
    @Query("expand") expand?: string,
    @Header("x-tenant-id") tenantHeader?: string,
  ): ContextResponse {
    const context = FrameworkContext.get();

    return {
      id,
      expand: expand ?? null,
      tenantHeader: tenantHeader ?? null,
      contextActive: FrameworkContext.isActive(),
      requestId: context?.requestId ?? null,
      traceId: context?.traceId ?? null,
    };
  }

  @Post("/widgets")
  createWidget(@Body(CreateWidgetSchema) body: CreateWidgetBody) {
    return {
      created: true,
      name: body.name,
      quantity: body.quantity,
    };
  }

  @Post("/widgets/repeated")
  createRepeatedWidget(
    @Body(CreateWidgetSchema) first: CreateWidgetBody,
    @Body(CreateWidgetSchema) second: CreateWidgetBody,
  ) {
    return {
      created: true,
      firstName: first.name,
      secondName: second.name,
    };
  }

  @Get("/lifecycle")
  @UseInterceptors(ResponseEnvelopeInterceptor)
  lifecycle() {
    return { value: "handler-result" };
  }
}

describe("Framework integration", () => {
  let app: CrocoApp;

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

  function createLambdaContext(): LambdaContext {
    return {
      callbackWaitsForEmptyEventLoop: false,
      functionName: "test",
      functionVersion: "$LATEST",
      invokedFunctionArn: "arn:aws:lambda:ap-northeast-2:123456789012:function:test",
      logGroupName: "/aws/lambda/test",
      logStreamName: "2026/03/17/[$LATEST]abcdef",
      memoryLimitInMB: "128",
      awsRequestId: "123",
      done: () => undefined,
      fail: () => undefined,
      getRemainingTimeInMillis: () => 5000,
      succeed: () => undefined,
    };
  }

  function createGetLambdaEvent(path: string, requestId: string): LambdaEvent {
    return createLambdaEvent({
      rawPath: path,
      rawQueryString: "",
      requestContext: {
        accountId: "123456789012",
        apiId: "api-123",
        domainName: "example.execute-api.ap-northeast-2.amazonaws.com",
        domainPrefix: "example",
        http: {
          method: "GET",
          path,
          protocol: "HTTP/1.1",
          sourceIp: "127.0.0.1",
          userAgent: "vitest",
        },
        requestId,
        routeKey: "$default",
        stage: "$default",
        time: "17/Mar/2026:12:00:00 +0000",
        timeEpoch: 1710676800000,
      },
    });
  }

  async function readJson<T>(response: Response): Promise<T> {
    return (await response.json()) as T;
  }

  async function expectBodyValidationProblem(
    response: Response,
    instance: string,
  ): Promise<ValidationProblemResponse> {
    expect(response.status).toBe(422);

    const problem = await readJson<ValidationProblemResponse>(response);
    expect(problem).toMatchObject({
      title: "Validation Error",
      status: 422,
      code: "protocols-rest/request-validation-failed",
      instance,
    });

    return problem;
  }

  beforeEach(() => {
    Container.reset();
    lifecycleInstanceSequence = 0;
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger;
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
    Component({ scope: "singleton" })(HttpSingletonLifecycleProvider);
    Component({ scope: "request" })(HttpRequestScopedLifecycleProvider);
    Component({ scope: "request" })(DiLifecycleController);

    app = createApp({
      controllers: [FrameworkIntegrationController, DiLifecycleControllerToken],
      securityValidation: "off",
    });
  });

  it("binds request inputs while preserving framework context", async () => {
    const response = await app.fetch(
      new Request("http://localhost/framework/integration/context/fetch-1?expand=full", {
        headers: {
          traceparent: TRACEPARENT,
          "x-tenant-id": "tenant-fetch",
        },
      }),
    );

    expect(response.status).toBe(200);

    const body = await readJson<ContextResponse>(response);
    expect(body).toMatchObject({
      id: "fetch-1",
      expand: "full",
      tenantHeader: "tenant-fetch",
      contextActive: true,
      traceId: TRACE_ID,
    });
    expect(body.requestId).toEqual(expect.any(String));
  });

  it("reuses request-scoped providers inside one Node fetch request and isolates separate requests", async () => {
    const firstResponse = await app.fetch(
      new Request("http://localhost/framework/integration/di/lifecycle/fetch-1"),
    );
    const secondResponse = await app.fetch(
      new Request("http://localhost/framework/integration/di/lifecycle/fetch-2"),
    );

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    const first = await readJson<DiLifecycleResponse>(firstResponse);
    const second = await readJson<DiLifecycleResponse>(secondResponse);

    expect(first).toMatchObject({
      id: "fetch-1",
      contextActive: true,
      graph: {
        status: "ready",
        roots: ["DiLifecycleController"],
        diagnostics: [],
      },
    });
    expect(first.requestId).toEqual(expect.any(String));
    expect(first.injectedRequestScopedId).toBe(first.directRequestScopedId);
    expect(first.directRequestScopedId).toBe(first.repeatedRequestScopedId);
    expect(first.graph.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          token: "DiLifecycleController",
          scope: "request",
          dependencies: expect.arrayContaining([
            "HttpSingletonLifecycleProvider",
            "HttpRequestScopedLifecycleProvider",
          ]),
        }),
        expect.objectContaining({
          token: "HttpSingletonLifecycleProvider",
          scope: "singleton",
        }),
        expect.objectContaining({
          token: "HttpRequestScopedLifecycleProvider",
          scope: "request",
        }),
      ]),
    );

    expect(second.id).toBe("fetch-2");
    expect(second.singletonId).toBe(first.singletonId);
    expect(second.injectedRequestScopedId).toBe(second.directRequestScopedId);
    expect(second.directRequestScopedId).toBe(second.repeatedRequestScopedId);
    expect(second.directRequestScopedId).not.toBe(first.directRequestScopedId);
    expect(second.requestId).not.toBe(first.requestId);
  });

  it("serializes zod body validation failures as Problem Details", async () => {
    const response = await app.fetch(
      new Request("http://localhost/framework/integration/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", quantity: 0 }),
      }),
    );

    expect(response.status).toBe(422);

    const problem = await readJson<ValidationProblemResponse>(response);
    expect(problem).toMatchObject({
      title: "Validation Error",
      status: 422,
      code: "protocols-rest/request-validation-failed",
      instance: "http://localhost/framework/integration/widgets",
    });
    expect(problem.detail).toContain("body.name");
    expect(problem.detail).toContain("body.quantity");
    expect(problem.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["body.name", "body.quantity"]),
    );
  });

  it("serializes malformed JSON body parse failures as Problem Details", async () => {
    const response = await app.fetch(
      new Request("http://localhost/framework/integration/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"name":',
      }),
    );

    const problem = await expectBodyValidationProblem(
      response,
      "http://localhost/framework/integration/widgets",
    );
    expect(problem.detail).toContain("body.value");
    expect(problem.issues).toEqual([
      {
        path: "body.value",
        message: "Request body must contain valid JSON",
      },
    ]);
  });

  it("serializes empty required JSON body failures as Problem Details", async () => {
    const response = await app.fetch(
      new Request("http://localhost/framework/integration/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      }),
    );

    const problem = await expectBodyValidationProblem(
      response,
      "http://localhost/framework/integration/widgets",
    );
    expect(problem.detail).toContain("body.value");
    expect(problem.issues).toEqual([
      {
        path: "body.value",
        message: "Request body must contain valid JSON",
      },
    ]);
  });

  it("serializes unexpected content-type parse failures as Problem Details", async () => {
    const response = await app.fetch(
      new Request("http://localhost/framework/integration/widgets", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not-json",
      }),
    );

    const problem = await expectBodyValidationProblem(
      response,
      "http://localhost/framework/integration/widgets",
    );
    expect(problem.detail).toContain("body.value");
    expect(problem.issues).toEqual([
      {
        path: "body.value",
        message: "Request body must contain valid JSON",
      },
    ]);
  });

  it("serializes repeated body parse failures as Problem Details", async () => {
    const response = await app.fetch(
      new Request("http://localhost/framework/integration/widgets/repeated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"name":',
      }),
    );

    const problem = await expectBodyValidationProblem(
      response,
      "http://localhost/framework/integration/widgets/repeated",
    );
    expect(problem.detail).toContain("body.value");
    expect(problem.issues).toEqual([
      {
        path: "body.value",
        message: "Request body must contain valid JSON",
      },
    ]);
  });

  it("runs route interceptors through the compiled lifecycle pipeline", async () => {
    const response = await app.fetch(
      new Request("http://localhost/framework/integration/lifecycle"),
    );

    expect(response.status).toBe(200);

    const body = await readJson<LifecycleResponse>(response);
    expect(body).toEqual({
      result: {
        value: "handler-result",
      },
      lifecycle: {
        handler: "lifecycle",
        method: "GET",
        path: "/framework/integration/lifecycle",
      },
    });
  });

  it("routes Lambda events through the same controller bindings", async () => {
    const handler = app.lambdaHandler();
    const response = await handler(
      createLambdaEvent({
        rawPath: "/framework/integration/context/lambda-1",
        rawQueryString: "expand=lambda",
        headers: {
          traceparent: TRACEPARENT,
          "x-tenant-id": "tenant-lambda",
        },
        requestContext: {
          accountId: "123456789012",
          apiId: "api-123",
          domainName: "example.execute-api.ap-northeast-2.amazonaws.com",
          domainPrefix: "example",
          http: {
            method: "GET",
            path: "/framework/integration/context/lambda-1",
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
      }),
      createLambdaContext(),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toBeDefined();

    const body = JSON.parse(response.body ?? "{}") as ContextResponse;
    expect(body).toMatchObject({
      id: "lambda-1",
      expand: "lambda",
      tenantHeader: "tenant-lambda",
      contextActive: true,
      traceId: TRACE_ID,
    });
    expect(body.requestId).toEqual(expect.any(String));
  });

  it("reuses request-scoped providers inside one Lambda request and isolates separate invocations", async () => {
    const handler = app.lambdaHandler();
    const firstResponse = await handler(
      createGetLambdaEvent("/framework/integration/di/lifecycle/lambda-1", "gateway-lambda-1"),
      createLambdaContext(),
    );
    const secondResponse = await handler(
      createGetLambdaEvent("/framework/integration/di/lifecycle/lambda-2", "gateway-lambda-2"),
      createLambdaContext(),
    );

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);

    const first = JSON.parse(firstResponse.body ?? "{}") as DiLifecycleResponse;
    const second = JSON.parse(secondResponse.body ?? "{}") as DiLifecycleResponse;

    expect(first).toMatchObject({
      id: "lambda-1",
      contextActive: true,
      requestId: "gateway-lambda-1",
      graph: {
        status: "ready",
        roots: ["DiLifecycleController"],
        diagnostics: [],
      },
    });
    expect(first.injectedRequestScopedId).toBe(first.directRequestScopedId);
    expect(first.directRequestScopedId).toBe(first.repeatedRequestScopedId);

    expect(second).toMatchObject({
      id: "lambda-2",
      contextActive: true,
      requestId: "gateway-lambda-2",
    });
    expect(second.singletonId).toBe(first.singletonId);
    expect(second.injectedRequestScopedId).toBe(second.directRequestScopedId);
    expect(second.directRequestScopedId).toBe(second.repeatedRequestScopedId);
    expect(second.directRequestScopedId).not.toBe(first.directRequestScopedId);
  });

  it("reports singleton to request-scope mismatches in DI graph diagnostics", () => {
    Container.reset();

    class InvalidRequestScopedProvider {}

    class InvalidSingletonProvider {
      constructor(readonly requestScopedProvider: InvalidRequestScopedProvider) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], InvalidRequestScopedProvider);
    Reflect.defineMetadata(
      "design:paramtypes",
      [InvalidRequestScopedProvider],
      InvalidSingletonProvider,
    );
    Component({ scope: "request" })(InvalidRequestScopedProvider);
    Component({ scope: "singleton" })(InvalidSingletonProvider);

    const manifest = Container.createDependencyGraphManifest({
      roots: [InvalidSingletonProvider],
    });

    expect(manifest.status).toBe("failed");
    expect(manifest.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "CROCO_DI_003",
        legacyCode: "framework-context/di-scope-mismatch",
        severity: "error",
        token: "InvalidRequestScopedProvider",
        status: "scope-mismatch",
        path: ["InvalidSingletonProvider", "InvalidRequestScopedProvider"],
      }),
    );
  });
});
