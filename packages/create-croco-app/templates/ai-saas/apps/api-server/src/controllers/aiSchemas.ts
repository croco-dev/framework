import { z } from "zod";
import { ProblemCategory } from "@croco/problems-core";
import { defineRouteContract, defineRouteProblem, HttpMethod } from "@croco/protocols-rest";
import {
  AiModelNotFoundProblem,
  AiModelRequiredProblem,
  AiProviderUnavailableProblem,
  AiQuotaExceededProblem,
  AiRateLimitExceededProblem,
  AiTenantNotFoundProblem,
  AiTenantRequiredProblem,
} from "../aiProblems";

const tenantRequiredProblem = defineRouteProblem(AiTenantRequiredProblem, {
  code: "ai-saas/tenant-required",
  category: ProblemCategory.ValidationError,
  description: "AI requests require an x-tenant-id header.",
});
const tenantNotFoundProblem = defineRouteProblem(AiTenantNotFoundProblem, {
  code: "ai-saas/tenant-not-found",
  category: ProblemCategory.NotFound,
  description: "The requested tenant does not exist.",
});
const modelRequiredProblem = defineRouteProblem(AiModelRequiredProblem, {
  code: "ai-saas/model-required",
  category: ProblemCategory.ValidationError,
  description: "AI generation requires a model id.",
});
const modelNotFoundProblem = defineRouteProblem(AiModelNotFoundProblem, {
  code: "ai-saas/model-not-found",
  category: ProblemCategory.NotFound,
  description: "The requested AI model is not registered.",
});
const quotaExceededProblem = defineRouteProblem(AiQuotaExceededProblem, {
  code: "ai-saas/quota-exceeded",
  category: ProblemCategory.TooManyRequests,
  description: "AI generation would exceed the tenant quota.",
});
const rateLimitExceededProblem = defineRouteProblem(AiRateLimitExceededProblem, {
  code: "ai-saas/rate-limit-exceeded",
  category: ProblemCategory.TooManyRequests,
  description: "AI generation exceeded the rate-limit window.",
});
const providerUnavailableProblem = defineRouteProblem(AiProviderUnavailableProblem, {
  code: "ai-saas/provider-unavailable",
  category: ProblemCategory.InternalServerError,
  description: "The configured AI provider is unavailable.",
});

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

export const generateAiRoute = defineRouteContract({
  id: "ai.generate",
  method: HttpMethod.POST,
  path: "/ai/generate",
  operationId: "generateAiText",
  body: aiGenerateRequestSchema,
  response: aiGenerateResponseSchema,
  problems: [
    tenantRequiredProblem,
    tenantNotFoundProblem,
    modelRequiredProblem,
    modelNotFoundProblem,
    quotaExceededProblem,
    rateLimitExceededProblem,
    providerUnavailableProblem,
  ],
});

export const aiUsageRoute = defineRouteContract({
  id: "ai.usage",
  method: HttpMethod.GET,
  path: "/ai/usage",
  operationId: "getAiUsage",
  response: aiUsageStateSchema,
  problems: [tenantRequiredProblem, tenantNotFoundProblem],
});

export const aiInvocationsRoute = defineRouteContract({
  id: "ai.invocations",
  method: HttpMethod.GET,
  path: "/ai/invocations",
  operationId: "listAiInvocations",
  response: aiInvocationLogListSchema,
  problems: [tenantRequiredProblem, tenantNotFoundProblem],
});
