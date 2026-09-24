import { Inject } from "@croco/framework-context";
import {
  Controller,
  Get,
  Post,
  ProblemResponses,
  routeProblemResponses,
} from "@croco/protocols-rest";
import { SAAS_RUNTIME_STATE_TOKEN, runSaasDemoFlow, type SaasRuntimeState } from "../saasDemo";
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
  constructor(
    @Inject(SAAS_RUNTIME_STATE_TOKEN)
    private readonly runtimeState: SaasRuntimeState,
  ) {}

  @Post(seedSaasDemoRoute)
  @ProblemResponses(...routeProblemResponses(seedSaasDemoRoute))
  async seedDemo() {
    await assertDemoEndpointsEnabled();
    return runSaasDemoFlow(this.runtimeState.reset());
  }

  @Get(smokeSaasDemoRoute)
  @ProblemResponses(...routeProblemResponses(smokeSaasDemoRoute))
  async smokeDemo() {
    await assertDemoEndpointsEnabled();
    return runSaasDemoFlow(this.runtimeState.reset());
  }
}
