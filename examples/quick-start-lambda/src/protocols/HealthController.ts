import { Controller, Get } from "@croco/protocols-rest";

@Controller("/api")
export class HealthController {
  @Get("/health")
  health() {
    return { status: "ok" };
  }
}
