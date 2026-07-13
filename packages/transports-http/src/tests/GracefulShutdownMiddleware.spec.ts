import "reflect-metadata";

import { EventBusConfig } from "@croco/events-core";
import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import {
  createGracefulShutdownController,
  type GracefulShutdownOptions,
  getActiveRequestCount,
  gracefulShutdownMiddleware,
  isShuttingDown,
  resetShutdownState,
  setupGracefulShutdown,
} from "../libs/middleware/GracefulShutdownMiddleware";
import {
  GracefulShutdownConfigurationProblem,
  GracefulShutdownTimeoutProblem,
} from "../libs/problems/GracefulShutdownProblems";
import type { MiddlewareFunction } from "../libs/types";

function deferred<T = void>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createContext(): Parameters<MiddlewareFunction>[0] {
  return {
    req: {
      method: "GET",
      path: "/test",
      headers: {},
      url: "http://localhost/test",
    },
    res: { status: 200, headers: {} },
    raw: { header: vi.fn(), json: () => new Response() },
    jsonResponse: vi.fn(
      (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    ),
  } as unknown as Parameters<MiddlewareFunction>[0];
}

describe("GracefulShutdownMiddleware", () => {
  beforeEach(() => {
    Container.reset();
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger;
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
    resetShutdownState();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetShutdownState();
  });

  describe("gracefulShutdownMiddleware", () => {
    it("should allow requests when not shutting down", async () => {
      const middleware = gracefulShutdownMiddleware();
      let nextCalled = false;

      const ctx = {
        req: {
          method: "GET",
          path: "/test",
          headers: {},
          url: "http://localhost/test",
        },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
      } as unknown as Parameters<typeof middleware>[0];

      await middleware(ctx, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it("should track active requests", async () => {
      const middleware = gracefulShutdownMiddleware();

      expect(getActiveRequestCount()).toBe(0);

      const ctx = {
        req: {
          method: "GET",
          path: "/test",
          headers: {},
          url: "http://localhost/test",
        },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
      } as unknown as Parameters<typeof middleware>[0];

      let requestCount = 0;

      await middleware(ctx, async () => {
        requestCount = getActiveRequestCount();
      });

      expect(requestCount).toBe(1);
      expect(getActiveRequestCount()).toBe(0);
    });

    it("should track shutdown state", async () => {
      resetShutdownState();
      const middleware = gracefulShutdownMiddleware();

      expect(isShuttingDown()).toBe(false);

      const ctx = {
        req: {
          method: "GET",
          path: "/test",
          headers: {},
          url: "http://localhost/test",
        },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
      } as unknown as Parameters<typeof middleware>[0];

      await middleware(ctx, async () => {});
      expect(getActiveRequestCount()).toBe(0);
    });

    it("should track concurrent active requests across legacy middleware wrappers", async () => {
      const firstMiddleware = gracefulShutdownMiddleware();
      const secondMiddleware = gracefulShutdownMiddleware();

      const ctx = {
        req: {
          method: "GET",
          path: "/test",
          headers: {},
          url: "http://localhost/test",
        },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
      } as unknown as Parameters<typeof firstMiddleware>[0];

      let secondRequestCount = 0;

      await firstMiddleware(ctx, async () => {
        await secondMiddleware(ctx, async () => {
          secondRequestCount = getActiveRequestCount();
        });
      });

      expect(secondRequestCount).toBe(2);
      expect(getActiveRequestCount()).toBe(0);
    });

    it("should aggregate active request count across middleware instances", async () => {
      resetShutdownState();
      const mw1 = gracefulShutdownMiddleware();
      gracefulShutdownMiddleware();

      const ctx = {
        req: {
          method: "GET",
          path: "/test",
          headers: {},
          url: "http://localhost/test",
        },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
      } as unknown as Parameters<typeof mw1>[0];

      let countDuring = 0;
      await mw1(ctx, async () => {
        countDuring = getActiveRequestCount();
      });

      expect(countDuring).toBe(1);
      expect(getActiveRequestCount()).toBe(0);
    });

    it("should report shutting down when any middleware instance is shutting down (aggregate)", async () => {
      resetShutdownState();
      const shutdown = setupGracefulShutdown();
      gracefulShutdownMiddleware();

      expect(isShuttingDown()).toBe(false);

      await shutdown();

      expect(isShuttingDown()).toBe(true);

      resetShutdownState();
      expect(isShuttingDown()).toBe(false);
    });

    it("should share shutdown state between legacy setup and middleware wrappers", async () => {
      const shutdown = setupGracefulShutdown();
      const middleware = gracefulShutdownMiddleware();

      await shutdown();

      const ctx = createContext();
      let nextCalled = false;

      await expect(
        middleware(ctx, async () => {
          nextCalled = true;
        }),
      ).rejects.toBeInstanceOf(Response);

      expect(nextCalled).toBe(false);
      expect(ctx.res.status).toBe(503);
      expect(ctx.raw.header).toHaveBeenCalledWith("Retry-After", "10");
      expect(ctx.raw.header).toHaveBeenCalledWith("Connection", "close");
    });

    it("should isolate shutdown rejection state per app controller", async () => {
      const firstApp = createGracefulShutdownController({
        isLambdaEnvironment: true,
      });
      const secondApp = createGracefulShutdownController({
        isLambdaEnvironment: true,
      });

      await firstApp.shutdown();

      expect(firstApp.isShuttingDown()).toBe(true);
      expect(secondApp.isShuttingDown()).toBe(false);
      expect(isShuttingDown()).toBe(true);

      const firstCtx = createContext();
      let firstNextCalled = false;

      await expect(
        firstApp.middleware(firstCtx, async () => {
          firstNextCalled = true;
        }),
      ).rejects.toBeInstanceOf(Response);

      expect(firstNextCalled).toBe(false);
      expect(firstCtx.res.status).toBe(503);

      const secondCtx = createContext();
      let secondNextCalled = false;

      await secondApp.middleware(secondCtx, async () => {
        secondNextCalled = true;
      });

      expect(secondNextCalled).toBe(true);
      expect(secondCtx.res.status).toBe(200);
    });

    it("should register app signal handlers without replacing another app handler", () => {
      const signal = "SIGUSR2";
      const listenerCount = process.listeners(signal).length;

      const firstApp = createGracefulShutdownController({
        signals: [signal],
        isLambdaEnvironment: false,
      });
      const secondApp = createGracefulShutdownController({
        signals: [signal],
        isLambdaEnvironment: false,
      });

      expect(process.listeners(signal)).toHaveLength(listenerCount + 2);

      firstApp.reset();
      expect(process.listeners(signal)).toHaveLength(listenerCount + 1);

      secondApp.reset();
      expect(process.listeners(signal)).toHaveLength(listenerCount);
    });
  });

  describe("state management", () => {
    it("should report shutdown state correctly", () => {
      resetShutdownState();
      expect(isShuttingDown()).toBe(false);
    });

    it("should reset state correctly", () => {
      const middleware = gracefulShutdownMiddleware();

      const ctx = {
        req: {
          method: "GET",
          path: "/test",
          headers: {},
          url: "http://localhost/test",
        },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
      } as unknown as Parameters<typeof middleware>[0];

      middleware(ctx, async () => {
        resetShutdownState();
      });

      expect(getActiveRequestCount()).toBe(0);
      expect(isShuttingDown()).toBe(false);
    });

    it("should preserve external signal listeners after shutdown", async () => {
      const externalListener = vi.fn();
      const signal = "SIGINT";

      process.on(signal, externalListener);

      gracefulShutdownMiddleware({
        signals: [signal],
        isLambdaEnvironment: false,
      });

      const shutdown = setupGracefulShutdown({ signals: [signal] });
      await shutdown();

      expect(process.listeners(signal)).toContain(externalListener);
      process.off(signal, externalListener);
    });

    it("should preserve external signal listeners when registering its own handlers", () => {
      const externalListener = vi.fn();
      const signal = "SIGTERM";

      process.on(signal, externalListener);

      gracefulShutdownMiddleware({
        signals: [signal],
        isLambdaEnvironment: false,
      });

      expect(process.listeners(signal)).toContain(externalListener);
      process.off(signal, externalListener);
      resetShutdownState();
    });
  });

  describe("bounded lifecycle", () => {
    it("should publish the shared lifecycle before re-entrant logger calls", async () => {
      let shutdown: (() => Promise<void>) | undefined;
      let reentrantPromise: Promise<void> | undefined;
      const logger = {
        debug: vi.fn(),
        info: vi.fn((message: string) => {
          if (message === "Graceful shutdown initiated") {
            reentrantPromise = shutdown?.();
          }
        }),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      } as unknown as Logger;
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        logger,
      });
      shutdown = controller.shutdown;

      const firstPromise = shutdown();

      await firstPromise;
      expect(reentrantPromise).toBe(firstPromise);
    });

    it("should keep concurrent callers joined through the custom hook", async () => {
      const hook = deferred();
      const onShutdown = vi.fn(() => hook.promise);
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        onShutdown,
      });

      const firstPromise = controller.shutdown();
      await vi.waitFor(() => expect(onShutdown).toHaveBeenCalledOnce());
      const secondPromise = controller.shutdown();

      expect(secondPromise).toBe(firstPromise);
      hook.resolve();
      await expect(Promise.all([firstPromise, secondPromise])).resolves.toEqual([
        undefined,
        undefined,
      ]);
      expect(onShutdown).toHaveBeenCalledOnce();
    });

    it("should complete active requests, event drain, hook, and finalization in order", async () => {
      vi.useFakeTimers();
      const signal = "SIGUSR2";
      const externalListener = vi.fn();
      const request = deferred();
      const hook = deferred();
      const onShutdown = vi.fn(() => hook.promise);
      let runningHandlerCount = 1;
      const getRunningHandlerCount = vi.fn(() => runningHandlerCount);
      vi.spyOn(EventBusConfig.getInstance(), "getEventBus").mockReturnValue({
        getRunningHandlerCount,
      } as never);
      process.on(signal, externalListener);
      const listenerCount = process.listeners(signal).length;
      const controller = createGracefulShutdownController({
        signals: [signal],
        isLambdaEnvironment: false,
        timeoutMs: 1000,
        onShutdown,
      });
      const requestPromise = controller.middleware(createContext(), () => request.promise);
      await Promise.resolve();

      const firstPromise = controller.shutdown();
      const secondPromise = controller.shutdown();
      let lifecycleSettled = false;
      void firstPromise.finally(() => {
        lifecycleSettled = true;
      });
      await vi.advanceTimersByTimeAsync(100);

      expect(secondPromise).toBe(firstPromise);
      expect(getRunningHandlerCount).not.toHaveBeenCalled();
      expect(onShutdown).not.toHaveBeenCalled();
      expect(lifecycleSettled).toBe(false);

      request.resolve();
      await requestPromise;
      await vi.advanceTimersByTimeAsync(100);

      expect(getRunningHandlerCount).toHaveBeenCalled();
      expect(onShutdown).not.toHaveBeenCalled();
      expect(lifecycleSettled).toBe(false);

      runningHandlerCount = 0;
      await vi.advanceTimersByTimeAsync(100);

      expect(onShutdown).toHaveBeenCalledOnce();
      expect(lifecycleSettled).toBe(false);
      expect(process.listeners(signal)).toHaveLength(listenerCount + 1);

      hook.resolve();
      await expect(Promise.all([firstPromise, secondPromise])).resolves.toEqual([
        undefined,
        undefined,
      ]);
      expect(process.listeners(signal)).toHaveLength(listenerCount);
      expect(process.listeners(signal)).toContain(externalListener);

      process.off(signal, externalListener);
    });

    it("should reject a pending active-request phase at the total deadline", async () => {
      vi.useFakeTimers();
      const request = deferred();
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        timeoutMs: 500,
      });
      const requestPromise = controller.middleware(createContext(), () => request.promise);
      await Promise.resolve();

      const shutdownPromise = controller.shutdown();
      const rejection = expect(shutdownPromise).rejects.toMatchObject({
        phase: "active-requests",
        timeoutMs: 500,
      });
      await vi.advanceTimersByTimeAsync(500);
      await rejection;

      request.resolve();
      await requestPromise;
    });

    it("should permit already-satisfied phases with a zero timeout", async () => {
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        timeoutMs: 0,
      });

      await expect(controller.shutdown()).resolves.toBeUndefined();
    });

    it("should reject a stuck event bus using its tighter phase cap", async () => {
      vi.useFakeTimers();
      vi.spyOn(EventBusConfig.getInstance(), "getEventBus").mockReturnValue({
        getRunningHandlerCount: () => 1,
      } as never);
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        timeoutMs: 1000,
        eventBusDrainTimeoutMs: 200,
      });

      const shutdownPromise = controller.shutdown();
      const rejection = expect(shutdownPromise).rejects.toMatchObject({
        phase: "event-bus",
        timeoutMs: 1000,
      });
      await vi.advanceTimersByTimeAsync(200);
      await rejection;
    });

    it("should abort and reject all joiners when the hook exhausts the remaining budget", async () => {
      vi.useFakeTimers();
      const hook = deferred();
      let hookSignal: AbortSignal | undefined;
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        timeoutMs: 300,
        onShutdown: (signal) => {
          hookSignal = signal;
          return hook.promise;
        },
      });

      const firstPromise = controller.shutdown();
      await vi.advanceTimersByTimeAsync(0);
      const secondPromise = controller.shutdown();
      const firstRejection = expect(firstPromise).rejects.toMatchObject({
        phase: "on-shutdown",
      });
      const secondRejection = expect(secondPromise).rejects.toMatchObject({
        phase: "on-shutdown",
      });
      await vi.advanceTimersByTimeAsync(300);
      await Promise.all([firstRejection, secondRejection]);

      expect(secondPromise).toBe(firstPromise);
      expect(hookSignal?.aborted).toBe(true);
    });

    it("should reject an asynchronous hook that resolves exactly at the total deadline", async () => {
      vi.useFakeTimers();
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        timeoutMs: 100,
        onShutdown: () => new Promise<void>((resolve) => setTimeout(resolve, 100)),
      });

      const shutdownPromise = controller.shutdown();
      const rejection = expect(shutdownPromise).rejects.toMatchObject({
        phase: "on-shutdown",
        timeoutMs: 100,
      });
      await vi.advanceTimersByTimeAsync(100);
      await rejection;
    });

    it("should allow an asynchronous hook that resolves before the total deadline", async () => {
      vi.useFakeTimers();
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        timeoutMs: 100,
        onShutdown: () => new Promise<void>((resolve) => setTimeout(resolve, 99)),
      });

      const shutdownPromise = controller.shutdown();
      await vi.advanceTimersByTimeAsync(99);
      await expect(shutdownPromise).resolves.toBeUndefined();
    });

    it("should not restart the total budget after active requests drain", async () => {
      vi.useFakeTimers();
      const request = deferred();
      const hook = deferred();
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        timeoutMs: 500,
        onShutdown: () => hook.promise,
      });
      const requestPromise = controller.middleware(createContext(), () => request.promise);
      await Promise.resolve();

      const shutdownPromise = controller.shutdown();
      const rejection = expect(shutdownPromise).rejects.toMatchObject({
        phase: "on-shutdown",
      });
      await vi.advanceTimersByTimeAsync(200);
      request.resolve();
      await vi.advanceTimersByTimeAsync(100);
      await requestPromise;
      await vi.advanceTimersByTimeAsync(199);
      expect(controller.isShuttingDown()).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      await rejection;
    });

    it("should propagate the same hook failure to every joiner", async () => {
      const failure = new Error("hook failed");
      const hook = deferred();
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        onShutdown: () => hook.promise,
      });

      const firstPromise = controller.shutdown();
      await Promise.resolve();
      const secondPromise = controller.shutdown();
      hook.reject(failure);

      await expect(firstPromise).rejects.toBe(failure);
      await expect(secondPromise).rejects.toBe(failure);
    });

    it("should observe repeated signal failures once and remove only its listener", async () => {
      vi.useFakeTimers();
      const signal = "SIGUSR2";
      const externalListener = vi.fn();
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      } as unknown as Logger;
      const hook = deferred();
      process.on(signal, externalListener);
      const controller = createGracefulShutdownController({
        signals: [signal],
        timeoutMs: 100,
        isLambdaEnvironment: false,
        logger,
        onShutdown: () => hook.promise,
      });

      process.emit(signal, signal);
      process.emit(signal, signal);
      const explicitPromise = controller.shutdown();
      const explicitRejection = expect(explicitPromise).rejects.toMatchObject({
        phase: "on-shutdown",
      });
      await vi.advanceTimersByTimeAsync(100);
      await explicitRejection;

      expect(logger.error).toHaveBeenCalledOnce();
      expect(logger.error).toHaveBeenCalledWith("Graceful shutdown failed", {
        error: expect.any(GracefulShutdownTimeoutProblem),
      });
      expect(logger.info).not.toHaveBeenCalledWith(
        "Graceful shutdown completed",
        expect.anything(),
      );
      expect(process.listeners(signal)).toContain(externalListener);
      process.off(signal, externalListener);
    });

    it("should contain a signal failure when the configured logger also throws", async () => {
      vi.useFakeTimers();
      const signal = "SIGUSR2";
      const shutdownFailure = new Error("shutdown failed");
      const loggingFailure = new Error("logging failed");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const listenerCount = process.listeners(signal).length;
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(() => {
          throw loggingFailure;
        }),
        child: vi.fn(),
      } as unknown as Logger;
      const controller = createGracefulShutdownController({
        signals: [signal],
        isLambdaEnvironment: false,
        logger,
        onShutdown: () => Promise.reject(shutdownFailure),
      });

      process.emit(signal, signal);
      const explicitPromise = controller.shutdown();
      await expect(explicitPromise).rejects.toBe(shutdownFailure);
      await vi.advanceTimersByTimeAsync(0);

      expect(logger.error).toHaveBeenCalledOnce();
      expect(consoleError).toHaveBeenCalledOnce();
      expect(consoleError).toHaveBeenCalledWith("Graceful shutdown failure logging failed", {
        error: shutdownFailure,
        loggingError: loggingFailure,
      });
      expect(process.listeners(signal)).toHaveLength(listenerCount);
    });

    it("should remove owned listeners when the initial logger call throws", async () => {
      const signal = "SIGUSR2";
      const externalListener = vi.fn();
      const failure = new Error("logger failed");
      const logger = {
        debug: vi.fn(),
        info: vi.fn(() => {
          throw failure;
        }),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      } as unknown as Logger;
      process.on(signal, externalListener);
      const listenerCount = process.listeners(signal).length;
      const controller = createGracefulShutdownController({
        signals: [signal],
        isLambdaEnvironment: false,
        logger,
      });

      expect(process.listeners(signal)).toHaveLength(listenerCount + 1);
      await expect(controller.shutdown()).rejects.toBe(failure);
      expect(process.listeners(signal)).toHaveLength(listenerCount);
      expect(process.listeners(signal)).toContain(externalListener);

      process.off(signal, externalListener);
    });

    it("should reject when the event-drain success logger throws", async () => {
      const signal = "SIGUSR2";
      const failure = new Error("event drain logging failed");
      const logger = {
        debug: vi.fn(),
        info: vi.fn((message: string) => {
          if (message === "Event bus drained successfully") {
            throw failure;
          }
        }),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      } as unknown as Logger;
      vi.spyOn(EventBusConfig.getInstance(), "getEventBus").mockReturnValue({
        getRunningHandlerCount: () => 0,
      } as never);
      const listenerCount = process.listeners(signal).length;
      const controller = createGracefulShutdownController({
        signals: [signal],
        isLambdaEnvironment: false,
        logger,
      });

      await expect(controller.shutdown()).rejects.toBe(failure);
      expect(logger.warn).not.toHaveBeenCalledWith("Event bus drain failed", expect.anything());
      expect(logger.info).not.toHaveBeenCalledWith(
        "Graceful shutdown completed",
        expect.anything(),
      );
      expect(process.listeners(signal)).toHaveLength(listenerCount);
    });

    it.each([
      ["unavailable", undefined, "event-bus-unavailable"],
      ["unsupported", {}, "running-count-unsupported"],
    ] as const)(
      "should warn and continue when the event bus is %s",
      async (_case, eventBus, reason) => {
        const logger = {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          child: vi.fn(),
        } as unknown as Logger;
        vi.spyOn(EventBusConfig.getInstance(), "getEventBus").mockReturnValue(eventBus as never);
        const controller = createGracefulShutdownController({
          isLambdaEnvironment: true,
          logger,
        });

        await expect(controller.shutdown()).resolves.toBeUndefined();
        expect(logger.warn).toHaveBeenCalledOnce();
        expect(logger.warn).toHaveBeenCalledWith("Event bus drain skipped", {
          reason,
        });
        expect(logger.info).toHaveBeenCalledWith("Graceful shutdown completed", expect.anything());
      },
    );

    it("should warn and continue when the event bus accessor throws", async () => {
      const failure = new Error("running count failed");
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      } as unknown as Logger;
      vi.spyOn(EventBusConfig.getInstance(), "getEventBus").mockReturnValue({
        getRunningHandlerCount: () => {
          throw failure;
        },
      } as never);
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        logger,
      });

      await expect(controller.shutdown()).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledOnce();
      expect(logger.warn).toHaveBeenCalledWith("Event bus drain failed", {
        error: failure,
      });
      expect(logger.info).toHaveBeenCalledWith("Graceful shutdown completed", expect.anything());
    });

    it("should reject and finalize when the event-drain skip logger throws", async () => {
      const signal = "SIGUSR2";
      const externalListener = vi.fn();
      const failure = new Error("event drain skip logging failed");
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(() => {
          throw failure;
        }),
        error: vi.fn(),
        child: vi.fn(),
      } as unknown as Logger;
      vi.spyOn(EventBusConfig.getInstance(), "getEventBus").mockReturnValue(undefined as never);
      process.on(signal, externalListener);
      const listenerCount = process.listeners(signal).length;
      const controller = createGracefulShutdownController({
        signals: [signal],
        isLambdaEnvironment: false,
        logger,
      });

      await expect(controller.shutdown()).rejects.toBe(failure);
      expect(logger.warn).toHaveBeenCalledOnce();
      expect(logger.info).not.toHaveBeenCalledWith(
        "Graceful shutdown completed",
        expect.anything(),
      );
      expect(process.listeners(signal)).toHaveLength(listenerCount);
      expect(process.listeners(signal)).toContain(externalListener);

      process.off(signal, externalListener);
    });

    it("should reject a synchronous hook that reaches the total deadline", async () => {
      vi.useFakeTimers();
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      } as unknown as Logger;
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        timeoutMs: 100,
        logger,
        onShutdown: () => {
          vi.advanceTimersByTime(100);
        },
      });

      await expect(controller.shutdown()).rejects.toMatchObject({
        phase: "on-shutdown",
        timeoutMs: 100,
      });
      expect(logger.info).not.toHaveBeenCalledWith(
        "Graceful shutdown completed",
        expect.anything(),
      );
    });

    it("should invoke and reject a synchronous hook with a zero timeout", async () => {
      const onShutdown = vi.fn();
      const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      } as unknown as Logger;
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        timeoutMs: 0,
        logger,
        onShutdown,
      });

      await expect(controller.shutdown()).rejects.toMatchObject({
        phase: "on-shutdown",
        timeoutMs: 0,
      });
      expect(onShutdown).toHaveBeenCalledOnce();
      expect(logger.info).not.toHaveBeenCalledWith(
        "Graceful shutdown completed",
        expect.anything(),
      );
    });

    it("should observe a late hook rejection after the total deadline has already expired", async () => {
      const hook = deferred();
      const unhandledRejection = vi.fn();
      process.on("unhandledRejection", unhandledRejection);
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        timeoutMs: 0,
        onShutdown: () => hook.promise,
      });

      try {
        await expect(controller.shutdown()).rejects.toMatchObject({
          phase: "on-shutdown",
          timeoutMs: 0,
        });
        hook.reject(new Error("late hook failure"));
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(unhandledRejection).not.toHaveBeenCalled();
      } finally {
        process.off("unhandledRejection", unhandledRejection);
      }
    });

    it("should reject a zero-timeout hook when the monotonic clock does not advance", async () => {
      vi.spyOn(performance, "now").mockReturnValue(100);
      const onShutdown = vi.fn();
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        timeoutMs: 0,
        onShutdown,
      });

      await expect(controller.shutdown()).rejects.toMatchObject({
        phase: "on-shutdown",
        timeoutMs: 0,
      });
      expect(onShutdown).toHaveBeenCalledOnce();
    });

    it("should remove every owned legacy signal handler after one signal starts shutdown", async () => {
      const firstSignal = "SIGUSR1";
      const secondSignal = "SIGUSR2";
      const firstExternalListener = vi.fn();
      const secondExternalListener = vi.fn();
      process.on(firstSignal, firstExternalListener);
      process.on(secondSignal, secondExternalListener);
      const firstListenerCount = process.listeners(firstSignal).length;
      const secondListenerCount = process.listeners(secondSignal).length;
      gracefulShutdownMiddleware({
        signals: [firstSignal],
        isLambdaEnvironment: false,
      });
      gracefulShutdownMiddleware({
        signals: [secondSignal],
        isLambdaEnvironment: false,
      });
      const shutdown = setupGracefulShutdown();

      expect(process.listeners(firstSignal)).toHaveLength(firstListenerCount + 1);
      expect(process.listeners(secondSignal)).toHaveLength(secondListenerCount + 1);
      process.emit(firstSignal, firstSignal);
      await shutdown();

      expect(process.listeners(firstSignal)).toHaveLength(firstListenerCount);
      expect(process.listeners(secondSignal)).toHaveLength(secondListenerCount);
      expect(process.listeners(firstSignal)).toContain(firstExternalListener);
      expect(process.listeners(secondSignal)).toContain(secondExternalListener);

      process.off(firstSignal, firstExternalListener);
      process.off(secondSignal, secondExternalListener);
    });

    it("should reject work that becomes idle exactly at the total deadline", async () => {
      vi.useFakeTimers();
      const request = deferred();
      const controller = createGracefulShutdownController({
        isLambdaEnvironment: true,
        timeoutMs: 100,
      });
      const requestPromise = controller.middleware(createContext(), () => request.promise);
      await Promise.resolve();
      setTimeout(request.resolve, 100);

      const shutdownPromise = controller.shutdown();
      const rejection = expect(shutdownPromise).rejects.toMatchObject({
        phase: "active-requests",
        timeoutMs: 100,
      });
      await vi.advanceTimersByTimeAsync(100);
      await rejection;
      await requestPromise;
    });

    it.each([
      ["timeoutMs", Number.NaN],
      ["timeoutMs", Number.POSITIVE_INFINITY],
      ["timeoutMs", Number.NEGATIVE_INFINITY],
      ["eventBusDrainTimeoutMs", Number.NaN],
      ["eventBusDrainTimeoutMs", Number.POSITIVE_INFINITY],
      ["eventBusDrainTimeoutMs", Number.NEGATIVE_INFINITY],
    ] as const)("should reject non-finite %s value %s before creating state", (option, value) => {
      const signal = "SIGUSR2";
      const listenerCount = process.listeners(signal).length;
      const options: GracefulShutdownOptions = {
        [option]: value,
        signals: [signal],
        isLambdaEnvironment: false,
      };

      for (const factory of [
        () => gracefulShutdownMiddleware(options),
        () => createGracefulShutdownController(options),
        () => setupGracefulShutdown(options),
      ]) {
        expect(factory).toThrowError(GracefulShutdownConfigurationProblem);
        expect(process.listeners(signal)).toHaveLength(listenerCount);
        expect(isShuttingDown()).toBe(false);
        expect(getActiveRequestCount()).toBe(0);
      }
    });
  });
});
