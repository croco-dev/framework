import type { NodeSDK } from '@opentelemetry/sdk-node';
import type { BatchSpanProcessor, Sampler } from '@opentelemetry/sdk-trace-base';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import type { TelemetryConfig } from './config';
import { OtlpEndpointRequiredProblem, TelemetryRuntimeProblem } from './libs/problems/TelemetryProblems';

type ForceFlushResult = {
  success: boolean;
  flushedSpans?: number;
  error?: TelemetryRuntimeProblem;
};

class TelemetryRuntime {
  private static instance: TelemetryRuntime;
  private sdk: NodeSDK | null = null;
  private processor: BatchSpanProcessor | null = null;
  private initialized = false;
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

    const { ProbabilitySampler } = await import('./libs/samplers/ProbabilitySampler');
    return new ProbabilitySampler({ probability: traceConfig.probability });
  }

  private createRuntimeProblem(phase: 'init' | 'forceFlush' | 'shutdown', error: unknown): TelemetryRuntimeProblem {
    return error instanceof TelemetryRuntimeProblem ? error : new TelemetryRuntimeProblem(phase, error);
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

    this.config = config;

    if (config.enabled === false) {
      return;
    }

    const [{ Resource }, { NodeSDK }, traceBaseModule, { OTLPTraceExporter }] = await Promise.all([
      import('@opentelemetry/resources'),
      import('@opentelemetry/sdk-node'),
      import('@opentelemetry/sdk-trace-base'),
      import('@opentelemetry/exporter-trace-otlp-http'),
    ]);

    const BatchSpanProcessor = traceBaseModule.BatchSpanProcessor;

    const resource = Resource.default().merge(
      new Resource({
        [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion ?? '0.0.0',
        ...config.resourceAttributes,
      })
    );

    const traceConfig = config.trace ?? {};
    const sampler = await this.createSampler(config);

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

    try {
      this.sdk.start();
      this.initialized = true;
    } catch (error) {
      this.initialized = false;
      this.sdk = null;
      this.processor = null;
      throw this.createRuntimeProblem('init', error);
    }
  }

  async forceFlush(timeoutMillis?: number): Promise<ForceFlushResult> {
    if (!this.processor) {
      return { success: true };
    }

    const effectiveTimeout = timeoutMillis ?? 30000;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const flushPromise = this.processor.forceFlush();

      if (timeoutMillis !== undefined) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new TelemetryRuntimeProblem('forceFlush', `timed out after ${effectiveTimeout}ms`)),
            effectiveTimeout
          );
        });

        await Promise.race([flushPromise, timeoutPromise]);
      } else {
        await flushPromise;
      }

      return {
        success: true,
        flushedSpans: this.processor ? undefined : 0,
      };
    } catch (error) {
      return {
        success: false,
        error: this.createRuntimeProblem('forceFlush', error),
      };
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  async shutdown(): Promise<void> {
    if (!this.sdk) {
      return;
    }

    try {
      await this.sdk.shutdown();
      this.sdk = null;
      this.processor = null;
      this.initialized = false;
    } catch (error) {
      throw this.createRuntimeProblem('shutdown', error);
    }
  }

  static async reset(): Promise<void> {
    const instance = TelemetryRuntime.instance;
    if (instance) {
      await instance.shutdown();
      TelemetryRuntime.instance = undefined as unknown as TelemetryRuntime;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getConfig(): TelemetryConfig | null {
    return this.config;
  }
}

export { TelemetryRuntime };
export type { ForceFlushResult };
