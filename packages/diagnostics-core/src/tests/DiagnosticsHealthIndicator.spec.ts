import { HealthCheckService } from "@croco/health-core";
import { describe, expect, it, vi } from "vitest";
import { DiagnosticsCollector } from "../libs/DiagnosticsCollector";
import { DiagnosticsHealthIndicator } from "../libs/DiagnosticsHealthIndicator";
import type { ReadinessIndicator } from "@croco/health-core";
import type { DiagnosticsProvider, HealthStatus } from "../libs/types";

function createProvider(status: HealthStatus): DiagnosticsProvider {
  return {
    name: "database-provider",
    getHealth: vi.fn().mockResolvedValue(status),
  };
}

describe("DiagnosticsHealthIndicator", () => {
  it.each([
    ["healthy", "up"],
    ["unhealthy", "down"],
  ] as const)("maps %s diagnostics status to %s", async (status, expectedStatus) => {
    const provider = createProvider({
      status,
      component: "database",
      lastChecked: "2026-08-28T00:00:00.000Z",
    });
    const indicator = new DiagnosticsHealthIndicator(provider, { degradedStatus: "down" });

    await expect(indicator.check()).resolves.toMatchObject({ status: expectedStatus });
  });

  it.each(["up", "down"] as const)(
    "maps degraded diagnostics status using the explicit %s policy",
    async (degradedStatus) => {
      const provider = createProvider({
        status: "degraded",
        component: "database",
        lastChecked: "2026-08-28T00:00:00.000Z",
      });
      const indicator = new DiagnosticsHealthIndicator(provider, { degradedStatus });

      await expect(indicator.check()).resolves.toMatchObject({ status: degradedStatus });
    },
  );

  it.each(["check", "isReady"] as const)(
    "preserves names, message, nested details, timestamp, and AbortSignal in %s",
    async (method) => {
      const details = {
        latencyMs: 12,
        connection: { pool: "primary", available: 4 },
      };
      const getHealth = vi.fn().mockResolvedValue({
        status: "degraded",
        component: "database-component",
        message: "Replica lag is above target",
        details,
        lastChecked: "2026-08-28T01:02:03.000Z",
      } satisfies HealthStatus);
      const provider: DiagnosticsProvider = {
        name: "database-provider",
        getHealth,
      };
      const indicator = new DiagnosticsHealthIndicator(provider, { degradedStatus: "down" });
      const controller = new AbortController();

      const result = await indicator[method](controller.signal);

      expect(indicator.name).toBe("database-provider");
      expect(getHealth).toHaveBeenCalledOnce();
      expect(getHealth).toHaveBeenCalledWith(controller.signal);
      expect(result).toEqual({
        name: "database-component",
        status: "down",
        message: "Replica lag is above target",
        details,
        lastChecked: "2026-08-28T01:02:03.000Z",
      });
      expect(result.details).toBe(details);
    },
  );

  it("lets the diagnostics collector and readiness service use the same provider", async () => {
    const provider = createProvider({
      status: "healthy",
      component: "database",
      details: { region: "ap-northeast-2" },
      lastChecked: "2026-08-28T00:00:00.000Z",
    });
    const collector = new DiagnosticsCollector();
    const service = new HealthCheckService();
    const readinessIndicator: ReadinessIndicator = new DiagnosticsHealthIndicator(provider, {
      degradedStatus: "down",
    });

    collector.registerProvider(provider);
    service.registerReadiness(readinessIndicator);

    await expect(collector.getReport()).resolves.toMatchObject({
      components: [{ component: "database", status: "healthy" }],
    });
    await expect(service.checkReadiness()).resolves.toMatchObject({
      results: [{ name: "database", status: "up" }],
    });
    await expect(service.isReady()).resolves.toBe(true);
    expect(provider.getHealth).toHaveBeenCalledTimes(3);
  });

  it("does not convert provider failures into a fallback result", async () => {
    const failure = new Error("database connection failed");
    const provider: DiagnosticsProvider = {
      name: "database-provider",
      getHealth: vi.fn().mockRejectedValue(failure),
    };
    const indicator = new DiagnosticsHealthIndicator(provider, { degradedStatus: "down" });

    await expect(indicator.check()).rejects.toBe(failure);
  });
});
