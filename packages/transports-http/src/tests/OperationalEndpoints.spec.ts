import "reflect-metadata";
import { DiagnosticsCollector } from "@croco/diagnostics-core";
import {
  Container,
  LOGGER_TOKEN,
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
    const app = createApp({ controllers: [], securityValidation: "off" });

    const response = await app.fetch(new Request("http://localhost/health/diagnostics"));

    expect(response.status).toBe(404);
  });

  it("does not register the dev inspector when exposure is off", async () => {
    const app = createApp({ controllers: [], securityValidation: "off" });

    const response = await app.fetch(new Request("http://localhost/dev/inspector"));

    expect(response.status).toBe(404);
  });

  it("locks health, readiness, and metrics response contracts", async () => {
    const registry = Container.get(HealthCheckRegistry);
    registry.register("generic", async () => ({ status: "up" }));
    registry.registerReadiness("db", async () => ({ status: "up", latency: 10 }));
    const app = createApp({ controllers: [], securityValidation: "off" });

    const contracts = await Promise.all(
      ["/health", "/health/live", "/ready", "/health/ready", "/metrics"].map(async (path) => ({
        path,
        ...(await readJsonResponseContract(
          await app.fetch(new Request(`http://localhost${path}`)),
        )),
      })),
    );

    expect(normalizeOperationalSnapshot(contracts)).toMatchInlineSnapshot(`
      [
        {
          "body": {
            "status": "ok",
          },
          "cacheControl": null,
          "path": "/health",
          "status": 200,
        },
        {
          "body": {
            "status": "ok",
          },
          "cacheControl": null,
          "path": "/health/live",
          "status": 200,
        },
        {
          "body": {
            "results": [
              {
                "details": {
                  "latency": 10,
                },
                "name": "db",
                "status": "up",
              },
            ],
            "status": "up",
          },
          "cacheControl": null,
          "path": "/ready",
          "status": 200,
        },
        {
          "body": {
            "results": [
              {
                "details": {
                  "latency": 10,
                },
                "name": "db",
                "status": "up",
              },
            ],
            "status": "up",
          },
          "cacheControl": null,
          "path": "/health/ready",
          "status": 200,
        },
        {
          "body": {
            "metrics": {
              "healthCheckCount": 1,
              "standardEndpointPathCount": 7,
            },
            "timestamp": "<iso-timestamp>",
          },
          "cacheControl": "no-store",
          "path": "/metrics",
          "status": 200,
        },
      ]
    `);
  });

  it("locks readiness failure response contracts", async () => {
    const registry = Container.get(HealthCheckRegistry);
    registry.registerReadiness("db", async () => ({ status: "down", error: "not ready" }));
    const app = createApp({ controllers: [], securityValidation: "off" });

    const contracts = await Promise.all(
      ["/ready", "/health/ready"].map(async (path) => ({
        path,
        ...(await readJsonResponseContract(
          await app.fetch(new Request(`http://localhost${path}`)),
        )),
      })),
    );

    expect(contracts).toEqual([
      {
        path: "/ready",
        status: 503,
        cacheControl: null,
        body: {
          status: "down",
          results: [
            {
              name: "db",
              status: "down",
              details: {
                error: "not ready",
              },
            },
          ],
        },
      },
      {
        path: "/health/ready",
        status: 503,
        cacheControl: null,
        body: {
          status: "down",
          results: [
            {
              name: "db",
              status: "down",
              details: {
                error: "not ready",
              },
            },
          ],
        },
      },
    ]);
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
    const inspectorError = Object.assign(new Error("logger unavailable"), {
      token: "secret-inspector-token",
    });
    const logger = {
      info: vi.fn(),
      warn: vi.fn(() => {
        throw inspectorError;
      }),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    Container.set(Logger, logger);
    Container.set(LOGGER_TOKEN, logger);

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
    expect(consoleWarn).toHaveBeenCalledWith("Dev Inspector failure logging failed", {
      inspectorErrorName: "Error",
      loggingErrorName: "Error",
    });
    expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain("secret-inspector-token");
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
      securityValidation: "off",
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

  it("locks protected operational endpoint failure response contracts", async () => {
    const app = createApp({
      controllers: [],
      securityValidation: "off",
      diagnostics: createDiagnosticsOptions({
        exposure: "token",
        token: "ops-secret",
      }),
      devInspector: {
        exposure: "token",
        token: "dev-secret",
      },
    });

    const contracts = await Promise.all(
      ["/diagnostics", "/health/diagnostics", "/dev/inspector"].map(async (path) => ({
        path,
        ...(await readJsonResponseContract(
          await app.fetch(new Request(`http://localhost${path}`)),
        )),
      })),
    );

    expect(contracts).toEqual([
      {
        path: "/diagnostics",
        status: 403,
        cacheControl: "no-store",
        body: { error: "Forbidden" },
      },
      {
        path: "/health/diagnostics",
        status: 403,
        cacheControl: "no-store",
        body: { error: "Forbidden" },
      },
      {
        path: "/dev/inspector",
        status: 403,
        cacheControl: "no-store",
        body: { error: "Forbidden" },
      },
    ]);
  });

  it("keeps private dev inspector exposure disabled in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const app = createApp({
      controllers: [],
      securityValidation: "off",
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
      securityValidation: "off",
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
      securityValidation: "off",
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

  it("locks sanitized diagnostics and dev inspector response snapshots", async () => {
    const collector = new DiagnosticsCollector();
    collector.registerProvider(new StaticDiagnosticsProvider());
    collector.recordError({
      timestamp: "2026-06-15T00:00:01.000Z",
      component: "static",
      code: "FIRST",
      message: "a".repeat(120),
      cause: "stack trace should not be exposed",
    });
    const app = createApp({
      controllers: [InspectorController],
      securityValidation: "off",
      diagnostics: {
        exposure: "private",
        collector,
        recentErrorLimit: 1,
        messageLimit: 20,
      },
      devInspector: {
        exposure: "private",
      },
    });

    await app.fetch(
      new Request("http://localhost/inspector/ok?apiKey=query-secret", {
        headers: {
          authorization: "Bearer secret",
          "x-request-id": "dev-contract-request",
        },
      }),
    );

    const diagnosticsContract = await readJsonResponseContract(
      await app.fetch(new Request("http://localhost/diagnostics")),
    );
    const legacyDiagnosticsContract = await readJsonResponseContract(
      await app.fetch(new Request("http://localhost/health/diagnostics")),
    );
    const inspectorContract = await readJsonResponseContract(
      await app.fetch(new Request("http://localhost/dev/inspector")),
    );

    expect(normalizeOperationalSnapshot(diagnosticsContract)).toMatchInlineSnapshot(`
      {
        "body": {
          "components": [
            {
              "component": "static",
              "details": {
                "apiToken": "[Redacted]",
                "nested": {
                  "DATABASE_URL": "[Redacted]",
                  "OPENAI_API_KEY": "[Redacted]",
                  "authorization": "[Redacted]",
                  "connectionString": "[Redacted]",
                  "ok": true,
                  "payloads": [
                    {
                      "password": "[Redacted]",
                      "safe": "visible",
                    },
                    {
                      "webhookSecret": "[Redacted]",
                    },
                  ],
                  "providerAccessToken": "[Redacted]",
                },
                "safe": "visible",
              },
              "lastChecked": "<iso-timestamp>",
              "message": "xxxxxxxxxxxxxxxxx...",
              "status": "degraded",
            },
          ],
          "recentErrors": [
            {
              "code": "FIRST",
              "component": "static",
              "message": "aaaaaaaaaaaaaaaaa...",
              "timestamp": "<iso-timestamp>",
            },
          ],
          "summary": "degraded",
          "timestamp": "<iso-timestamp>",
        },
        "cacheControl": "no-store",
        "status": 200,
      }
    `);
    expect(normalizeOperationalSnapshot(legacyDiagnosticsContract)).toEqual(
      normalizeOperationalSnapshot(diagnosticsContract),
    );
    expect(JSON.stringify(diagnosticsContract.body)).not.toContain("secret-token");
    expect(JSON.stringify(diagnosticsContract.body)).not.toContain(
      "stack trace should not be exposed",
    );

    const inspectorSnapshot = inspectorContract.body as RuntimeInspectorSnapshot;
    const inspectedRequest = inspectorSnapshot.requests[0];
    expect(
      normalizeOperationalSnapshot({
        status: inspectorContract.status,
        cacheControl: inspectorContract.cacheControl,
        body: {
          generatedAt: inspectorSnapshot.generatedAt,
          activeRequestCount: inspectorSnapshot.activeRequestCount,
          requestCount: inspectorSnapshot.requestCount,
          request: {
            id: inspectedRequest?.id,
            requestId: inspectedRequest?.requestId,
            method: inspectedRequest?.method,
            path: inspectedRequest?.path,
            route: inspectedRequest?.route,
            status: inspectedRequest?.status,
            outcome: inspectedRequest?.outcome,
            startedAt: inspectedRequest?.startedAt,
            completedAt: inspectedRequest?.completedAt,
            durationMs: inspectedRequest?.durationMs,
            headers: inspectedRequest?.headers,
            query: inspectedRequest?.query,
            timeline: inspectedRequest?.timeline.map((event) => ({
              kind: event.kind,
              outcome: event.outcome,
              name: event.name,
            })),
          },
        },
      }),
    ).toEqual({
      status: 200,
      cacheControl: "no-store",
      body: {
        generatedAt: "<iso-timestamp>",
        activeRequestCount: 0,
        requestCount: 1,
        request: {
          id: "<id>",
          requestId: "dev-contract-request",
          method: "GET",
          path: "/inspector/ok",
          route: "/inspector/ok",
          status: 200,
          outcome: "succeeded",
          startedAt: "<iso-timestamp>",
          completedAt: "<iso-timestamp>",
          durationMs: "<duration-ms>",
          headers: {
            authorization: "[Redacted]",
            "x-request-id": "dev-contract-request",
          },
          query: {
            apiKey: "[Redacted]",
          },
          timeline: expect.arrayContaining([
            { kind: "request.start", outcome: "started" },
            { kind: "request.context", outcome: "started" },
            { kind: "di.snapshot", outcome: "started" },
            { kind: "handler.start", outcome: "started", name: "ok" },
            { kind: "handler.end", outcome: "succeeded", name: "ok" },
            { kind: "request.end", outcome: "succeeded" },
          ]),
        },
      },
    });
    expect(JSON.stringify(inspectorContract.body)).not.toContain("query-secret");
    expect(JSON.stringify(inspectorContract.body)).not.toContain("Bearer secret");
  });

  it("returns minimal operational metrics without exposing diagnostics details", async () => {
    const registry = Container.get(HealthCheckRegistry);
    registry.register("db", async () => ({ status: "up", latency: 10 }));
    const app = createApp({ controllers: [], securityValidation: "off" });

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
      securityValidation: "off",
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
      securityValidation: "off",
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
        expect.objectContaining({ component: "container" }),
        expect.objectContaining({ component: "events" }),
      ]),
    );
  });

  it("adds configured diagnostics providers to the default collector", async () => {
    const app = createApp({
      controllers: [],
      securityValidation: "off",
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

    const app = createApp({ controllers: [], securityValidation: "off" });
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

type JsonResponseContract = {
  readonly status: number;
  readonly cacheControl: string | null;
  readonly body: unknown;
};

async function readJsonResponseContract(response: Response): Promise<JsonResponseContract> {
  return {
    status: response.status,
    cacheControl: response.headers.get("cache-control"),
    body: (await response.json()) as unknown,
  };
}

function normalizeOperationalSnapshot(value: unknown, key = ""): unknown {
  if (typeof value === "string") {
    if (key === "id") {
      return "<id>";
    }

    if (isIsoTimestamp(value)) {
      return "<iso-timestamp>";
    }

    return value;
  }

  if (typeof value === "number" && (key === "durationMs" || key === "offsetMs")) {
    return "<duration-ms>";
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeOperationalSnapshot(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([entryKey, entry]) => [entryKey, normalizeOperationalSnapshot(entry, entryKey)]),
  );
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
