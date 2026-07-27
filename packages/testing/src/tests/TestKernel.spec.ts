import "reflect-metadata";
import { EventBusConfig } from "@croco/events-core";
import { Component, Container, Context, ShutdownManager, Token } from "@croco/framework-context";
import { Controller, Get } from "@croco/protocols-rest";
import {
  createApp,
  declareSecurityMiddlewareCapabilities,
  type MiddlewareFunction,
} from "@croco/transports-http";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestKernel,
  type TestKernel,
  TestKernelDisposalProblem,
  TestKernelDisposedProblem,
  type TestKernelOptions,
  TestKernelResourceFidelityProblem,
  TestKernelResourceNotFoundProblem,
  TestKernelValidationProblem,
  type TestResource,
} from "../index";

class KernelValueService {
  constructor(readonly value: string) {}
}

type FakeResourceConnection = {
  readonly identity: string;
};

const FAKE_RESOURCE_CONNECTION = new Token<FakeResourceConnection>(
  "testing.fake-resource-connection",
);

function fakeResource(
  id: string,
  mode: "rollback" | "commit" | "migration",
  lifecycle: string[] = [],
): TestResource<FakeResourceConnection> {
  const fidelity = {
    id,
    image: "example.invalid/resource@sha256:abc",
    isolation: "database-per-worker",
    kind: "fake",
    mode,
  } as const;

  return {
    fidelityHint: fidelity,
    id,
    async start(context) {
      lifecycle.push(`resource:${id}:start`);
      const connection = { identity: `${context.workerId}:${context.testId}` };
      context.register(FAKE_RESOURCE_CONNECTION, connection);
      return {
        connection,
        diagnostics: [
          {
            logs: [`started ${id}`],
            message: "resource is healthy",
            stage: "health-check",
            status: "passed",
          },
        ],
        dispose: () => {
          lifecycle.push(`resource:${id}:dispose`);
        },
        fidelity,
      };
    },
  };
}

class DecoratedKernelService {
  readonly identity = {};
}

@Controller("/kernel")
class KernelController {
  @Get("/value")
  value() {
    return {
      requestId: Context.getRequestId(),
      value: Container.get(KernelValueService).value,
    };
  }
}

@Controller("/decorated-kernel")
class DecoratedKernelController {
  constructor(readonly service: DecoratedKernelService) {}

  @Get("/identity")
  identity() {
    return { available: this.service.identity !== undefined };
  }
}

const productionSecurityMiddleware = declareSecurityMiddlewareCapabilities(
  (async (_ctx, next) => await next()) satisfies MiddlewareFunction,
  ["security-headers", "cors", "body-limit", "rate-limit"],
);

function bootstrapProductionApp(value: string) {
  const service = new KernelValueService(value);
  Container.set(KernelValueService, service);
  Container.set(KernelController, new KernelController());

  return createApp({
    controllers: [KernelController],
    diValidation: "enforce",
    middlewares: [productionSecurityMiddleware],
    securityValidation: "enforce",
  });
}

describe("TestKernel", () => {
  beforeEach(() => {
    Container.reset();
    ShutdownManager.reset();
    EventBusConfig.setInstance(new EventBusConfig());
  });

  it("makes application and adapter fidelity options mutually exclusive", () => {
    const bootstrap = () => bootstrapProductionApp("typed-options");
    const applicationOptions: TestKernelOptions = {
      bootstrap,
      fidelity: "application",
    };
    // @ts-expect-error Application fidelity exercises the production app path, not an adapter.
    const invalidOptions: TestKernelOptions = {
      adapter: "lambda",
      bootstrap,
      fidelity: "application",
    };

    expect(applicationOptions.fidelity).toBe("application");
    expect(invalidOptions.adapter).toBe("lambda");
  });

  it("boots the supplied production bootstrap and exposes structured fidelity evidence", async () => {
    let bootstrapCalls = 0;
    const kernel = await createTestKernel({
      bootstrap: () => {
        bootstrapCalls += 1;
        return bootstrapProductionApp("production");
      },
      fidelity: "application",
    });

    const response = await kernel.http.get("/kernel/value");

    expect(bootstrapCalls).toBe(1);
    expect(kernel.fidelity).toEqual({
      boot: "application",
      runtime: "node",
      validation: "production",
    });
    await expect(response.json()).resolves.toMatchObject({
      value: "production",
    });
    expect(kernel.evidence).toEqual([
      {
        fidelity: kernel.fidelity,
        method: "GET",
        path: "/kernel/value",
        status: 200,
      },
    ]);

    await kernel.dispose();
  });

  it("starts typed resources before bootstrap and disposes them after application shutdown once", async () => {
    const lifecycle: string[] = [];
    const resource = fakeResource("database", "commit", lifecycle);
    const kernel = await createTestKernel({
      bootstrap: () => {
        lifecycle.push(`bootstrap:${Container.get(FAKE_RESOURCE_CONNECTION).identity}`);
        ShutdownManager.getInstance().register({
          onShutdown: async () => {
            lifecycle.push("application:shutdown");
          },
        });
        return bootstrapProductionApp("resources");
      },
      dispose: () => {
        lifecycle.push("application:dispose");
      },
      fidelity: "application",
      resources: [resource],
      testId: "test-a",
      workerId: "worker-a",
    });

    expect(kernel.resource(resource)).toEqual({ identity: "worker-a:test-a" });
    expect(kernel.resourceEvidence).toEqual([
      {
        diagnostics: [
          {
            logs: ["started database"],
            message: "resource is healthy",
            stage: "health-check",
            status: "passed",
          },
        ],
        fidelity: {
          id: "database",
          image: "example.invalid/resource@sha256:abc",
          isolation: "database-per-worker",
          kind: "fake",
          mode: "commit",
        },
      },
    ]);

    const firstDisposal = kernel.dispose();
    const secondDisposal = kernel.dispose();
    expect(firstDisposal).toBe(secondDisposal);
    await firstDisposal;
    expect(lifecycle).toEqual([
      "resource:database:start",
      "bootstrap:worker-a:test-a",
      "application:shutdown",
      "application:dispose",
      "resource:database:dispose",
    ]);
  });

  it("rejects commit-semantic obligations in rollback mode before application bootstrap", async () => {
    const lifecycle: string[] = [];
    const resource = fakeResource("database", "rollback", lifecycle);
    let bootstrapCalls = 0;

    await expect(
      createTestKernel({
        bootstrap: () => {
          bootstrapCalls += 1;
          return bootstrapProductionApp("not-reached");
        },
        fidelity: "application",
        obligations: [{ kind: "outbox", resource }],
        resources: [resource],
      }),
    ).rejects.toBeInstanceOf(TestKernelResourceFidelityProblem);
    expect(bootstrapCalls).toBe(0);
    expect(lifecycle).toEqual([]);
  });

  it("requires resource obligations and lookups to reference this kernel", async () => {
    const configured = fakeResource("configured", "commit");
    const missing = fakeResource("missing", "commit");

    await expect(
      createTestKernel({
        bootstrap: () => bootstrapProductionApp("missing-obligation"),
        fidelity: "application",
        obligations: [{ kind: "after-commit", resource: missing }],
        resources: [configured],
      }),
    ).rejects.toBeInstanceOf(TestKernelResourceNotFoundProblem);

    const kernel = await createTestKernel({
      bootstrap: () => bootstrapProductionApp("missing-lookup"),
      fidelity: "application",
      resources: [configured],
    });
    expect(() => kernel.resource(missing)).toThrow(TestKernelResourceNotFoundProblem);
    await kernel.dispose();
  });

  it("creates isolated singleton instances from component metadata registered before kernel boot", async () => {
    Reflect.defineMetadata("design:paramtypes", [], DecoratedKernelService);
    Reflect.defineMetadata(
      "design:paramtypes",
      [DecoratedKernelService],
      DecoratedKernelController,
    );
    Component({ scope: "singleton" })(DecoratedKernelService);
    Component({ scope: "singleton" })(DecoratedKernelController);

    const bootstrap = () =>
      createApp({
        controllers: [DecoratedKernelController as never],
        diValidation: "enforce",
        middlewares: [productionSecurityMiddleware],
        securityValidation: "enforce",
      });
    const [first, second] = await Promise.all([
      createTestKernel({ bootstrap, fidelity: "application" }),
      createTestKernel({ bootstrap, fidelity: "application" }),
    ]);

    const [firstResponse, secondResponse] = await Promise.all([
      first.http.get("/decorated-kernel/identity"),
      second.http.get("/decorated-kernel/identity"),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(first.get(DecoratedKernelService)).not.toBe(second.get(DecoratedKernelService));

    await Promise.all([first.dispose(), second.dispose()]);
  });

  it.each(["node", "lambda"] as const)(
    "exercises the %s adapter lifecycle without opening a network port",
    async (adapter) => {
      const kernel = await createTestKernel({
        adapter,
        bootstrap: () => bootstrapProductionApp(adapter),
        fidelity: "adapter",
      });

      const response = await kernel.http.get("/kernel/value");

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ value: adapter });
      expect(kernel.fidelity.runtime).toBe(adapter);

      await kernel.dispose();
    },
  );

  it("isolates providers, events, transactions, request state, and evidence across concurrent kernels", async () => {
    const [first, second] = await Promise.all([
      createTestKernel({
        bootstrap: async () => {
          await Promise.resolve();
          return bootstrapProductionApp("first");
        },
        fidelity: "application",
      }),
      createTestKernel({
        bootstrap: async () => {
          await Promise.resolve();
          return bootstrapProductionApp("second");
        },
        fidelity: "application",
      }),
    ]);

    const firstEvents = first.run(() => EventBusConfig.getInstance());
    const secondEvents = second.run(() => EventBusConfig.getInstance());
    first.run(() =>
      firstEvents.subscribe({
        eventName: "first",
        handlerClass: class First {
          handle(): void {}
        },
      }),
    );
    second.run(() =>
      secondEvents.subscribe({
        eventName: "second",
        handlerClass: class Second {
          handle(): void {}
        },
      }),
    );

    const [firstResponse, secondResponse] = await Promise.all([
      first.http.get("/kernel/value"),
      second.http.get("/kernel/value"),
    ]);
    const [firstBody, secondBody] = await Promise.all([
      firstResponse.json(),
      secondResponse.json(),
    ]);

    expect(first.get(KernelValueService).value).toBe("first");
    expect(second.get(KernelValueService).value).toBe("second");
    expect(firstEvents).not.toBe(secondEvents);
    expect([...firstEvents.getSubscriptions()].map((item) => item.eventName)).toEqual(["first"]);
    expect([...secondEvents.getSubscriptions()].map((item) => item.eventName)).toEqual(["second"]);
    expect(first.transactionContext).not.toBe(second.transactionContext);
    expect(firstBody).toMatchObject({ value: "first" });
    expect(secondBody).toMatchObject({ value: "second" });
    expect((firstBody as { requestId: string }).requestId).not.toBe(
      (secondBody as { requestId: string }).requestId,
    );
    expect(first.evidence).toHaveLength(1);
    expect(second.evidence).toHaveLength(1);

    await Promise.all([first.dispose(), second.dispose()]);
  });

  it("fails application bootstrap when a controller registration is missing", async () => {
    await expect(
      createTestKernel({
        bootstrap: () =>
          createApp({
            controllers: [KernelController],
            diValidation: "enforce",
            middlewares: [productionSecurityMiddleware],
            securityValidation: "enforce",
          }),
        fidelity: "application",
      }),
    ).rejects.toThrow("Provider KernelController is not registered");
  });

  it("fails application bootstrap for an invalid singleton-to-request scope", async () => {
    class RequestDependency {}
    class InvalidSingleton {
      constructor(readonly dependency: RequestDependency) {}
    }

    Reflect.defineMetadata("design:paramtypes", [], RequestDependency);
    Reflect.defineMetadata("design:paramtypes", [RequestDependency], InvalidSingleton);

    await expect(
      createTestKernel({
        bootstrap: () => {
          Component({ scope: "request" })(RequestDependency);
          Component({ scope: "singleton" })(InvalidSingleton);
          Container.set(KernelValueService, new KernelValueService("invalid-scope"));
          Container.set(KernelController, new KernelController());
          return createApp({
            controllers: [KernelController],
            diValidation: "enforce",
            middlewares: [productionSecurityMiddleware],
            securityValidation: "enforce",
          });
        },
        fidelity: "application",
      }),
    ).rejects.toThrow("cannot depend on request-scoped");
  });

  it("fails application bootstrap when production security validation fails", async () => {
    await expect(
      createTestKernel({
        bootstrap: () => {
          Container.set(KernelValueService, new KernelValueService("security"));
          Container.set(KernelController, new KernelController());
          return createApp({
            controllers: [KernelController],
            diValidation: "enforce",
            middlewares: [],
            securityValidation: "enforce",
          });
        },
        fidelity: "application",
      }),
    ).rejects.toThrow("Missing required security middleware");
  });

  it("requires lower validation fidelity to be explicit", async () => {
    let cleanupCalls = 0;

    await expect(
      createTestKernel({
        bootstrap: () => ({
          app: createApp({
            controllers: [],
            diValidation: "off",
            securityValidation: "off",
          }),
          dispose: () => {
            cleanupCalls += 1;
          },
        }),
        fidelity: "application",
      }),
    ).rejects.toBeInstanceOf(TestKernelValidationProblem);
    expect(cleanupCalls).toBe(1);

    const kernel = await createTestKernel({
      bootstrap: () =>
        createApp({
          controllers: [],
          diValidation: "off",
          securityValidation: "off",
        }),
      fidelity: "application",
      validation: { di: "off", security: "off" },
    });
    expect(kernel.fidelity.validation).toBe("overridden");
    await kernel.dispose();
  });

  it("runs registered cleanup when bootstrap fails before returning an app", async () => {
    let cleanupCalls = 0;

    await expect(
      createTestKernel({
        bootstrap: ({ onCleanup }) => {
          onCleanup(() => {
            cleanupCalls += 1;
          });
          throw new Error("bootstrap failed");
        },
        fidelity: "application",
      }),
    ).rejects.toThrow("bootstrap failed");
    expect(cleanupCalls).toBe(1);
  });

  it("preserves structured resource cleanup evidence when bootstrap also fails", async () => {
    let cleanupFailure!: TestKernelResourceFidelityProblem;
    const resource: TestResource<FakeResourceConnection> = {
      id: "cleanup-evidence",
      async start() {
        return {
          connection: { identity: "cleanup-evidence" },
          diagnostics: [],
          dispose: () => {
            throw cleanupFailure;
          },
          fidelity: {
            id: "cleanup-evidence",
            image: "example.invalid/resource@sha256:abc",
            isolation: "database-per-worker",
            kind: "fake",
            mode: "commit",
          },
        };
      },
    };
    cleanupFailure = new TestKernelResourceFidelityProblem(
      { kind: "outbox", resource },
      {
        id: resource.id,
        image: "example.invalid/resource@sha256:abc",
        isolation: "database-per-worker",
        kind: "fake",
        mode: "rollback",
      },
    );
    Object.assign(cleanupFailure.extensions ?? {}, {
      logs: ["container cleanup failed"],
      recovery: "stop the retained container",
      stage: "cleanup",
    });

    let thrown: unknown;
    try {
      await createTestKernel({
        bootstrap: () => {
          throw new Error("bootstrap failed");
        },
        fidelity: "application",
        resources: [resource],
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(TestKernelDisposalProblem);
    expect(thrown).toMatchObject({
      cause: { message: "bootstrap failed" },
      extensions: {
        failureCount: 1,
        failures: [
          expect.objectContaining({
            code: "testing/test-kernel-resource-fidelity",
            logs: ["container cleanup failed"],
            recovery: "stop the retained container",
            stage: "cleanup",
          }),
        ],
      },
    });
  });

  it("runs cleanup exactly once and surfaces cleanup failures", async () => {
    let cleanupCalls = 0;
    let fallbackCleanupCalls = 0;
    const kernel = await createTestKernel({
      bootstrap: () => ({
        app: bootstrapProductionApp("cleanup"),
        dispose: () => {
          cleanupCalls += 1;
          throw new Error("cleanup failed");
        },
      }),
      dispose: () => {
        fallbackCleanupCalls += 1;
      },
      fidelity: "application",
    });

    const firstDisposal = kernel.dispose();
    const secondDisposal = kernel.dispose();

    expect(firstDisposal).toBe(secondDisposal);
    await expect(firstDisposal).rejects.toBeInstanceOf(TestKernelDisposalProblem);
    await expect(secondDisposal).rejects.toBeInstanceOf(TestKernelDisposalProblem);
    expect(cleanupCalls).toBe(1);
    expect(fallbackCleanupCalls).toBe(1);
  });

  it("disposes through await using and rejects access after disposal starts", async () => {
    let kernelRef!: TestKernel;

    {
      await using kernel = await createTestKernel({
        bootstrap: () => bootstrapProductionApp("async-dispose"),
        fidelity: "application",
      });
      kernelRef = kernel;
      expect(kernel.get(KernelValueService).value).toBe("async-dispose");
    }

    expect(() => kernelRef.get(KernelValueService)).toThrow(TestKernelDisposedProblem);
    expect(() => kernelRef.http.get("/kernel/value")).toThrow(TestKernelDisposedProblem);
    expect(() => kernelRef.run(() => undefined)).toThrow(TestKernelDisposedProblem);
  });

  it("waits for in-flight kernel work before cleanup", async () => {
    let resumeOperation!: () => void;
    const resume = new Promise<void>((resolve) => {
      resumeOperation = resolve;
    });
    let cleanupCalls = 0;
    const kernel = await createTestKernel({
      bootstrap: () => bootstrapProductionApp("in-flight"),
      dispose: () => {
        cleanupCalls += 1;
      },
      fidelity: "application",
    });
    const operation = kernel.run(async () => {
      await resume;
      return Container.get(KernelValueService).value;
    });

    const disposal = kernel.dispose();
    await Promise.resolve();
    expect(cleanupCalls).toBe(0);

    resumeOperation();
    await expect(operation).resolves.toBe("in-flight");
    await disposal;
    expect(cleanupCalls).toBe(1);
  });

  it("isolates and executes production shutdown hooks for each kernel", async () => {
    let firstShutdowns = 0;
    let secondShutdowns = 0;
    const [first, second] = await Promise.all([
      createTestKernel({
        bootstrap: () => {
          ShutdownManager.getInstance().register({
            onShutdown: async () => {
              firstShutdowns += 1;
            },
          });
          return bootstrapProductionApp("first-shutdown");
        },
        fidelity: "application",
      }),
      createTestKernel({
        bootstrap: () => {
          ShutdownManager.getInstance().register({
            onShutdown: async () => {
              secondShutdowns += 1;
            },
          });
          return bootstrapProductionApp("second-shutdown");
        },
        fidelity: "application",
      }),
    ]);

    await first.dispose();
    expect(firstShutdowns).toBe(1);
    expect(secondShutdowns).toBe(0);

    await second.dispose();
    expect(firstShutdowns).toBe(1);
    expect(secondShutdowns).toBe(1);
  });

  it("surfaces production shutdown hook failures through disposal", async () => {
    const kernel = await createTestKernel({
      bootstrap: () => {
        ShutdownManager.getInstance().register({
          onShutdown: () => {
            throw new Error("shutdown failed");
          },
        });
        return bootstrapProductionApp("shutdown-failure");
      },
      fidelity: "application",
    });

    await expect(kernel.dispose()).rejects.toBeInstanceOf(TestKernelDisposalProblem);
  });
});
