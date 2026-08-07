import type { NodeSDK } from "@opentelemetry/sdk-node";
import type { BatchSpanProcessor, Sampler } from "@opentelemetry/sdk-trace-base";
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import type { TelemetryConfig } from "./config";
import { resolveAutoInstrumentation } from "./libs/instrumentation/AutoInstrumentation";
import { TelemetryAutoInstrumentationProblem } from "./libs/problems/TelemetryAutoInstrumentationProblem";
import {
  LegacyTelemetrySignalConfigProblem,
  OtlpEndpointRequiredProblem,
  TelemetryRuntimeProblem,
} from "./libs/problems/TelemetryProblems";
import { resolveDeploymentEnvironment } from "./libs/resources/DeploymentEnvironment";

class TelemetryRuntime {
  private static instance: TelemetryRuntime | null = null;
  private sdk: NodeSDK | null = null;
  private processor: BatchSpanProcessor | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private config: TelemetryConfig | null = null;
  private enabledAutoInstrumentationModules: string[] = [];

  private constructor() {}

  private async createSampler(config: TelemetryConfig): Promise<Sampler | undefined> {
    const traceConfig = config.trace ?? {};

    if (traceConfig.sampler) {
      return traceConfig.sampler;
    }

    if (traceConfig.probability === undefined) {
      return undefined;
    }

    const { ProbabilitySampler } = await import("./libs/samplers/ProbabilitySampler");
    return new ProbabilitySampler({ probability: traceConfig.probability });
  }

  private createRuntimeProblem(
    phase: "init" | "forceFlush" | "shutdown",
    error: unknown,
  ): TelemetryRuntimeProblem {
    return error instanceof TelemetryRuntimeProblem
      ? error
      : new TelemetryRuntimeProblem(phase, error);
  }

  static getInstance(): TelemetryRuntime {
    if (!TelemetryRuntime.instance) {
      TelemetryRuntime.instance = new TelemetryRuntime();
    }
    return TelemetryRuntime.instance;
  }

  async init(config: TelemetryConfig): Promise<void> {
    const legacySignals = getLegacyTelemetrySignals(config);
    if (legacySignals) {
      throw new LegacyTelemetrySignalConfigProblem(legacySignals);
    }

    const requestedConfig = snapshotTelemetryConfig(config);

    if (!this.initialized && !this.initPromise) {
      this.config = requestedConfig;
    }

    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    config = requestedConfig;
    this.config = config;

    if (config.enabled === false || config.trace?.enabled === false) {
      // Store disabled config so a later enabled init can initialize telemetry in the same process.
      return;
    }

    this.initPromise = (async () => {
      const [
        { defaultResource, resourceFromAttributes },
        { NodeSDK },
        traceBaseModule,
        { OTLPTraceExporter },
      ] = await Promise.all([
        import("@opentelemetry/resources"),
        import("@opentelemetry/sdk-node"),
        import("@opentelemetry/sdk-trace-base"),
        import("@opentelemetry/exporter-trace-otlp-http"),
      ]);

      const BatchSpanProcessor = traceBaseModule.BatchSpanProcessor;

      const traceConfig = config.trace ?? {};
      const sampler = await this.createSampler(config);

      try {
        const instrumentationEnvironment =
          config.resourceAttributes?.["cloud.platform"] === "aws_lambda" ||
          process.env["AWS_LAMBDA_FUNCTION_NAME"] !== undefined ||
          process.env["AWS_EXECUTION_ENV"]?.includes("AWS_Lambda") === true
            ? "lambda"
            : "node";
        const resolvedInstrumentation = await resolveAutoInstrumentation(
          traceConfig.autoInstrumentation,
          instrumentationEnvironment,
          traceConfig.instrumentations ?? [],
        );

        const resource = defaultResource().merge(
          resourceFromAttributes({
            [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
            [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion ?? "0.0.0",
            ...config.resourceAttributes,
            [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: resolveDeploymentEnvironment(config),
          }),
        );

        if (traceConfig.enabled !== false) {
          const endpoint =
            traceConfig.exporterUrl ??
            process.env["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"] ??
            process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];

          if (!endpoint) {
            throw new OtlpEndpointRequiredProblem();
          }

          const exporter = new OTLPTraceExporter({
            url: endpoint,
            ...(traceConfig.exporterHeaders !== undefined && {
              headers: traceConfig.exporterHeaders,
            }),
          });

          this.processor = new BatchSpanProcessor(exporter, {
            scheduledDelayMillis: traceConfig.batchTimeout ?? 5000,
            maxQueueSize: traceConfig.batchCount ?? 2048,
            maxExportBatchSize: traceConfig.batchSize ?? 512,
          });
        }

        this.sdk = new NodeSDK({
          resource,
          ...(this.processor !== null && { spanProcessor: this.processor }),
          ...(sampler !== undefined && { sampler }),
          instrumentations: resolvedInstrumentation.instrumentations,
        });

        this.sdk.start();
        this.enabledAutoInstrumentationModules = resolvedInstrumentation.enabledModules;
        this.initialized = true;
      } catch (error) {
        this.initialized = false;
        this.sdk = null;
        this.processor = null;
        this.enabledAutoInstrumentationModules = [];
        if (
          error instanceof OtlpEndpointRequiredProblem ||
          error instanceof TelemetryAutoInstrumentationProblem
        ) {
          throw error;
        }
        throw this.createRuntimeProblem("init", error);
      }
    })();

    try {
      await this.initPromise;
    } catch (error) {
      this.initPromise = null;
      throw error;
    } finally {
      if (this.initialized) {
        this.initPromise = null;
      }
    }
  }

  async forceFlush(timeoutMillis?: number): Promise<ForceFlushResult> {
    const pendingInit = this.initPromise;
    if (pendingInit) {
      try {
        await pendingInit;
      } catch (error) {
        this.initialized = false;
        this.initPromise = null;
        throw error;
      }
    }

    if (!this.processor) {
      const reason = this.getDisabledLifecycleReason();
      return reason
        ? { outcome: "skipped", reason, flushedSpans: 0 }
        : { outcome: "unsupported", reason: "not-initialized", flushedSpans: 0 };
    }

    const effectiveTimeout = timeoutMillis ?? 30000;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const flushPromise = this.processor.forceFlush();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new TelemetryRuntimeProblem("forceFlush", `timed out after ${effectiveTimeout}ms`),
            ),
          effectiveTimeout,
        );
      });

      await Promise.race([flushPromise, timeoutPromise]);

      return {
        outcome: "completed",
        flushedSpans: -1,
      };
    } catch (error) {
      return {
        outcome: "failed",
        flushedSpans: -1,
        error: this.createRuntimeProblem("forceFlush", error),
      };
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  async shutdown(): Promise<ShutdownResult> {
    const pendingInit = this.initPromise;
    if (pendingInit) {
      try {
        await pendingInit;
      } catch (error) {
        this.initialized = false;
        this.initPromise = null;
        throw error;
      }
    }

    if (!this.sdk) {
      this.initialized = false;
      this.initPromise = null;
      const reason = this.getDisabledLifecycleReason();
      return reason
        ? { outcome: "skipped", reason }
        : { outcome: "unsupported", reason: "not-initialized" };
    }

    try {
      await this.sdk.shutdown();
      this.sdk = null;
      this.processor = null;
      this.enabledAutoInstrumentationModules = [];
      this.initialized = false;
      this.initPromise = null;
      return { outcome: "completed" };
    } catch (error) {
      throw this.createRuntimeProblem("shutdown", error);
    }
  }

  static async reset(): Promise<void> {
    const instance = TelemetryRuntime.instance;
    if (instance) {
      await instance.shutdown();
      TelemetryRuntime.instance = null;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isEnabled(): boolean {
    return this.isInitialized();
  }

  getConfig(): TelemetryConfig | null {
    if (!this.config) {
      return null;
    }
    return snapshotTelemetryConfig(this.config);
  }

  getEnabledAutoInstrumentationModules(): string[] {
    return [...this.enabledAutoInstrumentationModules];
  }

  private getDisabledLifecycleReason(): TelemetryLifecycleSkipReason | null {
    if (this.config?.enabled === false) {
      return "telemetry-disabled";
    }
    if (this.config?.trace?.enabled === false) {
      return "tracing-disabled";
    }
    return null;
  }
}

function getLegacyTelemetrySignals(
  config: TelemetryConfig,
): readonly ["logs" | "metrics", ...("logs" | "metrics")[]] | undefined {
  const signals: ("logs" | "metrics")[] = [];
  for (const signal of ["metrics", "logs"] as const) {
    if (Object.prototype.hasOwnProperty.call(config, signal)) {
      signals.push(signal);
    }
  }
  const firstSignal = signals[0];
  return firstSignal ? [firstSignal, ...signals.slice(1)] : undefined;
}

function snapshotTelemetryConfig(config: TelemetryConfig): TelemetryConfig {
  return {
    ...config,
    ...(config.resourceAttributes && { resourceAttributes: { ...config.resourceAttributes } }),
    ...(config.trace && {
      trace: {
        ...config.trace,
        ...(config.trace.exporterHeaders && {
          exporterHeaders: { ...config.trace.exporterHeaders },
        }),
        ...(config.trace.instrumentations && {
          instrumentations: [...config.trace.instrumentations],
        }),
      },
    }),
  };
}

type TelemetryLifecycleSkipReason = "telemetry-disabled" | "tracing-disabled";

type ForceFlushResult =
  | { outcome: "completed"; flushedSpans: -1 }
  | { outcome: "skipped"; reason: TelemetryLifecycleSkipReason; flushedSpans: 0 }
  | { outcome: "unsupported"; reason: "not-initialized"; flushedSpans: 0 }
  | { outcome: "failed"; flushedSpans: -1; error: TelemetryRuntimeProblem };

type ShutdownResult =
  | { outcome: "completed" }
  | { outcome: "skipped"; reason: TelemetryLifecycleSkipReason }
  | { outcome: "unsupported"; reason: "not-initialized" };

export { TelemetryRuntime };
export type { ForceFlushResult, ShutdownResult, TelemetryLifecycleSkipReason };
