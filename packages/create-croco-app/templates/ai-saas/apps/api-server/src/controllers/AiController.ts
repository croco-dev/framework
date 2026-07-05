import { Component } from "@croco/framework-context";
import { Body, Controller, Get, Header, Post, ResponseSchema } from "@croco/protocols-rest";
import {
  aiGenerateRequestSchema,
  aiGenerateResponseSchema,
  aiInvocationLogListSchema,
  aiUsageStateSchema,
  OPTIONAL_TENANT_ID_HEADER_SCHEMA,
  type AiGenerateRequestDto,
} from "./aiSchemas";

@Component()
@Controller("/ai")
export class AiController {
  @Post("/generate")
  @ResponseSchema(aiGenerateResponseSchema)
  async generate(
    @Header("x-tenant-id", OPTIONAL_TENANT_ID_HEADER_SCHEMA) tenantId: string | undefined,
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
  async usage(
    @Header("x-tenant-id", OPTIONAL_TENANT_ID_HEADER_SCHEMA) tenantId: string | undefined,
  ) {
    const { defaultAiSaasRuntime } = await import("../aiSaas");
    return defaultAiSaasRuntime.service.getUsageState(tenantId);
  }

  @Get("/invocations")
  @ResponseSchema(aiInvocationLogListSchema)
  async invocations(
    @Header("x-tenant-id", OPTIONAL_TENANT_ID_HEADER_SCHEMA) tenantId: string | undefined,
  ) {
    const { defaultAiSaasRuntime } = await import("../aiSaas");
    return defaultAiSaasRuntime.service.listInvocationLogs(tenantId);
  }
}
