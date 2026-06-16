import { Controller, Get, Post, ResponseSchema } from "@croco/protocols-rest";
import { saasDemoSnapshotSchema } from "./schemas";

@Controller("/saas")
export class SaasController {
  @Post("/demo/seed")
  @ResponseSchema(saasDemoSnapshotSchema)
  async seedDemo() {
    const { runSaasDemoFlow } = await import("../saasDemo");
    return runSaasDemoFlow();
  }

  @Get("/demo/smoke")
  @ResponseSchema(saasDemoSnapshotSchema)
  async smokeDemo() {
    const { runSaasDemoFlow } = await import("../saasDemo");
    return runSaasDemoFlow();
  }
}
