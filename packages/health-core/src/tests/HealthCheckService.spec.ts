import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HealthCheckService } from "../libs/HealthCheckService";
import {
  DuplicateHealthIndicatorProblem,
  InvalidHealthIndicatorIdProblem,
  InvalidHealthCheckTimeoutProblem,
  MAX_HEALTH_CHECK_TIMEOUT_MS,
} from "../libs/problems/HealthProblems";
import type {
  HealthIndicator,
  HealthIndicatorResult,
  ReadinessIndicator,
} from "../libs/HealthIndicator";

describe("HealthCheckService", () => {
  let service!: HealthCheckService;

  beforeEach(() => {
    service = new HealthCheckService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("timeout configuration", () => {
    const invalidTimeouts = [Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 0.5, 1.5, 2_147_483_648];

    it.each(invalidTimeouts)("rejects invalid default timeout %s at construction", (timeout) => {
      expect(() => new HealthCheckService({ timeout })).toThrow(InvalidHealthCheckTimeoutProblem);

      try {
        new HealthCheckService({ timeout });
      } catch (error) {
        expect(error).toMatchObject({
          code: "health-core/invalid-timeout",
          message: expect.stringContaining(String(timeout)),
        });
      }
    });

    it.each(invalidTimeouts)(
      "rejects invalid indicator timeout %s at registration",
      async (timeout) => {
        const indicator: HealthIndicator = {
          check: vi.fn().mockResolvedValue({ name: "db", status: "up" }),
        };

        expect(() => service.register(indicator, { timeout })).toThrow(
          InvalidHealthCheckTimeoutProblem,
        );
        expect(() =>
          service.registerReadiness({ ...indicator, isReady: indicator.check }, { timeout }),
        ).toThrow(InvalidHealthCheckTimeoutProblem);

        await expect(service.check()).resolves.toEqual({ status: "up", results: [] });
        await expect(service.checkReadiness()).resolves.toEqual({ status: "up", results: [] });
      },
    );

    it.each([1, MAX_HEALTH_CHECK_TIMEOUT_MS])(
      "preserves valid default timeout boundary %s",
      async (timeout) => {
        const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
        const boundaryService = new HealthCheckService({ timeout });
        boundaryService.register({
          check: vi.fn().mockResolvedValue({ name: "db", status: "up" }),
        });

        await expect(boundaryService.check()).resolves.toEqual({
          status: "up",
          results: [{ name: "db", status: "up" }],
        });
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), timeout);
      },
    );

    it.each([1, MAX_HEALTH_CHECK_TIMEOUT_MS])(
      "preserves valid indicator timeout boundary %s",
      async (timeout) => {
        const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
        service.register(
          { check: vi.fn().mockResolvedValue({ name: "db", status: "up" }) },
          { timeout },
        );

        await service.check();

        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), timeout);
      },
    );

    it("snapshots a validated indicator timeout before the caller mutates its options", async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
      const options = { timeout: 100 };
      service.register({ check: vi.fn().mockResolvedValue({ name: "db", status: "up" }) }, options);

      options.timeout = Number.POSITIVE_INFINITY;
      await service.check();

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
      expect(setTimeoutSpy).not.toHaveBeenCalledWith(
        expect.any(Function),
        Number.POSITIVE_INFINITY,
      );
    });
  });

  describe("indicator registration lifecycle", () => {
    it("uses an explicit health indicator id for successful and failed reports", async () => {
      service.register("database", {
        check: vi.fn().mockResolvedValue({ name: "minified-constructor-name", status: "up" }),
      });
      service.register("cache", {
        check: vi.fn().mockRejectedValue(new Error("unavailable")),
      });

      await expect(service.check()).resolves.toEqual({
        status: "down",
        results: [
          { name: "database", status: "up" },
          { name: "cache", status: "down", details: { error: "unavailable" } },
        ],
      });
    });

    it("uses an explicit readiness indicator id for reports", async () => {
      service.registerReadiness("database", {
        check: vi.fn().mockResolvedValue({ name: "ignored-health-name", status: "up" }),
        isReady: vi.fn().mockResolvedValue({ name: "ignored-readiness-name", status: "up" }),
      });

      await expect(service.checkReadiness()).resolves.toEqual({
        status: "up",
        results: [{ name: "database", status: "up" }],
      });
    });

    it.each(["health", "readiness"] as const)(
      "rejects a duplicate explicit id in the %s namespace without replacing the original",
      async (namespace) => {
        const original = {
          check: vi.fn().mockResolvedValue({ name: "original", status: "up" as const }),
        };
        const replacement = {
          check: vi.fn().mockResolvedValue({ name: "replacement", status: "down" as const }),
          isReady: vi.fn().mockResolvedValue({ name: "replacement", status: "down" as const }),
        };

        if (namespace === "health") {
          service.register("database", original);
          expect(() => service.register("database", replacement)).toThrow(
            DuplicateHealthIndicatorProblem,
          );
          await expect(service.check()).resolves.toEqual({
            status: "up",
            results: [{ name: "database", status: "up" }],
          });
        } else {
          service.registerReadiness("database", { ...original, isReady: original.check });
          expect(() => service.registerReadiness("database", replacement)).toThrow(
            DuplicateHealthIndicatorProblem,
          );
          await expect(service.checkReadiness()).resolves.toEqual({
            status: "up",
            results: [{ name: "database", status: "up" }],
          });
        }

        try {
          if (namespace === "health") {
            service.register("database", replacement);
          } else {
            service.registerReadiness("database", replacement);
          }
        } catch (error) {
          expect(error).toMatchObject({
            code: "health-core/duplicate-indicator-id",
            extensions: { namespace, indicatorId: "database", retryable: false },
          });
        }
      },
    );

    it("allows the same explicit id in separate health and readiness namespaces", async () => {
      service.register("database", {
        check: vi.fn().mockResolvedValue({ name: "health", status: "up" }),
      });
      service.registerReadiness("database", {
        check: vi.fn().mockResolvedValue({ name: "health", status: "up" }),
        isReady: vi.fn().mockResolvedValue({ name: "readiness", status: "up" }),
      });

      await expect(service.check()).resolves.toEqual({
        status: "up",
        results: [{ name: "database", status: "up" }],
      });
      await expect(service.checkReadiness()).resolves.toEqual({
        status: "up",
        results: [{ name: "database", status: "up" }],
      });
    });

    it.each(["", " ", " database", "database "])("rejects invalid explicit id %j", (id) => {
      expect(() =>
        service.register(id, {
          check: vi.fn().mockResolvedValue({ name: "database", status: "up" }),
        }),
      ).toThrow(InvalidHealthIndicatorIdProblem);
    });

    it("disposes only its registration and permits safe re-registration", async () => {
      const database = service.register("database", {
        check: vi.fn().mockResolvedValue({ name: "database", status: "up" }),
      });
      const cache = service.register("cache", {
        check: vi.fn().mockResolvedValue({ name: "cache", status: "up" }),
      });

      database.dispose();
      database.dispose();
      const replacement = service.register("database", {
        check: vi.fn().mockResolvedValue({ name: "replacement", status: "down" }),
      });
      database.dispose();

      await expect(service.check()).resolves.toEqual({
        status: "down",
        results: [
          { name: "cache", status: "up" },
          { name: "database", status: "down" },
        ],
      });

      cache.dispose();
      replacement.dispose();
      await expect(service.check()).resolves.toEqual({ status: "up", results: [] });
    });

    it("keeps an in-flight registration snapshot while excluding disposed indicators later", async () => {
      let resolveCheck!: (result: HealthIndicatorResult) => void;
      const registration = service.register("database", {
        check: vi.fn().mockImplementation(
          () =>
            new Promise<HealthIndicatorResult>((resolve) => {
              resolveCheck = resolve;
            }),
        ),
      });

      const inFlight = service.check();
      registration.dispose();
      resolveCheck({ name: "ignored", status: "up" });

      await expect(inFlight).resolves.toEqual({
        status: "up",
        results: [{ name: "database", status: "up" }],
      });
      await expect(service.check()).resolves.toEqual({ status: "up", results: [] });
    });

    it("keeps the deprecated convenience overload disposable without deduplicating inferred names", async () => {
      const first = service.register({
        check: vi.fn().mockResolvedValue({ name: "first", status: "up" }),
      });
      service.register({
        check: vi.fn().mockResolvedValue({ name: "second", status: "up" }),
      });

      first.dispose();

      await expect(service.check()).resolves.toEqual({
        status: "up",
        results: [{ name: "second", status: "up" }],
      });
    });
  });

  it("should return up status when all indicators are up", async () => {
    const indicator1: HealthIndicator = {
      check: vi.fn().mockResolvedValue({ name: "indicator1", status: "up" }),
    };
    const indicator2: HealthIndicator = {
      check: vi.fn().mockResolvedValue({ name: "indicator2", status: "up" }),
    };

    service.register(indicator1);
    service.register(indicator2);

    const result = await service.check();

    expect(result.status).toBe("up");
    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe("up");
    expect(result.results[1].status).toBe("up");
  });

  it("should return down status when any indicator is down", async () => {
    const indicator1: HealthIndicator = {
      check: vi.fn().mockResolvedValue({ name: "indicator1", status: "up" }),
    };
    const indicator2: HealthIndicator = {
      check: vi.fn().mockResolvedValue({
        name: "indicator2",
        status: "down",
        details: { error: "Connection failed", message: "Unable to connect to database" },
      }),
    };

    service.register(indicator1);
    service.register(indicator2);

    const result = await service.check();

    expect(result.status).toBe("down");
    expect(result.results).toHaveLength(2);
    expect(result.results[1].status).toBe("down");
    expect(result.results[1].details).toEqual({
      error: "Connection failed",
      message: "Unable to connect to database",
    });
  });

  it("should return down status when indicator throws error", async () => {
    const indicator: HealthIndicator = {
      check: vi.fn().mockRejectedValue(new Error("Connection timeout")),
    };

    service.register(indicator);

    const result = await service.check();

    expect(result.status).toBe("down");
    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe("down");
    expect(result.results[0].details?.error).toBe("Connection timeout");
    expect(result.results[0].details).toHaveProperty("error");
  });

  it("should return empty results when no indicators registered", async () => {
    const result = await service.check();

    expect(result.status).toBe("up");
    expect(result.results).toHaveLength(0);
  });

  it("should handle timeout for slow indicators", async () => {
    let didAbort = false;

    const slowIndicator: HealthIndicator = {
      check: vi.fn().mockImplementation(
        (signal?: AbortSignal) =>
          new Promise<HealthIndicatorResult>((resolve) => {
            signal?.addEventListener("abort", () => {
              didAbort = true;
            });

            setTimeout(() => resolve({ name: "slow", status: "up" }), 10000);
          }),
      ),
    };

    const fastService = new HealthCheckService({ timeout: 100 });
    fastService.register(slowIndicator);

    const result = await fastService.check();

    expect(result.status).toBe("down");
    expect(result.results[0].status).toBe("down");
    expect(result.results[0].details?.error).toContain("timeout");
    expect(didAbort).toBe(true);
  });

  it("should honor per-indicator timeout overrides", async () => {
    let didAbort = false;

    const slowIndicator: HealthIndicator = {
      name: "slow",
      check: vi.fn().mockImplementation(
        (signal?: AbortSignal) =>
          new Promise<HealthIndicatorResult>((resolve) => {
            signal?.addEventListener("abort", () => {
              didAbort = true;
            });

            setTimeout(() => resolve({ name: "slow", status: "up" }), 10000);
          }),
      ),
    };

    const serviceWithLongDefault = new HealthCheckService({ timeout: 5000 });
    serviceWithLongDefault.register(slowIndicator, { timeout: 100 });

    const result = await serviceWithLongDefault.check();

    expect(result.status).toBe("down");
    expect(result.results[0]).toEqual({
      name: "slow",
      status: "down",
      details: { error: "Health check timeout for slow" },
    });
    expect(didAbort).toBe(true);
  });

  it("should use default timeout of 5000ms", () => {
    const defaultService = new HealthCheckService();
    expect(defaultService).toBeInstanceOf(HealthCheckService);
  });

  it("should include indicator name in timeout error", async () => {
    class CustomIndicator implements HealthIndicator {
      async check(_signal?: AbortSignal): Promise<HealthIndicatorResult> {
        return new Promise((resolve) =>
          setTimeout(() => resolve({ name: "custom", status: "up" }), 10000),
        );
      }
    }

    const fastService = new HealthCheckService({ timeout: 100 });
    fastService.register(new CustomIndicator());

    const result = await fastService.check();

    expect(result.results[0].details?.error).toContain("CustomIndicator");
  });

  it("should support typed success details", async () => {
    const indicator: HealthIndicator = {
      check: vi.fn().mockResolvedValue({
        name: "database",
        status: "up",
        details: { latency: 15, connections: 5 },
      }),
    };

    service.register(indicator);

    const result = await service.check();

    expect(result.status).toBe("up");
    if (result.results[0].details && "latency" in result.results[0].details) {
      expect(result.results[0].details.latency).toBe(15);
      expect(result.results[0].details.connections).toBe(5);
    }
  });

  it("preserves nested details and diagnostic metadata from indicators", async () => {
    const indicator: HealthIndicator = {
      check: vi.fn().mockResolvedValue({
        name: "database",
        status: "up",
        message: "Primary is available",
        details: { connection: { pool: "primary", available: 4 } },
        lastChecked: "2026-08-28T01:02:03.000Z",
      }),
    };

    service.register(indicator);

    await expect(service.check()).resolves.toEqual({
      status: "up",
      results: [
        {
          name: "database",
          status: "up",
          message: "Primary is available",
          details: { connection: { pool: "primary", available: 4 } },
          lastChecked: "2026-08-28T01:02:03.000Z",
        },
      ],
    });
  });

  it("should support typed error details with code", async () => {
    const indicator: HealthIndicator = {
      check: vi.fn().mockResolvedValue({
        name: "api",
        status: "down",
        details: { error: "Service unavailable", code: "503", message: "API rate limit exceeded" },
      }),
    };

    service.register(indicator);

    const result = await service.check();

    expect(result.status).toBe("down");
    expect(result.results[0].details?.error).toBe("Service unavailable");
    expect(result.results[0].details?.code).toBe("503");
    expect(result.results[0].details?.message).toBe("API rate limit exceeded");
  });

  it("should handle non-Error objects in error details", async () => {
    const indicator: HealthIndicator = {
      check: vi.fn().mockRejectedValue("String error message"),
    };

    service.register(indicator);

    const result = await service.check();

    expect(result.status).toBe("down");
    expect(result.results[0].details?.error).toBe("String error message");
  });

  it("should handle null error objects", async () => {
    const indicator: HealthIndicator = {
      check: vi.fn().mockRejectedValue(null),
    };

    service.register(indicator);

    const result = await service.check();

    expect(result.status).toBe("down");
    expect(result.results[0].details?.error).toBe("null");
  });

  it("should clear timeout when indicator completes quickly", async () => {
    const fastIndicator: HealthIndicator = {
      check: vi.fn().mockResolvedValue({
        name: "fast",
        status: "up",
        details: { responseTime: 1 },
      }),
    };

    const fastService = new HealthCheckService({ timeout: 5000 });
    fastService.register(fastIndicator);

    const result = await fastService.check();

    expect(result.status).toBe("up");
    expect(result.results[0].status).toBe("up");
  });

  describe("liveness", () => {
    it("should return true when process is alive", () => {
      const service = new HealthCheckService();
      expect(service.isLive()).toBe(true);
    });

    it("should always return true regardless of indicators", () => {
      const service = new HealthCheckService();
      const indicator: HealthIndicator = {
        check: vi.fn().mockRejectedValue(new Error("Failed")),
      };
      service.register(indicator);

      expect(service.isLive()).toBe(true);
    });
  });

  describe("readiness", () => {
    it("should return detailed up status when no readiness indicators are registered", async () => {
      await expect(service.checkReadiness()).resolves.toEqual({ status: "up", results: [] });
    });

    it("should return detailed readiness results", async () => {
      const database: ReadinessIndicator = {
        check: vi.fn().mockResolvedValue({ name: "database", status: "up" }),
        isReady: vi.fn().mockResolvedValue({
          name: "database",
          status: "up",
          details: { latency: 12 },
        }),
      };
      const cache: ReadinessIndicator = {
        check: vi.fn().mockResolvedValue({ name: "cache", status: "up" }),
        isReady: vi.fn().mockResolvedValue({
          name: "cache",
          status: "down",
          details: { error: "warming up" },
        }),
      };

      service.registerReadiness(database);
      service.registerReadiness(cache);

      await expect(service.checkReadiness()).resolves.toEqual({
        status: "down",
        results: [
          { name: "database", status: "up", details: { latency: 12 } },
          { name: "cache", status: "down", details: { error: "warming up" } },
        ],
      });
      expect(database.isReady).toHaveBeenCalledOnce();
      expect(cache.isReady).toHaveBeenCalledOnce();
    });

    it("should keep generic and readiness indicator results independent", async () => {
      service.register({
        check: vi.fn().mockResolvedValue({ name: "generic", status: "down" }),
      });
      service.registerReadiness({
        check: vi.fn().mockResolvedValue({ name: "readiness", status: "down" }),
        isReady: vi.fn().mockResolvedValue({ name: "readiness", status: "up" }),
      });

      await expect(service.check()).resolves.toEqual({
        status: "down",
        results: [{ name: "generic", status: "down" }],
      });
      await expect(service.checkReadiness()).resolves.toEqual({
        status: "up",
        results: [{ name: "readiness", status: "up" }],
      });
    });

    it("should return true when no readiness indicators registered", async () => {
      const service = new HealthCheckService();
      const isReady = await service.isReady();
      expect(isReady).toBe(true);
    });

    it("should return true when all readiness indicators are up", async () => {
      const service = new HealthCheckService();
      const readinessIndicator: ReadinessIndicator = {
        check: vi.fn().mockResolvedValue({ name: "db", status: "up" }),
        isReady: vi.fn().mockResolvedValue({ name: "db", status: "up" }),
      };

      service.registerReadiness(readinessIndicator);

      const isReady = await service.isReady();
      expect(isReady).toBe(true);
      expect(readinessIndicator.isReady).toHaveBeenCalled();
    });

    it("should return false when any readiness indicator is down", async () => {
      const service = new HealthCheckService();
      const readinessIndicator: ReadinessIndicator = {
        check: vi.fn().mockResolvedValue({ name: "db", status: "up" }),
        isReady: vi.fn().mockResolvedValue({
          name: "db",
          status: "down",
          details: { error: "Connection failed" },
        }),
      };

      service.registerReadiness(readinessIndicator);

      const isReady = await service.isReady();
      expect(isReady).toBe(false);
    });

    it("should return false when readiness indicator throws error", async () => {
      const service = new HealthCheckService();
      const readinessIndicator: ReadinessIndicator = {
        check: vi.fn().mockResolvedValue({ name: "db", status: "up" }),
        isReady: vi.fn().mockRejectedValue(new Error("Timeout")),
      };

      service.registerReadiness(readinessIndicator);

      const isReady = await service.isReady();
      expect(isReady).toBe(false);

      await expect(service.checkReadiness()).resolves.toEqual({
        status: "down",
        results: [
          {
            name: "Object",
            status: "down",
            details: { error: "Timeout" },
          },
        ],
      });
    });

    it("should handle multiple readiness indicators", async () => {
      const service = new HealthCheckService();
      const indicator1: ReadinessIndicator = {
        check: vi.fn().mockResolvedValue({ name: "db", status: "up" }),
        isReady: vi.fn().mockResolvedValue({ name: "db", status: "up" }),
      };
      const indicator2: ReadinessIndicator = {
        check: vi.fn().mockResolvedValue({ name: "redis", status: "up" }),
        isReady: vi.fn().mockResolvedValue({ name: "redis", status: "up" }),
      };

      service.registerReadiness(indicator1);
      service.registerReadiness(indicator2);

      const isReady = await service.isReady();
      expect(isReady).toBe(true);
      expect(indicator1.isReady).toHaveBeenCalled();
      expect(indicator2.isReady).toHaveBeenCalled();
    });

    it("should use timeout for readiness checks", async () => {
      const service = new HealthCheckService({ timeout: 100 });
      const slowIndicator: ReadinessIndicator = {
        check: vi.fn().mockResolvedValue({ name: "db", status: "up" }),
        isReady: vi
          .fn()
          .mockImplementation(
            () =>
              new Promise((resolve) =>
                setTimeout(() => resolve({ name: "db", status: "up" }), 10000),
              ),
          ),
      };

      service.registerReadiness(slowIndicator);

      const isReady = await service.isReady();
      expect(isReady).toBe(false);
    });

    it("should abort timed-out readiness indicators and preserve the detailed timeout", async () => {
      vi.useFakeTimers();
      let didAbort = false;
      const service = new HealthCheckService({ timeout: 100 });
      const slowIndicator: ReadinessIndicator = {
        name: "slow",
        check: vi.fn().mockResolvedValue({ name: "slow", status: "up" }),
        isReady: vi.fn().mockImplementation(
          (signal?: AbortSignal) =>
            new Promise<HealthIndicatorResult>((resolve) => {
              signal?.addEventListener("abort", () => {
                didAbort = true;
              });
              setTimeout(() => resolve({ name: "slow", status: "up" }), 10000);
            }),
        ),
      };
      service.registerReadiness(slowIndicator);

      const resultPromise = service.checkReadiness();
      await vi.advanceTimersByTimeAsync(100);

      await expect(resultPromise).resolves.toEqual({
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
  });
});
