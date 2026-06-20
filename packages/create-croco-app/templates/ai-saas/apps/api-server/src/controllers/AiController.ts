import { Body, Controller, Get, Header, Post, ResponseSchema } from "@croco/protocols-rest";
import {
  aiGenerateRequestSchema,
  aiGenerateResponseSchema,
  aiInvocationLogListSchema,
  aiUsageStateSchema,
  optionalTenantIdHeaderSchema,
  type AiGenerateRequestDto,
} from "./aiSchemas";

@Controller("/ai")
export class AiController {
  @Post("/generate")
  @ResponseSchema(aiGenerateResponseSchema)
  async generate(
    @Header("x-tenant-id", optionalTenantIdHeaderSchema) tenantId: string | undefined,
    @Body(aiGenerateRequestSchema) body: AiGenerateRequestDto,
  ) {
    const { defaultAiSaasRuntime } = await import("../aiSaas");
    return defaultAiSaasRuntime.service.generateText({
      tenantId,
      requestId: body.requestId,
      prompt: body.prompt,
      modelId: body.modelId,
    });
  }

  @Get("/usage")
  @ResponseSchema(aiUsageStateSchema)
  async usage(@Header("x-tenant-id", optionalTenantIdHeaderSchema) tenantId: string | undefined) {
    const { defaultAiSaasRuntime } = await import("../aiSaas");
    return defaultAiSaasRuntime.service.getUsageState(tenantId);
  }

  @Get("/invocations")
  @ResponseSchema(aiInvocationLogListSchema)
  async invocations(
    @Header("x-tenant-id", optionalTenantIdHeaderSchema) tenantId: string | undefined,
  ) {
    const { defaultAiSaasRuntime } = await import("../aiSaas");
    return defaultAiSaasRuntime.service.listInvocationLogs(tenantId);
  }
}
