import { EventBusConfig } from "@croco/events-core";
import {
  Container,
  type ContainerScope,
  ShutdownManager,
  type TokenIdentifier,
} from "@croco/framework-context";
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
  createTestingRequest,
  createTestingTransactionContext,
  type TestingRequestOptions,
  type TestingTransactionContext,
} from "./testing";

export type TestKernelBootstrapResult =
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

export type TestResourceMode = "rollback" | "commit" | "migration";
export type TestResourceIsolation = "database-per-worker" | "prefix-per-test";
export type TestResourceDiagnosticStage = "startup" | "migration" | "health-check" | "cleanup";

export type TestResourceFidelity = {
  readonly id: string;
  readonly image: string;
  readonly isolation: TestResourceIsolation;
  readonly kind: string;
  readonly mode: TestResourceMode;
};

export type TestResourceDiagnostic = {
  readonly logs: readonly string[];
  readonly message: string;
  readonly stage: TestResourceDiagnosticStage;
  readonly status: "passed" | "failed";
};

export type StartedTestResource<TConnection> = {
  readonly connection: TConnection;
  readonly diagnostics: readonly TestResourceDiagnostic[];
  readonly dispose: () => Promise<void> | void;
  readonly fidelity: TestResourceFidelity;
};

export type TestResourceStartContext = {
  readonly register: <T>(token: TokenIdentifier<T>, value: T) => void;
  readonly testId: string;
  readonly workerId: string;
};

export type TestResource<TConnection> = {
  readonly id: string;
  readonly start: (context: TestResourceStartContext) => Promise<StartedTestResource<TConnection>>;
};

export type TestKernelResourceEvidence = {
  readonly diagnostics: readonly TestResourceDiagnostic[];
  readonly fidelity: TestResourceFidelity;
};

export type TestKernelResourceObligation = {
  readonly kind: "after-commit" | "deferred-constraint" | "outbox" | "serialization";
  readonly resource: TestResource<unknown>;
};

type TestKernelCommonOptions = {
  readonly baseUrl?: string;
  readonly bootstrap: (
    context: TestKernelBootstrapContext,
  ) => Promise<TestKernelBootstrapResult> | TestKernelBootstrapResult;
  readonly dispose?: (app: CrocoApp) => Promise<void> | void;
  readonly obligations?: readonly TestKernelResourceObligation[];
  readonly resources?: readonly TestResource<unknown>[];
  readonly testId?: string;
  readonly validation?: Partial<BootstrapValidationPolicy>;
  readonly workerId?: string;
};

type TestKernelCleanupOperation = () => Promise<void> | void;

export type TestKernelOptions = TestKernelCommonOptions &
  (
    | {
        readonly adapter?: never;
        readonly fidelity: "application";
      }
    | {
        readonly adapter?: TestKernelRuntime;
        readonly fidelity: "adapter";
      }
  );

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
          failures: failures.map((failure) =>
            failure instanceof Problem
              ? {
                  ...failure.toJSON(),
                  message: failure.message,
                  name: failure.name,
                }
              : {
                  message: failure.message,
                  name: failure.name,
                },
          ),
        },
        ...(cause === undefined ? {} : { cause: toError(cause) }),
      },
    );
  }
}

export class TestKernelDisposedProblem extends Problem {
  constructor() {
    super(
      "testing/test-kernel-disposed",
      ProblemCategory.InternalServerError,
      "TestKernel cannot be used after disposal has started.",
    );
  }
}

export class TestKernelResourceFidelityProblem extends Problem {
  constructor(obligation: TestKernelResourceObligation, fidelity: TestResourceFidelity) {
    super(
      "testing/test-kernel-resource-fidelity",
      ProblemCategory.InternalServerError,
      `Test resource '${fidelity.id}' cannot satisfy '${obligation.kind}' evidence in '${fidelity.mode}' mode. Use commit or migration mode for commit-semantic obligations.`,
      {
        extensions: {
          fidelity,
          obligation: obligation.kind,
        },
      },
    );
  }
}

export class TestKernelResourceNotFoundProblem extends Problem {
  constructor(resourceId: string) {
    super(
      "testing/test-kernel-resource-not-found",
      ProblemCategory.InternalServerError,
      `Test resource '${resourceId}' is not part of this TestKernel.`,
      {
        extensions: { resourceId },
      },
    );
  }
}

export class TestKernelResourceRegistrationProblem extends Problem {
  constructor(resourceId: string) {
    super(
      "testing/test-kernel-resource-registration",
      ProblemCategory.InternalServerError,
      `Test resource id '${resourceId}' is registered more than once.`,
      {
        extensions: { resourceId },
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
    private readonly cleanupOperations: readonly TestKernelCleanupOperation[],
    private readonly resourceConnections: ReadonlyMap<TestResource<unknown>, unknown>,
    private readonly resourceEvidenceBuffer: readonly TestKernelResourceEvidence[],
  ) {
    this.http = new TestKernelHttp(this);
    this.transactionContext = transactionContext;
  }

  get evidence(): readonly TestKernelEvidence[] {
    return [...this.evidenceBuffer];
  }

  get resourceEvidence(): readonly TestKernelResourceEvidence[] {
    return [...this.resourceEvidenceBuffer];
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

  resource<TConnection>(resource: TestResource<TConnection>): TConnection {
    this.assertActive();
    if (!this.resourceConnections.has(resource)) {
      throw new TestKernelResourceNotFoundProblem(resource.id);
    }
    return this.resourceConnections.get(resource) as TConnection;
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
    await Promise.allSettled(this.inFlight);
    const failures = await runCleanupSequence(this.scope, this.cleanupOperations);

    if (failures.length > 0) {
      throw new TestKernelDisposalProblem(failures);
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new TestKernelDisposedProblem();
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
  const resourceCleanups: Array<() => Promise<void> | void> = [];
  const testId = options.testId ?? `test-${crypto.randomUUID()}`;
  const workerId =
    options.workerId ??
    process.env["VITEST_POOL_ID"] ??
    process.env["CI_NODE_INDEX"] ??
    `process-${process.pid}`;
  const fidelityContext: TestKernelBootstrapContext = {
    fidelity: options.fidelity,
    onCleanup(cleanup) {
      registeredCleanups.push(cleanup);
    },
    runtime,
  };
  let app: CrocoApp | undefined;
  let bootstrapCleanup: (() => Promise<void> | void) | undefined;
  const resourceConnections = new Map<TestResource<unknown>, unknown>();
  const resourceEvidence: TestKernelResourceEvidence[] = [];

  try {
    return await scope.run(async () => {
      EventBusConfig.setInstance(new EventBusConfig());
      ShutdownManager.getInstance();
      const transactionContext = createTestingTransactionContext();
      const resources = options.resources ?? [];
      const resourceIds = new Set<string>();

      for (const resource of resources) {
        if (resourceIds.has(resource.id)) {
          throw new TestKernelResourceRegistrationProblem(resource.id);
        }
        resourceIds.add(resource.id);
      }
      for (const obligation of options.obligations ?? []) {
        if (!resources.includes(obligation.resource)) {
          throw new TestKernelResourceNotFoundProblem(obligation.resource.id);
        }
      }

      for (const resource of resources) {
        const started = await resource.start({
          register: <T>(token: TokenIdentifier<T>, value: T) => {
            Container.set(token, value);
          },
          testId,
          workerId,
        });
        resourceConnections.set(resource, started.connection);
        resourceEvidence.push(
          Object.freeze({
            diagnostics: started.diagnostics,
            fidelity: Object.freeze({ ...started.fidelity }),
          }),
        );
        resourceCleanups.push(started.dispose);
      }

      for (const obligation of options.obligations ?? []) {
        const index = resources.indexOf(obligation.resource);
        const evidence = resourceEvidence[index] as TestKernelResourceEvidence;
        if (evidence.fidelity.mode === "rollback") {
          throw new TestKernelResourceFidelityProblem(obligation, evidence.fidelity);
        }
      }

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
        ...[...resourceCleanups].reverse(),
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
        resourceConnections,
        resourceEvidence,
      );
    });
  } catch (error) {
    const cleanupOperations = [
      ...(bootstrapCleanup ? [bootstrapCleanup] : []),
      ...[...registeredCleanups].reverse(),
      ...(app && options.dispose ? [() => options.dispose?.(app as CrocoApp)] : []),
      ...[...resourceCleanups].reverse(),
    ];
    const failures = await runCleanupSequence(scope, cleanupOperations);

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
  return createTestingRequest(input, options, baseUrl);
}

async function runCleanupSequence(
  scope: ContainerScope,
  cleanupOperations: readonly TestKernelCleanupOperation[],
): Promise<Error[]> {
  const failures: Error[] = [];

  try {
    await scope.run(() => ShutdownManager.getInstance().shutdown({ throwOnHookError: true }));
  } catch (error) {
    failures.push(toError(error));
  }

  for (const cleanup of cleanupOperations) {
    try {
      await scope.run(cleanup);
    } catch (error) {
      failures.push(toError(error));
    }
  }

  try {
    scope.run(() => EventBusConfig.disposeCurrentScope());
  } catch (error) {
    failures.push(toError(error));
  }

  try {
    scope.run(() => ShutdownManager.disposeCurrentScope());
  } catch (error) {
    failures.push(toError(error));
  }

  try {
    scope.dispose();
  } catch (error) {
    failures.push(toError(error));
  }

  return failures;
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
