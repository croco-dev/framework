import type { UsageAccuracy as LlmCoreUsageAccuracy } from "@croco/llm-core";

export type UsageAccuracy = LlmCoreUsageAccuracy;

export const PROMPT_TOKENS = "llm.prompt_tokens";
export const COMPLETION_TOKENS = "llm.completion_tokens";
export const EMBEDDING_TOKENS = "llm.embedding_tokens";
export const COST_USD = "llm.cost_usd";

export type LlmMeterId =
  | typeof PROMPT_TOKENS
  | typeof COMPLETION_TOKENS
  | typeof EMBEDDING_TOKENS
  | typeof COST_USD;

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
  source?: string;
  effectiveDate?: string;
};

export type PricingRegistryEntry = ModelPricing & {
  provider: string;
  modelId: string;
};

export type PricingRegistryDefinition = {
  version: string;
  entries: readonly PricingRegistryEntry[];
  source?: string;
  effectiveDate?: string;
  notes?: string;
};

export type LlmCostBudget = {
  dailyLimit: number;
  monthlyLimit?: number;
  tenantId: string;
};

export type LlmMeteringFailurePolicy = "fail-closed";

export type LlmMeterUsageDelta = {
  meterId: LlmMeterId;
  value: number;
  operation: "generate" | "stream" | "embed" | "cost_tracking" | string;
};

export type LlmQuotaPolicyContext = {
  tenantId: string;
  modelId: string;
  provider: string;
  operation: string;
  idempotencyKey: string;
  meters: readonly LlmMeterUsageDelta[];
  metadata?: Record<string, unknown>;
};

export interface LlmQuotaPolicy {
  enforce(context: LlmQuotaPolicyContext): Promise<void>;
}
