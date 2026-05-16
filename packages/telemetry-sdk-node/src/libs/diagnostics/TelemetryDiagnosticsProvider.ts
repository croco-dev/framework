import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { TelemetryRuntime } from "../../runtime";

export class TelemetryDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "telemetry";

  async getHealth(): Promise<HealthStatus> {
    const runtime = TelemetryRuntime.getInstance();
    if (!runtime.isInitialized()) {
      return {
        status: "unhealthy",
        component: "telemetry",
        message: "Telemetry runtime not initialized",
        lastChecked: new Date().toISOString(),
      };
    }
    const config = runtime.getConfig();
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
        details: {
          serviceName: config.serviceName,
          probability: 0,
          enabled: config.enabled !== false,
        },
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      status: "healthy",
      component: "telemetry",
      details: { serviceName: config.serviceName, probability, enabled: config.enabled !== false },
      lastChecked: new Date().toISOString(),
    };
  }
}
