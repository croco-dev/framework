import { describe, expect, it } from "vitest";
import type {
  AiCostBudget,
  AiEmbeddingUsageRecord,
  AiUsageRecord,
  ModelPricing,
  UsageAccuracy,
} from "../libs/types";
import {
  AI_OUTPUT_TOKENS,
  AI_COST_USD_NANOS,
  AI_EMBEDDING_TOKENS,
  AI_INPUT_TOKENS,
} from "../libs/types";

describe("types", () => {
  describe("AiMeterIds", () => {
    it("should have AI_INPUT_TOKENS constant", () => {
      expect(AI_INPUT_TOKENS).toBe("llm.prompt_tokens");
    });

    it("should have AI_OUTPUT_TOKENS constant", () => {
      expect(AI_OUTPUT_TOKENS).toBe("llm.completion_tokens");
    });

    it("should have AI_EMBEDDING_TOKENS constant", () => {
      expect(AI_EMBEDDING_TOKENS).toBe("llm.embedding_tokens");
    });

    it("should expose the integer USD nanodollar meter", () => {
      expect(AI_COST_USD_NANOS).toBe("llm.cost_usd_nanos");
    });
  });

  describe("AiUsageRecord", () => {
    it("should define type with required fields", () => {
      const record: AiUsageRecord = {
        inputTokens: 100,
        outputTokens: 50,
        modelId: "gpt-4",
        provider: "openai",
        costUsd: 0.003,
        accuracy: "EXACT",
        idempotencyKey: "test-key",
        tenantId: "tenant-123",
        timestamp: new Date(),
      };

      expect(record.inputTokens).toBe(100);
      expect(record.outputTokens).toBe(50);
      expect(record.modelId).toBe("gpt-4");
      expect(record.provider).toBe("openai");
      expect(record.costUsd).toBe(0.003);
      expect(record.accuracy).toBe("EXACT");
    });

    it("should allow optional accuracy field", () => {
      const record: AiUsageRecord = {
        inputTokens: 100,
        outputTokens: 50,
        modelId: "gpt-4",
        provider: "openai",
        costUsd: 0.003,
        idempotencyKey: "test-key",
        tenantId: "tenant-123",
        timestamp: new Date(),
      };

      expect(record.accuracy).toBeUndefined();
    });
  });

  describe("AiEmbeddingUsageRecord", () => {
    it("should define type with required fields", () => {
      const record: AiEmbeddingUsageRecord = {
        embeddingTokens: 256,
        modelId: "text-embedding-ada-002",
        provider: "openai",
        costUsd: 0.0001,
        accuracy: "EXACT",
        idempotencyKey: "test-key",
        tenantId: "tenant-123",
        timestamp: new Date(),
      };

      expect(record.embeddingTokens).toBe(256);
      expect(record.modelId).toBe("text-embedding-ada-002");
      expect(record.provider).toBe("openai");
      expect(record.costUsd).toBe(0.0001);
    });
  });

  describe("ModelPricing", () => {
    it("should define type with pricing fields", () => {
      const pricing: ModelPricing = {
        inputPricePerToken: 0.00003,
        outputPricePerToken: 0.00006,
        currency: "USD",
      };

      expect(pricing.inputPricePerToken).toBe(0.00003);
      expect(pricing.outputPricePerToken).toBe(0.00006);
      expect(pricing.currency).toBe("USD");
    });
  });

  describe("AiCostBudget", () => {
    it("should define type with budget fields", () => {
      const budget: AiCostBudget = {
        dailyLimit: 10.0,
        monthlyLimit: 100.0,
        tenantId: "tenant-123",
      };

      expect(budget.dailyLimit).toBe(10.0);
      expect(budget.monthlyLimit).toBe(100.0);
      expect(budget.tenantId).toBe("tenant-123");
    });

    it("should allow optional monthlyLimit", () => {
      const budget: AiCostBudget = {
        dailyLimit: 10.0,
        tenantId: "tenant-123",
      };

      expect(budget.dailyLimit).toBe(10.0);
      expect(budget.monthlyLimit).toBeUndefined();
    });
  });

  describe("UsageAccuracy type", () => {
    const createRecord = (accuracy: UsageAccuracy): AiUsageRecord => ({
      inputTokens: 100,
      outputTokens: 50,
      modelId: "gpt-4",
      provider: "openai",
      costUsd: 0.003,
      accuracy,
      idempotencyKey: "test-key",
      tenantId: "tenant-123",
      timestamp: new Date(),
    });

    it("should accept EXACT value", () => {
      const record = createRecord("EXACT");
      expect(record.accuracy).toBe("EXACT");
    });

    it("should accept ESTIMATED value", () => {
      const record = createRecord("ESTIMATED");
      expect(record.accuracy).toBe("ESTIMATED");
    });

    it("should accept UNKNOWN value", () => {
      const record = createRecord("UNKNOWN");
      expect(record.accuracy).toBe("UNKNOWN");
    });
  });

  describe("Provider type", () => {
    const createRecord = (provider: string): AiUsageRecord => ({
      inputTokens: 100,
      outputTokens: 50,
      modelId: "gpt-4",
      provider,
      costUsd: 0.003,
      idempotencyKey: "test-key",
      tenantId: "tenant-123",
      timestamp: new Date(),
    });

    it("should accept openai provider", () => {
      const record = createRecord("openai");
      expect(record.provider).toBe("openai");
    });

    it("should accept anthropic provider", () => {
      const record = createRecord("anthropic");
      expect(record.provider).toBe("anthropic");
    });

    it("should accept custom provider string", () => {
      const record = createRecord("custom-provider");
      expect(record.provider).toBe("custom-provider");
    });
  });
});
