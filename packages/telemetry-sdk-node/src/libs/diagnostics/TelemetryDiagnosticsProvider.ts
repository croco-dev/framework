import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { TelemetryRuntime } from "../../runtime";
import {
  getTelemetrySignalSupport,
  getUnsupportedTelemetrySignals,
} from "../signals/TelemetrySignalSupport";

export class TelemetryDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "telemetry";

  async getHealth(): Promise<HealthStatus> {
    const runtime = TelemetryRuntime.getInstance();
    const config = runtime.getConfig();
    const initialized = runtime.isInitialized();

    if (config) {
      const unsupportedSignals = getUnsupportedTelemetrySignals(config);

      if (unsupportedSignals) {
        return {
          status: "unhealthy",
          component: "telemetry",
          message: `Unsupported telemetry signals requested: ${unsupportedSignals.join(", ")}`,
          details: createSafeTelemetryDetails(config, initialized, "unsupported_requested"),
          lastChecked: new Date().toISOString(),
        };
      }
    }

    if (config?.enabled === false || config?.trace?.enabled === false) {
      const disabledTarget = config.enabled === false ? "runtime" : "tracing";
      return {
        status: "degraded",
        component: "telemetry",
        message: `Telemetry ${disabledTarget} disabled by configuration; SDK startup and export are skipped`,
        details: createSafeTelemetryDetails(config, initialized, "disabled"),
        lastChecked: new Date().toISOString(),
      };
    }

    if (!initialized) {
      return {
        status: "unhealthy",
        component: "telemetry",
        message: "Telemetry runtime not initialized",
        ...(config && {
          details: createSafeTelemetryDetails(config, initialized, "not_initialized"),
        }),
        lastChecked: new Date().toISOString(),
      };
    }

    if (!config) {
      return {
        status: "unhealthy",
        component: "telemetry",
        message: "Telemetry config not available",
        lastChecked: new Date().toISOString(),
      };
    }
    const probability = config.trace?.probability;
    if (probability === 0) {
      return {
        status: "degraded",
        component: "telemetry",
        message: "Telemetry sampling disabled (probability=0)",
        details: createSafeTelemetryDetails(config, initialized, "sampling_disabled"),
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      status: "healthy",
      component: "telemetry",
      details: createSafeTelemetryDetails(config, initialized, "active"),
      lastChecked: new Date().toISOString(),
    };
  }
}

function createSafeTelemetryDetails(
  config: NonNullable<ReturnType<TelemetryRuntime["getConfig"]>>,
  initialized: boolean,
  mode: "active" | "disabled" | "not_initialized" | "sampling_disabled" | "unsupported_requested",
): Record<string, unknown> {
  const enabled = config.enabled !== false;
  return {
    serviceName: config.serviceName,
    enabled,
    initialized,
    traceEnabled: enabled && config.trace?.enabled !== false,
    probability: config.trace?.probability,
    signals: getTelemetrySignalSupport(config),
    autoInstrumentationModules:
      TelemetryRuntime.getInstance().getEnabledAutoInstrumentationModules(),
    mode,
  };
}
