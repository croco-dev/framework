/**
 * Configuration options for telemetry traces.
 *
 * @remarks
 * Defines how trace data is collected and exported, including OTLP endpoint settings,
 * sampling strategy, and batching behavior.
 *
 * @example
 * ```ts
 * const traceConfig: TraceConfig = {
 *   enabled: true,
 *   exporterUrl: 'http://localhost:4318/v1/traces',
 *   batchTimeout: 5000,
 *   batchSize: 512,
 * };
 * ```
 */

/**
 * Configuration options for telemetry metrics.
 *
 * @remarks
 * Defines how metric data is collected and exported.
 * Currently disabled by default in Lambda environments.
 *
 * @example
 * ```ts
 * const metricsConfig: MetricsConfig = {
 *   enabled: false,
 * };
 * ```
 */

/**
 * Configuration options for telemetry logs.
 *
 * @remarks
 * Defines how log data is collected and exported.
 * Currently disabled by default in Lambda environments.
 *
 * @example
 * ```ts
 * const logsConfig: LogsConfig = {
 *   enabled: false,
 * };
 * ```
 */

/**
 * Main configuration for the OpenTelemetry SDK.
 *
 * @remarks
 * This is the top-level configuration object passed to {@link TelemetryRuntime.init}.
 * It combines service metadata with trace, metrics, and logs configurations.
 *
 * @example
 * ```ts
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
export type { LogsConfig, MetricsConfig, TelemetryConfig, TraceConfig } from './config';
export type {
  AutoInstrumentationConfig,
  AutoInstrumentationModule,
} from './libs/instrumentation/AutoInstrumentation';
export {
  LAMBDA_DEFAULT_MODULES,
  NODE_DEFAULT_MODULES,
  normalizeAutoInstrumentationConfig,
} from './libs/instrumentation/AutoInstrumentation';
export type {
  Logger,
  LoggerOptions,
  LogRecord,
  LogRecordOptions,
  LogSeverity,
  LogsApi,
} from './libs/logs/LogsApi';
export type {
  Counter,
  CounterOptions,
  Gauge,
  GaugeOptions,
  Histogram,
  HistogramOptions,
  MetricsApi,
} from './libs/metrics/MetricsApi';
export { lambdaPreset } from './libs/presets/lambda';
export { OtlpEndpointRequiredProblem, SamplerProblem } from './libs/problems/TelemetryProblems';
export { ProbabilitySampler } from './libs/samplers/ProbabilitySampler';
export type { ForceFlushResult } from './runtime';
export { TelemetryRuntime } from './runtime';
