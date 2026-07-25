import {
  Container,
  type ContainerScope,
  ShutdownManager,
  type TokenIdentifier,
} from "@croco/framework-context";
import { EventBusConfig } from "@croco/events-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  BootstrapValidationPolicy,
  CrocoApp,
  LambdaContext,
  LambdaEvent,
  LambdaHandler,
  NodeRequestHandler,
} from "@croco/transports-http";
import {
  createTestingTransactionContext,
  type TestingRequestOptions,
  type TestingTransactionContext,
} from "./testing";

type TestKernelBootstrapResult =
  | CrocoApp
  | {
      readonly app: CrocoApp;
      readonly dispose?: () => Promise<void> | void;
    };

export type TestKernelBootFidelity = "application" | "adapter";
export type TestKernelRuntime = "node" | "lambda";
export type TestKernelValidationFidelity = "production" | "overridden";

export type TestKernelFidelity = {
  readonly boot: TestKernelBootFidelity;
  readonly runtime: TestKernelRuntime;
  readonly validation: TestKernelValidationFidelity;
};

export type TestKernelEvidence = {
  readonly fidelity: TestKernelFidelity;
  readonly method: string;
  readonly path: string;
  readonly status: number;
};

export type TestKernelBootstrapContext = {
  readonly fidelity: TestKernelBootFidelity;
  readonly onCleanup: (cleanup: () => Promise<void> | void) => void;
  readonly runtime: TestKernelRuntime;
};

export type TestKernelOptions = {
  readonly adapter?: TestKernelRuntime;
  readonly baseUrl?: string;
  readonly bootstrap: (
    context: TestKernelBootstrapContext,
  ) => Promise<TestKernelBootstrapResult> | TestKernelBootstrapResult;
  readonly dispose?: (app: CrocoApp) => Promise<void> | void;
  readonly fidelity: TestKernelBootFidelity;
  readonly validation?: Partial<BootstrapValidationPolicy>;
};

export class TestKernelValidationProblem extends Problem {
  constructor(actual: BootstrapValidationPolicy, expected: BootstrapValidationPolicy) {
    super(
      "testing/test-kernel-validation-policy",
      ProblemCategory.InternalServerError,
      `TestKernel bootstrap used DI '${actual.di}' and security '${actual.security}' validation; expected DI '${expected.di}' and security '${expected.security}'. Pass an explicit validation override only when lower validation fidelity is intentional.`,
      {
        extensions: { actual, expected },
      },
    );
  }
}

export class TestKernelDisposalProblem extends Problem {
  constructor(failures: readonly Error[], cause?: unknown) {
    super(
      "testing/test-kernel-disposal-failed",
      ProblemCategory.InternalServerError,
      `${failures.length} TestKernel cleanup operation(s) failed.`,
      {
        extensions: {
          failureCount: failures.length,
          failures: failures.map((failure) => ({
            message: failure.message,
            name: failure.name,
          })),
        },
        ...(cause === undefined ? {} : { cause: toError(cause) }),
      },
    );
  }
}

export class TestKernelHttp {
  constructor(private readonly kernel: TestKernel) {}

  request(path: string | URL | Request, options: TestingRequestOptions = {}): Promise<Response> {
    return this.kernel.request(path, options);
  }

  get(path: string | URL, options: Omit<TestingRequestOptions, "method"> = {}): Promise<Response> {
    return this.request(path, { ...options, method: "GET" });
  }

  post(path: string | URL, options: Omit<TestingRequestOptions, "method"> = {}): Promise<Response> {
    return this.request(path, { ...options, method: "POST" });
  }

  put(path: string | URL, options: Omit<TestingRequestOptions, "method"> = {}): Promise<Response> {
    return this.request(path, { ...options, method: "PUT" });
  }

  patch(
    path: string | URL,
    options: Omit<TestingRequestOptions, "method"> = {},
  ): Promise<Response> {
    return this.request(path, { ...options, method: "PATCH" });
  }

  delete(
    path: string | URL,
    options: Omit<TestingRequestOptions, "method"> = {},
  ): Promise<Response> {
    return this.request(path, { ...options, method: "DELETE" });
  }
}

export class TestKernel implements AsyncDisposable {
  readonly http: TestKernelHttp;
  readonly transactionContext: TestingTransactionContext;
  private disposal: Promise<void> | undefined;
  private disposed = false;
  private readonly evidenceBuffer: TestKernelEvidence[] = [];
  private readonly inFlight = new Set<Promise<unknown>>();

  constructor(
    readonly app: CrocoApp,
    readonly fidelity: TestKernelFidelity,
    private readonly scope: ContainerScope,
    transactionContext: TestingTransactionContext,
    private readonly baseUrl: string,
    private readonly lambdaHandler: LambdaHandler | undefined,
    private readonly nodeHandler: NodeRequestHandler | undefined,
    private readonly cleanupOperations: readonly (() => Promise<void> | void)[],
  ) {
    this.http = new TestKernelHttp(this);
    this.transactionContext = transactionContext;
  }

  get evidence(): readonly TestKernelEvidence[] {
    return [...this.evidenceBuffer];
  }

  run<T>(fn: () => Promise<T>): Promise<T>;
  run<T>(fn: () => T): T;
  run<T>(fn: () => Promise<T> | T): Promise<T> | T {
    this.assertActive();
    const result = this.scope.run(fn);
    return result instanceof Promise ? this.track(result) : result;
  }

  get<T>(token: TokenIdentifier<T>): T {
    this.assertActive();
    return this.scope.run(() => Container.get(token)) as T;
  }

  request(path: string | URL | Request, options: TestingRequestOptions = {}): Promise<Response> {
    this.assertActive();
    return this.track(this.dispatchRequest(path, options));
  }

  private async dispatchRequest(
    path: string | URL | Request,
    options: TestingRequestOptions,
  ): Promise<Response> {
    const request = toRequest(path, options, this.baseUrl);
    const response = await this.scope.run(async () =>
      this.lambdaHandler
        ? dispatchLambdaRequest(this.lambdaHandler, request)
        : this.nodeHandler
          ? this.nodeHandler(request)
          : this.app.fetch(request, { platform: "node" }),
    );
    const url = new URL(request.url);
    this.evidenceBuffer.push(
      Object.freeze({
        fidelity: this.fidelity,
        method: request.method,
        path: url.pathname,
        status: response.status,
      }),
    );
    return response;
  }

  dispose(): Promise<void> {
    if (!this.disposal) {
      this.disposed = true;
      this.disposal = this.disposeOnce();
    }

    return this.disposal;
  }

  private async disposeOnce(): Promise<void> {
    const failures: Error[] = [];

    await Promise.allSettled(this.inFlight);

    try {
      await this.scope.run(() =>
        ShutdownManager.getInstance().shutdown({ throwOnHookError: true }),
      );
    } catch (error) {
      failures.push(toError(error));
    }

    for (const cleanup of this.cleanupOperations) {
      try {
        await this.scope.run(cleanup);
      } catch (error) {
        failures.push(toError(error));
      }
    }

    try {
      this.scope.run(() => EventBusConfig.disposeCurrentScope());
    } catch (error) {
      failures.push(toError(error));
    }

    try {
      this.scope.run(() => ShutdownManager.disposeCurrentScope());
    } catch (error) {
      failures.push(toError(error));
    }

    try {
      this.scope.dispose();
    } catch (error) {
      failures.push(toError(error));
    }

    if (failures.length > 0) {
      throw new TestKernelDisposalProblem(failures);
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new TestKernelDisposalProblem([new Error("TestKernel has already been disposed.")]);
    }
  }

  private track<T>(operation: Promise<T>): Promise<T> {
    this.inFlight.add(operation);
    void operation.then(
      () => this.inFlight.delete(operation),
      () => this.inFlight.delete(operation),
    );
    return operation;
  }
}

export async function createTestKernel(options: TestKernelOptions): Promise<TestKernel> {
  const scope = Container.createScope();
  const runtime = options.fidelity === "adapter" ? (options.adapter ?? "node") : "node";
  const registeredCleanups: Array<() => Promise<void> | void> = [];
  const fidelityContext: TestKernelBootstrapContext = {
    fidelity: options.fidelity,
    onCleanup(cleanup) {
      registeredCleanups.push(cleanup);
    },
    runtime,
  };
  let app: CrocoApp | undefined;
  let bootstrapCleanup: (() => Promise<void> | void) | undefined;

  try {
    return await scope.run(async () => {
      EventBusConfig.setInstance(new EventBusConfig());
      ShutdownManager.getInstance();
      const transactionContext = createTestingTransactionContext();

      const result = await options.bootstrap(fidelityContext);
      app = isBootstrapApplication(result) ? result.app : result;
      bootstrapCleanup = isBootstrapApplication(result) ? result.dispose : undefined;

      const actualValidation = app.describeBootstrapValidationPolicy();
      const expectedValidation: BootstrapValidationPolicy = {
        di: options.validation?.di ?? "enforce",
        security: options.validation?.security ?? "enforce",
      };
      if (
        actualValidation.di !== expectedValidation.di ||
        actualValidation.security !== expectedValidation.security
      ) {
        throw new TestKernelValidationProblem(actualValidation, expectedValidation);
      }

      const lambdaHandler = runtime === "lambda" ? app.lambdaHandler() : undefined;
      const nodeHandler =
        options.fidelity === "adapter" && runtime === "node" ? app.nodeHandler() : undefined;
      if (!lambdaHandler) {
        app.getHono();
      }

      const fidelity: TestKernelFidelity = Object.freeze({
        boot: options.fidelity,
        runtime,
        validation:
          expectedValidation.di === "enforce" && expectedValidation.security === "enforce"
            ? "production"
            : "overridden",
      });
      const cleanupOperations = [
        ...(bootstrapCleanup ? [bootstrapCleanup] : []),
        ...[...registeredCleanups].reverse(),
        ...(options.dispose ? [() => options.dispose?.(app as CrocoApp)] : []),
      ];

      return new TestKernel(
        app,
        fidelity,
        scope,
        transactionContext,
        options.baseUrl ?? "http://localhost",
        lambdaHandler,
        nodeHandler,
        cleanupOperations,
      );
    });
  } catch (error) {
    const failures: Error[] = [];

    try {
      await scope.run(() => ShutdownManager.getInstance().shutdown({ throwOnHookError: true }));
    } catch (cleanupError) {
      failures.push(toError(cleanupError));
    }

    const cleanupOperations = [
      ...(bootstrapCleanup ? [bootstrapCleanup] : []),
      ...[...registeredCleanups].reverse(),
      ...(app && options.dispose ? [() => options.dispose?.(app as CrocoApp)] : []),
    ];
    for (const cleanup of cleanupOperations) {
      try {
        await scope.run(cleanup);
      } catch (cleanupError) {
        failures.push(toError(cleanupError));
      }
    }

    try {
      scope.run(() => EventBusConfig.disposeCurrentScope());
    } catch (cleanupError) {
      failures.push(toError(cleanupError));
    }

    try {
      scope.run(() => ShutdownManager.disposeCurrentScope());
    } catch (cleanupError) {
      failures.push(toError(cleanupError));
    }

    try {
      scope.dispose();
    } catch (cleanupError) {
      failures.push(toError(cleanupError));
    }

    if (failures.length > 0) {
      throw new TestKernelDisposalProblem(failures, error);
    }

    throw error;
  }
}

function isBootstrapApplication(
  result: TestKernelBootstrapResult,
): result is Exclude<TestKernelBootstrapResult, CrocoApp> {
  return typeof result === "object" && result !== null && "app" in result;
}

function toRequest(
  input: string | URL | Request,
  options: TestingRequestOptions,
  baseUrl: string,
): Request {
  if (input instanceof Request) {
    return new Request(input, options);
  }

  const url = new URL(String(input), baseUrl);
  if (options.query) {
    for (const [key, rawValue] of Object.entries(options.query)) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const value of values) {
        if (value !== null && value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      }
    }
  }

  const headers = new Headers(options.headers);
  const body =
    options.json !== undefined
      ? JSON.stringify(options.json)
      : options.body === null
        ? null
        : options.body;
  if (options.json !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const { body: _body, json: _json, query: _query, ...requestOptions } = options;
  const requestInit: RequestInit = {
    ...requestOptions,
    headers,
    ...(body === undefined ? {} : { body }),
  };

  return new Request(url, requestInit);
}

async function dispatchLambdaRequest(handler: LambdaHandler, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers.entries());
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
  const event: LambdaEvent = {
    version: "2.0",
    routeKey: `${request.method} ${url.pathname}`,
    rawPath: url.pathname,
    rawQueryString: url.searchParams.toString(),
    headers,
    requestContext: {
      accountId: "testing",
      apiId: "test-kernel",
      domainName: url.hostname,
      domainPrefix: "test-kernel",
      http: {
        method: request.method,
        path: url.pathname,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: headers["user-agent"] ?? "croco-test-kernel",
      },
      requestId: `test-kernel-${crypto.randomUUID()}`,
      routeKey: `${request.method} ${url.pathname}`,
      stage: "$default",
      time: new Date(0).toUTCString(),
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    ...(body === undefined ? {} : { body }),
  };
  const lambdaResponse = await handler(event, createLambdaContext());
  const responseHeaders = new Headers(lambdaResponse.headers);
  for (const cookie of lambdaResponse.cookies ?? []) {
    responseHeaders.append("set-cookie", cookie);
  }
  const responseBody = lambdaResponse.body
    ? lambdaResponse.isBase64Encoded
      ? Buffer.from(lambdaResponse.body, "base64")
      : lambdaResponse.body
    : null;

  return new Response(responseBody, {
    status: lambdaResponse.statusCode,
    headers: responseHeaders,
  });
}

function createLambdaContext(): LambdaContext {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: "croco-test-kernel",
    functionVersion: "$LATEST",
    invokedFunctionArn: "arn:aws:lambda:local:0:function:croco-test-kernel",
    memoryLimitInMB: "128",
    awsRequestId: crypto.randomUUID(),
    logGroupName: "/aws/lambda/croco-test-kernel",
    logStreamName: "test",
    getRemainingTimeInMillis: () => 30_000,
    done: () => undefined,
    fail: () => undefined,
    succeed: () => undefined,
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
