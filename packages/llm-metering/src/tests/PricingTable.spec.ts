import { describe, expect, it } from 'vitest';
import { PricingTable } from '../libs/PricingTable';
import type { LlmEmbeddingUsageRecord, LlmUsageRecord } from '../libs/types';

describe('PricingTable', () => {
  const createPricingTable = (): PricingTable => new PricingTable();

  describe('getPrice', () => {
    it('should return pricing for GPT-4', () => {
      const pricingTable = createPricingTable();
      const pricing = pricingTable.getPrice('openai', 'gpt-4');

      expect(pricing).not.toBeNull();
      expect(pricing?.inputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.outputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.currency).toBe('USD');
    });

    it('should return pricing for GPT-3.5-turbo', () => {
      const pricing = createPricingTable().getPrice('openai', 'gpt-3.5-turbo');

      expect(pricing).not.toBeNull();
      expect(pricing?.inputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.outputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.currency).toBe('USD');
    });

    it('should return pricing for Claude-3 Opus', () => {
      const pricing = createPricingTable().getPrice('anthropic', 'claude-3-opus-20240229');

      expect(pricing).not.toBeNull();
      expect(pricing?.inputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.outputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.currency).toBe('USD');
    });

    it('should return pricing for Claude-3 Sonnet', () => {
      const pricing = createPricingTable().getPrice('anthropic', 'claude-3-sonnet-20240229');

      expect(pricing).not.toBeNull();
      expect(pricing?.inputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.outputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.currency).toBe('USD');
    });

    it('should return pricing for text-embedding-ada-002', () => {
      const pricing = createPricingTable().getPrice('openai', 'text-embedding-ada-002');

      expect(pricing).not.toBeNull();
      expect(pricing?.inputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.currency).toBe('USD');
    });

    it('should return null for unknown provider', () => {
      const pricing = createPricingTable().getPrice('unknown', 'gpt-4');

      expect(pricing).toBeNull();
    });

    it('should return null for unknown model', () => {
      const pricing = createPricingTable().getPrice('openai', 'unknown-model');

      expect(pricing).toBeNull();
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for completion usage', () => {
      const pricingTable = createPricingTable();
      const usage: LlmUsageRecord = {
        promptTokens: 1000,
        completionTokens: 500,
        modelId: 'gpt-4',
        provider: 'openai',
        costUsd: 0,
        idempotencyKey: 'test-key',
        tenantId: 'tenant-123',
        timestamp: new Date(),
      };

      const pricing = pricingTable.getPrice('openai', 'gpt-4');
      if (!pricing) {
        throw new Error('Pricing not found');
      }

      const cost = pricingTable.calculateCost(usage, pricing);

      const expectedCost =
        usage.promptTokens * pricing.inputPricePerToken + usage.completionTokens * pricing.outputPricePerToken;

      expect(cost).toBeCloseTo(expectedCost, 6);
      expect(cost).toBeGreaterThan(0);
    });

    it('should calculate cost for embedding usage', () => {
      const pricingTable = createPricingTable();
      const usage: LlmEmbeddingUsageRecord = {
        embeddingTokens: 1000,
        modelId: 'text-embedding-ada-002',
        provider: 'openai',
        costUsd: 0,
        idempotencyKey: 'test-key',
        tenantId: 'tenant-123',
        timestamp: new Date(),
      };

      const pricing = pricingTable.getPrice('openai', 'text-embedding-ada-002');
      if (!pricing) {
        throw new Error('Pricing not found');
      }

      const cost = pricingTable.calculateCost(usage, pricing);

      const expectedCost = usage.embeddingTokens * pricing.inputPricePerToken;

      expect(cost).toBeCloseTo(expectedCost, 6);
      expect(cost).toBeGreaterThan(0);
    });

    it('should return zero for zero usage', () => {
      const pricingTable = createPricingTable();
      const usage: LlmUsageRecord = {
        promptTokens: 0,
        completionTokens: 0,
        modelId: 'gpt-4',
        provider: 'openai',
        costUsd: 0,
        idempotencyKey: 'test-key',
        tenantId: 'tenant-123',
        timestamp: new Date(),
      };

      const pricing = pricingTable.getPrice('openai', 'gpt-4');
      if (!pricing) {
        throw new Error('Pricing not found');
      }

      const cost = pricingTable.calculateCost(usage, pricing);

      expect(cost).toBe(0);
    });
  });

  describe('pricing accuracy', () => {
    it('should have GPT-4 pricing higher than GPT-3.5-turbo', () => {
      const pricingTable = createPricingTable();
      const gpt4Pricing = pricingTable.getPrice('openai', 'gpt-4');
      const gpt35Pricing = pricingTable.getPrice('openai', 'gpt-3.5-turbo');

      expect(gpt4Pricing).not.toBeNull();
      expect(gpt35Pricing).not.toBeNull();

      if (!gpt4Pricing || !gpt35Pricing) {
        throw new Error('Pricing not found');
      }

      expect(gpt4Pricing.inputPricePerToken).toBeGreaterThan(gpt35Pricing.inputPricePerToken);
      expect(gpt4Pricing.outputPricePerToken).toBeGreaterThan(gpt35Pricing.outputPricePerToken);
    });

    it('should have Claude-3 Opus pricing higher than Sonnet', () => {
      const pricingTable = createPricingTable();
      const opusPricing = pricingTable.getPrice('anthropic', 'claude-3-opus-20240229');
      const sonnetPricing = pricingTable.getPrice('anthropic', 'claude-3-sonnet-20240229');

      expect(opusPricing).not.toBeNull();
      expect(sonnetPricing).not.toBeNull();

      if (!opusPricing || !sonnetPricing) {
        throw new Error('Pricing not found');
      }

      expect(opusPricing.inputPricePerToken).toBeGreaterThan(sonnetPricing.inputPricePerToken);
      expect(opusPricing.outputPricePerToken).toBeGreaterThan(sonnetPricing.outputPricePerToken);
    });
  });

  describe('setPrice', () => {
    it('should allow setting custom pricing for new model', () => {
      const pricingTable = createPricingTable();
      const customPricing = {
        inputPricePerToken: 0.00001,
        outputPricePerToken: 0.00002,
        currency: 'USD',
      };

      pricingTable.setPrice('custom', 'custom-model', customPricing);

      const pricing = pricingTable.getPrice('custom', 'custom-model');

      expect(pricing).toEqual(customPricing);
    });

    it('should allow overriding existing pricing', () => {
      const pricingTable = createPricingTable();

      const customPricing = {
        inputPricePerToken: 0.00001,
        outputPricePerToken: 0.00002,
        currency: 'USD',
      };

      pricingTable.setPrice('openai', 'gpt-4', customPricing);

      const pricing = pricingTable.getPrice('openai', 'gpt-4');

      expect(pricing).toEqual(customPricing);
    });

    it('should isolate pricing mutations per instance', () => {
      const pricingTable = createPricingTable();
      const untouchedPricingTable = createPricingTable();
      const customPricing = {
        inputPricePerToken: 0.123,
        outputPricePerToken: 0.456,
        currency: 'USD',
      };

      pricingTable.setPrice('openai', 'gpt-4', customPricing);

      expect(pricingTable.getPrice('openai', 'gpt-4')).toEqual(customPricing);
      expect(untouchedPricingTable.getPrice('openai', 'gpt-4')).not.toEqual(customPricing);
    });
  });
});
