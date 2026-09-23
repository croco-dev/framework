import { Inject } from "@croco/framework-context";
import { Controller, Get } from "@croco/protocols-rest";
import { SAAS_RUNTIME_STATE_TOKEN, type SaasRuntimeState } from "../saasDemo";
import { diagnosticsRoute, healthRoute } from "./schemas";

@Controller("/ops")
export class OperationsController {
  constructor(
    @Inject(SAAS_RUNTIME_STATE_TOKEN)
    private readonly runtimeState: SaasRuntimeState,
  ) {}

  @Get(healthRoute)
  async health() {
    return this.runtimeState.current.healthService.check();
  }

  @Get(diagnosticsRoute)
  async diagnostics() {
    return this.runtimeState.current.diagnosticsCollector.getReport();
  }
}
