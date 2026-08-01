import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  ProblemResponses,
  type RouteBody,
  routeProblemResponses,
} from "@croco/protocols-rest";
import {
  aiInvocationsRoute,
  aiUsageRoute,
  generateAiRoute,
  OPTIONAL_TENANT_ID_HEADER_SCHEMA,
} from "./aiSchemas";

@Controller("/ai")
export class AiController {
  @Post(generateAiRoute)
  @ProblemResponses(...routeProblemResponses(generateAiRoute))
  async generate(
    @Header("x-tenant-id", OPTIONAL_TENANT_ID_HEADER_SCHEMA) tenantId: string | undefined,
    @Body(generateAiRoute) body: RouteBody<typeof generateAiRoute>,
  ) {
    const { defaultAiSaasRuntime } = await import("../aiSaas");
    return defaultAiSaasRuntime.service.generateText({
      tenantId,
      requestId: body.requestId,
      prompt: body.prompt,
      modelId: body.modelId,
    });
  }

  @Get(aiUsageRoute)
  @ProblemResponses(...routeProblemResponses(aiUsageRoute))
  async usage(
    @Header("x-tenant-id", OPTIONAL_TENANT_ID_HEADER_SCHEMA) tenantId: string | undefined,
  ) {
    const { defaultAiSaasRuntime } = await import("../aiSaas");
    return defaultAiSaasRuntime.service.getUsageState(tenantId);
  }

  @Get(aiInvocationsRoute)
  @ProblemResponses(...routeProblemResponses(aiInvocationsRoute))
  async invocations(
    @Header("x-tenant-id", OPTIONAL_TENANT_ID_HEADER_SCHEMA) tenantId: string | undefined,
  ) {
    const { defaultAiSaasRuntime } = await import("../aiSaas");
    return defaultAiSaasRuntime.service.listInvocationLogs(tenantId);
  }
}
