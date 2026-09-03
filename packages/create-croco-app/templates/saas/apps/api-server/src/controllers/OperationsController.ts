import { Controller, Get } from "@croco/protocols-rest";
import { getSaasRuntimeState } from "../saasDemo";
import { diagnosticsRoute, healthRoute } from "./schemas";

@Controller("/ops")
export class OperationsController {
  @Get(healthRoute)
  async health() {
    return getSaasRuntimeState().current.healthService.check();
  }

  @Get(diagnosticsRoute)
  async diagnostics() {
    return getSaasRuntimeState().current.diagnosticsCollector.getReport();
  }
}
