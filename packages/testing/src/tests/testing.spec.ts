import "reflect-metadata";
import type { BillingGateway, CheckoutResult, CreateCheckoutParams } from "@croco/billing-core";
import type { EventHandler } from "@croco/events-core";
import { DomainEvent, EventBusConfig, RegisterEventHandler } from "@croco/events-core";
import type { InMemoryEventBus } from "@croco/events-inmemory";
import type { TransactionContext } from "@croco/framework-context";
import { Container, Context, Token, TRANSACTION_CONTEXT_TOKEN } from "@croco/framework-context";
import type { GenerateParams, GenerateResult } from "@croco/llm-core";
import { InMemoryLlmModel } from "@croco/llm-core";
import { Problem, ProblemCategory, ProblemFactory } from "@croco/problems-core";
import { Controller, Get, Param } from "@croco/protocols-rest";
import type {
  RateLimitPolicy,
  RateLimitRefundReceipt,
  RateLimitRefundResult,
  RateLimitResult,
  RateLimitStats,
} from "@croco/ratelimit-core";
import { RateLimitStore } from "@croco/ratelimit-core";
import { InMemoryStorageProvider } from "@croco/storage-core";
import { recordEvent, withSpan } from "@croco/telemetry-api";
import { createGracefulShutdownController } from "@croco/transports-http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertDrizzleProblem,
  assertOpenAPIRoute,
  assertProblemResponse,
  createAuthProviderConformanceSuite,
  createBillingProviderConformanceSuite,
  createDrizzleProviderConformanceSuite,
  createEventTestingHarness,
  createFailureDrillCatalog,
  createLlmProviderConformanceSuite,
  createProviderConformanceMatrixSuite,
  createQStashTaskConformanceSuite,
  createRpcTestFetch,
  createStorageProviderConformanceSuite,
  createTestingApp,
  createTestingRequestContext,
  createTestingTransactionContext,
  createUpstashRedisRateLimitConformanceSuite,
  FAILURE_DRILL_SCENARIO_IDS,
  type FailureDrillScenario,
  installTestingTelemetryCapture,
  type QStashTaskConformanceScenario,
  type QStashTaskExecuteOptions,
  type QStashTaskPublisher,
  type QStashTaskPublishRecord,
  resetCrocoTestingContext,
  runFailureDrillScenario,
  runFailureDrills,
  runWithTestingContext,
  TestingTransactionContext,
  type TestLogger,
  type UpstashRedisRateLimitConformanceScenario,
} from "../index";

class GreetingService {
  constructor(private readonly prefix: string = "Hello") {}

  greet(name: string): string {
    return `${this.prefix}, ${name}`;
  }
}

class FailingLlmModel extends InMemoryLlmModel {
  override async generate(_params: GenerateParams): Promise<GenerateResult> {
    throw ProblemFactory.internalServerError(
      "testing/llm-provider-failed",
      "provider generate failed",
    );
  }
}

class TestingBillingProblem extends Problem {
  constructor(detail: string) {
    super("testing/billing-provider-failed", ProblemCategory.InternalServerError, detail);
  }
}

class InMemoryBillingGateway implements BillingGateway {
  readonly subscriptionOperations: string[] = [];

  async ensureCustomer(billingAccountId: string, _email: string): Promise<string> {
    return `customer-${billingAccountId}`;
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    return {
      checkoutId: `checkout-${params.billingAccountId}`,
      checkoutUrl: `https://billing.example.com/checkout/${params.productId}`,
    };
  }

  async cancelSubscription(externalSubscriptionId: string, immediate = false): Promise<void> {
    this.subscriptionOperations.push(
      immediate ? `revoke:${externalSubscriptionId}` : `cancel:${externalSubscriptionId}`,
    );
  }

  async resumeSubscription(externalSubscriptionId: string): Promise<void> {
    this.subscriptionOperations.push(`resume:${externalSubscriptionId}`);
  }

  async getCustomerPortalUrl(externalCustomerId: string): Promise<string> {
    return `https://billing.example.com/portal/${externalCustomerId}`;
  }
}

class FailingBillingGateway extends InMemoryBillingGateway {
  override async createCheckout(_params: CreateCheckoutParams): Promise<CheckoutResult> {
    throw new TestingBillingProblem("provider checkout failed");
  }
}

class InMemoryBillingWebhookHandler {
  readonly processedEventIds: string[] = [];

  async handle(body: Buffer | string, headers: Record<string, string>) {
    if (headers["webhook-signature"] !== "valid") {
      throw new TestingBillingProblem("invalid webhook signature");
    }

    const event = JSON.parse(Buffer.isBuffer(body) ? body.toString("utf8") : body) as {
      id?: unknown;
      type?: unknown;
    };

    if (typeof event.id !== "string" || typeof event.type !== "string") {
      throw new TestingBillingProblem("invalid webhook payload");
    }

    if (!this.processedEventIds.includes(event.id)) {
      this.processedEventIds.push(event.id);
    }

    return {
      success: true,
      eventId: event.id,
    };
  }
}

class ConformanceProviderProblem extends Problem {
  constructor(message: string, retryable: boolean) {
    super(
      retryable ? "testing/provider-retryable" : "testing/provider-terminal",
      retryable ? ProblemCategory.InternalServerError : ProblemCategory.BadRequest,
      message,
      {
        extensions: {
          retryable,
        },
      },
    );
  }
}

class FakeRateLimitStore extends RateLimitStore {
  private refunded = false;
  private readonly stats: RateLimitStats = { allowed: 0, denied: 0, total: 0 };

  constructor(private readonly scenario: UpstashRedisRateLimitConformanceScenario) {
    super();
  }

  async check(_key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    if (policy.algorithm !== "fixed") {
      throw new ConformanceProviderProblem("unsupported policy", false);
    }

    if (this.scenario === "retryable-upstream") {
      throw new ConformanceProviderProblem("retryable outage token=[Redacted]", true);
    }

    if (this.scenario === "terminal-upstream") {
      throw new ConformanceProviderProblem("terminal rejection token=[Redacted]", false);
    }

    this.stats.total += 1;
    if (this.scenario === "deny") {
      this.stats.denied += 1;
      return {
        success: false,
        limit: policy.limit,
        remaining: 0,
        resetAtMs: Date.now() + policy.windowMs,
      };
    }

    this.stats.allowed += 1;
    return {
      success: true,
      limit: policy.limit,
      remaining: policy.limit - 1,
      resetAtMs: Date.now() + policy.windowMs,
      refundReceipt: {
        algorithm: "fixed",
        id: "fake-refund-receipt",
        windowStart: Date.now(),
      },
    };
  }

  override async refund(
    _key: string,
    policy: RateLimitPolicy,
    receipt?: RateLimitRefundReceipt,
  ): Promise<RateLimitRefundResult> {
    if (!receipt || this.refunded || policy.algorithm !== "fixed") {
      return {
        success: true,
        limit: "limit" in policy ? policy.limit : 0,
        remaining: "limit" in policy ? policy.limit : 0,
        resetAtMs: Date.now(),
        refunded: false,
      };
    }

    this.refunded = true;
    this.stats.allowed = Math.max(0, this.stats.allowed - 1);
    this.stats.total = Math.max(0, this.stats.total - 1);

    return {
      success: true,
      limit: policy.limit,
      remaining: policy.limit,
      resetAtMs: Date.now() + policy.windowMs,
      refunded: true,
    };
  }

  async getStats(): Promise<RateLimitStats> {
    return { ...this.stats };
  }

  async pruneExpired(): Promise<number> {
    return 0;
  }
}

class FakeQStashTaskPublisher implements QStashTaskPublisher {
  readonly published: QStashTaskPublishRecord[] = [];

  constructor(private readonly scenario: QStashTaskConformanceScenario) {}

  async execute(
    taskId: string,
    payload: unknown,
    options: QStashTaskExecuteOptions = {},
  ): Promise<{ readonly messageId: string }> {
    if (!taskId) {
      throw new ConformanceProviderProblem("task id is required", false);
    }

    if (options.delay !== undefined && options.delay < 0) {
      throw new ConformanceProviderProblem("delay must be non-negative", false);
    }

    if (this.scenario === "retryable-upstream") {
      throw new ConformanceProviderProblem("retryable qstash outage token=[Redacted]", true);
    }

    if (this.scenario === "terminal-upstream") {
      throw new ConformanceProviderProblem("terminal qstash rejection token=[Redacted]", false);
    }

    this.published.push({
      body: { taskId, payload },
      deduplicationId: options.idempotencyKey,
      delay: options.delay,
      headers: options.headers,
      url: "https://example.com/tasks",
    });

    return { messageId: "msg-conformance" };
  }
}

type TokenValue = {
  readonly value: string;
};

const TOKEN_VALUE = new Token<TokenValue>("testing.value");

class MockTestLogger implements TestLogger {
  readonly debug = vi.fn();
  readonly info = vi.fn();
  readonly warn = vi.fn();
  readonly error = vi.fn();

  child(): TestLogger {
    return this;
  }
}

@Controller("/greetings")
class GreetingController {
  constructor(private readonly service: GreetingService) {}

  @Get("/:name")
  getGreeting(@Param("name") name: string) {
    return {
      message: this.service.greet(name),
    };
  }

  @Get("/problems/missing")
  missing() {
    throw ProblemFactory.notFound("testing/greeting-not-found", "Greeting was not found");
  }
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function createDeferred() {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((resolver) => {
    resolve = resolver;
  });

  if (!resolve) {
    throw ProblemFactory.internalServerError(
      "testing/deferred-resolver-not-initialized",
      "Deferred resolver was not initialized.",
    );
  }

  return { promise, resolve };
}

function greetingProviders(prefix = "Hello") {
  const service = new GreetingService(prefix);

  return [
    { token: GreetingService, useValue: service },
    { token: GreetingController, useValue: new GreetingController(service) },
  ];
}

describe("@croco/testing", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("creates an isolated app that injects controller requests without manual bootstrap", async () => {
    const app = createTestingApp({
      controllers: [GreetingController],
      providers: greetingProviders(),
    });

    const response = await app.get("/greetings/Ada");

    expect(app.fidelity).toEqual({
      boot: "isolated",
      runtime: "node",
      validation: "isolated",
    });
    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({
      message: "Hello, Ada",
    });
  });

  it("resets provider state between testing apps", async () => {
    const first = createTestingApp({
      controllers: [GreetingController],
      providers: greetingProviders("First"),
    });

    await expect(readJson(await first.get("/greetings/Ada"))).resolves.toEqual({
      message: "First, Ada",
    });

    const second = createTestingApp({
      controllers: [GreetingController],
      providers: greetingProviders("Second"),
    });

    await expect(readJson(await second.get("/greetings/Ada"))).resolves.toEqual({
      message: "Second, Ada",
    });
  });

  it("does not leak request context after request injection", async () => {
    const app = createTestingApp({
      controllers: [GreetingController],
      providers: greetingProviders(),
    });

    expect(Context.isActive()).toBe(false);
    await app.get("/greetings/Ada");
    expect(Context.isActive()).toBe(false);
  });

  it("asserts Problem Details responses through the HTTP runtime", async () => {
    const app = createTestingApp({
      controllers: [GreetingController],
      providers: greetingProviders(),
    });

    const response = await app.get("/greetings/problems/missing");
    const problem = await assertProblemResponse(response, {
      code: "testing/greeting-not-found",
      detailIncludes: "Greeting was not found",
      status: 404,
      title: "Not Found",
    });

    expect(problem.instance).toBe("http://localhost/greetings/problems/missing");
  });

  it("asserts OpenAPI route contracts from controllers", () => {
    const operation = assertOpenAPIRoute([GreetingController], {
      contentType: "application/problem+json",
      method: "GET",
      path: "/greetings/:name",
      status: 422,
    });

    expect(operation.operationId).toBe("GreetingController_getGreeting");
  });

  it("routes generated-style RPC clients through the in-memory app", async () => {
    const app = createTestingApp({
      controllers: [GreetingController],
      providers: greetingProviders(),
    });
    const rpcFetch = createRpcTestFetch(app);

    const generatedStyleClient = {
      getGreeting: async (name: string) => {
        const response = await rpcFetch(`/greetings/${name}`, {
          method: "GET",
        });
        return readJson(response);
      },
    };

    await expect(generatedStyleClient.getGreeting("Grace")).resolves.toEqual({
      message: "Hello, Grace",
    });
  });

  it("seeds reset defaults for apps created outside createTestingApp", async () => {
    resetCrocoTestingContext({ providers: greetingProviders() });
    const app = createTestingApp({
      controllers: [GreetingController],
      resetContainer: false,
    });

    await expect(readJson(await app.get("/greetings/Lynn"))).resolves.toEqual({
      message: "Hello, Lynn",
    });
  });

  it("registers token-backed testing providers", () => {
    resetCrocoTestingContext({
      providers: [{ token: TOKEN_VALUE, useValue: { value: "registered" } }],
    });

    expect(Container.get(TOKEN_VALUE)).toEqual({ value: "registered" });
  });

  it("runs deterministic request contexts without leaking AsyncLocalStorage state", async () => {
    const requestContext = createTestingRequestContext({
      requestId: "testing-request-1",
      tenantId: "tenant-a",
    });

    expect(Context.isActive()).toBe(false);
    await expect(
      runWithTestingContext(async () => {
        const runtime = Context.getRuntimeContext();
        runtime?.waitUntil(Promise.resolve("flushed"));
        await runtime?.flush();

        return {
          requestId: Context.getRequestId(),
          tenantId: Context.getTenantId(),
          waitUntil: runtime?.capabilities.waitUntil,
        };
      }, requestContext),
    ).resolves.toEqual({
      requestId: "testing-request-1",
      tenantId: "tenant-a",
      waitUntil: true,
    });
    expect(Context.isActive()).toBe(false);
  });

  it("resets transaction context hooks between testing contexts", async () => {
    const committed: string[] = [];
    const transactionContext = createTestingTransactionContext({
      inTransaction: true,
    });

    resetCrocoTestingContext({ transactionContext });
    const registered = Container.get<TransactionContext>(TRANSACTION_CONTEXT_TOKEN);
    registered.onAfterCommit(() => {
      committed.push("first");
    });

    expect(transactionContext.getPendingAfterCommitHookCount()).toBe(1);
    await transactionContext.flushAfterCommitHooks();
    expect(committed).toEqual(["first"]);

    resetCrocoTestingContext();
    const fresh = Container.get<TestingTransactionContext>(TRANSACTION_CONTEXT_TOKEN);
    expect(fresh).toBeInstanceOf(TestingTransactionContext);
    expect(fresh).not.toBe(transactionContext);
    expect(fresh.isInTransaction()).toBe(false);
    expect(fresh.getPendingAfterCommitHookCount()).toBe(0);
  });

  it("runs testing transaction hooks after the outer transaction context is cleared", async () => {
    const transactionContext = createTestingTransactionContext();
    const committed: string[] = [];
    const observedTransactionStates: boolean[] = [];

    await transactionContext.runInTransaction(async () => {
      expect(transactionContext.isInTransaction()).toBe(true);
      transactionContext.onAfterCommit(() => {
        committed.push("root");
        observedTransactionStates.push(transactionContext.isInTransaction());
      });

      await transactionContext.runInTransaction(async () => {
        expect(transactionContext.isInTransaction()).toBe(true);
        transactionContext.onAfterCommit(() => {
          committed.push("nested");
          observedTransactionStates.push(transactionContext.isInTransaction());
        });
      });

      expect(transactionContext.getPendingAfterCommitHookCount()).toBe(2);
      expect(committed).toEqual([]);
    });

    expect(committed).toEqual(["root", "nested"]);
    expect(observedTransactionStates).toEqual([false, false]);
    expect(transactionContext.isInTransaction()).toBe(false);
    expect(transactionContext.getPendingAfterCommitHookCount()).toBe(0);
  });

  it("throws a Problem when registering a testing transaction hook outside a transaction", () => {
    const transactionContext = createTestingTransactionContext();

    expect(() => {
      transactionContext.onAfterCommit(() => {});
    }).toThrow(
      "Testing transaction context is not active. Use runInTransaction() or createTestingTransactionContext({ inTransaction: true }).",
    );
  });

  it("runs every testing transaction hook before reporting after-commit failures", async () => {
    const transactionContext = createTestingTransactionContext();
    const logger = new MockTestLogger();
    const committed: string[] = [];

    resetCrocoTestingContext({ logger, transactionContext });

    await expect(
      transactionContext.runInTransaction(async () => {
        transactionContext.onAfterCommit(() => {
          committed.push("first");
          throw ProblemFactory.internalServerError(
            "testing/after-commit-hook-failed",
            "hook failed",
          );
        });
        transactionContext.onAfterCommit(() => {
          committed.push("second");
        });
      }),
    ).rejects.toMatchObject({
      code: "testing/after-commit-hooks-failed",
      detail: "1 testing afterCommit hook(s) failed after transaction commit",
      extensions: expect.objectContaining({
        committed: true,
        failureCount: 1,
      }),
    });

    expect(committed).toEqual(["first", "second"]);
    expect(logger.error).toHaveBeenCalledWith("AfterCommit hook failed:", {
      error: expect.objectContaining({
        code: "testing/after-commit-hook-failed",
      }),
    });
  });

  it("isolates testing transaction hooks between overlapping transactions", async () => {
    const transactionContext = createTestingTransactionContext();
    const firstRegistered = createDeferred();
    const secondRegistered = createDeferred();
    const firstComplete = createDeferred();
    const firstHooks: string[] = [];
    const secondHooks: string[] = [];
    let secondBodyComplete = false;

    const first = transactionContext
      .runInTransaction(async () => {
        transactionContext.onAfterCommit(() => {
          firstHooks.push("first-1");
        });
        firstRegistered.resolve();

        await secondRegistered.promise;
        transactionContext.onAfterCommit(() => {
          firstHooks.push("first-2");
        });
      })
      .finally(firstComplete.resolve);

    const second = transactionContext.runInTransaction(async () => {
      await firstRegistered.promise;
      transactionContext.onAfterCommit(() => {
        secondHooks.push(secondBodyComplete ? "second-1" : "second-1-before-complete");
      });
      secondRegistered.resolve();

      await firstComplete.promise;
      secondBodyComplete = true;
      transactionContext.onAfterCommit(() => {
        secondHooks.push(secondBodyComplete ? "second-2" : "second-2-before-complete");
      });
    });

    await Promise.all([first, second]);

    expect(firstHooks).toEqual(["first-1", "first-2"]);
    expect(secondHooks).toEqual(["second-1", "second-2"]);
    expect(transactionContext.isInTransaction()).toBe(false);
  });

  it("dispatches decorated event handlers through an isolated in-memory event bus", async () => {
    class UserCreatedEvent extends DomainEvent {
      static eventName = "testing.user.created";

      constructor(readonly userId: string) {
        super();
      }
    }

    class CapturedEvents {
      readonly userIds: string[] = [];
    }

    @RegisterEventHandler(UserCreatedEvent)
    class CaptureUserCreatedHandler implements EventHandler<UserCreatedEvent> {
      constructor(private readonly capturedEvents: CapturedEvents) {}

      handle(event: UserCreatedEvent): void {
        this.capturedEvents.userIds.push(event.userId);
      }
    }

    const capturedEvents = new CapturedEvents();
    const harness = await createEventTestingHarness<UserCreatedEvent>({
      handlers: [CaptureUserCreatedHandler],
      providers: [
        { token: CapturedEvents, useValue: capturedEvents },
        {
          token: CaptureUserCreatedHandler,
          useValue: new CaptureUserCreatedHandler(capturedEvents),
        },
      ],
      transactionContext: { inTransaction: true },
    });

    await harness.dispatch(new UserCreatedEvent("user-1"));
    harness.publishAfterCommit(new UserCreatedEvent("user-2"));

    expect(capturedEvents.userIds).toEqual(["user-1"]);
    await harness.flushAfterCommitHooks();
    expect(capturedEvents.userIds).toEqual(["user-1", "user-2"]);
  });

  it("keeps graceful shutdown pending until handlers active before clear settle", async () => {
    vi.useFakeTimers();
    const started = createDeferred();
    const release = createDeferred();
    let controller: ReturnType<typeof createGracefulShutdownController> | undefined;

    class DeferredEvent extends DomainEvent {
      static eventName = "testing.deferred";
    }

    class DeferredHandler implements EventHandler<DeferredEvent> {
      async handle(): Promise<void> {
        started.resolve();
        await release.promise;
      }
    }

    try {
      const harness = await createEventTestingHarness<DeferredEvent>({
        inMemoryEventBus: { maxConcurrency: 1 },
        providers: [{ token: DeferredHandler, useValue: new DeferredHandler() }],
        subscriptions: [{ eventName: DeferredEvent.eventName, handlerClass: DeferredHandler }],
      });
      const eventBus = harness.eventBus as InMemoryEventBus<DeferredEvent>;
      const publishPromise = harness.publish(new DeferredEvent());
      await started.promise;

      harness.clear();
      expect(eventBus.getRunningHandlerCount()).toBe(1);

      controller = createGracefulShutdownController({
        eventBusDrainTimeoutMs: 1_000,
        isLambdaEnvironment: true,
      });
      let shutdownSettled = false;
      const shutdownPromise = controller.shutdown().then(() => {
        shutdownSettled = true;
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(shutdownSettled).toBe(false);

      release.resolve();
      await publishPromise;
      await vi.advanceTimersByTimeAsync(100);
      await shutdownPromise;

      expect(shutdownSettled).toBe(true);
      expect(eventBus.getRunningHandlerCount()).toBe(0);
    } finally {
      release.resolve();
      controller?.reset();
      EventBusConfig.setInstance(new EventBusConfig());
      vi.useRealTimers();
    }
  });

  it("captures telemetry spans without a real telemetry SDK exporter", async () => {
    const capture = installTestingTelemetryCapture();

    await capture.run(async () => {
      await withSpan(
        async () => {
          await Promise.resolve();
          recordEvent("testing.event", { ok: true });
          return "ok";
        },
        { name: "testing.operation" },
      );
    });

    expect(capture.spans).toHaveLength(1);
    expect(capture.spans[0]).toMatchObject({
      ended: true,
      events: [
        {
          attributes: { ok: true },
          name: "testing.event",
        },
      ],
      name: "testing.operation",
    });
  });

  it("isolates overlapping telemetry capture runs", async () => {
    const firstCapture = installTestingTelemetryCapture();
    const secondCapture = installTestingTelemetryCapture();
    const secondCaptureActive = createDeferred();
    const firstSpanRecorded = createDeferred();

    await Promise.all([
      firstCapture.run(async () => {
        await secondCaptureActive.promise;
        await withSpan(
          async () => {
            recordEvent("testing.capture", { capture: "first" });
          },
          { name: "testing.first" },
        );
        firstSpanRecorded.resolve();
      }),
      secondCapture.run(async () => {
        secondCaptureActive.resolve();
        await firstSpanRecorded.promise;
        await withSpan(
          async () => {
            recordEvent("testing.capture", { capture: "second" });
          },
          { name: "testing.second" },
        );
      }),
    ]);

    expect(firstCapture.spans.map((span) => span.name)).toEqual(["testing.first"]);
    expect(secondCapture.spans.map((span) => span.name)).toEqual(["testing.second"]);
    expect(firstCapture.spans[0]?.events).toEqual([
      { attributes: { capture: "first" }, name: "testing.capture" },
    ]);
    expect(secondCapture.spans[0]?.events).toEqual([
      { attributes: { capture: "second" }, name: "testing.capture" },
    ]);
  });

  describe("storage provider conformance", () => {
    it.each(
      createStorageProviderConformanceSuite({
        createProvider: () => new InMemoryStorageProvider("https://storage.example.com"),
        keyPrefix: "testing-conformance",
        metadata: {
          contentType: "required",
          customMetadata: "required",
        },
        providerName: "in-memory-storage",
        publicUrl: "https://storage.example.com/",
        signedUrl: "expires=",
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });

    it("supports unsupported metadata expectations and custom URL assertions", async () => {
      const signedUrlAssertion = vi.fn((url: string, context: { readonly key: string }) => {
        expect(url).toContain(context.key);
        expect(url).toContain("expires=");
      });
      const suite = createStorageProviderConformanceSuite({
        createProvider: () => new InMemoryStorageProvider("https://storage.example.com"),
        keyPrefix: "testing-custom-conformance",
        metadata: {
          contentType: "unsupported",
          customMetadata: "unsupported",
        },
        providerName: "custom in-memory storage",
        publicUrl: /storage\.example\.com/,
        signedUrl: signedUrlAssertion,
      });

      for (const testCase of suite.cases) {
        await testCase.run();
      }

      expect(signedUrlAssertion).toHaveBeenCalledTimes(1);
    });
  });

  describe("auth provider conformance", () => {
    it("creates executable auth provider conformance cases", async () => {
      const liveSmokeRun = vi.fn();
      let validWebhookHandled = false;
      const expectedUser = {
        id: "user_123",
        email: "user@example.com",
        roles: ["admin"],
        permissions: ["tenant:read"],
        metadata: {
          orgId: "org_123",
          tenantId: "tenant_123",
        },
      };
      const suite = createAuthProviderConformanceSuite({
        providerName: "testing-auth",
        secretSamples: ["super-secret"],
        auth: {
          expectedUser,
          authenticateValid: () => expectedUser,
          authenticateMissingCredentials: () => null,
          invalidCredentials: {
            allowNull: true,
            run: () => null,
          },
          malformedPayload: {
            code: "testing/provider-terminal",
            category: ProblemCategory.BadRequest,
            retryable: false,
            run: () => {
              throw new ConformanceProviderProblem("malformed token payload", false);
            },
          },
          upstreamFailure: {
            code: "testing/provider-retryable",
            category: ProblemCategory.InternalServerError,
            retryable: true,
            run: () => {
              throw new ConformanceProviderProblem("retryable outage token=[Redacted]", true);
            },
          },
        },
        webhooks: {
          processValid: () => {
            validWebhookHandled = true;
          },
          invalidSignature: {
            code: "testing/provider-terminal",
            category: ProblemCategory.BadRequest,
            retryable: false,
            run: () => {
              throw new ConformanceProviderProblem("invalid webhook signature", false);
            },
          },
          invalidPayload: {
            code: "testing/provider-terminal",
            category: ProblemCategory.BadRequest,
            retryable: false,
            run: () => {
              throw new ConformanceProviderProblem("invalid webhook payload", false);
            },
          },
        },
        readiness: {
          requiredEnv: ["AUTH_SECRET"],
          createMissingConfigHealth: () => ({
            status: "unhealthy",
            component: "testing-auth",
            message: "Missing AUTH_SECRET",
            details: {
              requiredEnv: ["AUTH_SECRET"],
              hasSecret: false,
            },
            lastChecked: new Date("2026-01-01T00:00:00Z").toISOString(),
          }),
          createReadyHealth: () => ({
            status: "healthy",
            component: "testing-auth",
            message: "Auth configuration is present",
            details: {
              requiredEnv: ["AUTH_SECRET"],
              hasSecret: true,
            },
            lastChecked: new Date("2026-01-01T00:00:00Z").toISOString(),
          }),
        },
        tenantMapping: {
          createEvidence: () => ({
            externalOrgId: "org_123",
            expectedTenantId: "tenant_123",
            resolvedTenantId: "tenant_123",
            unknownResolvedTenantId: null,
            userMetadata: expectedUser.metadata,
            expectedUserMetadata: {
              orgId: "org_123",
              tenantId: "tenant_123",
            },
          }),
        },
        liveSmoke: {
          requiredEnv: ["AUTH_LIVE_TOKEN"],
          isEnabled: () => false,
          run: liveSmokeRun,
        },
      });

      expect(suite.cases.map((testCase) => testCase.name)).toContain(
        "keeps live auth smoke optional and skipped unless explicitly env-gated",
      );

      for (const testCase of suite.cases) {
        await testCase.run();
      }

      expect(validWebhookHandled).toBe(true);
      expect(liveSmokeRun).not.toHaveBeenCalled();
    });

    it("fails when auth conformance evidence leaks secret samples", async () => {
      const suite = createAuthProviderConformanceSuite({
        providerName: "leaky-auth",
        secretSamples: ["super-secret"],
        auth: {
          expectedUser: {
            id: "user_123",
            roles: [],
            permissions: [],
          },
          authenticateValid: () => ({
            id: "user_123",
            roles: [],
            permissions: [],
          }),
          authenticateMissingCredentials: () => null,
          invalidCredentials: {
            allowNull: true,
            run: () => null,
          },
          malformedPayload: {
            code: "testing/provider-terminal",
            run: () => {
              throw new ConformanceProviderProblem("malformed payload", false);
            },
          },
          upstreamFailure: {
            code: "testing/provider-retryable",
            run: () => {
              throw new ConformanceProviderProblem("upstream leaked token=super-secret", true);
            },
          },
        },
        webhooks: {
          processValid: () => undefined,
          invalidSignature: {
            code: "testing/provider-terminal",
            run: () => {
              throw new ConformanceProviderProblem("invalid webhook signature", false);
            },
          },
        },
        readiness: {
          requiredEnv: ["AUTH_SECRET"],
          createMissingConfigHealth: () => ({
            status: "unhealthy",
            component: "leaky-auth",
            message: "Missing AUTH_SECRET",
            details: { requiredEnv: ["AUTH_SECRET"] },
            lastChecked: new Date("2026-01-01T00:00:00Z").toISOString(),
          }),
        },
      });
      const upstreamCase = suite.cases.find((testCase) =>
        testCase.name.includes("upstream auth failures"),
      );
      expect(upstreamCase).toBeDefined();
      if (!upstreamCase) {
        throw new ConformanceProviderProblem("missing upstream auth failures test case", false);
      }

      await expect(upstreamCase.run()).rejects.toThrow(
        "Conformance evidence must not leak secret sample 'super-secret'.",
      );
    });
  });

  describe("provider conformance matrix", () => {
    it("creates profile cases and a manifest for supported and optional capabilities", async () => {
      const suite = createProviderConformanceMatrixSuite({
        profiles: [
          {
            packageName: "@croco/storage-r2",
            providerName: "r2-storage",
            category: "storage",
            capabilities: [
              {
                name: "object roundtrip",
                required: true,
                supported: true,
                suite: "createStorageProviderConformanceSuite",
                methods: ["put", "get", "getStream", "delete", "exists"],
                evidence: ["packages/storage-r2/src/tests/R2StorageProvider.spec.ts"],
              },
              {
                name: "object listing",
                required: false,
                supported: false,
                methods: ["list"],
                reason: "StorageProvider does not expose list() in the public contract.",
              },
            ],
          },
          {
            packageName: "@croco/tasks-qstash",
            providerName: "qstash-task-runner",
            category: "tasks",
            capabilities: [
              {
                name: "task publishing",
                required: true,
                supported: true,
                suite: "createQStashTaskConformanceSuite",
                methods: ["execute"],
                evidence: ["packages/tasks-qstash/src/tests/QStashTaskRunner.spec.ts"],
              },
            ],
          },
          {
            packageName: "@croco/telemetry-sdk-node",
            providerName: "otel-node-sdk",
            category: "telemetry",
            capabilities: [
              {
                name: "shutdown flush",
                required: false,
                supported: false,
                methods: ["forceFlush"],
                reason:
                  "Telemetry SDK tests cover forceFlush directly until a telemetry provider suite exists.",
              },
            ],
          },
        ],
      });

      expect(suite.cases.map((testCase) => testCase.name)).toEqual([
        "provider conformance matrix: declares at least one provider profile",
        "@croco/storage-r2 storage provider profile: declares provider identity",
        "@croco/storage-r2: storage/object roundtrip (put, get, getStream, delete, exists): supported by createStorageProviderConformanceSuite",
        "@croco/storage-r2: storage/object listing (list): documents unsupported optional capability",
        "@croco/tasks-qstash tasks provider profile: declares provider identity",
        "@croco/tasks-qstash: tasks/task publishing (execute): supported by createQStashTaskConformanceSuite",
        "@croco/telemetry-sdk-node telemetry provider profile: declares provider identity",
        "@croco/telemetry-sdk-node: telemetry/shutdown flush (forceFlush): documents unsupported optional capability",
      ]);

      for (const testCase of suite.cases) {
        await testCase.run();
      }

      expect(suite.manifest).toEqual({
        version: "croco.provider-conformance.manifest.v1",
        profiles: [
          {
            packageName: "@croco/storage-r2",
            providerName: "r2-storage",
            category: "storage",
            capabilities: [
              {
                name: "object roundtrip",
                required: true,
                supported: true,
                methods: ["put", "get", "getStream", "delete", "exists"],
                suite: "createStorageProviderConformanceSuite",
                evidence: ["packages/storage-r2/src/tests/R2StorageProvider.spec.ts"],
              },
              {
                name: "object listing",
                required: false,
                supported: false,
                methods: ["list"],
                reason: "StorageProvider does not expose list() in the public contract.",
              },
            ],
          },
          {
            packageName: "@croco/tasks-qstash",
            providerName: "qstash-task-runner",
            category: "tasks",
            capabilities: [
              {
                name: "task publishing",
                required: true,
                supported: true,
                methods: ["execute"],
                suite: "createQStashTaskConformanceSuite",
                evidence: ["packages/tasks-qstash/src/tests/QStashTaskRunner.spec.ts"],
              },
            ],
          },
          {
            packageName: "@croco/telemetry-sdk-node",
            providerName: "otel-node-sdk",
            category: "telemetry",
            capabilities: [
              {
                name: "shutdown flush",
                required: false,
                supported: false,
                methods: ["forceFlush"],
                reason:
                  "Telemetry SDK tests cover forceFlush directly until a telemetry provider suite exists.",
              },
            ],
          },
        ],
      });
    });

    it("fails required unsupported capabilities with package, category, capability, and methods", async () => {
      const suite = createProviderConformanceMatrixSuite({
        profiles: [
          {
            packageName: "@croco/auth-clerk",
            providerName: "clerk-auth-provider",
            category: "auth",
            capabilities: [
              {
                name: "session verification",
                required: true,
                supported: false,
                methods: ["verifySession"],
                reason: "Auth conformance suite has not been wired into this provider.",
              },
            ],
          },
        ],
      });

      await expect(suite.cases[2]?.run()).rejects.toThrow(
        "@croco/auth-clerk must support required auth/session verification (verifySession): Auth conformance suite has not been wired into this provider.",
      );
    });

    it("requires supported capabilities to name contract methods and suites", async () => {
      const suite = createProviderConformanceMatrixSuite({
        profiles: [
          {
            packageName: "@croco/search-meilisearch",
            providerName: "meilisearch-provider",
            category: "search",
            capabilities: [
              {
                name: "document indexing",
                required: true,
                supported: true,
                suite: "",
                methods: [],
              },
            ],
          },
        ],
      });

      await expect(suite.cases[2]?.run()).rejects.toThrow(
        "@croco/search-meilisearch search/document indexing requires a conformance suite name.",
      );
    });

    it("requires optional unsupported capabilities to document the manifest reason", async () => {
      const suite = createProviderConformanceMatrixSuite({
        profiles: [
          {
            packageName: "@croco/cache-core",
            providerName: "cache-reference",
            category: "cache",
            capabilities: [
              {
                name: "tag invalidation",
                required: false,
                supported: false,
                methods: ["invalidateTag"],
                reason: "",
              },
            ],
          },
        ],
      });

      await expect(suite.cases[2]?.run()).rejects.toThrow(
        "@croco/cache-core must document why cache/tag invalidation is unsupported.",
      );
    });

    it("fails empty matrices instead of producing a silent zero-case suite", async () => {
      const suite = createProviderConformanceMatrixSuite({
        profiles: [],
      });

      await expect(suite.cases[0]?.run()).rejects.toThrow(
        "Provider conformance matrix requires at least one provider profile.",
      );
    });
  });

  describe("Drizzle provider conformance", () => {
    const supportedCheck = (name: string) => ({
      name,
      run: vi.fn(async () => undefined),
    });

    it("creates supported and explicitly unsupported capability cases", async () => {
      const schemaCheck = supportedCheck("verifies local table columns");
      const participationCheck = supportedCheck("uses the active transaction client");
      const rollbackCheck = supportedCheck("rolls back writes after transaction failure");
      const diagnosticsCheck = supportedCheck("redacts readiness details");
      const isolationCheck = supportedCheck("does not leak records across tenants");
      const notFoundCheck = supportedCheck("throws deterministic not-found Problem");

      const suite = createDrizzleProviderConformanceSuite({
        providerName: "drizzle-test-provider",
        schema: {
          supported: true,
          checks: [schemaCheck],
        },
        diagnostics: {
          supported: true,
          checks: [diagnosticsCheck],
        },
        transaction: {
          participation: {
            supported: true,
            checks: [participationCheck],
          },
          rollback: {
            supported: true,
            checks: [rollbackCheck],
          },
        },
        tenantIsolation: {
          supported: true,
          checks: [isolationCheck],
        },
        repositoryErrors: {
          notFound: {
            supported: true,
            checks: [notFoundCheck],
          },
          validation: {
            supported: false,
            reason: "The fixture exposes no user-input validation boundary.",
          },
          duplicate: {
            supported: false,
            reason: "The fixture has no unique business key.",
          },
          conflict: {
            supported: false,
            reason: "The fixture has no conflict-producing operation.",
          },
          retryableFailure: {
            supported: false,
            reason: "The fixture has no retryable upstream boundary.",
          },
        },
      });

      expect(suite.cases.map((testCase) => testCase.name)).toEqual([
        "drizzle-test-provider: schema and migration assumptions: verifies local table columns",
        "drizzle-test-provider: diagnostics and readiness redaction: redacts readiness details",
        "drizzle-test-provider: transaction participation: uses the active transaction client",
        "drizzle-test-provider: transaction rollback: rolls back writes after transaction failure",
        "drizzle-test-provider: tenant isolation: does not leak records across tenants",
        "drizzle-test-provider: not-found error semantics: throws deterministic not-found Problem",
        "drizzle-test-provider: documents unsupported validation error semantics",
        "drizzle-test-provider: documents unsupported duplicate error semantics",
        "drizzle-test-provider: documents unsupported conflict error semantics",
        "drizzle-test-provider: documents unsupported retryable failure semantics",
      ]);

      for (const testCase of suite.cases) {
        await testCase.run();
      }

      expect(schemaCheck.run).toHaveBeenCalledTimes(1);
      expect(diagnosticsCheck.run).toHaveBeenCalledTimes(1);
      expect(participationCheck.run).toHaveBeenCalledTimes(1);
      expect(rollbackCheck.run).toHaveBeenCalledTimes(1);
      expect(isolationCheck.run).toHaveBeenCalledTimes(1);
      expect(notFoundCheck.run).toHaveBeenCalledTimes(1);
    });

    it("requires unsupported capabilities to document a reason", async () => {
      const suite = createDrizzleProviderConformanceSuite({
        providerName: "drizzle-test-provider",
        schema: {
          supported: false,
          reason: "",
        },
        transaction: {
          participation: {
            supported: false,
            reason: "No transaction manager.",
          },
          rollback: {
            supported: false,
            reason: "No transaction manager.",
          },
        },
        tenantIsolation: {
          supported: false,
          reason: "No tenant contract.",
        },
        repositoryErrors: {
          notFound: {
            supported: false,
            reason: "No lookup contract.",
          },
          validation: {
            supported: false,
            reason: "No validation contract.",
          },
          duplicate: {
            supported: false,
            reason: "No duplicate contract.",
          },
          conflict: {
            supported: false,
            reason: "No conflict contract.",
          },
          retryableFailure: {
            supported: false,
            reason: "No retryable boundary.",
          },
        },
      });

      await expect(suite.cases[0]?.run()).rejects.toThrow(
        "drizzle-test-provider must document why schema and migration assumptions is unsupported.",
      );
    });

    it("asserts deterministic Croco Problem codes and categories", async () => {
      const problem = await assertDrizzleProblem(
        () =>
          Promise.reject(
            ProblemFactory.notFound("testing/drizzle-missing-row", "row was not found"),
          ),
        {
          category: ProblemCategory.NotFound,
          code: "testing/drizzle-missing-row",
          status: 404,
        },
      );

      expect(problem.code).toBe("testing/drizzle-missing-row");
    });
  });

  describe("failure drills", () => {
    function getFirstFailureDrillScenario(): FailureDrillScenario {
      const scenario = createFailureDrillCatalog()[0];
      if (!scenario) {
        throw ProblemFactory.internalServerError(
          "testing/failure-drill-fixture-missing",
          "Failure drill fixture was not initialized.",
        );
      }
      return scenario;
    }

    it("runs the deterministic no-credential failure drill catalog", async () => {
      const catalog = createFailureDrillCatalog();
      const report = await runFailureDrills(catalog);

      expect(catalog.map((scenario) => scenario.id)).toEqual([...FAILURE_DRILL_SCENARIO_IDS]);
      expect(report).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({
            problem: expect.objectContaining({
              code: "testing/provider-timeout",
            }),
            scenarioId: "provider-timeout",
          }),
          expect.objectContaining({
            problem: expect.objectContaining({
              code: "testing/quota-exceeded",
            }),
            scenarioId: "quota-exceeded",
          }),
        ]),
        status: "passed",
      });
      expect(report.results).toHaveLength(FAILURE_DRILL_SCENARIO_IDS.length);
    });

    it("rejects failure drills that lack Problem, telemetry, or audit evidence", async () => {
      const scenario = getFirstFailureDrillScenario();

      await expect(
        runFailureDrillScenario({
          ...scenario,
          run: () => ({
            evidence: [
              {
                kind: "telemetry",
                name: "failure_drill.provider_timeout.failed",
              },
              { kind: "audit", name: "failure_drill.provider_timeout.audit" },
            ],
            recoveryAction: scenario.expected.recoveryAction,
          }),
        }),
      ).rejects.toThrow("did not return a Problem");

      await expect(
        runFailureDrillScenario({
          ...scenario,
          run: () => ({
            evidence: [],
            problem: ProblemFactory.internalServerError(
              "testing/provider-timeout",
              "provider timeout",
            ),
            recoveryAction: scenario.expected.recoveryAction,
          }),
        }),
      ).rejects.toThrow("expected telemetry evidence");
    });

    it("supports app-backed scenario overrides with the same evidence contract", async () => {
      const catalog = createFailureDrillCatalog({
        "quota-exceeded": {
          expected: {
            evidence: {
              audit: "saas.metering.quota_rejected",
              telemetry: "saas.llm.quota_exceeded",
            },
            problem: {
              code: "llm-metering/quota-exceeded",
              status: 403,
              title: "Forbidden",
            },
            recoveryAction: "Reject the request and direct the tenant to reduce usage or upgrade.",
          },
          run: () => ({
            evidence: [
              { kind: "telemetry", name: "saas.llm.quota_exceeded" },
              { kind: "audit", name: "saas.metering.quota_rejected" },
            ],
            problem: ProblemFactory.forbidden("llm-metering/quota-exceeded", "LLM quota exceeded"),
            recoveryAction: "Reject the request and direct the tenant to reduce usage or upgrade.",
          }),
        },
      });
      const scenario = catalog.find((candidate) => candidate.id === "quota-exceeded");
      if (!scenario) {
        throw ProblemFactory.internalServerError(
          "testing/failure-drill-override-missing",
          "Failure drill override was not initialized.",
        );
      }

      const result = await runFailureDrillScenario(scenario);

      expect(result).toMatchObject({
        problem: { code: "llm-metering/quota-exceeded", status: 403 },
        recoveryAction: "Reject the request and direct the tenant to reduce usage or upgrade.",
        scenarioId: "quota-exceeded",
      });
    });
  });

  describe("LLM provider conformance", () => {
    const modelId = "conformance-model";
    const createModel = () =>
      new InMemoryLlmModel(modelId, {
        "croco conformance generate": "governed response",
        "croco conformance stream": "streaming governed response",
        "croco conformance object": '{"ok":true,"label":"croco"}',
        "croco conformance tool": 'lookup:{"topic":"croco"}',
      });

    it.each(
      createLlmProviderConformanceSuite({
        createFailingModel: () => new FailingLlmModel(modelId),
        createModel,
        modelId,
        providerName: "in-memory-llm",
        prompts: {
          generate: {
            prompt: "croco conformance generate",
            expectedText: "governed response",
          },
          stream: {
            prompt: "croco conformance stream",
            minimumChunks: 2,
          },
          object: {
            prompt: "croco conformance object",
            schema: { type: "object" },
            assertObject: (value) => {
              expect(value).toEqual({ ok: true, label: "croco" });
            },
          },
          tool: {
            prompt: "croco conformance tool",
            tools: [
              {
                name: "lookup",
                description: "Lookup a topic",
                parameters: {
                  type: "object",
                  properties: {
                    topic: { type: "string" },
                  },
                  required: ["topic"],
                },
              },
            ],
            assertToolResult: (result) => {
              expect(result.toolCalls).toEqual([
                {
                  name: "lookup",
                  arguments: { topic: "croco" },
                },
              ]);
            },
          },
          embed: {
            text: "croco embedding",
            expectedDimensions: 1536,
          },
          embedMany: {
            texts: ["croco one", "croco two"],
            expectedDimensions: 1536,
          },
        },
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  describe("billing provider conformance", () => {
    it.each(
      createBillingProviderConformanceSuite({
        providerName: "in-memory-billing",
        gateway: {
          createGateway: () => new InMemoryBillingGateway(),
          fixtures: {
            checkout: {
              billingAccountId: "tenant-conformance",
              email: "billing@example.com",
              productId: "product-pro",
              successUrl: "https://app.example.com/success",
            },
            portal: {
              billingAccountId: "tenant-conformance",
              email: "billing@example.com",
            },
            subscription: {
              externalSubscriptionId: "sub-conformance",
            },
          },
          assertions: {
            subscriptionLifecycle: ({ gateway }) => {
              expect(gateway.subscriptionOperations).toEqual([
                "cancel:sub-conformance",
                "resume:sub-conformance",
                "revoke:sub-conformance",
              ]);
            },
          },
          failureScenarios: [
            {
              name: "surfaces checkout failures as Croco Problems",
              createGateway: () => new FailingBillingGateway(),
              run: (gateway) =>
                gateway.createCheckout({
                  billingAccountId: "tenant-conformance",
                  email: "billing@example.com",
                  productId: "product-pro",
                  successUrl: "https://app.example.com/success",
                }),
              assertProblem: (problem) => {
                expect(problem.code).toBe("testing/billing-provider-failed");
              },
            },
          ],
        },
        webhook: {
          createHandler: () => new InMemoryBillingWebhookHandler(),
          fixtures: {
            subscription: {
              body: JSON.stringify({
                id: "evt-subscription",
                type: "subscription.created",
              }),
              headers: { "webhook-signature": "valid" },
              eventId: "evt-subscription",
            },
            order: {
              body: JSON.stringify({ id: "evt-order", type: "order.paid" }),
              headers: { "webhook-signature": "valid" },
              eventId: "evt-order",
            },
            invalidSignature: {
              body: JSON.stringify({
                id: "evt-invalid-signature",
                type: "subscription.created",
              }),
              headers: { "webhook-signature": "invalid" },
              eventId: "evt-invalid-signature",
            },
            invalidPayload: {
              body: JSON.stringify({ id: null, type: null }),
              headers: { "webhook-signature": "valid" },
              eventId: "evt-invalid-payload",
            },
          },
          assertions: {
            idempotency: (_results, { handler }) => {
              expect(handler.processedEventIds).toEqual(["evt-subscription"]);
            },
          },
        },
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  describe("serverless provider conformance", () => {
    it.each(
      createUpstashRedisRateLimitConformanceSuite({
        createMissingConfig: () => {
          throw new ConformanceProviderProblem("missing redis token=[Redacted]", false);
        },
        createStore: (scenario) => new FakeRateLimitStore(scenario),
        invalidPolicy: {
          algorithm: "sliding",
          limit: 2,
          name: "invalid",
          windowMs: 1_000,
        },
        liveSmoke: {
          isEnabled: () => false,
          requiredEnv: ["CROCO_LIVE_UPSTASH_REDIS", "UPSTASH_REDIS_REST_URL"],
        },
        policy: {
          algorithm: "fixed",
          limit: 2,
          name: "fixed",
          windowMs: 1_000,
        },
        providerName: "fake-upstash-ratelimit",
        secretSamples: ["super-secret-token"],
      }).cases,
    )("Upstash Redis rate-limit: $name", async ({ run }) => {
      await run();
    });

    it.each(
      createQStashTaskConformanceSuite({
        createMissingConfig: () => {
          throw new ConformanceProviderProblem("missing qstash token=[Redacted]", false);
        },
        createPublisher: (scenario) => {
          const publisher = new FakeQStashTaskPublisher(scenario);
          return {
            publisher,
            getPublishedMessages: () => publisher.published,
          };
        },
        liveSmoke: {
          isEnabled: () => false,
          requiredEnv: ["CROCO_LIVE_QSTASH", "UPSTASH_QSTASH_TOKEN"],
        },
        providerName: "fake-qstash-tasks",
        secretSamples: ["super-secret-token"],
      }).cases,
    )("QStash task: $name", async ({ run }) => {
      await run();
    });
  });
});
