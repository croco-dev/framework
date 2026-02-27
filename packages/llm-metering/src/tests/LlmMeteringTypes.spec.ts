import { describe, expect, it } from 'vitest';
import type {
  LlmCostBudget,
  LlmEmbeddingUsageRecord,
  LlmUsageRecord,
  ModelPricing,
  UsageAccuracy,
} from '../libs/types';
import { COMPLETION_TOKENS, COST_USD, EMBEDDING_TOKENS, PROMPT_TOKENS } from '../libs/types';

describe('types', () => {
  describe('LlmMeterIds', () => {
    it('should have PROMPT_TOKENS constant', () => {
      expect(PROMPT_TOKENS).toBe('llm.prompt_tokens');
    });

    it('should have COMPLETION_TOKENS constant', () => {
      expect(COMPLETION_TOKENS).toBe('llm.completion_tokens');
    });

    it('should have EMBEDDING_TOKENS constant', () => {
      expect(EMBEDDING_TOKENS).toBe('llm.embedding_tokens');
    });

    it('should have COST_USD constant', () => {
      expect(COST_USD).toBe('llm.cost_usd');
    });
  });

  describe('LlmUsageRecord', () => {
    it('should define type with required fields', () => {
      const record: LlmUsageRecord = {
        promptTokens: 100,
        completionTokens: 50,
        modelId: 'gpt-4',
        provider: 'openai',
        costUsd: 0.003,
        accuracy: 'EXACT',
        idempotencyKey: 'test-key',
        tenantId: 'tenant-123',
        timestamp: new Date(),
      };

      expect(record.promptTokens).toBe(100);
      expect(record.completionTokens).toBe(50);
      expect(record.modelId).toBe('gpt-4');
      expect(record.provider).toBe('openai');
      expect(record.costUsd).toBe(0.003);
      expect(record.accuracy).toBe('EXACT');
    });

    it('should allow optional accuracy field', () => {
      const record: LlmUsageRecord = {
        promptTokens: 100,
        completionTokens: 50,
        modelId: 'gpt-4',
        provider: 'openai',
        costUsd: 0.003,
        idempotencyKey: 'test-key',
        tenantId: 'tenant-123',
        timestamp: new Date(),
      };

      expect(record.accuracy).toBeUndefined();
    });
  });

  describe('LlmEmbeddingUsageRecord', () => {
    it('should define type with required fields', () => {
      const record: LlmEmbeddingUsageRecord = {
        embeddingTokens: 256,
        modelId: 'text-embedding-ada-002',
        provider: 'openai',
        costUsd: 0.0001,
        accuracy: 'EXACT',
        idempotencyKey: 'test-key',
        tenantId: 'tenant-123',
        timestamp: new Date(),
      };

      expect(record.embeddingTokens).toBe(256);
      expect(record.modelId).toBe('text-embedding-ada-002');
      expect(record.provider).toBe('openai');
      expect(record.costUsd).toBe(0.0001);
    });
  });

  describe('ModelPricing', () => {
    it('should define type with pricing fields', () => {
      const pricing: ModelPricing = {
        inputPricePerToken: 0.00003,
        outputPricePerToken: 0.00006,
        currency: 'USD',
      };

      expect(pricing.inputPricePerToken).toBe(0.00003);
      expect(pricing.outputPricePerToken).toBe(0.00006);
      expect(pricing.currency).toBe('USD');
    });
  });

  describe('LlmCostBudget', () => {
    it('should define type with budget fields', () => {
      const budget: LlmCostBudget = {
        dailyLimit: 10.0,
        monthlyLimit: 100.0,
        tenantId: 'tenant-123',
      };

      expect(budget.dailyLimit).toBe(10.0);
      expect(budget.monthlyLimit).toBe(100.0);
      expect(budget.tenantId).toBe('tenant-123');
    });

    it('should allow optional monthlyLimit', () => {
      const budget: LlmCostBudget = {
        dailyLimit: 10.0,
        tenantId: 'tenant-123',
      };

      expect(budget.dailyLimit).toBe(10.0);
      expect(budget.monthlyLimit).toBeUndefined();
    });
  });

  describe('UsageAccuracy type', () => {
    const createRecord = (accuracy: UsageAccuracy): LlmUsageRecord => ({
      promptTokens: 100,
      completionTokens: 50,
      modelId: 'gpt-4',
      provider: 'openai',
      costUsd: 0.003,
      accuracy,
      idempotencyKey: 'test-key',
      tenantId: 'tenant-123',
      timestamp: new Date(),
    });

    it('should accept EXACT value', () => {
      const record = createRecord('EXACT');
      expect(record.accuracy).toBe('EXACT');
    });

    it('should accept ESTIMATED value', () => {
      const record = createRecord('ESTIMATED');
      expect(record.accuracy).toBe('ESTIMATED');
    });

    it('should accept UNKNOWN value', () => {
      const record = createRecord('UNKNOWN');
      expect(record.accuracy).toBe('UNKNOWN');
    });
  });

  describe('Provider type', () => {
    const createRecord = (provider: string): LlmUsageRecord => ({
      promptTokens: 100,
      completionTokens: 50,
      modelId: 'gpt-4',
      provider,
      costUsd: 0.003,
      idempotencyKey: 'test-key',
      tenantId: 'tenant-123',
      timestamp: new Date(),
    });

    it('should accept openai provider', () => {
      const record = createRecord('openai');
      expect(record.provider).toBe('openai');
    });

    it('should accept anthropic provider', () => {
      const record = createRecord('anthropic');
      expect(record.provider).toBe('anthropic');
    });

    it('should accept custom provider string', () => {
      const record = createRecord('custom-provider');
      expect(record.provider).toBe('custom-provider');
    });
  });
});
