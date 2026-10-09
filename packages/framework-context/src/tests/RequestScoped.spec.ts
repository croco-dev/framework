import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Problem } from "@croco/problems-core";
import {
  Container,
  Context,
  GENERATED_DI_GRAPH_VERSION,
  Token,
  defineGeneratedDiGraph,
} from "../index";
import type { ILogger, RequestContext, RuntimeContext } from "../index";
import { trackRequestInstance } from "../libs/Context";
import { Component } from "./registerTestComponent";

describe("request scoped container behavior", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("should return same instance within same Context.run()", async () => {
    class RequestService {
      readonly id = Math.random();
    }

    Component({ scope: "request" })(RequestService);

    await Context.run({ requestId: "req-same-context" }, async () => {
      const instance1 = Container.get(RequestService);
      const instance2 = Container.get(RequestService);

      expect(instance1).toBe(instance2);
    });
  });

  it("should return different instances across different Context.run()", async () => {
    class RequestService {
      readonly id = Math.random();
    }

    Component({ scope: "request" })(RequestService);

    let firstRequestInstance!: RequestService;
    let secondRequestInstance!: RequestService;

    await Context.run({ requestId: "req-1" }, async () => {
      firstRequestInstance = Container.get(RequestService);
    });

    await Context.run({ requestId: "req-2" }, async () => {
      secondRequestInstance = Container.get(RequestService);
    });

    expect(firstRequestInstance).not.toBe(secondRequestInstance);
  });

  it("should preserve request scoped instance across async boundaries", async () => {
    class RequestService {
      readonly id = Math.random();
    }

    Component({ scope: "request" })(RequestService);

    await Context.run({ requestId: "req-async-boundary" }, async () => {
      const first = Container.get(RequestService);
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const second = Container.get(RequestService);

      expect(first).toBe(second);
    });
  });
});

function installRequestDisposables(disposals: readonly (() => void)[]): () => void {
  const tokens = disposals.map((_, index) => new Token<object>(`request.disposable.${index}`));
  Container.installGeneratedGraph(
    defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "test.request-cleanup-failure",
      compilerVersion: "test",
      inputHash: "input",
      roots: tokens,
      providers: tokens.map((token, index) => ({
        token,
        tokenId: `app:RequestDisposable${index}`,
        debugName: `RequestDisposable${index}`,
        scope: "request",
        dependencies: [],
        factory: () => ({ [Symbol.dispose]: disposals[index] }),
        sourceLocation: { file: "src/services.ts", line: 1, column: 1 },
      })),
    }),
  );
  return () => {
    for (const token of tokens) Container.get(token);
  };
}

function createLoggingRuntime(logger: ILogger): RuntimeContext {
  return {
    platform: "node",
    requestId: "cleanup-failure",
    logger,
    capabilities: {
      env: false,
      filesystem: false,
      logger: true,
      nodeApi: true,
      requestLifecycle: true,
      trace: false,
      waitUntil: false,
      flush: false,
      streamingResponse: false,
      deadline: false,
      abortSignal: false,
      shutdown: false,
    },
    waitUntil: () => undefined,
    flush: async () => undefined,
    shutdown: async () => undefined,
  };
}

function expectCleanupProblem(error: unknown, messages: readonly string[], cause?: Error): void {
  expect(error).toBeInstanceOf(Problem);
  if (!(error instanceof Problem)) throw new Error("Expected a cleanup Problem");
  expect(error.code).toBe("framework-context/request-scope-disposal-failed");
  expect(error.status).toBe(500);
  expect(error.cause).toBe(cause);
  const serialized = JSON.parse(JSON.stringify(error));
  expect(serialized.cleanupFailures).toEqual(
    messages.map((message) => expect.objectContaining({ message })),
  );
}

describe("request scope cleanup failure", () => {
  beforeEach(() => Container.reset());
  afterEach(() => {
    Container.reset();
    vi.restoreAllMocks();
  });

  for (const mode of ["sync", "async"] as const) {
    const run = (context: RequestContext, callback: () => string) =>
      Context.run(context, mode === "async" ? async () => callback() : callback);

    it(`reports a 500 cleanup Problem after a successful ${mode} callback`, async () => {
      const cleanupError = new Error("connection release failed");
      const dispose = vi.fn(() => {
        throw cleanupError;
      });
      const resolveProviders = installRequestDisposables([dispose]);
      let failure: unknown;
      try {
        await run({ requestId: "success" }, () => {
          resolveProviders();
          return "ok";
        });
      } catch (error) {
        failure = error;
      }
      expectCleanupProblem(failure, [cleanupError.message], cleanupError);
      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it.each(["inspector", "logger", "console"] as const)(
      `preserves a ${mode} primary failure and reports cleanup once through %s`,
      async (reporter) => {
        const cleanupError = new Error("connection release failed");
        const resolveProviders = installRequestDisposables([
          () => {
            throw cleanupError;
          },
        ]);
        const primary = new Error("handler failed");
        const recordEvent = vi.fn();
        const logger: ILogger = {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          fatal: vi.fn(),
          child: () => logger,
        };
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const context: RequestContext = {
          requestId: "failure",
          ...(reporter === "inspector" ? { runtimeInspector: { recordEvent } } : {}),
          ...(reporter !== "console" ? { runtime: createLoggingRuntime(logger) } : {}),
        };
        let failure: unknown;
        try {
          await run(context, () => {
            resolveProviders();
            throw primary;
          });
        } catch (error) {
          failure = error;
        }
        expect(failure).toBe(primary);
        expect(recordEvent).toHaveBeenCalledTimes(reporter === "inspector" ? 1 : 0);
        expect(logger.error).toHaveBeenCalledTimes(reporter === "logger" ? 1 : 0);
        expect(consoleError).toHaveBeenCalledTimes(reporter === "console" ? 1 : 0);
        const details =
          reporter === "inspector"
            ? recordEvent.mock.calls[0][0].details
            : reporter === "logger"
              ? vi.mocked(logger.error).mock.calls[0][1]
              : consoleError.mock.calls[0][1];
        expect(details.primaryError).toBe(primary);
        expectCleanupProblem(details.cleanupFailure, [cleanupError.message], cleanupError);
        if (reporter === "inspector") {
          expect(recordEvent).toHaveBeenCalledWith(
            expect.objectContaining({
              requestId: "failure",
              kind: "error",
              outcome: "failed",
              name: "request.cleanup",
            }),
          );
        }
      },
    );
  }

  it("disposes every provider in reverse order and retains the first Error as cause", () => {
    const firstError = new Error("first Error disposed");
    const laterError = new Error("later Error disposed");
    const order: number[] = [];
    const thrown = [laterError, firstError, "string cleanup failure", undefined];
    const disposals = thrown.map((value, index) =>
      vi.fn(() => {
        order.push(index);
        throw value;
      }),
    );
    const resolveProviders = installRequestDisposables(disposals);
    let failure: unknown;
    try {
      Context.run({ requestId: "multiple" }, resolveProviders);
    } catch (error) {
      failure = error;
    }
    expect(order).toEqual([3, 2, 1, 0]);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
    expectCleanupProblem(
      failure,
      ["undefined", "string cleanup failure", firstError.message, laterError.message],
      firstError,
    );
  });

  it("serializes non-Error cleanup failures without manufacturing a cause", () => {
    const resolveProviders = installRequestDisposables([
      () => {
        throw "string cleanup failure";
      },
    ]);
    let failure: unknown;
    try {
      Context.run({ requestId: "non-error" }, resolveProviders);
    } catch (error) {
      failure = error;
    }
    expectCleanupProblem(failure, ["string cleanup failure"]);
  });

  const nonCoercibleFailures = [
    { name: "null-prototype object", create: () => Object.create(null) },
    {
      name: "object with throwing primitive conversion",
      create: () => ({
        [Symbol.toPrimitive]() {
          throw new Error("primitive conversion failed");
        },
      }),
    },
  ];

  it.each(nonCoercibleFailures)(
    "reports cleanup as 500 for a $name after success",
    ({ create }) => {
      const resolveProviders = installRequestDisposables([
        () => {
          throw create();
        },
      ]);
      let failure: unknown;
      try {
        Context.run({ requestId: "non-coercible-success" }, resolveProviders);
      } catch (error) {
        failure = error;
      }
      expectCleanupProblem(failure, ["Non-Error object thrown during request provider cleanup."]);
    },
  );

  for (const mode of ["sync", "async"] as const) {
    it.each(nonCoercibleFailures)(
      `preserves ${mode} primary failure when cleanup throws a $name`,
      async ({ create }) => {
        const resolveProviders = installRequestDisposables([
          () => {
            throw create();
          },
        ]);
        const primary = new Error("handler failed");
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const callback = () => {
          resolveProviders();
          throw primary;
        };
        let failure: unknown;
        try {
          await Context.run(
            { requestId: "non-coercible-failure" },
            mode === "async" ? async () => callback() : callback,
          );
        } catch (error) {
          failure = error;
        }
        expect(failure).toBe(primary);
        expect(consoleError).toHaveBeenCalledTimes(1);
        const details = consoleError.mock.calls[0][1];
        expect(details.primaryError).toBe(primary);
        expectCleanupProblem(details.cleanupFailure, [
          "Non-Error object thrown during request provider cleanup.",
        ]);
      },
    );
  }
});

describe("disposed request scopes", () => {
  let created: number;
  let disposed: number;

  class RequestService {
    constructor() {
      created += 1;
    }

    [Symbol.dispose](): void {
      disposed += 1;
    }
  }

  class TransientService extends RequestService {}

  function createGate(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  }

  function expectDisposed(action: () => unknown): void {
    expect(action).toThrow(
      expect.objectContaining({ code: "framework-context/request-scope-disposed" }),
    );
  }

  beforeEach(() => {
    Container.reset();
    created = 0;
    disposed = 0;
    Container.installGeneratedGraph(
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "test.disposed-request-scope",
        compilerVersion: "test",
        inputHash: "input",
        roots: [RequestService, TransientService],
        providers: [
          {
            token: RequestService,
            tokenId: "test:RequestService",
            debugName: "RequestService",
            scope: "request",
            dependencies: [],
            factory: () => new RequestService(),
            sourceLocation: { file: "RequestScoped.spec.ts", line: 1, column: 1 },
          },
          {
            token: TransientService,
            tokenId: "test:TransientService",
            debugName: "TransientService",
            scope: "transient",
            dependencies: [],
            factory: () => new TransientService(),
            sourceLocation: { file: "RequestScoped.spec.ts", line: 1, column: 1 },
          },
        ],
      }),
    );
  });

  afterEach(() => Container.reset());

  it.each([true, false])(
    "rejects waitUntil resolution after disposal (previously resolved: %s)",
    async (resolveDuringRequest) => {
      const pending: Promise<unknown>[] = [];
      const gate = createGate();
      const runtime: RuntimeContext = {
        platform: "lambda",
        requestId: "req-wait-until",
        capabilities: {
          env: true,
          filesystem: true,
          logger: false,
          trace: false,
          waitUntil: true,
          flush: true,
          nodeApi: true,
          requestLifecycle: true,
          streamingResponse: false,
          deadline: true,
          abortSignal: false,
          shutdown: false,
        },
        waitUntil: (promise) => {
          pending.push(promise);
        },
        flush: async () => undefined,
        shutdown: async () => undefined,
      };

      await Context.run({ requestId: runtime.requestId, runtime }, async () => {
        if (resolveDuringRequest) {
          expect(Container.get(RequestService)).toBe(Container.get(RequestService));
        }
        runtime.waitUntil(
          gate.promise.then(() => {
            expectDisposed(() => Container.get(RequestService));
            expect(Context.getRequestId()).toBe(runtime.requestId);
          }),
        );
      });

      gate.resolve();
      await Promise.all(pending);
      expect({ created, disposed }).toEqual({
        created: resolveDuringRequest ? 1 : 0,
        disposed: resolveDuringRequest ? 1 : 0,
      });
    },
  );

  it("rejects legacy request resolution from a timer after synchronous completion", async () => {
    class LegacyService {
      constructor() {
        created += 1;
      }
    }
    Component({ scope: "request" })(LegacyService);
    let continuation!: Promise<void>;
    Context.run({ requestId: "req-timer" }, () => {
      Container.get(LegacyService);
      continuation = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          try {
            expectDisposed(() => Container.get(LegacyService));
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 0);
      });
    });
    await continuation;
    expect(created).toBe(1);
  });

  it("rejects transient resolution before invoking its factory after disposal", async () => {
    const gate = createGate();
    let continuation!: Promise<void>;
    Context.run({ requestId: "req-transient" }, () => {
      continuation = gate.promise.then(() => expectDisposed(() => Container.get(TransientService)));
    });
    gate.resolve();
    await continuation;
    expect({ created, disposed }).toEqual({ created: 0, disposed: 0 });
  });

  it("rejects direct instance tracking after disposal", async () => {
    const gate = createGate();
    let continuation!: Promise<void>;
    Context.run({ requestId: "req-track" }, () => {
      continuation = gate.promise.then(() => {
        expectDisposed(() =>
          trackRequestInstance({}, () => {
            disposed += 1;
          }),
        );
      });
    });
    gate.resolve();
    await continuation;
    expect(disposed).toBe(0);
  });

  it("shares the parent's disposal state with an inherited child", async () => {
    const gate = createGate();
    let child!: Promise<void> | void;
    await Context.run({ requestId: "req-parent" }, async () => {
      const parentInstance = Container.get(RequestService);
      child = Context.run(
        { requestId: "req-child" },
        async () => {
          expect(Container.get(RequestService)).toBe(parentInstance);
          await gate.promise;
          expectDisposed(() => Container.get(RequestService));
          expectDisposed(() => trackRequestInstance({}, () => undefined));
        },
        { inheritScope: true },
      );
      expect(disposed).toBe(0);
    });
    gate.resolve();
    await child;
    expect({ created, disposed }).toEqual({ created: 1, disposed: 1 });
  });

  it("closes the scope when the request rejects", async () => {
    const gate = createGate();
    const failure = new Error("request failed");
    let continuation!: Promise<void>;
    await expect(
      Context.run({ requestId: "req-failed" }, async () => {
        Container.get(RequestService);
        continuation = gate.promise.then(() => expectDisposed(() => Container.get(RequestService)));
        throw failure;
      }),
    ).rejects.toBe(failure);
    gate.resolve();
    await continuation;
    expect({ created, disposed }).toEqual({ created: 1, disposed: 1 });
  });

  it("rejects new resolutions and registrations during disposal", () => {
    Context.run({ requestId: "req-disposing" }, () => {
      trackRequestInstance({}, () => {
        expectDisposed(() => Container.get(RequestService));
        expectDisposed(() => trackRequestInstance({}, () => undefined));
      });
    });
    expect(created).toBe(0);
  });
});
