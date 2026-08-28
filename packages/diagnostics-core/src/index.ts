// @croco/diagnostics-core

export { DiagnosticsCollector } from "./libs/DiagnosticsCollector";
export { DiagnosticsHealthIndicator } from "./libs/DiagnosticsHealthIndicator";
export {
  CROCO_DIAGNOSTIC_CODE_DEFINITIONS,
  DIAGNOSTIC_CODE_CHANGE_POLICY,
  DIAGNOSTIC_CODE_PATTERN,
  createDiagnosticMessage,
  formatDiagnosticMessage,
  formatDiagnosticSourceLocation,
  getDiagnosticCodeDefinition,
  isDiagnosticCode,
} from "./libs/DiagnosticCodes";
export { ErrorHistoryRingBuffer } from "./libs/ErrorHistoryRingBuffer";
export {
  DuplicateDiagnosticsProviderProblem,
  InvalidDiagnosticsTimeoutProblem,
  MAX_DIAGNOSTICS_TIMEOUT_MS,
} from "./libs/problems/DiagnosticsProblems";
export type {
  CreateDiagnosticMessageOptions,
  DiagnosticCategory,
  DiagnosticCode,
  DiagnosticCodeDefinition,
  DiagnosticFixExample,
  DiagnosticMessage,
  DiagnosticSeverity,
  DiagnosticSourceLocation,
} from "./libs/DiagnosticCodes";
export type {
  DiagnosticsCollectorOptions,
  DiagnosticsProvider,
  DiagnosticsProviderOptions,
  HealthStatus,
  ErrorRecord,
  DiagnosticsReport,
} from "./libs/types";
export type { DiagnosticsHealthIndicatorPolicy } from "./libs/DiagnosticsHealthIndicator";
export type { DiagnosticsTimeoutSource } from "./libs/problems/DiagnosticsProblems";
