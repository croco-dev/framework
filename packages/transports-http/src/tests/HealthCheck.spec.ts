import "reflect-metadata";
import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../libs/CrocoApp";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";

describe("HealthCheck", () => {
  let registry!: HealthCheckRegistry;

  beforeEach(() => {
    Container.reset();
    registry = new HealthCheckRegistry();
    Container.set(HealthCheckRegistry, registry);

    // Mock Logger and ErrorHandler for CrocoApp
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger;
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("GET /health", () => {
    it("should return 200 OK", async () => {
      const app = createApp({ controllers: [] });
      const response = await app.fetch(new Request("http://localhost/health"));

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ status: "ok" });
    });
  });

  describe("GET /health/live", () => {
    it("should return the standard liveness contract", async () => {
      registry.register("db", async () => ({ status: "down", error: "not ready" }));

      const app = createApp({ controllers: [] });
      const response = await app.fetch(new Request("http://localhost/health/live"));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ status: "ok" });
    });
  });

  describe("GET /health/ready", () => {
    it("should return the same readiness contract as /ready", async () => {
      registry.register("db", async () => ({ status: "up", latency: 10 }));

      const app = createApp({ controllers: [] });
      const response = await app.fetch(new Request("http://localhost/health/ready"));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "ok",
        checks: {
          db: { status: "up", latency: 10 },
        },
      });
    });
  });

  describe("GET /ready", () => {
    it("should return 200 OK when no checks registered", async () => {
      const app = createApp({ controllers: [] });
      const response = await app.fetch(new Request("http://localhost/ready"));

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ status: "ok", checks: {} });
    });

    it("should return 200 OK when all checks pass", async () => {
      registry.register("db", async () => ({ status: "up", latency: 10 }));

      const app = createApp({ controllers: [] });
      const response = await app.fetch(new Request("http://localhost/ready"));

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: "ok",
        checks: {
          db: { status: "up", latency: 10 },
        },
      });
    });

    it("should preserve the health-core timeout path behind the HTTP readiness contract", async () => {
      vi.useFakeTimers();
      let didAbort = false;
      registry.register(
        "slow",
        async (signal?: AbortSignal) => {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 6000);
            const onAbort = () => {
              didAbort = true;
              clearTimeout(timer);
              resolve();
            };
            const onDone = () => {
              signal?.removeEventListener("abort", onAbort);
            };

            if (signal?.aborted) {
              onAbort();
              onDone();
              return;
            }

            signal?.addEventListener("abort", onAbort, { once: true });
            setTimeout(onDone, 6000);
          });

          return { status: "up" };
        },
        { timeout: 100 },
      );

      const app = createApp({ controllers: [] });
      const responsePromise = app.fetch(new Request("http://localhost/ready"));

      vi.advanceTimersByTime(100);
      const response = await responsePromise;

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        status: "error",
        checks: {
          slow: { status: "down", error: "timeout" },
        },
      });
      expect(didAbort).toBe(true);

      vi.useRealTimers();
    });

    it("should return 503 Service Unavailable when a check fails", async () => {
      registry.register("db", async () => {
        throw new Error("Connection failed");
      });

      const app = createApp({ controllers: [] });
      const response = await app.fetch(new Request("http://localhost/ready"));

      expect(response.status).toBe(503);
      const json = await response.json();
      expect(json.status).toBe("error");
      expect(json.checks.db.status).toBe("down");
      expect(json.checks.db.error).toBe("Connection failed");
    });

    it("should handle timeout", async () => {
      vi.useFakeTimers();
      let didAbort = false;
      registry.register("slow", async (signal?: AbortSignal) => {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 6000);
          const onAbort = () => {
            didAbort = true;
            clearTimeout(timer);
            resolve();
          };
          const onDone = () => {
            signal?.removeEventListener("abort", onAbort);
          };

          if (signal?.aborted) {
            onAbort();
            onDone();
            return;
          }

          signal?.addEventListener("abort", onAbort, { once: true });
          setTimeout(onDone, 6000);
        });

        return { status: "up" };
      });

      const app = createApp({ controllers: [] });
      const responsePromise = app.fetch(new Request("http://localhost/ready"));

      vi.advanceTimersByTime(6000);
      const response = await responsePromise;

      expect(response.status).toBe(503);
      const json = await response.json();
      expect(json.checks.slow.status).toBe("down");
      expect(json.checks.slow.error).toBe("timeout");
      expect(didAbort).toBe(true);

      vi.useRealTimers();
    });

    it("should fail fast when a health check name is registered twice", async () => {
      registry.register("db", async () => ({ status: "up", latency: 10 }));

      expect(() => {
        registry.register("db", async () => ({ status: "down" }));
      }).toThrow("Duplicate health check registration detected for 'db'");

      const app = createApp({ controllers: [] });
      const response = await app.fetch(new Request("http://localhost/ready"));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({
        status: "ok",
        checks: {
          db: { status: "up", latency: 10 },
        },
      });
    });
  });
});
