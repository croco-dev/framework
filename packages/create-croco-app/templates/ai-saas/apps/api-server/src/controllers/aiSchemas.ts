import { z } from "zod";

export const OPTIONAL_TENANT_ID_HEADER_SCHEMA = z.string().min(1).optional();

export const aiGenerateRequestSchema = z.object({
  requestId: z.string().min(1),
  modelId: z.string().min(1).optional(),
  prompt: z.string().min(1).max(4000),
});

export type AiGenerateRequestDto = z.infer<typeof aiGenerateRequestSchema>;

export const aiUsageSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  embeddingTokens: z.number(),
  totalTokens: z.number(),
  costUsd: z.number(),
});

export const aiQuotaSchema = z.object({
  monthlyTokenBudget: z.number(),
  monthlyCostBudgetUsd: z.number(),
  remainingTokens: z.number(),
  remainingCostUsd: z.number(),
  status: z.enum(["ok", "over_quota"]),
});

export const aiInvocationLogSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  requestId: z.string(),
  modelId: z.string(),
  provider: z.string(),
  promptMetadata: z.object({
    length: z.number(),
    rawPromptStored: z.boolean(),
  }),
  responseMetadata: z.object({
    length: z.number(),
    rawResponseStored: z.boolean(),
  }),
  latencyMs: z.number(),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
    accuracy: z.enum(["EXACT", "ESTIMATED", "UNKNOWN"]).optional(),
  }),
  costUsd: z.number(),
  status: z.enum(["completed", "over_quota", "failed"]),
  errorCategory: z.string().nullable(),
  createdAt: z.string(),
});

export const aiUsageStateSchema = z.object({
  tenantId: z.string(),
  planId: z.enum(["free", "pro", "team"]),
  modelId: z.string(),
  provider: z.string(),
  usage: aiUsageSchema,
  quota: aiQuotaSchema,
});

export const aiGenerateResponseSchema = z.object({
  tenantId: z.string(),
  planId: z.enum(["free", "pro", "team"]),
  modelId: z.string(),
  provider: z.string(),
  text: z.string(),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
    accuracy: z.enum(["EXACT", "ESTIMATED", "UNKNOWN"]).optional(),
  }),
  costUsd: z.number(),
  quota: aiQuotaSchema,
  invocation: aiInvocationLogSchema,
  idempotencyKey: z.string(),
});

export const aiInvocationLogListSchema = z.array(aiInvocationLogSchema);
