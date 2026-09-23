import { describe, expect, it } from "vitest";
import { AiPricingTable, samplePricingRegistry } from "../libs/AiPricingTable";
import { AiPricingRegistryConflictProblem } from "../libs/problems/AiUsageProblems";
import type { AiEmbeddingUsageRecord, AiUsageRecord } from "../libs/types";

describe("AiPricingTable", () => {
  const createAiPricingTable = (): AiPricingTable => new AiPricingTable();

  describe("getPrice", () => {
    it("should expose the versioned sample registry metadata", () => {
      const pricingTable = createAiPricingTable();

      expect(pricingTable.version).toBe(samplePricingRegistry.version);
      expect(pricingTable.source).toBe(samplePricingRegistry.source);
      expect(pricingTable.effectiveDate).toBe(samplePricingRegistry.effectiveDate);
      expect(pricingTable.notes).toBe(samplePricingRegistry.notes);
      expect(pricingTable.toRegistry()).toMatchObject({
        version: samplePricingRegistry.version,
        source: samplePricingRegistry.source,
        effectiveDate: samplePricingRegistry.effectiveDate,
        notes: samplePricingRegistry.notes,
      });
    });

    it("should build pricing from an injected versioned registry", () => {
      const pricingTable = AiPricingTable.fromRegistry({
        version: "tenant-pricing-2026-06-18",
        source: "internal-price-book",
        effectiveDate: "2026-06-18",
        notes: "tenant-specific negotiated rates",
        entries: [
          {
            provider: "openai",
            modelId: "gpt-governed",
            inputPricePerToken: 0.1,
            outputPricePerToken: 0.2,
            currency: "USD",
            effectiveDate: "2026-06-18",
            source: "tenant-rate-card",
          },
        ],
      });

      expect(pricingTable.version).toBe("tenant-pricing-2026-06-18");
      expect(pricingTable.source).toBe("internal-price-book");
      expect(pricingTable.effectiveDate).toBe("2026-06-18");
      expect(pricingTable.notes).toBe("tenant-specific negotiated rates");
      expect(pricingTable.getPrice("openai", "gpt-governed")).toEqual({
        inputPricePerToken: 0.1,
        outputPricePerToken: 0.2,
        currency: "USD",
        effectiveDate: "2026-06-18",
        source: "tenant-rate-card",
      });
      expect(pricingTable.toRegistry()).toMatchObject({
        version: "tenant-pricing-2026-06-18",
        source: "internal-price-book",
        effectiveDate: "2026-06-18",
        notes: "tenant-specific negotiated rates",
        entries: [
          {
            provider: "openai",
            modelId: "gpt-governed",
            inputPricePerToken: 0.1,
            outputPricePerToken: 0.2,
            currency: "USD",
            effectiveDate: "2026-06-18",
            source: "tenant-rate-card",
          },
        ],
      });
    });

    it("should reject duplicate provider and model registry entries", () => {
      expect(() =>
        AiPricingTable.fromRegistry({
          version: "conflicting-registry",
          entries: [
            {
              provider: "openai",
              modelId: "gpt-duplicate",
              inputPricePerToken: 0.1,
              outputPricePerToken: 0.2,
              currency: "USD",
            },
            {
              provider: "openai",
              modelId: "gpt-duplicate",
              inputPricePerToken: 0.3,
              outputPricePerToken: 0.4,
              currency: "USD",
            },
          ],
        }),
      ).toThrow(AiPricingRegistryConflictProblem);
    });

    it("should return pricing for GPT-4", () => {
      const pricingTable = createAiPricingTable();
      const pricing = pricingTable.getPrice("openai", "gpt-4");

      expect(pricing).not.toBeNull();
      expect(pricing?.inputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.outputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.currency).toBe("USD");
    });

    it("should return pricing for GPT-3.5-turbo", () => {
      const pricing = createAiPricingTable().getPrice("openai", "gpt-3.5-turbo");

      expect(pricing).not.toBeNull();
      expect(pricing?.inputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.outputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.currency).toBe("USD");
    });

    it("should return pricing for Claude-3 Opus", () => {
      const pricing = createAiPricingTable().getPrice("anthropic", "claude-3-opus-20240229");

      expect(pricing).not.toBeNull();
      expect(pricing?.inputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.outputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.currency).toBe("USD");
    });

    it("should return pricing for Claude-3 Sonnet", () => {
      const pricing = createAiPricingTable().getPrice("anthropic", "claude-3-sonnet-20240229");

      expect(pricing).not.toBeNull();
      expect(pricing?.inputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.outputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.currency).toBe("USD");
    });

    it("should return pricing for text-embedding-ada-002", () => {
      const pricing = createAiPricingTable().getPrice("openai", "text-embedding-ada-002");

      expect(pricing).not.toBeNull();
      expect(pricing?.inputPricePerToken).toBeGreaterThan(0);
      expect(pricing?.currency).toBe("USD");
    });

    it("should return null for unknown provider", () => {
      const pricing = createAiPricingTable().getPrice("unknown", "gpt-4");

      expect(pricing).toBeNull();
    });

    it("should return null for unknown model", () => {
      const pricing = createAiPricingTable().getPrice("openai", "unknown-model");

      expect(pricing).toBeNull();
    });
  });

  describe("calculateCost", () => {
    it("should calculate cost for completion usage", () => {
      const pricingTable = createAiPricingTable();
      const usage: AiUsageRecord = {
        inputTokens: 1000,
        outputTokens: 500,
        modelId: "gpt-4",
        provider: "openai",
        costUsd: 0,
        idempotencyKey: "test-key",
        tenantId: "tenant-123",
        timestamp: new Date(),
      };

      const pricing = pricingTable.getPrice("openai", "gpt-4");
      if (!pricing) {
        throw new Error("Pricing not found");
      }

      const cost = pricingTable.calculateCost(usage, pricing);

      const expectedCost =
        usage.inputTokens * pricing.inputPricePerToken +
        usage.outputTokens * pricing.outputPricePerToken;

      expect(cost).toBeCloseTo(expectedCost, 6);
      expect(cost).toBeGreaterThan(0);
    });

    it("should calculate cost for embedding usage", () => {
      const pricingTable = createAiPricingTable();
      const usage: AiEmbeddingUsageRecord = {
        embeddingTokens: 1000,
        modelId: "text-embedding-ada-002",
        provider: "openai",
        costUsd: 0,
        idempotencyKey: "test-key",
        tenantId: "tenant-123",
        timestamp: new Date(),
      };

      const pricing = pricingTable.getPrice("openai", "text-embedding-ada-002");
      if (!pricing) {
        throw new Error("Pricing not found");
      }

      const cost = pricingTable.calculateCost(usage, pricing);

      const expectedCost = usage.embeddingTokens * pricing.inputPricePerToken;

      expect(cost).toBeCloseTo(expectedCost, 6);
      expect(cost).toBeGreaterThan(0);
    });

    it("should return zero for zero usage", () => {
      const pricingTable = createAiPricingTable();
      const usage: AiUsageRecord = {
        inputTokens: 0,
        outputTokens: 0,
        modelId: "gpt-4",
        provider: "openai",
        costUsd: 0,
        idempotencyKey: "test-key",
        tenantId: "tenant-123",
        timestamp: new Date(),
      };

      const pricing = pricingTable.getPrice("openai", "gpt-4");
      if (!pricing) {
        throw new Error("Pricing not found");
      }

      const cost = pricingTable.calculateCost(usage, pricing);

      expect(cost).toBe(0);
    });
  });

  describe("pricing accuracy", () => {
    it("should have GPT-4 pricing higher than GPT-3.5-turbo", () => {
      const pricingTable = createAiPricingTable();
      const gpt4Pricing = pricingTable.getPrice("openai", "gpt-4");
      const gpt35Pricing = pricingTable.getPrice("openai", "gpt-3.5-turbo");

      expect(gpt4Pricing).not.toBeNull();
      expect(gpt35Pricing).not.toBeNull();

      if (!gpt4Pricing || !gpt35Pricing) {
        throw new Error("Pricing not found");
      }

      expect(gpt4Pricing.inputPricePerToken).toBeGreaterThan(gpt35Pricing.inputPricePerToken);
      expect(gpt4Pricing.outputPricePerToken).toBeGreaterThan(gpt35Pricing.outputPricePerToken);
    });

    it("should have Claude-3 Opus pricing higher than Sonnet", () => {
      const pricingTable = createAiPricingTable();
      const opusPricing = pricingTable.getPrice("anthropic", "claude-3-opus-20240229");
      const sonnetPricing = pricingTable.getPrice("anthropic", "claude-3-sonnet-20240229");

      expect(opusPricing).not.toBeNull();
      expect(sonnetPricing).not.toBeNull();

      if (!opusPricing || !sonnetPricing) {
        throw new Error("Pricing not found");
      }

      expect(opusPricing.inputPricePerToken).toBeGreaterThan(sonnetPricing.inputPricePerToken);
      expect(opusPricing.outputPricePerToken).toBeGreaterThan(sonnetPricing.outputPricePerToken);
    });
  });

  describe("setPrice", () => {
    it("should allow setting custom pricing for new model", () => {
      const pricingTable = createAiPricingTable();
      const customPricing = {
        inputPricePerToken: 0.00001,
        outputPricePerToken: 0.00002,
        currency: "USD",
      };

      pricingTable.setPrice("custom", "custom-model", customPricing);

      const pricing = pricingTable.getPrice("custom", "custom-model");

      expect(pricing).toEqual(customPricing);
    });

    it("should allow overriding existing pricing", () => {
      const pricingTable = createAiPricingTable();

      const customPricing = {
        inputPricePerToken: 0.00001,
        outputPricePerToken: 0.00002,
        currency: "USD",
      };

      pricingTable.setPrice("openai", "gpt-4", customPricing);

      const pricing = pricingTable.getPrice("openai", "gpt-4");

      expect(pricing).toEqual(customPricing);
    });

    it("should isolate pricing mutations per instance", () => {
      const pricingTable = createAiPricingTable();
      const untouchedAiPricingTable = createAiPricingTable();
      const customPricing = {
        inputPricePerToken: 0.123,
        outputPricePerToken: 0.456,
        currency: "USD",
      };

      pricingTable.setPrice("openai", "gpt-4", customPricing);

      expect(pricingTable.getPrice("openai", "gpt-4")).toEqual(customPricing);
      expect(untouchedAiPricingTable.getPrice("openai", "gpt-4")).not.toEqual(customPricing);
    });
  });
});
