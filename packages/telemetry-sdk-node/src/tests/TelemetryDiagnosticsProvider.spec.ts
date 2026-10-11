import { DiagnosticsCollector, DiagnosticsHealthIndicator } from "@croco/diagnostics-core";
import { ROOT_CONTEXT, SpanKind, TraceFlags, trace } from "@opentelemetry/api";
import { AlwaysOffSampler, AlwaysOnSampler, SamplingDecision } from "@opentelemetry/sdk-trace-base";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelemetryDiagnosticsProvider } from "../libs/diagnostics/TelemetryDiagnosticsProvider";
import { TelemetryRuntime } from "../runtime";
import { ProbabilitySampler } from "../libs/samplers/ProbabilitySampler";

describe("TelemetryDiagnosticsProvider", () => {
  let runtime!: TelemetryRuntime;
  let diagnostics!: TelemetryDiagnosticsProvider;

  beforeEach(async () => {
    await TelemetryRuntime.reset();
    runtime = TelemetryRuntime.getInstance();
    diagnostics = new TelemetryDiagnosticsProvider();
  });

  afterEach(async () => {
    await TelemetryRuntime.reset();
    vi.unstubAllEnvs();
  });

  it("should report unconfigured optional telemetry as degraded", async () => {
    const health = await diagnostics.getHealth();

    expect(health.status).toBe("degraded");
    expect(health.component).toBe("telemetry");
    expect(health.message).toBe("Optional telemetry is not configured");
    expect(health.details).toEqual({
      requirement: "optional",
      configured: false,
      enabled: false,
      initialized: false,
      traceEnabled: false,
      signals: { traces: "not_configured" },
      autoInstrumentationModules: [],
      mode: "not_configured",
    });
  });

  it("should report disabled telemetry as degraded with safe metadata", async () => {
    await runtime.init({
      serviceName: "orders",
      enabled: false,
      trace: {
        enabled: true,
        exporterUrl: "http://collector:4318/v1/traces",
        exporterHeaders: { Authorization: "Bearer secret" },
        probability: 0.25,
      },
    });

    const health = await diagnostics.getHealth();

    expect(health.status).toBe("degraded");
    expect(health.component).toBe("telemetry");
    expect(health.message).toBe(
      "Telemetry runtime disabled by configuration; SDK startup and export are skipped",
    );
    expect(health.details).toEqual({
      serviceName: "orders",
      environment: "development",
      requirement: "optional",
      configured: true,
      enabled: false,
      initialized: false,
      traceEnabled: false,
      probability: 0.25,
      signals: { traces: "disabled" },
      autoInstrumentationModules: [],
      mode: "disabled",
    });
    expect(JSON.stringify(health)).not.toContain("Bearer secret");
    expect(JSON.stringify(health)).not.toContain("collector");
  });

  it("should report disabled tracing as degraded with safe metadata", async () => {
    await runtime.init({
      serviceName: "orders",
      enabled: true,
      trace: {
        enabled: false,
        exporterUrl: "http://collector:4318/v1/traces",
        exporterHeaders: { Authorization: "Bearer secret" },
        probability: 0.25,
      },
    });

    const health = await diagnostics.getHealth();

    expect(health.status).toBe("degraded");
    expect(health.component).toBe("telemetry");
    expect(health.message).toBe(
      "Telemetry tracing disabled by configuration; SDK startup and export are skipped",
    );
    expect(health.details).toEqual({
      serviceName: "orders",
      environment: "development",
      requirement: "optional",
      configured: true,
      enabled: true,
      initialized: false,
      traceEnabled: false,
      probability: 0.25,
      signals: { traces: "disabled" },
      autoInstrumentationModules: [],
      mode: "disabled",
    });
    expect(JSON.stringify(health)).not.toContain("Bearer secret");
    expect(JSON.stringify(health)).not.toContain("collector");
  });

  it("should report the effective environment without exposing custom resource attributes", async () => {
    await runtime.init({
      serviceName: "orders",
      environment: "production",
      enabled: false,
      resourceAttributes: {
        "deployment.environment.name": "staging",
        "internal.secret": "resource-secret",
      },
      trace: {
        exporterUrl: "https://collector.example.test/v1/traces",
        exporterHeaders: { Authorization: "Bearer exporter-secret" },
      },
    });

    const health = await diagnostics.getHealth();

    expect(health.details).toMatchObject({ environment: "production" });
    expect(JSON.stringify(health)).not.toContain("staging");
    expect(JSON.stringify(health)).not.toContain("resource-secret");
    expect(JSON.stringify(health)).not.toContain("exporter-secret");
    expect(JSON.stringify(health)).not.toContain("collector.example.test");
  });

  it("should report zero root sampling probability as active with safe metadata", async () => {
    await runtime.init({
      serviceName: "orders",
      enabled: true,
      trace: {
        enabled: true,
        exporterUrl: "http://collector:4318/v1/traces",
        exporterHeaders: { Authorization: "Bearer secret" },
        probability: 0,
      },
    });

    const health = await diagnostics.getHealth();

    expect(health.status).toBe("healthy");
    expect(health.component).toBe("telemetry");
    expect(health.message).toBe(
      "Telemetry root sampling probability is 0; sampled parent traces are still recorded",
    );
    expect(health.details).toEqual({
      serviceName: "orders",
      environment: "development",
      requirement: "optional",
      configured: true,
      enabled: true,
      initialized: true,
      traceEnabled: true,
      probability: 0,
      signals: { traces: "supported" },
      autoInstrumentationModules: [],
      mode: "active",
    });
    expect(JSON.stringify(health)).not.toContain("Bearer secret");
    expect(JSON.stringify(health)).not.toContain("collector");
  });

  it.each([
    {
      name: "without a parent",
      parentContext: ROOT_CONTEXT,
      decision: SamplingDecision.NOT_RECORD,
    },
    {
      name: "with a sampled parent",
      parentContext: trace.setSpanContext(ROOT_CONTEXT, {
        traceId: "00000000000000000000000000000001",
        spanId: "0000000000000001",
        traceFlags: TraceFlags.SAMPLED,
        isRemote: true,
      }),
      decision: SamplingDecision.RECORD_AND_SAMPLED,
    },
  ])("should describe probability zero accurately $name", async ({ parentContext, decision }) => {
    await runtime.init({
      serviceName: "orders",
      trace: { exporterUrl: "http://collector:4318/v1/traces", probability: 0 },
    });
    const sampler = new ProbabilitySampler({ probability: 0 });
    const sampling = sampler.shouldSample(
      parentContext,
      "00000000000000000000000000000001",
      "test-span",
      SpanKind.INTERNAL,
      {},
      [],
    );

    expect(sampling.decision).toBe(decision);
    await expect(diagnostics.getHealth()).resolves.toMatchObject({
      status: "healthy",
      message: "Telemetry root sampling probability is 0; sampled parent traces are still recorded",
      details: { mode: "active", probability: 0, traceEnabled: true },
    });
  });

  it.each([new AlwaysOnSampler(), new AlwaysOffSampler()])(
    "should avoid probability-based sampling claims when a custom sampler takes precedence: %s",
    async (sampler) => {
      await runtime.init({
        serviceName: "orders",
        trace: { exporterUrl: "http://collector:4318/v1/traces", probability: 0, sampler },
      });

      const health = await diagnostics.getHealth();

      expect(health.status).toBe("healthy");
      expect(health.details).toMatchObject({ mode: "active", probability: 0, traceEnabled: true });
      expect(health.message).toBeUndefined();
    },
  );

  it("should keep explicitly disabled telemetry degraded when it is required", async () => {
    await runtime.init({ serviceName: "orders", enabled: false });

    const health = await new TelemetryDiagnosticsProvider({ requirement: "required" }).getHealth();

    expect(health).toMatchObject({
      status: "degraded",
      details: {
        requirement: "required",
        configured: true,
        mode: "disabled",
      },
    });
  });

  it("should report required telemetry without configuration as unhealthy", async () => {
    const health = await new TelemetryDiagnosticsProvider({ requirement: "required" }).getHealth();

    expect(health).toMatchObject({
      status: "unhealthy",
      message: "Required telemetry is not configured",
      details: {
        requirement: "required",
        configured: false,
        initialized: false,
        mode: "not_configured",
      },
    });
  });

  it("should preserve failed startup evidence and apply the requirement policy", async () => {
    vi.stubEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "");
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "");

    await expect(
      runtime.init({
        serviceName: "orders",
        resourceAttributes: { "internal.secret": "resource-secret" },
        trace: { exporterHeaders: { Authorization: "Bearer exporter-secret" } },
      }),
    ).rejects.toThrow("OTLP endpoint is required for telemetry");

    const optionalHealth = await diagnostics.getHealth();
    const requiredDiagnostics = new TelemetryDiagnosticsProvider({ requirement: "required" });
    const requiredHealth = await requiredDiagnostics.getHealth();

    expect(optionalHealth).toMatchObject({
      status: "degraded",
      message: "Optional telemetry failed to initialize",
      details: {
        serviceName: "orders",
        requirement: "optional",
        configured: true,
        initialized: false,
        mode: "startup_failed",
        failureCode: "OTLP_ENDPOINT_REQUIRED",
      },
    });
    expect(requiredHealth).toMatchObject({
      status: "unhealthy",
      message: "Required telemetry failed to initialize",
      details: {
        serviceName: "orders",
        requirement: "required",
        configured: true,
        initialized: false,
        mode: "startup_failed",
        failureCode: "OTLP_ENDPOINT_REQUIRED",
      },
    });
    expect(JSON.stringify(optionalHealth)).not.toContain("resource-secret");
    expect(JSON.stringify(optionalHealth)).not.toContain("exporter-secret");
  });

  it("should let aggregate diagnostics and readiness distinguish optional absence from required failure", async () => {
    const optionalCollector = new DiagnosticsCollector();
    optionalCollector.registerProvider(diagnostics);
    const optionalReadiness = new DiagnosticsHealthIndicator(diagnostics, {
      degradedStatus: "up",
    });

    await expect(optionalCollector.getReport()).resolves.toMatchObject({
      summary: "degraded",
      components: [{ status: "degraded", details: { mode: "not_configured" } }],
    });
    await expect(optionalReadiness.check()).resolves.toMatchObject({
      status: "up",
      details: { mode: "not_configured" },
    });

    vi.stubEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "");
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "");
    await expect(runtime.init({ serviceName: "orders" })).rejects.toThrow(
      "OTLP endpoint is required for telemetry",
    );

    const requiredDiagnostics = new TelemetryDiagnosticsProvider({ requirement: "required" });
    const requiredCollector = new DiagnosticsCollector();
    requiredCollector.registerProvider(requiredDiagnostics);
    const requiredReadiness = new DiagnosticsHealthIndicator(requiredDiagnostics, {
      degradedStatus: "up",
    });

    await expect(requiredCollector.getReport()).resolves.toMatchObject({
      summary: "issues_detected",
      components: [{ status: "unhealthy", details: { mode: "startup_failed" } }],
    });
    await expect(requiredReadiness.check()).resolves.toMatchObject({
      status: "down",
      details: { mode: "startup_failed" },
    });
  });
});
