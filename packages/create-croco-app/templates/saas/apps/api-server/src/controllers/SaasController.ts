import { Component } from "@croco/framework-context";
import { Controller, Get, Post, ResponseSchema } from "@croco/protocols-rest";
import { saasDemoSnapshotSchema } from "./schemas";

export async function assertDemoEndpointsEnabled(): Promise<void> {
  const { isSaasDemoEndpointEnabled } = await import("../providerProfiles");
  if (!isSaasDemoEndpointEnabled()) {
    const { DemoEndpointDisabledProblem } = await import("../problems");
    throw new DemoEndpointDisabledProblem();
  }
}

@Component()
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
