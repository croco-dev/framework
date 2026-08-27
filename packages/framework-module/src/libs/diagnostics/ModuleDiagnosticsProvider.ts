import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import { defaultModuleRuntime } from "../../ModuleRegistry";
import type { ModuleRuntime } from "../../ModuleRegistry";

export class ModuleDiagnosticsProvider implements DiagnosticsProvider {
  readonly name = "modules";

  constructor(
    private readonly runtime: Pick<ModuleRuntime, "getRegisteredModules"> = defaultModuleRuntime,
  ) {}

  async getHealth(): Promise<HealthStatus> {
    const modules = this.runtime.getRegisteredModules();
    const initializedCount = modules.filter((m) => m.initialized).length;
    const totalCount = modules.length;
    const details = {
      totalModuleCount: totalCount,
      registeredModuleCount: totalCount,
      initializedModuleCount: initializedCount,
      moduleList: modules.map((m) => m.name),
      modules,
    };

    if (totalCount === 0) {
      return {
        status: "unhealthy",
        component: "modules",
        message: "No modules registered",
        details,
        lastChecked: new Date().toISOString(),
      };
    }
    if (initializedCount < totalCount) {
      return {
        status: "degraded",
        component: "modules",
        message: `${totalCount - initializedCount} module(s) not initialized`,
        details,
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      status: "healthy",
      component: "modules",
      details,
      lastChecked: new Date().toISOString(),
    };
  }
}
