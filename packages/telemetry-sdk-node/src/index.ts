/**
 * 트레이스와 런타임 초기화에 사용하는 설정 타입입니다.
 */
export type { TelemetryConfig, TraceConfig } from "./config";
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
/**
 * AWS Lambda 환경에 맞는 기본 Telemetry 설정을 생성하는 프리셋입니다.
 */
export { lambdaPreset } from "./libs/presets/lambda";

/**
 * OTLP와 샘플러 설정 오류를 나타내는 Problem 타입입니다.
 */
export {
  OtlpEndpointRequiredProblem,
  SamplerProblem,
  TelemetryBatchConfigurationProblem,
  TelemetryForceFlushUnsupportedProblem,
  TelemetryInitializationConflictProblem,
  TelemetryShutdownTimeoutInvalidProblem,
  TelemetryShutdownTimeoutProblem,
} from "./libs/problems/TelemetryProblems";
export type {
  TelemetryBatchConfigurationConstraint,
  TelemetryBatchConfigurationField,
} from "./libs/problems/TelemetryProblems";
export { TelemetryAutoInstrumentationProblem } from "./libs/problems/TelemetryAutoInstrumentationProblem";

/**
 * 확률 기반 샘플링을 수행하는 OpenTelemetry 샘플러 구현체입니다.
 */
export { ProbabilitySampler } from "./libs/samplers/ProbabilitySampler";
export type { ForceFlushResult, ShutdownResult, TelemetryLifecycleSkipReason } from "./runtime";

export { TelemetryRuntime } from "./runtime";
export { TelemetryDiagnosticsProvider } from "./libs/diagnostics/TelemetryDiagnosticsProvider";
export { nodeTelemetry, TELEMETRY_RUNTIME_TOKEN } from "./libs/NodeTelemetryPlugin";
export type { NodeTelemetryPluginOptions } from "./libs/NodeTelemetryPlugin";
export type {
  TelemetryConfiguredDiagnosticsDetails,
  TelemetryDiagnosticsDetails,
  TelemetryDiagnosticsHealthStatus,
  TelemetryDiagnosticsMode,
  TelemetryDiagnosticsProviderOptions,
  TelemetryDiagnosticsRequirement,
  TelemetryNotConfiguredDiagnosticsDetails,
  TelemetryStartupFailedDiagnosticsDetails,
} from "./libs/diagnostics/TelemetryDiagnosticsProvider";
