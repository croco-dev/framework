import { Controller, Get, ResponseSchema } from "@croco/protocols-rest";
import { diagnosticsSchema, healthSchema } from "./schemas";

@Controller("/ops")
export class OperationsController {
  @Get("/health")
  @ResponseSchema(healthSchema)
  async health() {
    const { defaultSaasRuntime } = await import("../saasDemo");
    return defaultSaasRuntime.healthService.check();
  }

  @Get("/diagnostics")
  @ResponseSchema(diagnosticsSchema)
  async diagnostics() {
    const { defaultSaasRuntime } = await import("../saasDemo");
    return defaultSaasRuntime.diagnosticsCollector.getReport();
  }
}
