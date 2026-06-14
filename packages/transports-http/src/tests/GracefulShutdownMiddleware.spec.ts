import "reflect-metadata";

import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import {
  createGracefulShutdownController,
  getActiveRequestCount,
  gracefulShutdownMiddleware,
  isShuttingDown,
  resetShutdownState,
  setupGracefulShutdown,
} from "../libs/middleware/GracefulShutdownMiddleware";
import type { MiddlewareFunction } from "../libs/types";

function createContext(): Parameters<MiddlewareFunction>[0] {
  return {
    req: { method: "GET", path: "/test", headers: {}, url: "http://localhost/test" },
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

  describe("gracefulShutdownMiddleware", () => {
    it("should allow requests when not shutting down", async () => {
      const middleware = gracefulShutdownMiddleware();
      let nextCalled = false;

      const ctx = {
        req: { method: "GET", path: "/test", headers: {}, url: "http://localhost/test" },
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
        req: { method: "GET", path: "/test", headers: {}, url: "http://localhost/test" },
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
        req: { method: "GET", path: "/test", headers: {}, url: "http://localhost/test" },
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
        req: { method: "GET", path: "/test", headers: {}, url: "http://localhost/test" },
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
        req: { method: "GET", path: "/test", headers: {}, url: "http://localhost/test" },
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
      const firstApp = createGracefulShutdownController({ isLambdaEnvironment: true });
      const secondApp = createGracefulShutdownController({ isLambdaEnvironment: true });

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
        req: { method: "GET", path: "/test", headers: {}, url: "http://localhost/test" },
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
});
