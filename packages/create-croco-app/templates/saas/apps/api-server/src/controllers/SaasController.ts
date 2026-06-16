import { Controller, Get, Post, ResponseSchema } from "@croco/protocols-rest";
import { saasDemoSnapshotSchema } from "./schemas";

async function assertDemoEndpointsEnabled(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    const { DemoEndpointDisabledProblem } = await import("../problems");
    throw new DemoEndpointDisabledProblem();
  }
}

@Controller("/saas")
export class SaasController {
  @Post("/demo/seed")
  @ResponseSchema(saasDemoSnapshotSchema)
  async seedDemo() {
    await assertDemoEndpointsEnabled();
    const { runSaasDemoFlow } = await import("../saasDemo");
    return runSaasDemoFlow();
  }

  @Get("/demo/smoke")
  @ResponseSchema(saasDemoSnapshotSchema)
  async smokeDemo() {
    await assertDemoEndpointsEnabled();
    const { runSaasDemoFlow } = await import("../saasDemo");
    return runSaasDemoFlow();
  }
}
