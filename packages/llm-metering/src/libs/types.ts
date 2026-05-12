import type { UsageAccuracy as LlmCoreUsageAccuracy } from "@croco/llm-core";

export type UsageAccuracy = LlmCoreUsageAccuracy;

export const PROMPT_TOKENS = "llm.prompt_tokens";
export const COMPLETION_TOKENS = "llm.completion_tokens";
export const EMBEDDING_TOKENS = "llm.embedding_tokens";
export const COST_USD = "llm.cost_usd";

export type LlmUsageRecord = {
  promptTokens: number;
  completionTokens: number;
  modelId: string;
  provider: string;
  costUsd: number;
  accuracy?: UsageAccuracy;
  idempotencyKey: string;
  tenantId: string;
  timestamp: Date;
};

export type LlmEmbeddingUsageRecord = {
  embeddingTokens: number;
  modelId: string;
  provider: string;
  costUsd: number;
  accuracy?: UsageAccuracy;
  idempotencyKey: string;
  tenantId: string;
  timestamp: Date;
};

export type ModelPricing = {
  inputPricePerToken: number;
  outputPricePerToken: number;
  currency: string;
};

export type LlmCostBudget = {
  dailyLimit: number;
  monthlyLimit?: number;
  tenantId: string;
};
