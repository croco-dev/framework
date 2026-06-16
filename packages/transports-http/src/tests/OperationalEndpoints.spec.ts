import "reflect-metadata";
import { DiagnosticsCollector } from "@croco/diagnostics-core";
import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../libs/CrocoApp";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import { createDefaultDiagnosticsCollector } from "../libs/operationalEndpoints";
import type { DiagnosticsEndpointOptions } from "../libs/operationalEndpoints";

class StaticDiagnosticsProvider {
  readonly name = "static";

  async getHealth() {
    return {
      status: "degraded" as const,
      component: "static",
      message: "x".repeat(120),
      details: {
        safe: "visible",
        apiToken: "secret-token",
        nested: {
          authorization: "Bearer secret",
          ok: true,
        },
      },
      lastChecked: "2026-06-15T00:00:00.000Z",
    };
  }
}

describe("Operational endpoints", () => {
  beforeEach(() => {
    Container.reset();
    vi.unstubAllEnvs();

    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger;

    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not register diagnostics when exposure is off", async () => {
    const app = createApp({ controllers: [] });

    const response = await app.fetch(new Request("http://localhost/health/diagnostics"));

    expect(response.status).toBe(404);
  });

  it("requires the configured diagnostics token and returns no-store responses", async () => {
    const app = createApp({
      controllers: [],
      diagnostics: createDiagnosticsOptions({
        exposure: "token",
        token: "ops-secret",
      }),
    });

    const missingTokenResponse = await app.fetch(
      new Request("http://localhost/health/diagnostics"),
    );
    const validTokenResponse = await app.fetch(
      new Request("http://localhost/health/diagnostics", {
        headers: { "X-Diagnostics-Token": "ops-secret" },
      }),
    );

    expect(missingTokenResponse.status).toBe(403);
    expect(missingTokenResponse.headers.get("cache-control")).toBe("no-store");
    expect(validTokenResponse.status).toBe(200);
    expect(validTokenResponse.headers.get("cache-control")).toBe("no-store");
  });

  it("serves diagnostics from the canonical and legacy endpoint paths", async () => {
    const collector = new DiagnosticsCollector();
    collector.registerProvider(new StaticDiagnosticsProvider());
    const app = createApp({
      controllers: [],
      diagnostics: {
        exposure: "private",
        collector,
      },
    });

    const canonical = await app.fetch(new Request("http://localhost/diagnostics"));
    const legacy = await app.fetch(new Request("http://localhost/health/diagnostics"));

    expect(canonical.status).toBe(200);
    expect(legacy.status).toBe(200);
    await expect(canonical.json()).resolves.toMatchObject({
      summary: "degraded",
      components: [{ component: "static" }],
    });
    await expect(legacy.json()).resolves.toMatchObject({
      summary: "degraded",
      components: [{ component: "static" }],
    });
  });

  it("returns minimal operational metrics without exposing diagnostics details", async () => {
    const registry = Container.get(HealthCheckRegistry);
    registry.register("db", async () => ({ status: "up", latency: 10 }));
    const app = createApp({ controllers: [] });

    const response = await app.fetch(new Request("http://localhost/metrics"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      timestamp: expect.any(String),
      metrics: {
        standardEndpointPathCount: 7,
        healthCheckCount: 1,
      },
    });
  });

  it("supports custom diagnostics guards", async () => {
    const app = createApp({
      controllers: [],
      diagnostics: createDiagnosticsOptions({
        exposure: "custom",
        guard: ({ header }) => header("X-Internal-Request") === "true",
      }),
    });

    const denied = await app.fetch(new Request("http://localhost/health/diagnostics"));
    const allowed = await app.fetch(
      new Request("http://localhost/health/diagnostics", {
        headers: { "X-Internal-Request": "true" },
      }),
    );

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
  });

  it("redacts diagnostics details and bounds recent errors", async () => {
    const collector = new DiagnosticsCollector();
    collector.registerProvider(new StaticDiagnosticsProvider());
    collector.recordError({
      timestamp: "2026-06-15T00:00:02.000Z",
      component: "static",
      code: "SECOND",
      message: "second error",
      cause: "stack trace should not be exposed",
    });
    collector.recordError({
      timestamp: "2026-06-15T00:00:01.000Z",
      component: "static",
      code: "FIRST",
      message: "a".repeat(120),
      cause: "stack trace should not be exposed",
    });

    const app = createApp({
      controllers: [],
      diagnostics: {
        exposure: "private",
        collector,
        recentErrorLimit: 1,
        messageLimit: 20,
      },
    });

    const response = await app.fetch(new Request("http://localhost/health/diagnostics"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      timestamp: expect.any(String),
      summary: "degraded",
      components: [
        {
          status: "degraded",
          component: "static",
          message: "xxxxxxxxxxxxxxxxx...",
          details: {
            safe: "visible",
            apiToken: "[Redacted]",
            nested: {
              authorization: "[Redacted]",
              ok: true,
            },
          },
          lastChecked: "2026-06-15T00:00:00.000Z",
        },
      ],
      recentErrors: [
        {
          timestamp: "2026-06-15T00:00:01.000Z",
          component: "static",
          code: "FIRST",
          message: "aaaaaaaaaaaaaaaaa...",
        },
      ],
    });
  });

  it("includes runtime metadata in the default diagnostics collector", async () => {
    const collector = createDefaultDiagnosticsCollector();

    const report = await collector.getReport();

    expect(report.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "healthy",
          component: "runtime",
          details: expect.objectContaining({
            runtime: "node",
            nodeVersion: expect.any(String),
          }),
        }),
      ]),
    );
  });

  it("keeps the legacy environment token mode", async () => {
    vi.stubEnv("CROCO_DIAGNOSTICS_ENABLED", "true");
    vi.stubEnv("CROCO_DIAGNOSTICS_TOKEN", "legacy-token");

    const app = createApp({ controllers: [] });
    const denied = await app.fetch(new Request("http://localhost/health/diagnostics"));
    const allowed = await app.fetch(
      new Request("http://localhost/health/diagnostics", {
        headers: { "X-Diagnostics-Token": "legacy-token" },
      }),
    );

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
  });
});

function createDiagnosticsOptions(
  options: Omit<DiagnosticsEndpointOptions, "collector">,
): DiagnosticsEndpointOptions {
  return {
    collector: new DiagnosticsCollector(),
    ...options,
  };
}
