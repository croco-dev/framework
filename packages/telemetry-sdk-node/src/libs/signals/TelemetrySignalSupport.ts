import type { TelemetryConfig } from "../../config";

export type TelemetrySignalName = "logs" | "metrics" | "traces";
export type UnsupportedTelemetrySignalName = Exclude<TelemetrySignalName, "traces">;
export type TelemetrySignalSupportState = "disabled" | "supported" | "unsupported-requested";
export type TelemetrySignalSupport = Record<TelemetrySignalName, TelemetrySignalSupportState>;

export function getTelemetrySignalSupport(config: TelemetryConfig): TelemetrySignalSupport {
  const runtimeEnabled = config.enabled !== false;

  return {
    logs: config.logs?.enabled === true ? "unsupported-requested" : "disabled",
    metrics: config.metrics?.enabled === true ? "unsupported-requested" : "disabled",
    traces: runtimeEnabled && config.trace?.enabled !== false ? "supported" : "disabled",
  };
}

export function getUnsupportedTelemetrySignals(
  config: TelemetryConfig,
): readonly [UnsupportedTelemetrySignalName, ...UnsupportedTelemetrySignalName[]] | undefined {
  const support = getTelemetrySignalSupport(config);
  const signals: UnsupportedTelemetrySignalName[] = [];

  if (support.metrics === "unsupported-requested") {
    signals.push("metrics");
  }
  if (support.logs === "unsupported-requested") {
    signals.push("logs");
  }

  const firstSignal = signals[0];
  return firstSignal ? [firstSignal, ...signals.slice(1)] : undefined;
}
