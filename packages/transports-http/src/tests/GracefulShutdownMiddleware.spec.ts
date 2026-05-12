import "reflect-metadata";

import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import {
  getActiveRequestCount,
  gracefulShutdownMiddleware,
  isShuttingDown,
  resetShutdownState,
  setupGracefulShutdown,
} from "../libs/middleware/GracefulShutdownMiddleware";

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

    it("should keep active request state isolated per middleware instance", async () => {
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

      expect(secondRequestCount).toBe(1);
      expect(getActiveRequestCount()).toBe(0);
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
