import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TelemetryDiagnosticsProvider } from "../libs/diagnostics/TelemetryDiagnosticsProvider";
import { TelemetryRuntime } from "../runtime";

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
  });

  it("should report uninitialized runtime without config as unhealthy", async () => {
    const health = await diagnostics.getHealth();

    expect(health.status).toBe("unhealthy");
    expect(health.component).toBe("telemetry");
    expect(health.message).toBe("Telemetry runtime not initialized");
    expect(health.details).toBeUndefined();
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
      enabled: false,
      initialized: false,
      traceEnabled: false,
      probability: 0.25,
      signals: { logs: "disabled", metrics: "disabled", traces: "disabled" },
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
      enabled: true,
      initialized: false,
      traceEnabled: false,
      probability: 0.25,
      signals: { logs: "disabled", metrics: "disabled", traces: "disabled" },
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

  it("should report sampling probability zero as degraded with safe metadata", async () => {
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

    expect(health.status).toBe("degraded");
    expect(health.component).toBe("telemetry");
    expect(health.message).toBe("Telemetry sampling disabled (probability=0)");
    expect(health.details).toEqual({
      serviceName: "orders",
      environment: "development",
      enabled: true,
      initialized: true,
      traceEnabled: true,
      probability: 0,
      signals: { logs: "disabled", metrics: "disabled", traces: "supported" },
      autoInstrumentationModules: [],
      mode: "sampling_disabled",
    });
    expect(JSON.stringify(health)).not.toContain("Bearer secret");
    expect(JSON.stringify(health)).not.toContain("collector");
  });

  it("should distinguish supported, disabled, and unsupported-requested signals safely", async () => {
    await expect(
      runtime.init({
        serviceName: "orders",
        trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
        metrics: {
          enabled: true,
          exporterUrl: "https://metrics.example.test/v1/metrics",
          exporterHeaders: { Authorization: "Bearer metrics-secret" },
        },
        logs: { enabled: false },
      }),
    ).rejects.toMatchObject({ code: "TELEMETRY_SIGNAL_UNSUPPORTED" });

    const health = await diagnostics.getHealth();

    expect(health.status).toBe("unhealthy");
    expect(health.message).toBe("Unsupported telemetry signals requested: metrics");
    expect(health.details).toMatchObject({
      mode: "unsupported_requested",
      signals: {
        logs: "disabled",
        metrics: "unsupported-requested",
        traces: "supported",
      },
    });
    expect(JSON.stringify(health)).not.toContain("metrics-secret");
    expect(JSON.stringify(health)).not.toContain("metrics.example.test");
    expect(JSON.stringify(health)).not.toContain("collector");
  });

  it("should report multiple unsupported signals in canonical order", async () => {
    await expect(
      runtime.init({
        serviceName: "orders",
        trace: { enabled: false },
        logs: { enabled: true },
        metrics: { enabled: true },
      }),
    ).rejects.toMatchObject({ signals: ["metrics", "logs"] });

    const health = await diagnostics.getHealth();

    expect(health.message).toBe("Unsupported telemetry signals requested: metrics, logs");
  });
});
