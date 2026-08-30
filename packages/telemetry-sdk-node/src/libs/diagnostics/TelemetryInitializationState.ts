import type { TelemetryConfig } from "../../config";
import { resolveDeploymentEnvironment } from "../resources/DeploymentEnvironment";

export type TelemetryConfigurationDiagnosticsSnapshot = {
  readonly serviceName: string;
  readonly environment: string;
  readonly enabled: boolean;
  readonly traceEnabled: boolean;
  readonly probability?: number;
  readonly signals: { readonly traces: "disabled" | "supported" };
};

export type TelemetryInitializationFailure = {
  readonly snapshot: TelemetryConfigurationDiagnosticsSnapshot;
  readonly code: string;
};

const initializationFailures = new WeakMap<object, TelemetryInitializationFailure>();

export function clearTelemetryInitializationFailure(runtime: object): void {
  initializationFailures.delete(runtime);
}

export function createTelemetryConfigurationDiagnosticsSnapshot(
  config: TelemetryConfig,
): TelemetryConfigurationDiagnosticsSnapshot {
  const enabled = config.enabled !== false;
  const traceEnabled = enabled && config.trace?.enabled !== false;
  return {
    serviceName: config.serviceName,
    environment: resolveDeploymentEnvironment(config),
    enabled,
    traceEnabled,
    ...(config.trace?.probability !== undefined && { probability: config.trace.probability }),
    signals: { traces: traceEnabled ? "supported" : "disabled" },
  };
}

export function getTelemetryInitializationFailure(
  runtime: object,
): TelemetryInitializationFailure | undefined {
  return initializationFailures.get(runtime);
}

export function recordTelemetryInitializationFailure(
  runtime: object,
  config: TelemetryConfig,
  error: unknown,
): void {
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "TELEMETRY_RUNTIME_ERROR";
  initializationFailures.set(runtime, {
    snapshot: createTelemetryConfigurationDiagnosticsSnapshot(config),
    code,
  });
}
