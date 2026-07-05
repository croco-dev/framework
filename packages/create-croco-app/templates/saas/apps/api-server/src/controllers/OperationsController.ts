import { Component } from "@croco/framework-context";
import { Controller, Get } from "@croco/protocols-rest";
import { diagnosticsRoute, healthRoute } from "./schemas";

@Component()
@Controller("/ops")
export class OperationsController {
  @Get(healthRoute)
  async health() {
    const { defaultSaasRuntime } = await import("../saasDemo");
    return defaultSaasRuntime.healthService.check();
  }

  @Get(diagnosticsRoute)
  async diagnostics() {
    const { defaultSaasRuntime } = await import("../saasDemo");
    return defaultSaasRuntime.diagnosticsCollector.getReport();
  }
}
