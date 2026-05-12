import type { Instrumentation } from "@opentelemetry/instrumentation";
import type { Sampler } from "@opentelemetry/sdk-trace-base";
import type { AutoInstrumentationConfig } from "./libs/instrumentation/AutoInstrumentation";

/**
 * Configuration for telemetry traces.
 *
 * Defines how trace data is collected and exported, including OTLP endpoint settings,
 * sampling strategy, and batching behavior.
 */
export type TraceConfig = {
  /** Whether tracing is enabled. Default: true */
  enabled?: boolean;
  /** OTLP exporter URL. Default: from env or localhost:4318 */
  exporterUrl?: string;
  /** Additional HTTP headers for the exporter */
  exporterHeaders?: Record<string, string>;
  /** Custom sampler instance. Takes precedence over probability */
  sampler?: Sampler;
  /** Sampling probability (0.0-1.0). Alternative to sampler */
  probability?: number;
  /** Batch timeout in milliseconds. Default: 5000 */
  batchTimeout?: number;
  /** Maximum queue size. Default: 2048 */
  batchCount?: number;
  /** Maximum export batch size. Default: 512 */
  batchSize?: number;
  /** Custom instrumentation instances */
  instrumentations?: Instrumentation[];
  /** Auto-instrumentation configuration */
  autoInstrumentation?: AutoInstrumentationConfig;
};

/**
 * Configuration for telemetry metrics.
 *
 * Defines how metric data is collected and exported.
 * Currently disabled by default in Lambda environments.
 */
export type MetricsConfig = {
  /** Whether metrics collection is enabled. Default: false */
  enabled?: boolean;
  /** OTLP metrics exporter URL */
  exporterUrl?: string;
  /** Additional HTTP headers for the exporter */
  exporterHeaders?: Record<string, string>;
  /** Export interval in milliseconds */
  exportIntervalMillis?: number;
  /** Export timeout in milliseconds */
  exportTimeoutMillis?: number;
};

/**
 * Configuration for telemetry logs.
 *
 * Defines how log data is collected and exported.
 * Currently disabled by default in Lambda environments.
 */
export type LogsConfig = {
  /** Whether logs collection is enabled. Default: false */
  enabled?: boolean;
  /** OTLP logs exporter URL */
  exporterUrl?: string;
  /** Additional HTTP headers for the exporter */
  exporterHeaders?: Record<string, string>;
  /** Maximum queue size for log records */
  maxQueueSize?: number;
  /** Maximum batch size for export */
  maxExportBatchSize?: number;
};

/**
 * Main configuration for the OpenTelemetry SDK.
 *
 * This is the top-level configuration object passed to TelemetryRuntime.init.
 * It combines service metadata with trace, metrics, and logs configurations.
 *
 * @example
 * ```typescript
 * const config: TelemetryConfig = {
 *   serviceName: 'my-service',
 *   serviceVersion: '1.0.0',
 *   environment: 'production',
 *   enabled: true,
 *   trace: {
 *     enabled: true,
 *     exporterUrl: 'http://localhost:4318/v1/traces',
 *   },
 *   metrics: { enabled: false },
 *   logs: { enabled: false },
 * };
 * ```
 */
export type TelemetryConfig = {
  /** Service name (required) */
  serviceName: string;
  /** Service version. Default: '0.0.0' */
  serviceVersion?: string;
  /** Deployment environment. Default: 'development' */
  environment?: string;
  /** Whether telemetry is globally enabled. Default: true */
  enabled?: boolean;
  /** Trace configuration */
  trace?: TraceConfig;
  /** Metrics configuration */
  metrics?: MetricsConfig;
  /** Logs configuration */
  logs?: LogsConfig;
  /** Additional resource attributes */
  resourceAttributes?: Record<string, string | number | boolean>;
};
