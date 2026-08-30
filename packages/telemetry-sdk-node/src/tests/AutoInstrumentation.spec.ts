import type { Instrumentation } from "@opentelemetry/instrumentation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AutoInstrumentationConfig } from "../libs/instrumentation/AutoInstrumentation";
import { TelemetryDiagnosticsProvider } from "../libs/diagnostics/TelemetryDiagnosticsProvider";
import { lambdaPreset } from "../libs/presets/lambda";
import type { TelemetryAutoInstrumentationProblem } from "../libs/problems/TelemetryAutoInstrumentationProblem";
import { TelemetryRuntime } from "../runtime";

type NamedInstrumentation = Instrumentation & { instrumentationName: string };

function instrumentation(name: string): NamedInstrumentation {
  return { instrumentationName: name, disable: vi.fn() } as unknown as NamedInstrumentation;
}

const runtimeMocks = vi.hoisted(() => ({
  nodeSdkConstructor: vi.fn(),
  getNodeAutoInstrumentations: vi.fn((configs: Record<string, { enabled?: boolean }>) =>
    Object.entries(configs)
      .filter(([, config]) => config.enabled !== false)
      .map(([name]) => instrumentation(name)),
  ),
}));

vi.mock("@opentelemetry/auto-instrumentations-node", () => ({
  getNodeAutoInstrumentations: runtimeMocks.getNodeAutoInstrumentations,
}));
vi.mock("@opentelemetry/resources", () => ({
  defaultResource: () => ({ merge: vi.fn() }),
  resourceFromAttributes: vi.fn(),
}));
vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: class MockNodeSDK {
    constructor(options: unknown) {
      runtimeMocks.nodeSdkConstructor(options);
    }

    start(): void {}
    async shutdown(): Promise<void> {}
  },
}));
vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: class MockTraceExporter {},
}));
vi.mock("@opentelemetry/sdk-trace-base", () => ({
  BatchSpanProcessor: class MockBatchSpanProcessor {
    async forceFlush(): Promise<void> {}
  },
}));

function installRuntimeMocks() {
  runtimeMocks.getNodeAutoInstrumentations.mockClear();
  runtimeMocks.nodeSdkConstructor.mockClear();
  return runtimeMocks;
}

describe("TelemetryRuntime auto-instrumentation", () => {
  let runtime!: TelemetryRuntime;

  beforeEach(async () => {
    await TelemetryRuntime.reset();
    runtime = TelemetryRuntime.getInstance();
  });

  afterEach(async () => {
    await TelemetryRuntime.reset();
    vi.unstubAllEnvs();
  });

  it("passes Node defaults to NodeSDK in deterministic module order", async () => {
    const mocks = installRuntimeMocks();

    await runtime.init({
      serviceName: "node-service",
      trace: {
        exporterUrl: "http://collector:4318/v1/traces",
        autoInstrumentation: {},
      },
    });

    expect(mocks.getNodeAutoInstrumentations).toHaveBeenCalledTimes(1);
    expect(runtime.getEnabledAutoInstrumentationModules()).toEqual([
      "@opentelemetry/instrumentation-http",
      "@opentelemetry/instrumentation-express",
      "@opentelemetry/instrumentation-dns",
      "@opentelemetry/instrumentation-net",
    ]);
    expect(mocks.nodeSdkConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        instrumentations: runtime
          .getEnabledAutoInstrumentationModules()
          .map((name) => expect.objectContaining({ instrumentationName: name })),
      }),
    );
  });

  it("uses Lambda defaults from the Lambda preset", async () => {
    const mocks = installRuntimeMocks();
    vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "orders");

    await runtime.init(
      lambdaPreset({
        serviceName: "lambda-service",
        exporterUrl: "http://collector:4318/v1/traces",
      }),
    );

    expect(mocks.getNodeAutoInstrumentations).toHaveBeenCalledTimes(1);
    expect(runtime.getEnabledAutoInstrumentationModules()).toEqual([
      "@opentelemetry/instrumentation-http",
      "@opentelemetry/instrumentation-aws-sdk",
      "@opentelemetry/instrumentation-aws-lambda",
    ]);
  });

  it("reports only sanitized enabled module identities in diagnostics", async () => {
    installRuntimeMocks();

    await runtime.init({
      serviceName: "diagnostic-service",
      trace: {
        exporterUrl: "http://collector:4318/v1/traces",
        exporterHeaders: { Authorization: "Bearer secret" },
        autoInstrumentation: { modules: ["http", "https", "pg"] },
      },
    });

    const health = await new TelemetryDiagnosticsProvider().getHealth();

    expect(health.details?.autoInstrumentationModules).toEqual([
      "@opentelemetry/instrumentation-http",
      "@opentelemetry/instrumentation-pg",
    ]);
    expect(JSON.stringify(health)).not.toContain("Bearer secret");
    expect(JSON.stringify(health)).not.toContain("collector");
  });

  it("does not create automatic instances when explicitly disabled", async () => {
    const mocks = installRuntimeMocks();

    await runtime.init({
      serviceName: "disabled-service",
      trace: {
        exporterUrl: "http://collector:4318/v1/traces",
        autoInstrumentation: { enabled: false },
      },
    });

    expect(mocks.getNodeAutoInstrumentations).not.toHaveBeenCalled();
    expect(runtime.getEnabledAutoInstrumentationModules()).toEqual([]);
    expect(mocks.nodeSdkConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ instrumentations: [] }),
    );
  });

  it("excludes configured modules and passes supported module options upstream", async () => {
    const mocks = installRuntimeMocks();

    await runtime.init({
      serviceName: "configured-service",
      trace: {
        exporterUrl: "http://collector:4318/v1/traces",
        autoInstrumentation: {
          modules: ["http", "https", "express", "pg"],
          excludeModules: ["express"],
          moduleOptions: { pg: { enhancedDatabaseReporting: true } },
        },
      },
    });

    expect(runtime.getEnabledAutoInstrumentationModules()).toEqual([
      "@opentelemetry/instrumentation-http",
      "@opentelemetry/instrumentation-pg",
    ]);
    expect(mocks.getNodeAutoInstrumentations).toHaveBeenCalledWith(
      expect.objectContaining({
        "@opentelemetry/instrumentation-express": { enabled: false },
        "@opentelemetry/instrumentation-pg": {
          enabled: true,
          enhancedDatabaseReporting: true,
        },
      }),
    );
  });

  it("lets the first custom instance replace an automatic instance without duplicates", async () => {
    const mocks = installRuntimeMocks();
    const customHttp = instrumentation("@opentelemetry/instrumentation-http");
    const duplicateHttp = instrumentation("@opentelemetry/instrumentation-http");
    const custom = instrumentation("orders-custom");

    await runtime.init({
      serviceName: "custom-service",
      trace: {
        exporterUrl: "http://collector:4318/v1/traces",
        instrumentations: [customHttp, custom],
        autoInstrumentation: {
          modules: ["http", "https", "express"],
          customInstrumentations: [duplicateHttp, custom],
        },
      },
    });

    expect(mocks.nodeSdkConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        instrumentations: [
          customHttp,
          custom,
          expect.objectContaining({
            instrumentationName: "@opentelemetry/instrumentation-express",
          }),
        ],
      }),
    );
  });

  const unsupportedConfigurations = [
    ["include filters", { include: ["api.*"] }],
    ["exclude filters", { exclude: ["health.*"] }],
    ["unavailable modules", { modules: ["fastify"] }],
    ["partial HTTP selection", { modules: ["http"] }],
    ["partial HTTP exclusion", { modules: ["http", "https"], excludeModules: ["https"] }],
    [
      "unknown module options",
      { modules: ["http", "https"], moduleOptions: { http: { ignored: true } } },
    ],
  ] satisfies Array<[string, AutoInstrumentationConfig]>;

  it.each(unsupportedConfigurations)(
    "rejects unsupported %s before SDK startup",
    async (_label, autoInstrumentation) => {
      const mocks = installRuntimeMocks();

      await expect(
        runtime.init({
          serviceName: "invalid-service",
          trace: {
            exporterUrl: "http://collector:4318/v1/traces",
            autoInstrumentation,
          },
        }),
      ).rejects.toMatchObject({
        code: "TELEMETRY_AUTO_INSTRUMENTATION_INVALID_CONFIG",
      } satisfies Partial<TelemetryAutoInstrumentationProblem>);

      expect(mocks.getNodeAutoInstrumentations).not.toHaveBeenCalled();
      expect(mocks.nodeSdkConstructor).not.toHaveBeenCalled();

      await expect(new TelemetryDiagnosticsProvider().getHealth()).resolves.toMatchObject({
        status: "degraded",
        details: {
          configured: true,
          initialized: false,
          mode: "startup_failed",
          failureCode: "TELEMETRY_AUTO_INSTRUMENTATION_INVALID_CONFIG",
        },
      });
      await expect(
        new TelemetryDiagnosticsProvider({ requirement: "required" }).getHealth(),
      ).resolves.toMatchObject({
        status: "unhealthy",
        details: {
          configured: true,
          initialized: false,
          mode: "startup_failed",
          failureCode: "TELEMETRY_AUTO_INSTRUMENTATION_INVALID_CONFIG",
        },
      });
    },
  );
});
