import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { Container } from "../Container";

export class ContainerDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "container";

  async getHealth(): Promise<HealthStatus> {
    const snap = Container.getDiagnosticsSnapshot();
    if (snap.registeredServiceCount > 0) {
      return {
        status: "healthy",
        component: "container",
        details: snap,
        lastChecked: new Date().toISOString(),
      };
    }
    if (snap.isInitialized) {
      return {
        status: "degraded",
        component: "container",
        message: "No services registered",
        details: snap,
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      status: "unhealthy",
      component: "container",
      message: "Container not validated",
      details: snap,
      lastChecked: new Date().toISOString(),
    };
  }
}
