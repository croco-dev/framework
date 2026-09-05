import {
  Controller,
  Get,
  Post,
  ProblemResponses,
  routeProblemResponses,
} from "@croco/protocols-rest";
import { getSaasRuntimeState, runSaasDemoFlow } from "../saasDemo";
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
    return runSaasDemoFlow(getSaasRuntimeState().reset());
  }

  @Get(smokeSaasDemoRoute)
  @ProblemResponses(...routeProblemResponses(smokeSaasDemoRoute))
  async smokeDemo() {
    await assertDemoEndpointsEnabled();
    return runSaasDemoFlow(getSaasRuntimeState().reset());
  }
}
