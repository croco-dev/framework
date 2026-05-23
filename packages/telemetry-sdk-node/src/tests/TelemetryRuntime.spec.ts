import { beforeEach, describe, expect, it, vi } from "vitest";
import { TelemetryRuntimeProblem } from "../libs/problems/TelemetryProblems";
import { TelemetryRuntime } from "../runtime";

describe("TelemetryRuntime", () => {
  let runtime!: TelemetryRuntime;

  beforeEach(async () => {
    await TelemetryRuntime.reset();
    runtime = TelemetryRuntime.getInstance();
  });

  it("should return singleton instance", () => {
    const instance1 = TelemetryRuntime.getInstance();
    const instance2 = TelemetryRuntime.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should return null config before initialization", () => {
    expect(runtime.getConfig()).toBeNull();
  });

  it("should initialize with valid config", async () => {
    await runtime.init({
      serviceName: "test-service",
      enabled: false,
    });

    expect(runtime.isInitialized()).toBe(false);
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

  it("should handle forceFlush without error", async () => {
    await runtime.forceFlush();
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

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(TelemetryRuntimeProblem);
    expect(result.error?.message).toContain("timed out after");
    vi.useRealTimers();
  });

  it("should resolve when processor completes quickly even without timeout arg", async () => {
    const processor = {
      forceFlush: vi.fn().mockResolvedValue(undefined),
    };

    Object.assign(runtime, { processor });

    const result = await runtime.forceFlush();
    expect(result.success).toBe(true);
  });

  it("should handle shutdown without error", async () => {
    await runtime.shutdown();
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

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(TelemetryRuntimeProblem);
    expect(result.error?.message).toBe("Telemetry forceFlush failed: export failed");
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

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(TelemetryRuntimeProblem);
    expect(result.error?.message).toBe("Telemetry forceFlush failed: timed out after 10ms");
    vi.useRealTimers();
  });

  it("should propagate shutdown failures as Problem details", async () => {
    const sdk = {
      shutdown: vi.fn().mockRejectedValue(new Error("shutdown failed")),
    };

    Object.assign(runtime, { sdk });

    await expect(runtime.shutdown()).rejects.toThrow("Telemetry shutdown failed: shutdown failed");
  });
});
