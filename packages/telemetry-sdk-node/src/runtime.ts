import type { NodeSDK } from "@opentelemetry/sdk-node";
import type { BatchSpanProcessor, Sampler } from "@opentelemetry/sdk-trace-base";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import type { TelemetryConfig } from "./config";
import {
  OtlpEndpointRequiredProblem,
  TelemetryRuntimeProblem,
} from "./libs/problems/TelemetryProblems";

type ForceFlushResult = {
  success: boolean;
  flushedSpans: number;
  error?: TelemetryRuntimeProblem;
};

class TelemetryRuntime {
  private static instance: TelemetryRuntime | null = null;
  private sdk: NodeSDK | null = null;
  private processor: BatchSpanProcessor | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private config: TelemetryConfig | null = null;

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
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.config = config;

    if (config.enabled === false) {
      // Disabled init stores the requested config without starting the SDK, so
      // a later enabled init can still initialize telemetry in the same process.
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
        const resource = defaultResource().merge(
          resourceFromAttributes({
            [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
            [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion ?? "0.0.0",
            ...config.resourceAttributes,
          }),
        );

        if (traceConfig.enabled !== false) {
          const endpoint =
            traceConfig.exporterUrl ??
            process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
            process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

          if (!endpoint) {
            throw new OtlpEndpointRequiredProblem();
          }

          const exporter = new OTLPTraceExporter({
            url: endpoint,
            headers: traceConfig.exporterHeaders,
          });

          this.processor = new BatchSpanProcessor(exporter, {
            scheduledDelayMillis: traceConfig.batchTimeout ?? 5000,
            maxQueueSize: traceConfig.batchCount ?? 2048,
            maxExportBatchSize: traceConfig.batchSize ?? 512,
          });
        }

        this.sdk = new NodeSDK({
          resource,
          spanProcessor: this.processor ?? undefined,
          sampler,
          instrumentations: traceConfig.instrumentations ?? [],
        });

        this.sdk.start();
        this.initialized = true;
      } catch (error) {
        this.initialized = false;
        this.sdk = null;
        this.processor = null;
        if (error instanceof OtlpEndpointRequiredProblem) {
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
    if (!this.processor) {
      return { success: true, flushedSpans: -1 };
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
        success: true,
        flushedSpans: -1,
      };
    } catch (error) {
      return {
        success: false,
        flushedSpans: -1,
        error: this.createRuntimeProblem("forceFlush", error),
      };
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  async shutdown(): Promise<void> {
    const pendingInit = this.initPromise;
    if (pendingInit) {
      try {
        await pendingInit;
      } catch {
        this.initialized = false;
        this.initPromise = null;
        return;
      }
    }

    if (!this.sdk) {
      this.initialized = false;
      this.initPromise = null;
      return;
    }

    try {
      await this.sdk.shutdown();
      this.sdk = null;
      this.processor = null;
      this.initialized = false;
      this.initPromise = null;
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
    return this.initialized && this.config?.enabled !== false;
  }

  isEnabled(): boolean {
    return this.isInitialized();
  }

  getConfig(): TelemetryConfig | null {
    return this.config;
  }
}

export { TelemetryRuntime };
export type { ForceFlushResult };
