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

/**
 * Creates a telemetry configuration preset optimized for AWS Lambda.
 *
 * @param options - Lambda preset options
 * @param options.serviceName - Name of the service (required)
 * @param options.serviceVersion - Version of the service (optional)
 * @param options.probability - Sampling probability 0.0-1.0 (default: 1.0 for dev, 0.1 for prod)
 * @param options.exporterUrl - OTLP exporter URL (default: from env or localhost:4318)
 * @param options.exporterHeaders - Additional HTTP headers for the exporter (optional)
 * @returns A complete {@link TelemetryConfig} object
 *
 * @remarks
 * This preset provides sensible defaults for Lambda environments:
 * - Automatically detects Lambda environment via AWS environment variables
 * - Sets resource attributes (cloud.provider, cloud.platform)
 * - Optimizes batch settings for Lambda's short-lived execution model
 * - Uses probability-based sampling (100% in development, 10% in production by default)
 *
 * @example
 * ```ts
 * import { TelemetryRuntime, lambdaPreset } from '@croco/telemetry-sdk-node';
 *
 * const telemetry = TelemetryRuntime.getInstance();
 * await telemetry.init(lambdaPreset({
 *   serviceName: 'order-service',
 *   probability: 0.1, // 10% sampling for production
 * }));
 * ```
 *
 * @see {@link TelemetryRuntime.init}
 */
export { lambdaPreset } from './libs/presets/lambda';
export { SamplerProblem } from './libs/problems/TelemetryProblems';
/**
 * Probability-based sampler for OpenTelemetry traces.
 *
 * @remarks
 * Implements consistent sampling based on trace ID. This ensures that the same trace
 * is always sampled or not sampled, regardless of which service in the distributed
 * system makes the sampling decision.
 *
 * Uses the lower 32 bits of the trace ID to make deterministic sampling decisions,
 * providing consistent sampling across all spans in a trace.
 *
 * @example
 * ```ts
 * import { ProbabilitySampler } from '@croco/telemetry-sdk-node';
 *
 * // Sample 10% of traces
 * const sampler = new ProbabilitySampler({ probability: 0.1 });
 *
 * await telemetry.init({
 *   serviceName: 'my-service',
 *   trace: { sampler },
 * });
 * ```
 */
export { ProbabilitySampler } from './libs/samplers/ProbabilitySampler';

/**
 * OpenTelemetry SDK runtime manager.
 *
 * @remarks
 * Singleton class that manages the OpenTelemetry SDK lifecycle.
 * Use {@link getInstance} to get the singleton instance, then call {@link init}
 * to initialize the SDK with your configuration.
 *
 * In Lambda environments, call {@link forceFlush} before returning from the handler
 * to ensure all telemetry data is exported.
 *
 * @example
 * ```ts
 * import { TelemetryRuntime, lambdaPreset } from '@croco/telemetry-sdk-node';
 *
 * // Get singleton instance (usually at module scope)
 * const telemetry = TelemetryRuntime.getInstance();
 *
 * // Initialize once at application startup
 * await telemetry.init(lambdaPreset({
 *   serviceName: 'my-service',
 * }));
 *
 * // In Lambda handler, flush before returning
 * export const handler = async (event: any) => {
 *   try {
 *     return await processEvent(event);
 *   } finally {
 *     await telemetry.forceFlush();
 *   }
 * };
 * ```
 */
export { TelemetryRuntime } from './runtime';
