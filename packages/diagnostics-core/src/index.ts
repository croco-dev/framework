// @croco/diagnostics-core

export { DiagnosticsCollector } from "./libs/DiagnosticsCollector";
export { ErrorHistoryRingBuffer } from "./libs/ErrorHistoryRingBuffer";
export { DuplicateDiagnosticsProviderProblem } from "./libs/problems/DiagnosticsProblems";
export type {
  DiagnosticsCollectorOptions,
  DiagnosticsProvider,
  DiagnosticsProviderOptions,
  HealthStatus,
  ErrorRecord,
  DiagnosticsReport,
} from "./libs/types";
