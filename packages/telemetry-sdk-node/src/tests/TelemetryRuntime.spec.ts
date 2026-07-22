import type { Instrumentation } from "@opentelemetry/instrumentation";
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TelemetryRuntimeProblem,
  UnsupportedTelemetrySignalProblem,
} from "../libs/problems/TelemetryProblems";
import { TelemetryRuntime } from "../runtime";

describe("TelemetryRuntime", () => {
  let runtime!: TelemetryRuntime;

  beforeEach(async () => {
    await TelemetryRuntime.reset();
    runtime = TelemetryRuntime.getInstance();
  });

  afterEach(async () => {
    vi.doUnmock("@opentelemetry/exporter-trace-otlp-http");
    vi.doUnmock("@opentelemetry/resources");
    vi.doUnmock("@opentelemetry/sdk-node");
    vi.doUnmock("@opentelemetry/sdk-trace-base");
    vi.doUnmock("../libs/samplers/ProbabilitySampler");
    vi.unstubAllEnvs();
    vi.useRealTimers();
    await TelemetryRuntime.reset();
    vi.resetModules();
  });

  it("should return singleton instance", () => {
    const instance1 = TelemetryRuntime.getInstance();
    const instance2 = TelemetryRuntime.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should return null config before initialization", () => {
    expect(runtime.getConfig()).toBeNull();
    expect(runtime.isEnabled()).toBe(false);
  });

  it("should initialize with valid config", async () => {
    await runtime.init({
      serviceName: "test-service",
      enabled: false,
    });

    expect(runtime.isInitialized()).toBe(false);
    expect(runtime.isEnabled()).toBe(false);
  });

  it("should apply the top-level environment over conflicting resource attributes", async () => {
    let capturedAttributes: Record<string, unknown> | undefined;

    vi.doMock("@opentelemetry/resources", () => ({
      defaultResource: () => ({ merge: vi.fn() }),
      resourceFromAttributes: (attributes: Record<string, unknown>) => {
        capturedAttributes = attributes;
        return attributes;
      },
    }));
    vi.doMock("@opentelemetry/sdk-node", () => ({
      NodeSDK: class MockNodeSDK {
        start(): void {}
        async shutdown(): Promise<void> {}
      },
    }));
    vi.doMock("@opentelemetry/exporter-trace-otlp-http", () => ({
      OTLPTraceExporter: class MockTraceExporter {},
    }));
    vi.doMock("@opentelemetry/sdk-trace-base", () => ({
      BatchSpanProcessor: class MockBatchSpanProcessor {
        async forceFlush(): Promise<void> {}
        async shutdown(): Promise<void> {}
      },
    }));

    await runtime.init({
      serviceName: "environment-test",
      environment: "production",
      resourceAttributes: {
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: "staging",
        "deployment.environment": "legacy",
      },
      trace: { exporterUrl: "http://collector:4318/v1/traces" },
    });

    expect(capturedAttributes?.[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]).toBe("production");
    expect(capturedAttributes?.["deployment.environment"]).toBe("legacy");
  });

  it("should store config after initialization", async () => {
    const config = {
      serviceName: "test-service",
      serviceVersion: "1.0.0",
    };

    await runtime.init({ ...config, enabled: false });
    const storedConfig = runtime.getConfig();
    expect(storedConfig).toEqual({
      ...config,
      enabled: false,
    });
  });

  it("should initialize when telemetry is enabled after a disabled init", async () => {
    await runtime.init({
      serviceName: "test-service",
      enabled: false,
    });

    await runtime.init({
      serviceName: "test-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    });

    expect(runtime.isInitialized()).toBe(true);
    expect(runtime.isEnabled()).toBe(true);
    expect(runtime.getConfig()).toEqual({
      serviceName: "test-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    });
  });

  it.each([
    { logs: { enabled: true }, signal: "logs" },
    { metrics: { enabled: true }, signal: "metrics" },
  ] as const)("should reject enabled $signal before NodeSDK starts", async (signalConfig) => {
    const nodeSdkStart = vi.fn();

    vi.doMock("@opentelemetry/sdk-node", () => ({
      NodeSDK: class MockNodeSDK {
        start(): void {
          nodeSdkStart();
        }

        async shutdown(): Promise<void> {}
      },
    }));

    const result = runtime.init({
      serviceName: "unsupported-signal-test",
      trace: { enabled: false },
      ...signalConfig,
    });

    await expect(result).rejects.toBeInstanceOf(UnsupportedTelemetrySignalProblem);
    await expect(result).rejects.toMatchObject({
      category: "BadRequest",
      code: "TELEMETRY_SIGNAL_UNSUPPORTED",
      signal: signalConfig.signal,
      supportState: "unsupported-requested",
    });
    expect(nodeSdkStart).not.toHaveBeenCalled();
    expect(runtime.isInitialized()).toBe(false);
  });

  it("should report both enabled unsupported signals without exposing exporter configuration", async () => {
    const result = runtime.init({
      serviceName: "unsupported-signals-test",
      trace: { enabled: false },
      metrics: {
        enabled: true,
        exporterUrl: "https://metrics.example.test/v1/metrics",
        exporterHeaders: { Authorization: "Bearer metrics-secret" },
      },
      logs: {
        enabled: true,
        exporterUrl: "https://logs.example.test/v1/logs",
        exporterHeaders: { Authorization: "Bearer logs-secret" },
      },
    });

    await expect(result).rejects.toMatchObject({
      code: "TELEMETRY_SIGNAL_UNSUPPORTED",
      signals: ["metrics", "logs"],
      supportState: "unsupported-requested",
    });

    const error = await result.catch((cause: unknown) => cause);
    const serializedError = JSON.stringify(error);
    expect(serializedError).not.toContain("metrics-secret");
    expect(serializedError).not.toContain("logs-secret");
    expect(serializedError).not.toContain("metrics.example.test");
    expect(serializedError).not.toContain("logs.example.test");
  });

  it("should reject an unsupported signal even when telemetry is globally disabled", async () => {
    await expect(
      runtime.init({
        serviceName: "globally-disabled-test",
        enabled: false,
        metrics: { enabled: true },
      }),
    ).rejects.toMatchObject({
      code: "TELEMETRY_SIGNAL_UNSUPPORTED",
      signal: "metrics",
    });
  });

  it("should reject an unsupported signal after initialization without replacing active config", async () => {
    await runtime.init({
      serviceName: "active-trace-test",
      trace: {
        enabled: true,
        exporterUrl: "http://collector:4318/v1/traces",
      },
    });

    await expect(
      runtime.init({
        serviceName: "ignored-logs-test",
        logs: { enabled: true },
      }),
    ).rejects.toMatchObject({
      code: "TELEMETRY_SIGNAL_UNSUPPORTED",
      signal: "logs",
    });
    expect(runtime.getConfig()?.serviceName).toBe("active-trace-test");
    expect(runtime.isInitialized()).toBe(true);
  });

  it.each([{}, { logs: { enabled: false }, metrics: { enabled: false } }])(
    "should retain trace behavior when unsupported signals are omitted or disabled",
    async (signalConfig) => {
      await expect(
        runtime.init({
          serviceName: "supported-trace-test",
          trace: {
            enabled: true,
            exporterUrl: "http://collector:4318/v1/traces",
          },
          ...signalConfig,
        }),
      ).resolves.not.toThrow();

      expect(runtime.isInitialized()).toBe(true);
    },
  );

  it("should not start tracing components when tracing is disabled", async () => {
    const instrumentationEnable = vi.fn();
    const nodeSdkConstructor = vi.fn();
    const nodeSdkStart = vi.fn(() => instrumentationEnable());
    const exporterConstructor = vi.fn();
    const processorConstructor = vi.fn();
    const samplerConstructor = vi.fn();

    vi.doMock("@opentelemetry/resources", () => ({
      defaultResource: () => ({ merge: vi.fn() }),
      resourceFromAttributes: vi.fn(),
    }));
    vi.doMock("@opentelemetry/sdk-node", () => ({
      NodeSDK: class MockNodeSDK {
        constructor(options: unknown) {
          nodeSdkConstructor(options);
        }

        start(): void {
          nodeSdkStart();
        }

        async shutdown(): Promise<void> {}
      },
    }));
    vi.doMock("@opentelemetry/exporter-trace-otlp-http", () => ({
      OTLPTraceExporter: class MockTraceExporter {
        constructor(options: unknown) {
          exporterConstructor(options);
        }
      },
    }));
    vi.doMock("@opentelemetry/sdk-trace-base", () => ({
      BatchSpanProcessor: class MockBatchSpanProcessor {
        constructor(exporter: unknown, options: unknown) {
          processorConstructor(exporter, options);
        }

        onStart(): void {}

        onEnd(): void {}

        async forceFlush(): Promise<void> {}

        async shutdown(): Promise<void> {}
      },
    }));
    vi.doMock("../libs/samplers/ProbabilitySampler", () => ({
      ProbabilitySampler: class MockProbabilitySampler {
        constructor(options: unknown) {
          samplerConstructor(options);
        }
      },
    }));
    vi.stubEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "http://env-collector:4318/v1/traces");
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://generic-env-collector:4318");

    await runtime.init({
      serviceName: "trace-disabled-service",
      enabled: true,
      trace: {
        enabled: false,
        probability: 0.5,
        instrumentations: [{ enable: instrumentationEnable } as unknown as Instrumentation],
      },
    });

    expect(nodeSdkConstructor).not.toHaveBeenCalled();
    expect(nodeSdkStart).not.toHaveBeenCalled();
    expect(exporterConstructor).not.toHaveBeenCalled();
    expect(processorConstructor).not.toHaveBeenCalled();
    expect(samplerConstructor).not.toHaveBeenCalled();
    expect(instrumentationEnable).not.toHaveBeenCalled();
    expect(runtime.isInitialized()).toBe(false);
    expect(runtime.isEnabled()).toBe(false);
    expect(runtime.getConfig()?.trace?.enabled).toBe(false);
    await expect(runtime.forceFlush()).resolves.toEqual({
      outcome: "skipped",
      reason: "tracing-disabled",
      flushedSpans: 0,
    });
  });

  it("should keep enabled initialization active when a later disabled init is requested", async () => {
    await runtime.init({
      serviceName: "test-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    });

    await runtime.init({
      serviceName: "test-service",
      enabled: false,
    });

    expect(runtime.isInitialized()).toBe(true);
    expect(runtime.isEnabled()).toBe(true);
    expect(runtime.getConfig()).toEqual({
      serviceName: "test-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    });
  });

  it("should preserve initialized state when the caller mutates its config", async () => {
    const config = {
      serviceName: "test-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    };

    await runtime.init(config);
    config.enabled = false;
    config.trace.enabled = false;
    const returnedTraceConfig = runtime.getConfig()?.trace;
    expect(returnedTraceConfig).toBeDefined();
    if (returnedTraceConfig) {
      returnedTraceConfig.enabled = false;
    }

    expect(runtime.isInitialized()).toBe(true);
    expect(runtime.isEnabled()).toBe(true);
    expect(runtime.getConfig()?.enabled).toBe(true);
    expect(runtime.getConfig()?.trace?.enabled).toBe(true);
  });

  it("should initialize again after shutdown", async () => {
    await runtime.init({
      serviceName: "first-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    });

    expect(runtime.isInitialized()).toBe(true);
    expect(runtime.isEnabled()).toBe(true);

    await runtime.shutdown();
    expect(runtime.isInitialized()).toBe(false);
    expect(runtime.isEnabled()).toBe(false);

    await runtime.init({
      serviceName: "second-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    });

    expect(runtime.isInitialized()).toBe(true);
    expect(runtime.isEnabled()).toBe(true);
    expect(runtime.getConfig()).toEqual({
      serviceName: "second-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    });
  });

  it("should wait for in-flight initialization before shutdown", async () => {
    const config = {
      serviceName: "first-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    };
    const sdk = {
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    let releaseInit!: () => void;
    const pendingInit = new Promise<void>((resolve) => {
      releaseInit = () => {
        Object.assign(runtime, {
          config,
          initialized: true,
          sdk,
        });
        resolve();
      };
    });
    Object.assign(runtime, { initPromise: pendingInit });

    let shutdownSettled = false;
    const shutdownPromise = runtime.shutdown();
    shutdownPromise.then(() => {
      shutdownSettled = true;
    });

    await Promise.resolve();
    expect(shutdownSettled).toBe(false);

    releaseInit();
    await expect(shutdownPromise).resolves.toEqual({ outcome: "completed" });

    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
    expect(runtime.isInitialized()).toBe(false);
    expect(runtime.isEnabled()).toBe(false);

    await runtime.init({
      serviceName: "second-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    });

    expect(runtime.isInitialized()).toBe(true);
    expect(runtime.isEnabled()).toBe(true);
    expect(runtime.getConfig()).toEqual({
      serviceName: "second-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    });
  });

  it("should report forceFlush as unsupported before initialization", async () => {
    await expect(runtime.forceFlush()).resolves.toEqual({
      outcome: "unsupported",
      reason: "not-initialized",
      flushedSpans: 0,
    });
  });

  it("should wait for in-flight initialization before forceFlush", async () => {
    const processor = {
      forceFlush: vi.fn().mockResolvedValue(undefined),
    };
    let releaseInit!: () => void;
    const pendingInit = new Promise<void>((resolve) => {
      releaseInit = () => {
        Object.assign(runtime, { initialized: true, processor });
        resolve();
      };
    });
    Object.assign(runtime, { initPromise: pendingInit });

    let flushSettled = false;
    const flushPromise = runtime.forceFlush();
    flushPromise.then(() => {
      flushSettled = true;
    });

    await Promise.resolve();
    expect(flushSettled).toBe(false);

    releaseInit();
    await expect(flushPromise).resolves.toEqual({
      outcome: "completed",
      flushedSpans: -1,
    });
    expect(processor.forceFlush).toHaveBeenCalledTimes(1);
  });

  it("should timeout with default 30000ms when no timeoutMillis arg given", async () => {
    vi.useFakeTimers();
    const processor = {
      forceFlush: vi.fn(() => new Promise<void>(() => {})),
    };

    Object.assign(runtime, { processor });

    const resultPromise = runtime.forceFlush();
    await vi.advanceTimersByTimeAsync(30000);
    const result = await resultPromise;

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.error).toBeInstanceOf(TelemetryRuntimeProblem);
      expect(result.error.message).toContain("timed out after");
    }
    vi.useRealTimers();
  });

  it("should resolve when processor completes quickly even without timeout arg", async () => {
    const processor = {
      forceFlush: vi.fn().mockResolvedValue(undefined),
    };

    Object.assign(runtime, { processor });

    const result = await runtime.forceFlush();
    expect(result.outcome).toBe("completed");
  });

  it("should report shutdown as unsupported before initialization", async () => {
    await expect(runtime.shutdown()).resolves.toEqual({
      outcome: "unsupported",
      reason: "not-initialized",
    });
  });

  it("should prefer OTEL_EXPORTER_OTLP_TRACES_ENDPOINT over OTEL_EXPORTER_OTLP_ENDPOINT", async () => {
    const tracesEndpoint = "http://collector:4318/v1/traces-custom";
    const genericEndpoint = "http://collector:4318/v1/traces-generic";

    vi.stubEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", tracesEndpoint);
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", genericEndpoint);

    await runtime.init({
      serviceName: "trace-endpoint-test",
      enabled: false,
    });

    expect(runtime.getConfig()?.trace?.exporterUrl).toBeUndefined();

    vi.unstubAllEnvs();
  });

  it("should throw error when OTLP endpoint is not provided", async () => {
    vi.stubEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "");
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "");

    await expect(
      runtime.init({
        serviceName: "test-service",
        trace: { enabled: true },
      }),
    ).rejects.toThrow("OTLP endpoint is required for telemetry");

    vi.unstubAllEnvs();
  });

  it("should throw error when endpoint is undefined", async () => {
    await expect(
      runtime.init({
        serviceName: "test-service",
        trace: { enabled: true, exporterUrl: undefined },
      }),
    ).rejects.toThrow("OTLP endpoint is required for telemetry");
  });

  it("should wrap exporter construction failures and leave runtime retryable", async () => {
    vi.resetModules();
    vi.doMock("@opentelemetry/exporter-trace-otlp-http", () => ({
      OTLPTraceExporter: class FailingTraceExporter {
        constructor() {
          throw new Error("exporter bootstrap failed");
        }
      },
    }));

    let caughtError: unknown;
    try {
      await runtime.init({
        serviceName: "exporter-failure-test",
        trace: {
          enabled: true,
          exporterUrl: "http://collector:4318/v1/traces",
        },
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(TelemetryRuntimeProblem);
    expect((caughtError as TelemetryRuntimeProblem).code).toBe("TELEMETRY_RUNTIME_ERROR");
    expect((caughtError as TelemetryRuntimeProblem).message).toBe(
      "Telemetry init failed: exporter bootstrap failed",
    );
    expect(runtime.isInitialized()).toBe(false);
    await expect(runtime.forceFlush()).resolves.toEqual({
      outcome: "unsupported",
      reason: "not-initialized",
      flushedSpans: 0,
    });

    vi.doUnmock("@opentelemetry/exporter-trace-otlp-http");
    vi.resetModules();

    await expect(
      runtime.init({
        serviceName: "retry-after-exporter-failure",
        enabled: true,
        trace: {
          enabled: true,
          exporterUrl: "http://collector:4318/v1/traces",
        },
      }),
    ).resolves.not.toThrow();
    expect(runtime.isInitialized()).toBe(true);
  });

  it("should not throw when endpoint is provided in config", async () => {
    await expect(
      runtime.init({
        serviceName: "test-service",
        trace: { enabled: true, exporterUrl: "http://localhost:4318/v1/traces" },
      }),
    ).resolves.not.toThrow();
  });

  it("should not throw when endpoint is provided via env var", async () => {
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/traces");

    await expect(
      runtime.init({
        serviceName: "test-service",
        trace: { enabled: true },
      }),
    ).resolves.not.toThrow();

    vi.unstubAllEnvs();
  });

  it("should return Problem details when forceFlush fails", async () => {
    const processor = {
      forceFlush: vi.fn().mockRejectedValue(new Error("export failed")),
    };

    Object.assign(runtime, { processor });

    const result = await runtime.forceFlush();

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.error).toBeInstanceOf(TelemetryRuntimeProblem);
      expect(result.error.message).toBe("Telemetry forceFlush failed: export failed");
    }
  });

  it("should return Problem details when forceFlush times out", async () => {
    vi.useFakeTimers();
    const processor = {
      forceFlush: vi.fn(() => new Promise<void>(() => {})),
    };

    Object.assign(runtime, { processor });

    const resultPromise = runtime.forceFlush(10);
    await vi.advanceTimersByTimeAsync(10);
    const result = await resultPromise;

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.error).toBeInstanceOf(TelemetryRuntimeProblem);
      expect(result.error.message).toBe("Telemetry forceFlush failed: timed out after 10ms");
    }
    vi.useRealTimers();
  });

  it("should return flushedSpans: -1 when forceFlush succeeds", async () => {
    const processor = {
      forceFlush: vi.fn().mockResolvedValue(undefined),
    };

    Object.assign(runtime, { processor });

    const result = await runtime.forceFlush();
    expect(result.outcome).toBe("completed");
    expect(result.flushedSpans).toBe(-1);
  });

  it("should return flushedSpans: -1 when forceFlush fails", async () => {
    const processor = {
      forceFlush: vi.fn().mockRejectedValue(new Error("export failed")),
    };

    Object.assign(runtime, { processor });

    const result = await runtime.forceFlush();
    expect(result.outcome).toBe("failed");
    expect(result.flushedSpans).toBe(-1);
  });

  it("should return zero flushed spans when forceFlush is unsupported", async () => {
    const result = await runtime.forceFlush();
    expect(result).toEqual({
      outcome: "unsupported",
      reason: "not-initialized",
      flushedSpans: 0,
    });
  });

  it("should keep disabled telemetry from blocking unrelated request work", async () => {
    await runtime.init({
      serviceName: "disabled-request-test",
      enabled: false,
      trace: {
        enabled: true,
        exporterUrl: "http://collector:4318/v1/traces",
        exporterHeaders: { Authorization: "Bearer secret" },
      },
    });

    const requestWork = vi.fn().mockResolvedValue({ ok: true });

    await expect(requestWork()).resolves.toEqual({ ok: true });
    await expect(runtime.forceFlush()).resolves.toEqual({
      outcome: "skipped",
      reason: "telemetry-disabled",
      flushedSpans: 0,
    });
    await expect(runtime.shutdown()).resolves.toEqual({
      outcome: "skipped",
      reason: "telemetry-disabled",
    });
    expect(runtime.isInitialized()).toBe(false);
    expect(requestWork).toHaveBeenCalledTimes(1);
  });

  it("should propagate shutdown failures as Problem details", async () => {
    const sdk = {
      shutdown: vi.fn().mockRejectedValue(new Error("shutdown failed")),
    };

    Object.assign(runtime, { sdk });

    await expect(runtime.shutdown()).rejects.toThrow("Telemetry shutdown failed: shutdown failed");
    Object.assign(runtime, { sdk: null, processor: null, initialized: false, initPromise: null });
  });

  it("lifecycle outcomes should preserve an in-flight initialization failure through shutdown", async () => {
    const initFailure = new TelemetryRuntimeProblem("init", new Error("bootstrap failed"));
    let rejectInit!: (error: TelemetryRuntimeProblem) => void;
    const pendingInit = new Promise<void>((_resolve, reject) => {
      rejectInit = reject;
    });
    Object.assign(runtime, { initPromise: pendingInit });

    const shutdownPromise = runtime.shutdown();
    rejectInit(initFailure);

    await expect(shutdownPromise).rejects.toBe(initFailure);
    expect(runtime.isInitialized()).toBe(false);
  });

  it("should report completed shutdown after the SDK performs it", async () => {
    const sdk = {
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(runtime, { sdk, initialized: true });

    await expect(runtime.shutdown()).resolves.toEqual({ outcome: "completed" });
    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
    expect(runtime.isInitialized()).toBe(false);
  });
});
