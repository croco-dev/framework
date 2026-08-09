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

  describe("HealthCheckRegistry", () => {
    it("should expose the health-core aggregate contract", async () => {
      registry.register("db", async () => ({ status: "up", latency: 10 }));

      await expect(registry.check()).resolves.toEqual({
        status: "up",
        results: [
          {
            name: "db",
            status: "up",
            details: { latency: 10 },
          },
        ],
      });
    });

    it("should expose a separate readiness aggregate contract", async () => {
      registry.register("generic", async () => ({ status: "down" }));
      registry.registerReadiness("database", async () => ({ status: "up", latency: 10 }));

      await expect(registry.checkReadiness()).resolves.toEqual({
        status: "up",
        results: [
          {
            name: "database",
            status: "up",
            details: { latency: 10 },
          },
        ],
      });
      expect(registry.getRegisteredCheckCount()).toBe(1);
    });

    it("should enforce duplicate names within independent health and readiness namespaces", () => {
      registry.register("database", async () => ({ status: "up" }));
      registry.registerReadiness("database", async () => ({ status: "up" }));

      expect(() => registry.register("database", async () => ({ status: "up" }))).toThrow(
        "Duplicate health check registration detected for 'database'",
      );
      expect(() => registry.registerReadiness("database", async () => ({ status: "up" }))).toThrow(
        "Duplicate readiness check registration detected for 'database'",
      );
    });

    it("should keep readiness failures out of generic health results", async () => {
      registry.registerReadiness("database", async () => ({ status: "down" }));

      await expect(registry.check()).resolves.toEqual({ status: "up", results: [] });
      await expect(registry.checkReadiness()).resolves.toEqual({
        status: "down",
        results: [{ name: "database", status: "down" }],
      });
    });
  });

  describe("GET /health", () => {
    it("should return the healthy aggregate contract", async () => {
      registry.register("db", async () => ({ status: "up", latency: 10 }));

      const app = createApp({ controllers: [], securityValidation: "off" });
      const response = await app.fetch(new Request("http://localhost/health"));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "up",
        results: [{ name: "db", status: "up", details: { latency: 10 } }],
      });
    });

    it("should return 503 when a registered check fails", async () => {
      registry.register("db", async () => ({ status: "down", error: "unavailable" }));

      const app = createApp({ controllers: [], securityValidation: "off" });
      const response = await app.fetch(new Request("http://localhost/health"));

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        status: "down",
        results: [{ name: "db", status: "down", details: { error: "unavailable" } }],
      });
    });

    it("should return a stable timeout failure and abort the check", async () => {
      let didAbort = false;
      registry.register(
        "slow",
        (signal?: AbortSignal) =>
          new Promise((resolve) => {
            signal?.addEventListener(
              "abort",
              () => {
                didAbort = true;
                resolve({ status: "up" });
              },
              { once: true },
            );
          }),
        { timeout: 10 },
      );

      const app = createApp({ controllers: [], securityValidation: "off" });
      const response = await app.fetch(new Request("http://localhost/health"));

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        status: "down",
        results: [
          {
            name: "slow",
            status: "down",
            details: { error: "Health check timeout for slow" },
          },
        ],
      });
      expect(didAbort).toBe(true);
    });

    it("should bound and redact health check details", async () => {
      registry.register("database", async () => ({
        status: "down",
        error: "x".repeat(120),
        diagnostic: "d".repeat(120),
        samples: Array.from({ length: 60 }, (_, index) => index),
        apiToken: "secret-token",
        nested: { password: "hidden", safe: true },
        stack: "internal stack",
        cause: { authorization: "Bearer secret" },
      }));

      const app = createApp({ controllers: [], securityValidation: "off" });
      const response = await app.fetch(new Request("http://localhost/health"));

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        status: "down",
        results: [
          {
            name: "database",
            status: "down",
            details: {
              error: `${"x".repeat(97)}...`,
              diagnostic: `${"d".repeat(97)}...`,
              samples: Array.from({ length: 50 }, (_, index) => index),
              apiToken: "[Redacted]",
              nested: { password: "[Redacted]", safe: true },
            },
          },
        ],
      });
    });
  });

  describe("GET /health/live", () => {
    it("should return the standard liveness contract", async () => {
      registry.register("db", async () => ({ status: "down", error: "not ready" }));
      registry.registerReadiness("readiness", async () => ({ status: "down" }));

      const app = createApp({ controllers: [], securityValidation: "off" });
      const response = await app.fetch(new Request("http://localhost/health/live"));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ status: "ok" });
    });
  });

  describe("GET /health/ready", () => {
    it("should return the same readiness contract as /ready", async () => {
      registry.registerReadiness("db", async () => ({ status: "up", latency: 10 }));

      const app = createApp({ controllers: [], securityValidation: "off" });
      const response = await app.fetch(new Request("http://localhost/health/ready"));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "up",
        results: [
          {
            name: "db",
            status: "up",
            details: { latency: 10 },
          },
        ],
      });
    });
  });

  describe("GET /ready", () => {
    it("should return the empty readiness contract from both aliases", async () => {
      const app = createApp({ controllers: [], securityValidation: "off" });

      for (const path of ["/ready", "/health/ready"]) {
        const response = await app.fetch(new Request(`http://localhost${path}`));
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ status: "up", results: [] });
      }
    });

    it("should return 200 OK when no checks registered", async () => {
      const app = createApp({ controllers: [], securityValidation: "off" });
      const response = await app.fetch(new Request("http://localhost/ready"));

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ status: "up", results: [] });
    });

    it("should return 200 OK when all checks pass", async () => {
      registry.registerReadiness("db", async () => ({ status: "up", latency: 10 }));

      const app = createApp({ controllers: [], securityValidation: "off" });
      const response = await app.fetch(new Request("http://localhost/ready"));

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: "up",
        results: [
          {
            name: "db",
            status: "up",
            details: { latency: 10 },
          },
        ],
      });
    });

    it("should preserve the health-core timeout path behind the HTTP readiness contract", async () => {
      vi.useFakeTimers();
      let didAbort = false;
      registry.registerReadiness(
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

      const app = createApp({ controllers: [], securityValidation: "off" });
      const responsePromise = app.fetch(new Request("http://localhost/ready"));

      vi.advanceTimersByTime(100);
      const response = await responsePromise;

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        status: "down",
        results: [
          {
            name: "slow",
            status: "down",
            details: { error: "Health check timeout for slow" },
          },
        ],
      });
      expect(didAbort).toBe(true);

      vi.useRealTimers();
    });

    it("should return 503 Service Unavailable when a check fails", async () => {
      registry.registerReadiness("db", async () => {
        throw new Error("Connection failed");
      });

      const app = createApp({ controllers: [], securityValidation: "off" });
      const response = await app.fetch(new Request("http://localhost/ready"));

      expect(response.status).toBe(503);
      const json = await response.json();
      expect(json.status).toBe("down");
      expect(json.results[0].name).toBe("db");
      expect(json.results[0].status).toBe("down");
      expect(json.results[0].details.error).toBe("Connection failed");
    });

    it("should return sanitized thrown failures from both aliases", async () => {
      registry.registerReadiness("database", async () => {
        throw new Error("x".repeat(120));
      });
      const app = createApp({ controllers: [], securityValidation: "off" });

      for (const path of ["/ready", "/health/ready"]) {
        const response = await app.fetch(new Request(`http://localhost${path}`));
        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
          status: "down",
          results: [
            {
              name: "database",
              status: "down",
              details: { error: `${"x".repeat(97)}...` },
            },
          ],
        });
      }
    });

    it("should preserve timeout and abort behavior on both aliases", async () => {
      let abortCount = 0;
      registry.registerReadiness(
        "slow",
        (signal?: AbortSignal) =>
          new Promise((resolve) => {
            const timer = setTimeout(() => resolve({ status: "up" }), 1000);
            signal?.addEventListener(
              "abort",
              () => {
                abortCount += 1;
                clearTimeout(timer);
                resolve({ status: "up" });
              },
              { once: true },
            );
          }),
        { timeout: 10 },
      );
      const app = createApp({ controllers: [], securityValidation: "off" });

      for (const path of ["/ready", "/health/ready"]) {
        const response = await app.fetch(new Request(`http://localhost${path}`));
        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({
          status: "down",
          results: [
            {
              name: "slow",
              status: "down",
              details: { error: "Health check timeout for slow" },
            },
          ],
        });
      }
      expect(abortCount).toBe(2);
    });

    it("should handle timeout", async () => {
      vi.useFakeTimers();
      let didAbort = false;
      registry.registerReadiness("slow", async (signal?: AbortSignal) => {
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

      const app = createApp({ controllers: [], securityValidation: "off" });
      const responsePromise = app.fetch(new Request("http://localhost/ready"));

      vi.advanceTimersByTime(6000);
      const response = await responsePromise;

      expect(response.status).toBe(503);
      const json = await response.json();
      expect(json.results[0].name).toBe("slow");
      expect(json.results[0].status).toBe("down");
      expect(json.results[0].details.error).toBe("Health check timeout for slow");
      expect(didAbort).toBe(true);

      vi.useRealTimers();
    });

    it("should keep generic failures out of readiness", async () => {
      registry.register("generic", async () => ({ status: "down", error: "not ready" }));
      registry.registerReadiness("ready", async () => ({ status: "up" }));

      const app = createApp({ controllers: [], securityValidation: "off" });
      const response = await app.fetch(new Request("http://localhost/ready"));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "up",
        results: [{ name: "ready", status: "up" }],
      });
    });

    it("should sanitize readiness diagnostics at the HTTP boundary", async () => {
      registry.registerReadiness("database", async () => ({
        status: "down",
        error: "x".repeat(120),
        message: "m".repeat(120),
        apiToken: "secret-token",
        nested: { authorization: "Bearer secret", safe: true },
        stack: "internal stack",
        cause: { password: "hidden" },
      }));

      const app = createApp({ controllers: [], securityValidation: "off" });
      const response = await app.fetch(new Request("http://localhost/ready"));

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        status: "down",
        results: [
          {
            name: "database",
            status: "down",
            details: {
              error: `${"x".repeat(97)}...`,
              message: `${"m".repeat(97)}...`,
              apiToken: "[Redacted]",
              nested: { authorization: "[Redacted]", safe: true },
            },
          },
        ],
      });
    });

    it("should fail fast when a readiness check name is registered twice", async () => {
      registry.registerReadiness("db", async () => ({ status: "up", latency: 10 }));

      expect(() => {
        registry.registerReadiness("db", async () => ({ status: "down" }));
      }).toThrow("Duplicate readiness check registration detected for 'db'");

      const app = createApp({ controllers: [], securityValidation: "off" });
      const response = await app.fetch(new Request("http://localhost/ready"));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({
        status: "up",
        results: [
          {
            name: "db",
            status: "up",
            details: { latency: 10 },
          },
        ],
      });
    });
  });
});
