import { trace } from "@opentelemetry/api";
import type { Tracer, TracerProvider } from "@opentelemetry/api";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelemetryRuntimeProblem } from "../libs/problems/TelemetryProblems";
import { TelemetryRuntime } from "../runtime";
import type { TelemetryConfig } from "../config";

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

  it("should reject enabled initialization after a disabled init", async () => {
    await runtime.init({
      serviceName: "test-service",
      enabled: false,
    });

    await expect(
      runtime.init({
        serviceName: "test-service",
        enabled: true,
        trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
      }),
    ).rejects.toMatchObject({
      code: "telemetry-sdk-node/init-configuration-conflict",
      runtimeState: "disabled",
    });
    expect(runtime.isInitialized()).toBe(false);
    expect(runtime.getConfig()).toEqual({ serviceName: "test-service", enabled: false });
  });

  it("should treat equivalent property order and omitted undefined values as the same disabled config", async () => {
    await runtime.init({
      serviceName: "test-service",
      enabled: false,
      resourceAttributes: { region: "ap-northeast-2", version: 1 },
    });

    await expect(
      runtime.init({
        resourceAttributes: { version: 1, region: "ap-northeast-2" },
        enabled: false,
        serviceVersion: undefined,
        serviceName: "test-service",
      }),
    ).resolves.toBeUndefined();
  });

  it("should treat explicit runtime defaults as semantically equal", async () => {
    await runtime.init({
      serviceName: "default-service",
      trace: { exporterUrl: "http://collector:4318/v1/traces" },
    });

    await expect(
      runtime.init({
        serviceName: "default-service",
        serviceVersion: "0.0.0",
        environment: "development",
        enabled: true,
        resourceAttributes: {},
        trace: {
          enabled: true,
          exporterUrl: "http://collector:4318/v1/traces",
          exporterHeaders: {},
          batchTimeout: 5000,
          batchCount: 2048,
          batchSize: 512,
          instrumentations: [],
          autoInstrumentation: { enabled: false },
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("should treat equivalent auto-instrumentation aliases and duplicates as semantically equal", async () => {
    await runtime.init({
      serviceName: "instrumented-service",
      trace: {
        exporterUrl: "http://collector:4318/v1/traces",
        autoInstrumentation: {
          modules: ["http", "https", "http"],
          excludeModules: ["dns", "dns"],
        },
      },
    });

    await expect(
      runtime.init({
        serviceName: "instrumented-service",
        trace: {
          exporterUrl: "http://collector:4318/v1/traces",
          autoInstrumentation: {
            modules: ["https", "http"],
            excludeModules: [],
          },
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("should validate a conflicting init before accepting its canonical fingerprint", async () => {
    await runtime.init({
      serviceName: "validated-instrumentation-service",
      enabled: false,
      trace: { autoInstrumentation: { modules: ["http", "https"] } },
    });

    await expect(
      runtime.init({
        serviceName: "validated-instrumentation-service",
        enabled: false,
        trace: { autoInstrumentation: { modules: ["http"] } },
      }),
    ).rejects.toMatchObject({
      code: "TELEMETRY_AUTO_INSTRUMENTATION_INVALID_CONFIG",
      detail:
        "The 'http' and 'https' modules must be selected together because OpenTelemetry provides one shared instrumentation",
    });
  });

  it("should treat duplicate custom instrumentations as the same effective plan", async () => {
    const primary = {
      instrumentationName: "@opentelemetry/instrumentation-pg",
    } as unknown as Instrumentation;
    const duplicateName = {
      instrumentationName: "@opentelemetry/instrumentation-pg",
    } as unknown as Instrumentation;

    await runtime.init({
      serviceName: "custom-instrumented-service",
      enabled: false,
      trace: {
        instrumentations: [primary, primary],
        autoInstrumentation: {
          modules: ["pg"],
          customInstrumentations: [duplicateName],
          moduleOptions: { pg: { enhancedDatabaseReporting: true } },
        },
      },
    });

    await expect(
      runtime.init({
        serviceName: "custom-instrumented-service",
        enabled: false,
        trace: {
          instrumentations: [primary],
          autoInstrumentation: { modules: ["pg"], customInstrumentations: [] },
        },
      }),
    ).resolves.toBeUndefined();
  });

  it.each(["metrics", "logs"] as const)(
    "should reject removed %s configuration before storing it",
    async (signal) => {
      const legacyConfig = {
        serviceName: "legacy-signal-test",
        [signal]: { enabled: false },
      } as unknown as TelemetryConfig;

      await expect(runtime.init(legacyConfig)).rejects.toMatchObject({
        category: "BadRequest",
        code: "TELEMETRY_SIGNAL_UNSUPPORTED",
        signals: [signal],
      });
      expect(runtime.getConfig()).toBeNull();
      expect(runtime.isInitialized()).toBe(false);
    },
  );

  it.each([
    { field: "batchTimeout", value: Number.NaN, constraint: "non-negative-int32" },
    { field: "batchTimeout", value: Number.POSITIVE_INFINITY, constraint: "non-negative-int32" },
    { field: "batchTimeout", value: -1, constraint: "non-negative-int32" },
    { field: "batchTimeout", value: 1.5, constraint: "non-negative-int32" },
    { field: "batchTimeout", value: 2_147_483_648, constraint: "non-negative-int32" },
    { field: "batchCount", value: Number.NaN, constraint: "positive-int32" },
    { field: "batchCount", value: Number.POSITIVE_INFINITY, constraint: "positive-int32" },
    { field: "batchCount", value: 0, constraint: "positive-int32" },
    { field: "batchCount", value: 1.5, constraint: "positive-int32" },
    { field: "batchCount", value: 2_147_483_648, constraint: "positive-int32" },
    { field: "batchSize", value: Number.NaN, constraint: "positive-int32" },
    { field: "batchSize", value: Number.POSITIVE_INFINITY, constraint: "positive-int32" },
    { field: "batchSize", value: 0, constraint: "positive-int32" },
    { field: "batchSize", value: 1.5, constraint: "positive-int32" },
    { field: "batchSize", value: 2_147_483_648, constraint: "positive-int32" },
  ] as const)(
    "should reject invalid $field value $value before initialization",
    async (testCase) => {
      await expect(
        runtime.init({
          serviceName: "invalid-batch-config",
          trace: {
            exporterUrl: "http://collector:4318/v1/traces",
            [testCase.field]: testCase.value,
          },
        }),
      ).rejects.toMatchObject({
        category: "InternalServerError",
        code: "telemetry-sdk-node/batch-configuration-invalid",
        constraint: testCase.constraint,
        field: testCase.field,
        receivedValue: String(testCase.value),
      });
      expect(runtime.getConfig()).toBeNull();
      expect(runtime.isInitialized()).toBe(false);
    },
  );

  it("should reject a batch size larger than the effective queue size", async () => {
    await expect(
      runtime.init({
        serviceName: "invalid-batch-relation",
        trace: {
          exporterUrl: "http://collector:4318/v1/traces",
          batchCount: 10,
          batchSize: 11,
        },
      }),
    ).rejects.toMatchObject({
      category: "InternalServerError",
      code: "telemetry-sdk-node/batch-configuration-invalid",
      constraint: "less-than-or-equal-to-batchCount",
      field: "batchSize",
      receivedValue: "11",
    });
    expect(runtime.getConfig()).toBeNull();
    expect(runtime.isInitialized()).toBe(false);
  });

  it("should reject runtime null batch configuration before initialization", async () => {
    const config = {
      serviceName: "null-batch-config",
      trace: {
        exporterUrl: "http://collector:4318/v1/traces",
        batchCount: null,
      },
    } as unknown as TelemetryConfig;

    await expect(runtime.init(config)).rejects.toMatchObject({
      code: "telemetry-sdk-node/batch-configuration-invalid",
      constraint: "positive-int32",
      field: "batchCount",
      receivedValue: "null",
    });
    expect(runtime.getConfig()).toBeNull();
  });

  it("should reject non-numeric batch configuration without invoking user coercion", async () => {
    const coercion = vi.fn(() => {
      throw new Error("must not run");
    });
    const config = {
      serviceName: "object-batch-config",
      trace: {
        exporterUrl: "http://collector:4318/v1/traces",
        batchCount: { [Symbol.toPrimitive]: coercion },
      },
    } as unknown as TelemetryConfig;

    await expect(runtime.init(config)).rejects.toMatchObject({
      code: "telemetry-sdk-node/batch-configuration-invalid",
      constraint: "positive-int32",
      field: "batchCount",
      receivedValue: "[non-numeric object]",
    });
    expect(coercion).not.toHaveBeenCalled();
    expect(runtime.getConfig()).toBeNull();
  });

  it("should pass valid boundary tuning to BatchSpanProcessor unchanged", async () => {
    const processorConstructor = vi.fn();

    vi.doMock("@opentelemetry/resources", () => ({
      defaultResource: () => ({ merge: vi.fn() }),
      resourceFromAttributes: vi.fn(),
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
        constructor(exporter: unknown, options: unknown) {
          processorConstructor(exporter, options);
        }

        async forceFlush(): Promise<void> {}
        async shutdown(): Promise<void> {}
      },
    }));

    await runtime.init({
      serviceName: "valid-batch-boundaries",
      trace: {
        exporterUrl: "http://collector:4318/v1/traces",
        batchTimeout: 0,
        batchCount: 2_147_483_647,
        batchSize: 2_147_483_647,
      },
    });

    expect(processorConstructor).toHaveBeenCalledWith(expect.anything(), {
      scheduledDelayMillis: 0,
      maxQueueSize: 2_147_483_647,
      maxExportBatchSize: 2_147_483_647,
    });
  });

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

  it("should reject a different config after initialization", async () => {
    await runtime.init({
      serviceName: "test-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    });

    await expect(
      runtime.init({
        serviceName: "test-service",
        enabled: false,
      }),
    ).rejects.toMatchObject({
      code: "telemetry-sdk-node/init-configuration-conflict",
      runtimeState: "initialized",
    });

    expect(runtime.isInitialized()).toBe(true);
    expect(runtime.isEnabled()).toBe(true);
    expect(runtime.getConfig()).toEqual({
      serviceName: "test-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    });
  });

  it("should share concurrent initialization only for equal config", async () => {
    const config = {
      serviceName: "concurrent-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    };

    const first = runtime.init(config);
    const equal = runtime.init({ ...config, trace: { ...config.trace } });
    const conflicting = expect(
      runtime.init({ ...config, serviceName: "other-service" }),
    ).rejects.toMatchObject({ runtimeState: "initializing" });

    await expect(equal).resolves.toBeUndefined();
    await conflicting;
    await expect(first).resolves.toBeUndefined();
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

  it("should initialize with a new config after disabled runtime shutdown", async () => {
    await runtime.init({ serviceName: "disabled-service", enabled: false });
    await expect(runtime.shutdown()).resolves.toEqual({
      outcome: "skipped",
      reason: "telemetry-disabled",
    });

    await runtime.init({
      serviceName: "enabled-service",
      trace: { exporterUrl: "http://collector:4318/v1/traces" },
    });

    expect(runtime.isInitialized()).toBe(true);
    expect(runtime.getConfig()?.serviceName).toBe("enabled-service");
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
    Object.assign(runtime, {
      sdk: null,
      processor: null,
      initialized: false,
      initPromise: null,
      sdkShutdownPromise: null,
      shutdownFailure: null,
    });
  });

  it("should preserve every OpenTelemetry cleanup failure", async () => {
    const firstFailure = new Error("first cleanup failed");
    const secondFailure = new Error("second cleanup failed");
    const sdk = {
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    const activeInstrumentations = [
      {
        disable: vi.fn(() => {
          throw firstFailure;
        }),
      },
      {
        disable: vi.fn(() => {
          throw secondFailure;
        }),
      },
    ] as unknown as Instrumentation[];
    Object.assign(runtime, { sdk, activeInstrumentations, initialized: true });

    const problem = await runtime.shutdown().then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(problem).toBeInstanceOf(TelemetryRuntimeProblem);
    const cause = (problem as { cause?: unknown }).cause;
    expect(cause).toMatchObject({ failures: [firstFailure, secondFailure] });
    Object.assign(runtime, {
      sdk: null,
      processor: null,
      initialized: false,
      activeInstrumentations: [],
      initPromise: null,
      sdkShutdownPromise: null,
      shutdownFailure: null,
    });
  });

  it.each([
    [0, "0"],
    [-1, "-1"],
    [1.5, "1.5"],
    [Number.NaN, "NaN"],
    [Number.POSITIVE_INFINITY, "Infinity"],
    [2_147_483_648, "2147483648"],
    [null, "null"],
    ["100", "[non-numeric string]"],
    [{ timeout: 100 }, "[non-numeric object]"],
  ] as const)(
    "should reject invalid shutdown timeout %s before invoking the SDK",
    async (timeoutMillis, receivedValue) => {
      const sdk = {
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      Object.assign(runtime, { sdk, initialized: true });

      await expect(runtime.shutdown(timeoutMillis as number)).rejects.toMatchObject({
        code: "telemetry-sdk-node/shutdown-timeout-invalid",
        receivedValue,
      });
      expect(sdk.shutdown).not.toHaveBeenCalled();

      Object.assign(runtime, { sdk: null, initialized: false });
    },
  );

  it("should preserve an application-owned global tracer provider during shutdown", async () => {
    const externalTracer = {} as Tracer;
    const externalProvider = {
      getTracer: vi.fn(() => externalTracer),
    } as TracerProvider;
    expect(trace.setGlobalTracerProvider(externalProvider)).toBe(true);

    try {
      await runtime.init({
        serviceName: "external-provider-coexistence",
        trace: { exporterUrl: "http://collector:4318/v1/traces" },
      });
      expect(trace.getTracer("external-before-shutdown")).toBe(externalTracer);

      await expect(runtime.shutdown(100)).resolves.toEqual({ outcome: "completed" });

      expect(trace.getTracer("external-after-shutdown")).toBe(externalTracer);
    } finally {
      trace.disable();
    }
  });

  it("should rejoin one stalled SDK shutdown after timeout and reset the singleton", async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    let completeShutdown!: () => void;
    const sdkShutdownPromise = new Promise<void>((resolve) => {
      completeShutdown = resolve;
    });
    const sdk = {
      shutdown: vi.fn(() => sdkShutdownPromise),
    };
    Object.assign(runtime, { sdk, initialized: true });

    let shutdownError: unknown;
    void runtime.shutdown(10).catch((error: unknown) => {
      shutdownError = error;
    });
    await vi.advanceTimersByTimeAsync(10);

    expect(shutdownError).toMatchObject({
      code: "telemetry-sdk-node/shutdown-timeout",
      timeoutMillis: 10,
    });
    await expect(
      runtime.init({ serviceName: "blocked-reinit", enabled: false }),
    ).rejects.toMatchObject({
      code: "telemetry-sdk-node/init-configuration-conflict",
      runtimeState: "shutdown-timed-out",
    });
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    completeShutdown();
    await TelemetryRuntime.reset();

    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    expect(TelemetryRuntime.getInstance()).not.toBe(runtime);
    clearTimeoutSpy.mockRestore();
  });

  it("should apply the 30000ms default shutdown timeout", async () => {
    vi.useFakeTimers();
    let completeShutdown!: () => void;
    const sdkShutdownPromise = new Promise<void>((resolve) => {
      completeShutdown = resolve;
    });
    const sdk = {
      shutdown: vi.fn(() => sdkShutdownPromise),
    };
    Object.assign(runtime, { sdk, initialized: true });

    let shutdownError: unknown;
    void runtime.shutdown().catch((error: unknown) => {
      shutdownError = error;
    });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(shutdownError).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(shutdownError).toMatchObject({
      code: "telemetry-sdk-node/shutdown-timeout",
      timeoutMillis: 30_000,
    });

    completeShutdown();
    await expect(runtime.shutdown(100)).resolves.toEqual({ outcome: "completed" });
    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
  });

  it("should make concurrent shutdown callers join one SDK operation and result", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    let completeShutdown!: () => void;
    const sdkShutdownPromise = new Promise<void>((resolve) => {
      completeShutdown = resolve;
    });
    const sdk = {
      shutdown: vi.fn(() => sdkShutdownPromise),
    };
    Object.assign(runtime, { sdk, initialized: true });

    const shutdowns = [
      runtime.shutdown(100),
      runtime.shutdown(),
      runtime.shutdown(1),
      runtime.shutdown(0),
      runtime.shutdown(Number.NaN),
    ];
    await Promise.resolve();
    completeShutdown();
    const results = await Promise.all(shutdowns);
    expect(results).toEqual(Array.from({ length: 5 }, () => ({ outcome: "completed" })));
    for (const result of results.slice(1)) {
      expect(result).toBe(results[0]);
    }
    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    clearTimeoutSpy.mockRestore();
  });

  it("should make concurrent shutdown callers observe the same failure", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const failure = new Error("shutdown failed");
    const sdk = {
      shutdown: vi.fn().mockRejectedValue(failure),
    };
    Object.assign(runtime, { sdk, initialized: true });

    const results = await Promise.allSettled([
      runtime.shutdown(100),
      runtime.shutdown(100),
      runtime.shutdown(100),
    ]);
    const reasons = results.map((result) => (result.status === "rejected" ? result.reason : null));

    Object.assign(runtime, {
      sdk: null,
      processor: null,
      initialized: false,
      shutdownFailure: null,
    });

    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
    expect(reasons[0]).toBeInstanceOf(TelemetryRuntimeProblem);
    expect(reasons[1]).toBe(reasons[0]);
    expect(reasons[2]).toBe(reasons[0]);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    clearTimeoutSpy.mockRestore();
  });

  it("should publish the shared shutdown before invoking a reentrant SDK", async () => {
    let reentrantShutdown: Promise<unknown> | undefined;
    const sdk = {
      shutdown: vi.fn(() => {
        reentrantShutdown = runtime.shutdown(1);
        return Promise.resolve();
      }),
    };
    Object.assign(runtime, { sdk, initialized: true });

    const result = await runtime.shutdown(100);
    await expect(reentrantShutdown).resolves.toBe(result);
    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
  });

  it("should reject init while shutdown is in progress and permit it after shutdown", async () => {
    const config = {
      serviceName: "shutdown-race-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    };
    await runtime.init(config);

    let completeShutdown!: () => void;
    const sdk = {
      shutdown: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            completeShutdown = resolve;
          }),
      ),
    };
    Object.assign(runtime, { sdk });

    const shutdownPromise = runtime.shutdown(100);
    await expect(runtime.init(config)).rejects.toMatchObject({
      code: "telemetry-sdk-node/init-configuration-conflict",
      runtimeState: "shutting-down",
    });

    completeShutdown();
    await expect(shutdownPromise).resolves.toEqual({ outcome: "completed" });
    await expect(runtime.init(config)).resolves.toBeUndefined();
  });

  it("should make forceFlush join an in-progress shutdown", async () => {
    let completeShutdown!: () => void;
    const sdk = {
      shutdown: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            completeShutdown = resolve;
          }),
      ),
    };
    const processor = {
      forceFlush: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(runtime, { sdk, processor, initialized: true });

    const shutdownPromise = runtime.shutdown(100);
    const flushPromise = runtime.forceFlush();
    await Promise.resolve();
    expect(processor.forceFlush).not.toHaveBeenCalled();

    completeShutdown();
    await expect(shutdownPromise).resolves.toEqual({ outcome: "completed" });
    await expect(flushPromise).resolves.toEqual({
      outcome: "unsupported",
      reason: "not-initialized",
      flushedSpans: 0,
    });
  });

  it("should preserve an SDK shutdown rejection as terminal until process restart", async () => {
    const config = {
      serviceName: "shutdown-retry-service",
      enabled: true,
      trace: { enabled: true, exporterUrl: "http://collector:4318/v1/traces" },
    };
    await runtime.init(config);

    const sdk = {
      shutdown: vi
        .fn<() => Promise<void>>()
        .mockRejectedValue(new Error("exporter teardown failed")),
    };
    Object.assign(runtime, { sdk });

    let shutdownFailure: unknown;
    try {
      await runtime.shutdown(100);
    } catch (error) {
      shutdownFailure = error;
    }
    expect(shutdownFailure).toMatchObject({
      message: "Telemetry shutdown failed: exporter teardown failed",
    });
    expect(runtime.isInitialized()).toBe(false);
    await expect(runtime.forceFlush()).rejects.toBe(shutdownFailure);
    await expect(runtime.init(config)).rejects.toMatchObject({
      code: "telemetry-sdk-node/init-configuration-conflict",
      runtimeState: "shutdown-failed",
    });

    await expect(runtime.shutdown(100)).rejects.toBe(shutdownFailure);
    await expect(TelemetryRuntime.reset()).rejects.toBe(shutdownFailure);
    expect(TelemetryRuntime.getInstance()).toBe(runtime);
    expect(sdk.shutdown).toHaveBeenCalledTimes(1);

    Object.assign(runtime, {
      sdk: null,
      processor: null,
      initialized: false,
      sdkShutdownPromise: null,
      shutdownFailure: null,
    });
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
