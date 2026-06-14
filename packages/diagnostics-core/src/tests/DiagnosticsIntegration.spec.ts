import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticsCollector } from "../libs/DiagnosticsCollector";
import { DuplicateDiagnosticsProviderProblem } from "../libs/problems/DiagnosticsProblems";
import type { DiagnosticsProvider, HealthStatus, ErrorRecord } from "../libs/types";

class MockDiagnosticsProvider implements DiagnosticsProvider {
  readonly name: string;
  #healthStatus: HealthStatus;
  #shouldThrow = false;

  constructor(name: string, healthStatus: HealthStatus) {
    this.name = name;
    this.#healthStatus = healthStatus;
  }

  setHealth(status: HealthStatus): void {
    this.#healthStatus = status;
  }

  setThrow(shouldThrow: boolean): void {
    this.#shouldThrow = shouldThrow;
  }

  async getHealth(): Promise<HealthStatus> {
    if (this.#shouldThrow) {
      throw new Error("Provider health check failed");
    }
    return this.#healthStatus;
  }
}

function makeErrorRecord(overrides: Partial<ErrorRecord> = {}): ErrorRecord {
  return {
    timestamp: new Date().toISOString(),
    component: overrides.component ?? "test-component",
    code: overrides.code ?? "ERR_TEST",
    message: overrides.message ?? "Test error",
    ...overrides,
  };
}

describe("DiagnosticsCollector Integration", () => {
  let collector!: DiagnosticsCollector;

  beforeEach(() => {
    collector = new DiagnosticsCollector();
  });

  it("should return report with summary when no providers registered", async () => {
    const report = await collector.getReport();

    expect(report.summary).toBe("all_healthy");
    expect(report.components).toHaveLength(0);
    expect(report.recentErrors).toHaveLength(0);
    expect(report.timestamp).toBeDefined();
  });

  it("should collect health from all registered providers", async () => {
    const provider1 = new MockDiagnosticsProvider("db", {
      status: "healthy",
      component: "db",
      lastChecked: new Date().toISOString(),
    });
    const provider2 = new MockDiagnosticsProvider("cache", {
      status: "healthy",
      component: "cache",
      lastChecked: new Date().toISOString(),
    });

    collector.registerProvider(provider1);
    collector.registerProvider(provider2);

    const report = await collector.getReport();

    expect(report.components).toHaveLength(2);
    expect(report.components[0].component).toBe("db");
    expect(report.components[0].status).toBe("healthy");
    expect(report.components[1].component).toBe("cache");
    expect(report.components[1].status).toBe("healthy");
    expect(report.summary).toBe("all_healthy");
  });

  it("should record errors via recordError and include in report", async () => {
    collector.recordError(
      makeErrorRecord({ component: "auth", code: "AUTH_FAILED", message: "Invalid token" }),
    );
    collector.recordError(
      makeErrorRecord({ component: "db", code: "DB_TIMEOUT", message: "Connection timeout" }),
    );
    collector.recordError(
      makeErrorRecord({ component: "cache", code: "CACHE_MISS", message: "Redis unavailable" }),
    );

    const report = await collector.getReport();

    expect(report.recentErrors).toHaveLength(3);
    expect(report.recentErrors[0].component).toBe("cache");
    expect(report.recentErrors[1].component).toBe("db");
    expect(report.recentErrors[2].component).toBe("auth");
  });

  it("should cap error history to RingBuffer maxSize", async () => {
    for (let i = 0; i < 150; i += 1) {
      collector.recordError(makeErrorRecord({ message: `Error ${i}` }));
    }

    const report = await collector.getReport();

    expect(report.recentErrors.length).toBeLessThanOrEqual(100);
    expect(report.recentErrors.length).toBe(100);
    expect(report.recentErrors[0].message).toBe("Error 149");
  });

  it("should return all registered providers via getProviders()", async () => {
    const provider1 = new MockDiagnosticsProvider("db", {
      status: "healthy",
      component: "db",
      lastChecked: new Date().toISOString(),
    });
    const provider2 = new MockDiagnosticsProvider("cache", {
      status: "healthy",
      component: "cache",
      lastChecked: new Date().toISOString(),
    });

    collector.registerProvider(provider1);
    collector.registerProvider(provider2);

    const providers = collector.getProviders();

    expect(providers).toHaveLength(2);
    expect(providers[0].name).toBe("db");
    expect(providers[1].name).toBe("cache");
  });

  it("should keep the original provider when a different provider uses the same name", async () => {
    const provider1 = new MockDiagnosticsProvider("db", {
      status: "healthy",
      component: "db",
      lastChecked: new Date().toISOString(),
    });
    const provider2 = new MockDiagnosticsProvider("db", {
      status: "unhealthy",
      component: "db",
      lastChecked: new Date().toISOString(),
    });

    collector.registerProvider(provider1);

    expect(() => collector.registerProvider(provider2)).toThrow(
      DuplicateDiagnosticsProviderProblem,
    );

    const providers = collector.getProviders();
    const report = await collector.getReport();

    expect(providers).toEqual([provider1]);
    expect(report.components).toHaveLength(1);
    expect(report.components[0].status).toBe("healthy");
  });

  it("should treat registering the same provider instance as idempotent", () => {
    const provider = new MockDiagnosticsProvider("db", {
      status: "healthy",
      component: "db",
      lastChecked: new Date().toISOString(),
    });

    collector.registerProvider(provider);
    collector.registerProvider(provider);

    expect(collector.getProviders()).toEqual([provider]);
  });

  it("should handle provider that throws in getHealth()", async () => {
    const failingProvider = new MockDiagnosticsProvider("failing-service", {
      status: "healthy",
      component: "failing-service",
      lastChecked: new Date().toISOString(),
    });
    failingProvider.setThrow(true);

    collector.registerProvider(failingProvider);

    const report = await collector.getReport();

    expect(report.components).toHaveLength(1);
    expect(report.components[0].status).toBe("degraded");
    expect(report.components[0].component).toBe("failing-service");
    expect(report.components[0].message).toBe("Provider health check failed");
    expect(report.summary).toBe("degraded");
  });

  it("should return degraded component when provider health check times out", async () => {
    vi.useFakeTimers();

    try {
      let didAbort = false;
      const collectorWithTimeout = new DiagnosticsCollector({ timeout: 100 });
      const fastProvider = new MockDiagnosticsProvider("fast-service", {
        status: "healthy",
        component: "fast-service",
        lastChecked: new Date().toISOString(),
      });
      const hangingProvider: DiagnosticsProvider = {
        name: "stuck-service",
        getHealth: vi.fn(
          (signal?: AbortSignal) =>
            new Promise<HealthStatus>((_, reject) => {
              signal?.addEventListener("abort", () => {
                didAbort = true;
                reject(new Error("provider observed abort"));
              });
            }),
        ),
      };

      collectorWithTimeout.registerProvider(fastProvider);
      collectorWithTimeout.registerProvider(hangingProvider);

      const reportPromise = collectorWithTimeout.getReport();

      await vi.advanceTimersByTimeAsync(100);

      const report = await reportPromise;

      expect(report.components).toHaveLength(2);
      expect(report.components[0].status).toBe("healthy");
      expect(report.components[1].status).toBe("degraded");
      expect(report.components[1].component).toBe("stuck-service");
      expect(report.components[1].message).toBe(
        "Provider health check timed out after 100ms for stuck-service",
      );
      expect(report.summary).toBe("degraded");
      expect(didAbort).toBe(true);
      expect(hangingProvider.getHealth).toHaveBeenCalledWith(expect.any(AbortSignal));
    } finally {
      vi.useRealTimers();
    }
  });

  it("should honor per-provider timeout overrides", async () => {
    vi.useFakeTimers();

    try {
      const collectorWithTimeout = new DiagnosticsCollector({ timeout: 5000 });
      const hangingProvider: DiagnosticsProvider = {
        name: "slow-provider",
        getHealth: vi.fn((_signal?: AbortSignal) => new Promise<HealthStatus>(() => {})),
      };

      collectorWithTimeout.registerProvider(hangingProvider, { timeout: 75 });

      let settled = false;
      const reportPromise = collectorWithTimeout.getReport().then((report) => {
        settled = true;
        return report;
      });

      await vi.advanceTimersByTimeAsync(74);
      await Promise.resolve();

      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);

      const report = await reportPromise;

      expect(settled).toBe(true);
      expect(report.components).toHaveLength(1);
      expect(report.components[0]).toMatchObject({
        status: "degraded",
        component: "slow-provider",
        message: "Provider health check timed out after 75ms for slow-provider",
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
