import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import type { TelemetryConfig } from './config';

class TelemetryRuntime {
  private static instance: TelemetryRuntime;
  private sdk: NodeSDK | null = null;
  private processor: BatchSpanProcessor | null = null;
  private initialized = false;
  private config: TelemetryConfig | null = null;

  private constructor() {}

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

    const resource = Resource.default().merge(
      new Resource({
        [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion ?? '0.0.0',
        ...config.resourceAttributes,
      })
    );

    const traceConfig = config.trace ?? {};

    if (traceConfig.enabled !== false) {
      const exporterUrl =
        traceConfig.exporterUrl ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces';
      const exporter = new OTLPTraceExporter({
        url: exporterUrl,
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
      sampler: traceConfig.sampler,
      instrumentations: traceConfig.instrumentations ?? [],
    });

    try {
      this.sdk.start();
      this.initialized = true;
    } catch {
      this.initialized = false;
    }
  }

  async forceFlush(): Promise<void> {
    if (!this.processor) {
      return;
    }

    try {
      await this.processor.forceFlush();
    } catch {}
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
    } catch {}
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getConfig(): TelemetryConfig | null {
    return this.config;
  }
}

export { TelemetryRuntime };
