import "reflect-metadata";
import { DiagnosticsCollector } from "@croco/diagnostics-core";
import {
  Container,
  RuntimeInspector,
  type RuntimeInspectorSnapshot,
} from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { ProblemFactory } from "@croco/problems-core";
import { Controller, Get } from "@croco/protocols-rest";
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
          providerAccessToken: "provider-token",
          OPENAI_API_KEY: "provider-key",
          DATABASE_URL: "postgres://user:password@localhost/app",
          connectionString: "redis://localhost:6379",
          payloads: [
            { password: "nested-password", safe: "visible" },
            { webhookSecret: "nested-secret" },
          ],
        },
      },
      lastChecked: "2026-06-15T00:00:00.000Z",
    };
  }
}

@Controller("/inspector")
class InspectorController {
  @Get("/ok")
  ok() {
    return { ok: true };
  }

  @Get("/problem")
  problem() {
    throw ProblemFactory.badRequest(
      "dev-inspector/test-problem",
      "test problem token=problem-secret",
    );
  }
}

class ThrowingRuntimeInspector extends RuntimeInspector {
  override startRequest(): never {
    throw new Error("inspector start failure");
  }

  override recordEvent(): never {
    throw new Error("inspector record failure");
  }

  override finishRequest(): never {
    throw new Error("inspector finish failure");
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

  it("does not register the dev inspector when exposure is off", async () => {
    const app = createApp({ controllers: [] });

    const response = await app.fetch(new Request("http://localhost/dev/inspector"));

    expect(response.status).toBe(404);
  });

  it("captures the latest local request timeline with safe redaction", async () => {
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const spanId = "00f067aa0ba902b7";
    const app = createApp({
      controllers: [InspectorController],
      securityValidation: "off",
      devInspector: {
        exposure: "private",
      },
    });

    const requestResponse = await app.fetch(
      new Request("http://localhost/inspector/ok?apiKey=query-secret", {
        headers: {
          authorization: "Bearer secret",
          traceparent: `00-${traceId}-${spanId}-01`,
          "x-request-id": "dev-req-1",
        },
      }),
    );
    const inspectorResponse = await app.fetch(new Request("http://localhost/dev/inspector"));
    const snapshot = (await inspectorResponse.json()) as RuntimeInspectorSnapshot;

    expect(requestResponse.status).toBe(200);
    expect(inspectorResponse.status).toBe(200);
    expect(inspectorResponse.headers.get("cache-control")).toBe("no-store");
    expect(snapshot.requests[0]).toMatchObject({
      requestId: "dev-req-1",
      method: "GET",
      path: "/inspector/ok",
      route: "/inspector/ok",
      status: 200,
      outcome: "succeeded",
      headers: {
        authorization: "[Redacted]",
      },
      query: {
        apiKey: "[Redacted]",
      },
      trace: {
        traceId,
        spanId,
        traceFlags: 1,
      },
    });
    expect(snapshot.requests[0].timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "di.snapshot" }),
        expect.objectContaining({ kind: "middleware.end", outcome: "succeeded" }),
        expect.objectContaining({ kind: "handler.end", outcome: "succeeded" }),
        expect.objectContaining({ kind: "request.end", outcome: "succeeded" }),
      ]),
    );
    expect(JSON.stringify(snapshot)).not.toContain("query-secret");
    expect(JSON.stringify(snapshot)).not.toContain("Bearer secret");
  });

  it("records Problems without changing the Problem response", async () => {
    const app = createApp({
      controllers: [InspectorController],
      securityValidation: "off",
      devInspector: {
        exposure: "private",
      },
    });

    const requestResponse = await app.fetch(new Request("http://localhost/inspector/problem"));
    const problemBody = await requestResponse.json();
    const inspectorResponse = await app.fetch(new Request("http://localhost/dev/inspector"));
    const snapshot = (await inspectorResponse.json()) as RuntimeInspectorSnapshot;

    expect(requestResponse.status).toBe(400);
    expect(problemBody).toMatchObject({
      code: "dev-inspector/test-problem",
      detail: "test problem token=problem-secret",
    });
    expect(snapshot.requests[0]).toMatchObject({
      path: "/inspector/problem",
      status: 400,
      outcome: "failed",
    });
    expect(snapshot.requests[0].timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "problem",
          outcome: "failed",
          name: "dev-inspector/test-problem",
        }),
      ]),
    );
    expect(JSON.stringify(snapshot)).not.toContain("problem-secret");
  });

  it("does not let inspector failures change route responses", async () => {
    const app = createApp({
      controllers: [InspectorController],
      securityValidation: "off",
      devInspector: {
        exposure: "private",
        inspector: new ThrowingRuntimeInspector(),
      },
    });

    const response = await app.fetch(new Request("http://localhost/inspector/ok"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("keeps inspector records isolated between multiple apps in one process", async () => {
    const firstApp = createApp({
      controllers: [InspectorController],
      securityValidation: "off",
      devInspector: {
        exposure: "private",
      },
    });
    const secondApp = createApp({
      controllers: [InspectorController],
      securityValidation: "off",
      devInspector: {
        exposure: "private",
      },
    });

    await firstApp.fetch(new Request("http://localhost/dev/inspector"));
    await secondApp.fetch(new Request("http://localhost/dev/inspector"));
    await firstApp.fetch(
      new Request("http://localhost/inspector/ok", {
        headers: { "x-request-id": "first-app-request" },
      }),
    );

    const firstInspectorResponse = await firstApp.fetch(
      new Request("http://localhost/dev/inspector"),
    );
    const secondInspectorResponse = await secondApp.fetch(
      new Request("http://localhost/dev/inspector"),
    );
    const firstSnapshot = (await firstInspectorResponse.json()) as RuntimeInspectorSnapshot;
    const secondSnapshot = (await secondInspectorResponse.json()) as RuntimeInspectorSnapshot;

    expect(
      firstSnapshot.requests.some((request) => request.requestId === "first-app-request"),
    ).toBe(true);
    expect(
      secondSnapshot.requests.some((request) => request.requestId === "first-app-request"),
    ).toBe(false);
  });

  it("requires a token when the dev inspector uses token exposure", async () => {
    const app = createApp({
      controllers: [],
      devInspector: {
        exposure: "token",
        token: "dev-secret",
      },
    });

    const denied = await app.fetch(new Request("http://localhost/dev/inspector"));
    const allowed = await app.fetch(
      new Request("http://localhost/dev/inspector", {
        headers: { "X-Dev-Inspector-Token": "dev-secret" },
      }),
    );

    expect(denied.status).toBe(403);
    expect(denied.headers.get("cache-control")).toBe("no-store");
    expect(allowed.status).toBe(200);
  });

  it("keeps private dev inspector exposure disabled in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const app = createApp({
      controllers: [],
      devInspector: {
        exposure: "private",
        allowProduction: true,
      },
    });

    const response = await app.fetch(new Request("http://localhost/dev/inspector"));

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
              providerAccessToken: "[Redacted]",
              OPENAI_API_KEY: "[Redacted]",
              DATABASE_URL: "[Redacted]",
              connectionString: "[Redacted]",
              payloads: [
                { password: "[Redacted]", safe: "visible" },
                { webhookSecret: "[Redacted]" },
              ],
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

  it("adds configured diagnostics providers to the default collector", async () => {
    const app = createApp({
      controllers: [],
      diagnostics: {
        exposure: "private",
        providers: [
          {
            name: "provider-runtime",
            async getHealth() {
              return {
                status: "healthy" as const,
                component: "provider-runtime",
                details: { ready: true },
                lastChecked: "2026-06-15T00:00:00.000Z",
              };
            },
          },
        ],
      },
    });

    const response = await app.fetch(new Request("http://localhost/diagnostics"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      components: expect.arrayContaining([
        expect.objectContaining({ component: "runtime" }),
        expect.objectContaining({ component: "provider-runtime" }),
      ]),
    });
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
