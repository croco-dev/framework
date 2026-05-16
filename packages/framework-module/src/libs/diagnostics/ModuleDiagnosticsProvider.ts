import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { getRegisteredModules } from "../../ModuleRegistry";

export class ModuleDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "modules";

  async getHealth(): Promise<HealthStatus> {
    const modules = getRegisteredModules();
    const initializedCount = modules.filter((m) => m.initialized).length;
    const totalCount = modules.length;

    if (totalCount === 0) {
      return {
        status: "unhealthy",
        component: "modules",
        message: "No modules registered",
        details: { totalModuleCount: 0, initializedModuleCount: 0, moduleList: [] },
        lastChecked: new Date().toISOString(),
      };
    }
    if (initializedCount < totalCount) {
      return {
        status: "degraded",
        component: "modules",
        message: `${totalCount - initializedCount} module(s) not initialized`,
        details: {
          totalModuleCount: totalCount,
          initializedModuleCount: initializedCount,
          moduleList: modules.map((m) => m.name),
        },
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      status: "healthy",
      component: "modules",
      details: {
        totalModuleCount: totalCount,
        initializedModuleCount: initializedCount,
        moduleList: modules.map((m) => m.name),
      },
      lastChecked: new Date().toISOString(),
    };
  }
}
