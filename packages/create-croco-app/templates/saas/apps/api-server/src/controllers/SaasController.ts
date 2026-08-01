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

@Controller("/saas")
export class SaasController {
  @Post(seedSaasDemoRoute)
  @ProblemResponses(...routeProblemResponses(seedSaasDemoRoute))
  async seedDemo() {
    await assertDemoEndpointsEnabled();
    const { seedDefaultSaasRuntime } = await import("../saasDemo");
    return seedDefaultSaasRuntime();
  }

  @Get(smokeSaasDemoRoute)
  @ProblemResponses(...routeProblemResponses(smokeSaasDemoRoute))
  async smokeDemo() {
    await assertDemoEndpointsEnabled();
    const { seedDefaultSaasRuntime } = await import("../saasDemo");
    return seedDefaultSaasRuntime();
  }
}
