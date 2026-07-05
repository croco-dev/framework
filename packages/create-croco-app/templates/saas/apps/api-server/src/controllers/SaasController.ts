import { Component } from "@croco/framework-context";
import {
  Controller,
  Get,
  Post,
  ProblemResponses,
  routeProblemResponses,
} from "@croco/protocols-rest";
import { seedSaasDemoRoute, smokeSaasDemoRoute } from "./schemas";

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
  @Post(seedSaasDemoRoute)
  @ProblemResponses(...routeProblemResponses(seedSaasDemoRoute))
  async seedDemo() {
    await assertDemoEndpointsEnabled();
    const { runSaasDemoFlow } = await import("../saasDemo");
    return runSaasDemoFlow();
  }

  @Get(smokeSaasDemoRoute)
  @ProblemResponses(...routeProblemResponses(smokeSaasDemoRoute))
  async smokeDemo() {
    await assertDemoEndpointsEnabled();
    const { runSaasDemoFlow } = await import("../saasDemo");
    return runSaasDemoFlow();
  }
}
