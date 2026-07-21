/**
 * 트레이스, 메트릭, 로그, 런타임 초기화에 사용하는 설정 타입입니다.
 */
export type { LogsConfig, MetricsConfig, TelemetryConfig, TraceConfig } from "./config";
export type {
  AutoInstrumentationConfig,
  AutoInstrumentationModule,
} from "./libs/instrumentation/AutoInstrumentation";

/**
 * 환경별 기본 자동 계측 모듈 목록과 정규화 유틸리티입니다.
 */
export {
  LAMBDA_DEFAULT_MODULES,
  NODE_DEFAULT_MODULES,
  normalizeAutoInstrumentationConfig,
} from "./libs/instrumentation/AutoInstrumentation";
export type {
  Logger,
  LoggerOptions,
  LogRecord,
  LogRecordOptions,
  LogSeverity,
  LogsApi,
} from "./libs/logs/LogsApi";
export type {
  Counter,
  CounterOptions,
  Gauge,
  GaugeOptions,
  Histogram,
  HistogramOptions,
  MetricsApi,
} from "./libs/metrics/MetricsApi";

/**
 * AWS Lambda 환경에 맞는 기본 Telemetry 설정을 생성하는 프리셋입니다.
 */
export { lambdaPreset } from "./libs/presets/lambda";

/**
 * OTLP, 지원되지 않는 신호, 샘플러 설정 오류를 나타내는 Problem 타입입니다.
 */
export {
  OtlpEndpointRequiredProblem,
  SamplerProblem,
  UnsupportedTelemetrySignalProblem,
} from "./libs/problems/TelemetryProblems";
export { TelemetryAutoInstrumentationProblem } from "./libs/problems/TelemetryAutoInstrumentationProblem";

/**
 * 확률 기반 샘플링을 수행하는 OpenTelemetry 샘플러 구현체입니다.
 */
export { ProbabilitySampler } from "./libs/samplers/ProbabilitySampler";
export type { ForceFlushResult } from "./runtime";

export { TelemetryRuntime } from "./runtime";
export { TelemetryDiagnosticsProvider } from "./libs/diagnostics/TelemetryDiagnosticsProvider";
