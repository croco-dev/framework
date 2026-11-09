import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { context, metrics, propagation, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import type { NodeSDK } from "@opentelemetry/sdk-node";
import type { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import type { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TelemetryRuntime } from "../runtime";

// Keep the actual SDK/provider/processor ownership chain; inject failures only at SDK boundaries.
describe("TelemetryRuntime startup rollback", () => {
  let runtime: TelemetryRuntime;
  let Runtime: typeof TelemetryRuntime;
  let terminalFailure: unknown;
  let sdkShutdownFailure: Error | undefined;
  let failurePhase: "construct" | "early-start" | "late-start" | undefined;
  const startupFailure = new Error("partial SDK startup");
  const exporterShutdown = vi.fn<() => Promise<void>>();
  const sdkShutdown = vi.fn();
  const exported = vi.fn();

  beforeEach(async () => {
    ({ TelemetryRuntime: Runtime } = await import("../runtime"));
    runtime = Runtime.getInstance();
    terminalFailure = undefined;
    sdkShutdownFailure = undefined;
    failurePhase = undefined;
    exporterShutdown.mockReset().mockResolvedValue(undefined);
    sdkShutdown.mockReset();
    exported.mockReset();
    vi.stubEnv("OTEL_LOGS_EXPORTER", "none");
    vi.stubEnv("OTEL_METRICS_EXPORTER", "none");
    vi.doMock("@opentelemetry/exporter-trace-otlp-http", () => ({
      OTLPTraceExporter: class {
        export(spans: unknown[], callback: (result: { code: number }) => void): void {
          exported(spans);
          callback({ code: 0 });
        }
        shutdown = exporterShutdown;
      },
    }));
    vi.doMock("@opentelemetry/sdk-node", async () => {
      const actual = await vi.importActual<{ NodeSDK: typeof NodeSDK }>("@opentelemetry/sdk-node");
      return {
        ...actual,
        NodeSDK: class extends actual.NodeSDK {
          constructor(options: ConstructorParameters<typeof actual.NodeSDK>[0]) {
            if (failurePhase === "construct") throw startupFailure;
            super(options);
          }
          override start(): void {
            if (failurePhase === "early-start") throw startupFailure;
            super.start();
            if (failurePhase === "late-start") throw startupFailure;
          }
          override shutdown(): Promise<void> {
            sdkShutdown();
            if (sdkShutdownFailure) return Promise.reject(sdkShutdownFailure);
            return super.shutdown();
          }
        },
      };
    });
  });

  afterEach(async () => {
    if (terminalFailure) {
      await expect(Runtime.reset()).rejects.toBe(terminalFailure);
    } else {
      await Runtime.reset();
    }
    vi.useRealTimers();
    vi.doUnmock("@opentelemetry/auto-instrumentations-node");
    vi.doUnmock("@opentelemetry/sdk-trace-base");
    vi.doUnmock("@opentelemetry/sdk-node");
    vi.doUnmock("@opentelemetry/exporter-trace-otlp-http");
    vi.unstubAllEnvs();
    trace.disable();
    logs.disable();
    context.disable();
    propagation.disable();
    vi.resetModules();
  });

  function config(instrumentations: Instrumentation[] = []) {
    return {
      serviceName: "partial-start",
      trace: { exporterUrl: "http://collector.invalid/v1/traces", instrumentations },
    };
  }

  function instrumentation(name: string, disable: () => void): Instrumentation {
    return {
      instrumentationName: name,
      instrumentationVersion: "1.0.0",
      enable: vi.fn(),
      disable,
      setTracerProvider: vi.fn(),
      setMeterProvider: vi.fn(),
      setLoggerProvider: vi.fn(),
      getConfig: () => ({ enabled: true }),
      setConfig: vi.fn(),
    } as Instrumentation;
  }

  it.each(["construct", "early-start", "late-start"] as const)(
    "releases owned resources after %s failure and exports through a fresh provider on retry",
    async (phase) => {
      failurePhase = phase;
      const disabled: string[] = [];
      const instruments = [
        instrumentation("first", () => disabled.push("first")),
        instrumentation("second", () => disabled.push("second")),
      ];
      await expect(runtime.init(config(instruments))).rejects.toMatchObject({
        code: "TELEMETRY_RUNTIME_ERROR",
        cause: startupFailure,
      });
      expect(runtime.isInitialized()).toBe(false);
      expect(disabled).toEqual(["second", "first"]);
      expect(sdkShutdown).toHaveBeenCalledTimes(phase === "construct" ? 0 : 1);
      expect(exporterShutdown).toHaveBeenCalledTimes(1);
      expect(runtime.getConfig()).toBeNull();

      failurePhase = undefined;
      await runtime.init(config());
      trace.getTracer("retry").startSpan("fresh-provider").end();
      await expect(runtime.forceFlush()).resolves.toMatchObject({ outcome: "completed" });
      expect(exported).toHaveBeenCalledTimes(1);
      expect(exported.mock.calls[0]?.[0]).toEqual([
        expect.objectContaining({ name: "fresh-provider" }),
      ]);
      await runtime.shutdown();
      expect(exporterShutdown).toHaveBeenCalledTimes(2);
    },
  );

  it("keeps an external tracer provider registered after a late startup failure", async () => {
    const externalTracer = { startSpan: vi.fn() };
    const provider = { getTracer: () => externalTracer };
    trace.setGlobalTracerProvider(provider as never);
    failurePhase = "late-start";
    await expect(runtime.init(config())).rejects.toMatchObject({ cause: startupFailure });
    expect(trace.getTracer("external")).toBe(externalTracer);
    expect(exporterShutdown).toHaveBeenCalledTimes(1);
  });

  it("closes the exporter when processor construction fails", async () => {
    vi.doMock("@opentelemetry/sdk-trace-base", () => ({
      BatchSpanProcessor: class {
        constructor() {
          throw startupFailure;
        }
      },
    }));
    const disable = vi.fn();
    await expect(runtime.init(config([instrumentation("custom", disable)]))).rejects.toMatchObject({
      cause: startupFailure,
    });
    expect(exporterShutdown).toHaveBeenCalledTimes(1);
    expect(disable).toHaveBeenCalledTimes(1);
    expect(sdkShutdown).not.toHaveBeenCalled();
  });

  it("preserves startup and every rollback failure and refuses unsafe reinitialization", async () => {
    failurePhase = "late-start";
    const exportFailure = new Error("exporter shutdown failed");
    const disableFailure = new Error("instrumentation disable failed");
    exporterShutdown.mockRejectedValue(exportFailure);
    const disabled: string[] = [];
    const instruments = [
      instrumentation("first", () => {
        disabled.push("first");
      }),
      instrumentation("second", () => {
        disabled.push("second");
        throw disableFailure;
      }),
    ];
    const error = await runtime.init(config(instruments)).catch((error: unknown) => error);
    expect(error).toMatchObject({
      code: "TELEMETRY_RUNTIME_ERROR",
      cause: {
        cause: startupFailure,
        errors: [startupFailure, exportFailure, disableFailure],
      },
    });
    expect(disabled).toEqual(["second", "first"]);
    expect(exporterShutdown).toHaveBeenCalledTimes(1);
    expect(sdkShutdown).toHaveBeenCalledTimes(1);
    expect(runtime.isInitialized()).toBe(false);
    expect(runtime.getConfig()?.serviceName).toBe("partial-start");
    failurePhase = undefined;
    await expect(runtime.init(config())).rejects.toMatchObject({
      code: "telemetry-sdk-node/init-configuration-conflict",
      runtimeState: "shutdown-failed",
    });
    terminalFailure = await runtime.shutdown().catch((error: unknown) => error);
    expect(terminalFailure).toMatchObject({
      cause: { cause: startupFailure, errors: [startupFailure, exportFailure, disableFailure] },
    });
    await expect(runtime.forceFlush()).rejects.toBe(terminalFailure);
    await expect(runtime.shutdown()).rejects.toBe(terminalFailure);
    expect(sdkShutdown).toHaveBeenCalledTimes(1);
    expect(exporterShutdown).toHaveBeenCalledTimes(1);
  });

  it("joins concurrent initialization until asynchronous rollback has released its resources", async () => {
    failurePhase = "early-start";
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: () => void = () => {};
    const shutdownEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    exporterShutdown.mockImplementation(async () => {
      entered();
      await held;
    });
    const disable = vi.fn();
    const options = config([instrumentation("custom", disable)]);
    const first = runtime.init(options).catch((error: unknown) => error);
    await shutdownEntered;
    let settled = false;
    const second = runtime.init(options).catch((error: unknown) => {
      settled = true;
      return error;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(disable).not.toHaveBeenCalled();
    release();
    const results = await Promise.all([first, second]);
    expect(results[0]).toBe(results[1]);
    expect(results[0]).toMatchObject({ cause: startupFailure });
    expect(exporterShutdown).toHaveBeenCalledTimes(1);
    expect(disable).toHaveBeenCalledTimes(1);
    failurePhase = undefined;
    await expect(runtime.init(config())).resolves.toBeUndefined();
  });

  it("bounds a stalled rollback and blocks retry while retaining the unfinished teardown", async () => {
    vi.useFakeTimers();
    failurePhase = "early-start";
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: () => void = () => {};
    const shutdownEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let disabled: () => void = () => {};
    const cleanupFinished = new Promise<void>((resolve) => {
      disabled = resolve;
    });
    exporterShutdown.mockImplementation(async () => {
      entered();
      await held;
    });
    const init = runtime
      .init(config([instrumentation("custom", disabled)]))
      .catch((error: unknown) => error);
    await shutdownEntered;
    await vi.advanceTimersByTimeAsync(30000);
    const error = await init;
    expect(error).toMatchObject({
      cause: {
        cause: startupFailure,
        errors: [
          startupFailure,
          expect.objectContaining({
            code: "TELEMETRY_RUNTIME_ERROR",
            message: expect.stringContaining("startup rollback timed out after 30000ms; restart"),
          }),
        ],
      },
    });
    terminalFailure = await runtime.shutdown().catch((error: unknown) => error);
    await expect(runtime.init(config())).rejects.toMatchObject({ runtimeState: "shutdown-failed" });
    release();
    await cleanupFinished;
    expect(exporterShutdown).toHaveBeenCalledTimes(1);
    await expect(runtime.shutdown()).rejects.toBe(terminalFailure);
  });

  it("shuts down owners before their dependencies without invoking a dependency twice", async () => {
    failurePhase = "late-start";
    const actual = await vi.importActual<{ BatchSpanProcessor: typeof BatchSpanProcessor }>(
      "@opentelemetry/sdk-trace-base",
    );
    const processorShutdown = vi.spyOn(actual.BatchSpanProcessor.prototype, "shutdown");
    const order: string[] = [];
    sdkShutdown.mockImplementation(() => {
      order.push("sdk");
    });
    exporterShutdown.mockImplementation(async () => {
      order.push("exporter");
    });
    try {
      await expect(
        runtime.init(
          config([
            instrumentation("first", () => {
              order.push("first");
            }),
            instrumentation("second", () => {
              order.push("second");
            }),
          ]),
        ),
      ).rejects.toMatchObject({ cause: startupFailure });
      expect(order).toEqual(["sdk", "exporter", "second", "first"]);
      expect(processorShutdown).toHaveBeenCalledTimes(1);
    } finally {
      processorShutdown.mockRestore();
    }
  });

  it("releases the trace processor even if SDK shutdown rejects before reaching it", async () => {
    failurePhase = "early-start";
    sdkShutdownFailure = new Error("SDK shutdown failed");
    const disable = vi.fn();
    const error = await runtime
      .init(config([instrumentation("custom", disable)]))
      .catch((error: unknown) => error);
    expect(error).toMatchObject({
      cause: { cause: startupFailure, errors: [startupFailure, sdkShutdownFailure] },
    });
    expect(exporterShutdown).toHaveBeenCalledTimes(1);
    expect(disable).toHaveBeenCalledTimes(1);
    terminalFailure = await runtime.shutdown().catch((error: unknown) => error);
    await expect(runtime.init(config())).rejects.toMatchObject({ runtimeState: "shutdown-failed" });
    expect(sdkShutdown).toHaveBeenCalledTimes(1);
  });

  it("does not create implicit log or metric exporters from the environment", async () => {
    const requests: string[] = [];
    const collector = createServer((request, response) => {
      requests.push(request.url ?? "");
      request.resume();
      response.writeHead(200);
      response.end();
    });
    await new Promise<void>((resolve) => collector.listen(0, "127.0.0.1", resolve));
    const { port } = collector.address() as AddressInfo;
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", `http://127.0.0.1:${port}`);
    vi.stubEnv("OTEL_LOGS_EXPORTER", "otlp");
    vi.stubEnv("OTEL_METRICS_EXPORTER", "otlp");
    const meterProvider = metrics.getMeterProvider();
    try {
      await runtime.init(config());
      logs.getLogger("trace-only").emit({ body: "must not reach a logs exporter" });
      expect(metrics.getMeterProvider()).toBe(meterProvider);
      await runtime.shutdown();
      expect(requests).toEqual([]);
      expect(exporterShutdown).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve, reject) =>
        collector.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("continues releasing providers and SDK resources after a global cleanup failure", async () => {
    failurePhase = "late-start";
    const cleanupFailure = new Error("logger deregistration failed");
    const disable = vi.spyOn(logs, "disable").mockImplementation(() => {
      throw cleanupFailure;
    });
    try {
      const error = await runtime.init(config()).catch((error: unknown) => error);
      expect(error).toMatchObject({
        cause: { cause: startupFailure, errors: [startupFailure, cleanupFailure] },
      });
      expect(trace.getTracer("after-rollback").startSpan("not-recorded").isRecording()).toBe(false);
      expect(exporterShutdown).toHaveBeenCalledTimes(1);
      terminalFailure = await runtime.shutdown().catch((error: unknown) => error);
      await expect(runtime.init(config())).rejects.toMatchObject({
        runtimeState: "shutdown-failed",
      });
    } finally {
      disable.mockRestore();
    }
  });

  it("leaves no enabled automatic instrumentation outside the failed attempt's cleanup ownership", async () => {
    const created: Instrumentation[] = [];
    vi.doMock("@opentelemetry/auto-instrumentations-node", async () => {
      const actual = await vi.importActual<{
        getNodeAutoInstrumentations: typeof getNodeAutoInstrumentations;
      }>("@opentelemetry/auto-instrumentations-node");
      return {
        getNodeAutoInstrumentations: (...args: Parameters<typeof getNodeAutoInstrumentations>) => {
          const instances = actual.getNodeAutoInstrumentations(...args);
          created.push(...instances);
          return instances;
        },
      };
    });
    failurePhase = "early-start";
    const disable = vi.fn();
    const options = config([instrumentation("@opentelemetry/instrumentation-http", disable)]);
    try {
      await expect(
        runtime.init({
          ...options,
          trace: { ...options.trace, autoInstrumentation: { modules: ["http", "https", "dns"] } },
        }),
      ).rejects.toMatchObject({ cause: startupFailure });
      expect(
        created.map((instance) => [
          instance.instrumentationName,
          "isEnabled" in instance &&
            typeof instance.isEnabled === "function" &&
            instance.isEnabled(),
        ]),
      ).toEqual([["@opentelemetry/instrumentation-dns", false]]);
      expect(disable).toHaveBeenCalledTimes(1);
    } finally {
      for (const instance of created) instance.disable();
    }
  });
});
