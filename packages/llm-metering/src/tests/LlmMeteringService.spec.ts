import type { EventBus } from "@croco/events-core";
import { Container } from "@croco/framework-context";
import type { MeteringService } from "@croco/metering-core";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { LlmUsageRecordedEvent } from "../libs/events/LlmUsageRecordedEvent";
import { LlmMeteringService } from "../libs/LlmMeteringService";
import { PricingTable } from "../libs/PricingTable";
import {
  LlmMeteringRecordFailedProblem,
  LlmQuotaExceededProblem,
} from "../libs/problems/LlmMeteringProblems";

describe("LlmMeteringService", () => {
  let meteringService!: LlmMeteringService;
  let mockMeteringCore!: MeteringService;
  let mockEventBus!: EventBus;

  beforeEach(() => {
    Container.reset();

    // Mock MeteringService
    mockMeteringCore = {
      record: vi.fn().mockResolvedValue({
        id: "test-record-id",
        tenantId: "tenant-123",
        meterId: "llm.prompt_tokens",
        value: 100,
        timestamp: new Date(),
      }),
      getUsage: vi.fn().mockResolvedValue(1000),
    } as unknown as MeteringService;

    // Mock EventBus
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as EventBus;

    meteringService = new LlmMeteringService({
      meteringService: mockMeteringCore,
      eventBus: mockEventBus,
    });
  });

  describe("recordUsage", () => {
    it("should record prompt, completion, and cost meters", async () => {
      const usageEvent = {
        tenantId: "tenant-123",
        modelId: "gpt-4",
        provider: "openai",
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          accuracy: "EXACT" as const,
        },
        idempotencyKey: "test-key-123",
        metadata: { operationType: "generate" },
      };

      await meteringService.recordUsage(usageEvent);

      // Verify metering-core.record was called 3 times (prompt, completion, cost)
      expect(mockMeteringCore.record).toHaveBeenCalledTimes(3);

      // Check prompt tokens record
      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-123",
          meterId: "llm.prompt_tokens",
          value: 100,
          idempotencyKey: "test-key-123:prompt",
          metadata: expect.objectContaining({
            provider: "openai",
            model: "gpt-4",
            accuracy: "EXACT",
            operationType: "generate",
          }),
        }),
      );

      // Check completion tokens record
      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-123",
          meterId: "llm.completion_tokens",
          value: 50,
          idempotencyKey: "test-key-123:completion",
        }),
      );

      // Check cost record
      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-123",
          meterId: "llm.cost_usd_nanos",
          value: 6_000_000,
          idempotencyKey: "test-key-123:cost",
        }),
      );

      // Verify event was published
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(LlmUsageRecordedEvent));
    });

    it("should throw when any metering record fails", async () => {
      const usageEvent = {
        tenantId: "tenant-123",
        modelId: "gpt-4",
        provider: "openai",
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        idempotencyKey: "test-key-123",
      };

      // First call
      await meteringService.recordUsage(usageEvent);

      // Reset mock
      vi.clearAllMocks();

      // Second call with same key - should handle gracefully
      // Simulate idempotency check failure for prompt tokens
      (mockMeteringCore.record as Mock).mockRejectedValueOnce(
        new Error("Duplicate idempotency key"),
      );

      await expect(meteringService.recordUsage(usageEvent)).rejects.toThrow(
        LlmMeteringRecordFailedProblem,
      );
    });

    it("should expose failed meter ids when metering fails", async () => {
      const usageEvent = {
        tenantId: "tenant-123",
        modelId: "gpt-4",
        provider: "openai",
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        idempotencyKey: "test-key-123",
      };

      (mockMeteringCore.record as Mock)
        .mockRejectedValueOnce(new Error("Duplicate idempotency key"))
        .mockResolvedValueOnce({ id: "completion", tenantId: "tenant-123" })
        .mockRejectedValueOnce(new Error("Cost persistence failed"));

      await expect(meteringService.recordUsage(usageEvent)).rejects.toMatchObject({
        code: "llm-metering/record-failed",
        extensions: {
          operation: "generate",
          meterIds: ["llm.prompt_tokens", "llm.cost_usd_nanos"],
        },
      });
    });

    it("should handle estimated usage accuracy flag", async () => {
      const usageEvent = {
        tenantId: "tenant-123",
        modelId: "gpt-4",
        provider: "openai",
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          accuracy: "ESTIMATED" as const,
        },
        idempotencyKey: "test-key-123",
      };

      await meteringService.recordUsage(usageEvent);

      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            accuracy: "ESTIMATED",
          }),
        }),
      );
    });

    it("should enforce quota policy before recording meters", async () => {
      const quotaPolicy = {
        enforce: vi
          .fn()
          .mockRejectedValue(new LlmQuotaExceededProblem("llm.prompt_tokens", 105, 100)),
      };
      const guardedMeteringService = new LlmMeteringService({
        meteringService: mockMeteringCore,
        eventBus: mockEventBus,
        quotaPolicy,
      });

      await expect(
        guardedMeteringService.recordUsage({
          tenantId: "tenant-123",
          modelId: "gpt-4",
          provider: "openai",
          usage: {
            promptTokens: 105,
            completionTokens: 5,
            totalTokens: 110,
          },
          idempotencyKey: "quota-key-123",
          metadata: { operationType: "generate" },
        }),
      ).rejects.toThrow(LlmQuotaExceededProblem);

      expect(quotaPolicy.enforce).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-123",
          modelId: "gpt-4",
          provider: "openai",
          operation: "generate",
          meters: [
            { meterId: "llm.prompt_tokens", value: 105, operation: "generate" },
            { meterId: "llm.completion_tokens", value: 5, operation: "generate" },
            { meterId: "llm.cost_usd_nanos", value: 3_450_000, operation: "generate" },
          ],
        }),
      );
      expect(mockMeteringCore.record).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it("should normalize unexpected quota policy failures to metering record problems", async () => {
      const quotaPolicy = {
        enforce: vi.fn().mockRejectedValue(new Error("quota store unavailable")),
      };
      const guardedMeteringService = new LlmMeteringService({
        meteringService: mockMeteringCore,
        eventBus: mockEventBus,
        quotaPolicy,
      });

      await expect(
        guardedMeteringService.recordUsage({
          tenantId: "tenant-123",
          modelId: "gpt-4",
          provider: "openai",
          usage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
          },
          idempotencyKey: "quota-store-key-123",
          metadata: { operationType: "generate" },
        }),
      ).rejects.toThrow(LlmMeteringRecordFailedProblem);

      expect(mockMeteringCore.record).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it("should reject invalid generated meter values before quota or record writes", async () => {
      const quotaPolicy = {
        enforce: vi.fn(),
      };
      const guardedMeteringService = new LlmMeteringService({
        meteringService: mockMeteringCore,
        eventBus: mockEventBus,
        quotaPolicy,
      });

      await expect(
        guardedMeteringService.recordUsage({
          tenantId: "tenant-123",
          modelId: "gpt-4",
          provider: "openai",
          usage: {
            promptTokens: -1,
            completionTokens: 5,
            totalTokens: 4,
          },
          idempotencyKey: "invalid-generated-key",
        }),
      ).rejects.toMatchObject({
        code: "llm-metering/record-failed",
        extensions: {
          operation: "generate",
          meterIds: ["llm.prompt_tokens"],
        },
      });

      expect(quotaPolicy.enforce).not.toHaveBeenCalled();
      expect(mockMeteringCore.record).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe("recordEmbeddingUsage", () => {
    it("should record embedding tokens and cost", async () => {
      const embeddingEvent = {
        tenantId: "tenant-123",
        modelId: "text-embedding-3-small",
        provider: "openai",
        embeddingTokens: 100,
        idempotencyKey: "embed-key-123",
      };

      await meteringService.recordEmbeddingUsage(embeddingEvent);

      // Verify 2 records: embedding tokens + cost
      expect(mockMeteringCore.record).toHaveBeenCalledTimes(2);

      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-123",
          meterId: "llm.embedding_tokens",
          value: 100,
          idempotencyKey: "embed-key-123:tokens",
        }),
      );

      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-123",
          meterId: "llm.cost_usd_nanos",
          idempotencyKey: "embed-key-123:cost",
        }),
      );
    });

    it("should throw when embedding metering fails", async () => {
      (mockMeteringCore.record as Mock).mockRejectedValueOnce(
        new Error("Embedding metering failed"),
      );

      await expect(
        meteringService.recordEmbeddingUsage({
          tenantId: "tenant-123",
          modelId: "text-embedding-3-small",
          provider: "openai",
          embeddingTokens: 100,
          idempotencyKey: "embed-key-123",
        }),
      ).rejects.toThrow(LlmMeteringRecordFailedProblem);
    });

    it("should reject non-finite embedding meter values before record writes", async () => {
      await expect(
        meteringService.recordEmbeddingUsage({
          tenantId: "tenant-123",
          modelId: "text-embedding-3-small",
          provider: "openai",
          embeddingTokens: Number.NaN,
          idempotencyKey: "invalid-embed-key",
        }),
      ).rejects.toMatchObject({
        code: "llm-metering/record-failed",
        extensions: {
          operation: "embed",
          meterIds: ["llm.embedding_tokens"],
        },
      });

      expect(mockMeteringCore.record).not.toHaveBeenCalled();
    });
  });

  describe("checkQuota", () => {
    it("should return true when quota is not exceeded", async () => {
      (mockMeteringCore.getUsage as Mock).mockResolvedValue(1000);

      const result = await meteringService.checkQuota("tenant-123", "llm.prompt_tokens", 10000);

      expect(result).toBe(true);
      expect(mockMeteringCore.getUsage).toHaveBeenCalledWith({
        tenantId: "tenant-123",
        meterId: "llm.prompt_tokens",
        period: "billing_cycle",
      });
    });

    it("should throw LlmQuotaExceededProblem when quota exceeded", async () => {
      (mockMeteringCore.getUsage as Mock).mockResolvedValue(15000);

      await expect(
        meteringService.checkQuota("tenant-123", "llm.prompt_tokens", 10000),
      ).rejects.toThrow(LlmQuotaExceededProblem);
    });

    it("should not throw when quota is exactly at limit", async () => {
      (mockMeteringCore.getUsage as Mock).mockResolvedValue(10000);

      const result = await meteringService.checkQuota("tenant-123", "llm.prompt_tokens", 10000);

      expect(result).toBe(true);
    });

    it("should include requested usage when checking projected quota", async () => {
      (mockMeteringCore.getUsage as Mock).mockResolvedValue(95);

      await expect(
        meteringService.checkQuota("tenant-123", "llm.prompt_tokens", 100, 6),
      ).rejects.toThrow(LlmQuotaExceededProblem);
    });

    it("should reject negative or non-finite requested usage", async () => {
      await expect(
        meteringService.checkQuota("tenant-123", "llm.prompt_tokens", 100, -1),
      ).rejects.toThrow(LlmQuotaExceededProblem);
      await expect(
        meteringService.checkQuota("tenant-123", "llm.prompt_tokens", 100, Number.NaN),
      ).rejects.toThrow(LlmQuotaExceededProblem);
      expect(mockMeteringCore.getUsage).not.toHaveBeenCalled();
    });
  });

  describe("trackCost", () => {
    it("should calculate cost using PricingTable and return cost record", async () => {
      const usageEvent = {
        tenantId: "tenant-123",
        modelId: "gpt-4",
        provider: "openai",
        usage: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
        },
        idempotencyKey: "cost-key-123",
      };

      const costRecord = await meteringService.trackCost(usageEvent);

      // Verify cost calculation: 1000 * 0.00003 + 500 * 0.00006 = 0.03 + 0.03 = 0.06
      expect(costRecord.costUsd).toBeCloseTo(0.06, 5);
      expect(costRecord.modelId).toBe("gpt-4");
      expect(costRecord.provider).toBe("openai");

      // Verify cost meter was recorded
      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-123",
          meterId: "llm.cost_usd_nanos",
          value: 60_000_000,
        }),
      );
    });

    it("should use default pricing for unknown models", async () => {
      const usageEvent = {
        tenantId: "tenant-123",
        modelId: "unknown-model",
        provider: "unknown-provider",
        usage: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
        },
        idempotencyKey: "cost-key-123",
      };

      const costRecord = await meteringService.trackCost(usageEvent);

      // Should still return a cost record with default pricing
      expect(costRecord).not.toBeNull();
      expect(costRecord.costUsd).toBeGreaterThanOrEqual(0);
    });

    it("should prefer an injected pricing table over the shared default table", async () => {
      const pricingTable = new PricingTable();
      pricingTable.setPrice("openai", "gpt-4", {
        inputPricePerToken: 1,
        outputPricePerToken: 2,
        currency: "USD",
      });

      const isolatedMeteringService = new LlmMeteringService({
        meteringService: mockMeteringCore,
        eventBus: mockEventBus,
        pricingTable,
      });

      const usageEvent = {
        tenantId: "tenant-123",
        modelId: "gpt-4",
        provider: "openai",
        usage: {
          promptTokens: 2,
          completionTokens: 3,
          totalTokens: 5,
        },
        idempotencyKey: "cost-key-override",
      };

      const costRecord = await isolatedMeteringService.trackCost(usageEvent);

      expect(costRecord.costUsd).toBe(8);
      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({ meterId: "llm.cost_usd_nanos", value: 8_000_000_000 }),
      );
    });

    it("should preserve large exact costs as safe-integer nanodollars", async () => {
      const pricingTable = new PricingTable();
      pricingTable.setPrice("custom", "large-cost", {
        inputPricePerToken: 3,
        outputPricePerToken: 0,
        currency: "USD",
      });
      const isolatedMeteringService = new LlmMeteringService({
        meteringService: mockMeteringCore,
        pricingTable,
      });

      await isolatedMeteringService.trackCost({
        tenantId: "tenant-123",
        modelId: "large-cost",
        provider: "custom",
        usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
        idempotencyKey: "large-cost",
      });

      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({ value: 3_000_000_000, idempotencyKey: "large-cost:cost" }),
      );
    });

    it("should reject costs that cannot be represented exactly as USD nanodollars", async () => {
      const pricingTable = new PricingTable();
      pricingTable.setPrice("custom", "sub-nanodollar", {
        inputPricePerToken: 0.0000000001,
        outputPricePerToken: 0,
        currency: "USD",
      });
      const isolatedMeteringService = new LlmMeteringService({
        meteringService: mockMeteringCore,
        pricingTable,
      });

      await expect(
        isolatedMeteringService.trackCost({
          tenantId: "tenant-123",
          modelId: "sub-nanodollar",
          provider: "custom",
          usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
          idempotencyKey: "sub-nanodollar-cost",
        }),
      ).rejects.toMatchObject({
        code: "llm-metering/record-failed",
        extensions: { meterIds: ["llm.cost_usd_nanos"] },
      });
      expect(mockMeteringCore.record).not.toHaveBeenCalled();
    });

    it("should not round fractional nanodollars at large magnitudes", async () => {
      const pricingTable = new PricingTable();
      pricingTable.setPrice("custom", "fractional-large-cost", {
        inputPricePerToken: 2_000_000.0000000005,
        outputPricePerToken: 0,
        currency: "USD",
      });
      const isolatedMeteringService = new LlmMeteringService({
        meteringService: mockMeteringCore,
        pricingTable,
      });

      await expect(
        isolatedMeteringService.trackCost({
          tenantId: "tenant-123",
          modelId: "fractional-large-cost",
          provider: "custom",
          usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
          idempotencyKey: "fractional-large-cost",
        }),
      ).rejects.toMatchObject({ code: "llm-metering/record-failed" });
      expect(mockMeteringCore.record).not.toHaveBeenCalled();
    });

    it("should omit zero-valued token and cost meters", async () => {
      const pricingTable = new PricingTable();
      pricingTable.setPrice("custom", "free-output", {
        inputPricePerToken: 0.000001,
        outputPricePerToken: 0,
        currency: "USD",
      });
      const isolatedMeteringService = new LlmMeteringService({
        meteringService: mockMeteringCore,
        pricingTable,
      });

      await isolatedMeteringService.recordUsage({
        tenantId: "tenant-123",
        modelId: "free-output",
        provider: "custom",
        usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
        idempotencyKey: "zero-components",
      });

      expect(mockMeteringCore.record).toHaveBeenCalledTimes(2);
      expect(mockMeteringCore.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ meterId: "llm.completion_tokens" }),
      );
    });

    it("should omit a zero cost from quota policy and persistence", async () => {
      const pricingTable = new PricingTable();
      pricingTable.setPrice("custom", "free-model", {
        inputPricePerToken: 0,
        outputPricePerToken: 0,
        currency: "USD",
      });
      const quotaPolicy = { enforce: vi.fn() };
      const isolatedMeteringService = new LlmMeteringService({
        meteringService: mockMeteringCore,
        pricingTable,
        quotaPolicy,
      });

      await isolatedMeteringService.trackCost({
        tenantId: "tenant-123",
        modelId: "free-model",
        provider: "custom",
        usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
        idempotencyKey: "free-model-cost",
      });

      expect(quotaPolicy.enforce).toHaveBeenCalledWith(expect.objectContaining({ meters: [] }));
      expect(mockMeteringCore.record).not.toHaveBeenCalled();
    });

    it.each([1.9, Number.MAX_SAFE_INTEGER + 1])(
      "should reject invalid token value %s before quota or persistence",
      async (promptTokens) => {
        const quotaPolicy = { enforce: vi.fn() };
        const isolatedMeteringService = new LlmMeteringService({
          meteringService: mockMeteringCore,
          quotaPolicy,
        });

        await expect(
          isolatedMeteringService.recordUsage({
            tenantId: "tenant-123",
            modelId: "gpt-4",
            provider: "openai",
            usage: { promptTokens, completionTokens: 1, totalTokens: promptTokens + 1 },
            idempotencyKey: "invalid-token",
          }),
        ).rejects.toMatchObject({ code: "llm-metering/record-failed" });

        expect(quotaPolicy.enforce).not.toHaveBeenCalled();
        expect(mockMeteringCore.record).not.toHaveBeenCalled();
      },
    );

    it("should throw when cost metering fails", async () => {
      const usageEvent = {
        tenantId: "tenant-123",
        modelId: "gpt-4",
        provider: "openai",
        usage: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
        },
        idempotencyKey: "cost-key-123",
      };

      (mockMeteringCore.record as Mock).mockRejectedValueOnce(new Error("Cost metering failed"));

      await expect(meteringService.trackCost(usageEvent)).rejects.toThrow(
        LlmMeteringRecordFailedProblem,
      );
    });

    it("should reject non-finite cost values before record writes", async () => {
      await expect(
        meteringService.trackCost({
          tenantId: "tenant-123",
          modelId: "gpt-4",
          provider: "openai",
          usage: {
            promptTokens: Number.POSITIVE_INFINITY,
            completionTokens: 1,
            totalTokens: Number.POSITIVE_INFINITY,
          },
          idempotencyKey: "invalid-cost-key",
        }),
      ).rejects.toMatchObject({
        code: "llm-metering/record-failed",
        extensions: {
          operation: "cost_tracking",
          meterIds: ["llm.cost_usd_nanos"],
        },
      });

      expect(mockMeteringCore.record).not.toHaveBeenCalled();
    });
  });
});
