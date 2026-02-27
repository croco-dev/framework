import type { EventBus } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import type { MeteringService } from '@croco/metering-core';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { LlmUsageRecordedEvent } from '../libs/events/LlmUsageRecordedEvent';
import { LlmMeteringService } from '../libs/LlmMeteringService';
import { LlmQuotaExceededProblem } from '../libs/problems/LlmMeteringProblems';

describe('LlmMeteringService', () => {
  let meteringService!: LlmMeteringService;
  let mockMeteringCore!: MeteringService;
  let mockEventBus!: EventBus;

  beforeEach(() => {
    Container.reset();

    // Mock MeteringService
    mockMeteringCore = {
      record: vi.fn().mockResolvedValue({
        id: 'test-record-id',
        tenantId: 'tenant-123',
        meterId: 'llm.prompt_tokens',
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

  describe('recordUsage', () => {
    it('should record prompt, completion, and cost meters', async () => {
      const usageEvent = {
        tenantId: 'tenant-123',
        modelId: 'gpt-4',
        provider: 'openai',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          accuracy: 'EXACT' as const,
        },
        idempotencyKey: 'test-key-123',
        metadata: { operationType: 'generate' },
      };

      await meteringService.recordUsage(usageEvent);

      // Verify metering-core.record was called 3 times (prompt, completion, cost)
      expect(mockMeteringCore.record).toHaveBeenCalledTimes(3);

      // Check prompt tokens record
      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          meterId: 'llm.prompt_tokens',
          value: 100,
          idempotencyKey: 'test-key-123:prompt',
          metadata: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-4',
            accuracy: 'EXACT',
            operationType: 'generate',
          }),
        })
      );

      // Check completion tokens record
      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          meterId: 'llm.completion_tokens',
          value: 50,
          idempotencyKey: 'test-key-123:completion',
        })
      );

      // Check cost record
      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          meterId: 'llm.cost_usd',
          idempotencyKey: 'test-key-123:cost',
        })
      );

      // Verify event was published
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(LlmUsageRecordedEvent));
    });

    it('should handle idempotency correctly - duplicate calls should not record again', async () => {
      const usageEvent = {
        tenantId: 'tenant-123',
        modelId: 'gpt-4',
        provider: 'openai',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        idempotencyKey: 'test-key-123',
      };

      // First call
      await meteringService.recordUsage(usageEvent);

      // Reset mock
      vi.clearAllMocks();

      // Second call with same key - should handle gracefully
      // Simulate idempotency check failure for prompt tokens
      (mockMeteringCore.record as Mock).mockRejectedValueOnce(new Error('Duplicate idempotency key'));

      // Should not throw, returns the usage record even with partial failures
      const result = await meteringService.recordUsage(usageEvent);
      expect(result).not.toBeNull();
      expect(result.promptTokens).toBe(100);
      expect(result.completionTokens).toBe(50);
    });

    it('should handle estimated usage accuracy flag', async () => {
      const usageEvent = {
        tenantId: 'tenant-123',
        modelId: 'gpt-4',
        provider: 'openai',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          accuracy: 'ESTIMATED' as const,
        },
        idempotencyKey: 'test-key-123',
      };

      await meteringService.recordUsage(usageEvent);

      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            accuracy: 'ESTIMATED',
          }),
        })
      );
    });
  });

  describe('recordEmbeddingUsage', () => {
    it('should record embedding tokens and cost', async () => {
      const embeddingEvent = {
        tenantId: 'tenant-123',
        modelId: 'text-embedding-3-small',
        provider: 'openai',
        embeddingTokens: 100,
        idempotencyKey: 'embed-key-123',
      };

      await meteringService.recordEmbeddingUsage(embeddingEvent);

      // Verify 2 records: embedding tokens + cost
      expect(mockMeteringCore.record).toHaveBeenCalledTimes(2);

      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          meterId: 'llm.embedding_tokens',
          value: 100,
          idempotencyKey: 'embed-key-123:tokens',
        })
      );

      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          meterId: 'llm.cost_usd',
          idempotencyKey: 'embed-key-123:cost',
        })
      );
    });
  });

  describe('checkQuota', () => {
    it('should return true when quota is not exceeded', async () => {
      (mockMeteringCore.getUsage as Mock).mockResolvedValue(1000);

      const result = await meteringService.checkQuota('tenant-123', 'llm.prompt_tokens', 10000);

      expect(result).toBe(true);
      expect(mockMeteringCore.getUsage).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        meterId: 'llm.prompt_tokens',
        period: 'billing_cycle',
      });
    });

    it('should throw LlmQuotaExceededProblem when quota exceeded', async () => {
      (mockMeteringCore.getUsage as Mock).mockResolvedValue(15000);

      await expect(meteringService.checkQuota('tenant-123', 'llm.prompt_tokens', 10000)).rejects.toThrow(
        LlmQuotaExceededProblem
      );
    });

    it('should not throw when quota is exactly at limit', async () => {
      (mockMeteringCore.getUsage as Mock).mockResolvedValue(10000);

      const result = await meteringService.checkQuota('tenant-123', 'llm.prompt_tokens', 10000);

      expect(result).toBe(true);
    });
  });

  describe('trackCost', () => {
    it('should calculate cost using PricingTable and return cost record', async () => {
      const usageEvent = {
        tenantId: 'tenant-123',
        modelId: 'gpt-4',
        provider: 'openai',
        usage: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
        },
        idempotencyKey: 'cost-key-123',
      };

      const costRecord = await meteringService.trackCost(usageEvent);

      // Verify cost calculation: 1000 * 0.00003 + 500 * 0.00006 = 0.03 + 0.03 = 0.06
      expect(costRecord.costUsd).toBeCloseTo(0.06, 5);
      expect(costRecord.modelId).toBe('gpt-4');
      expect(costRecord.provider).toBe('openai');

      // Verify cost meter was recorded
      expect(mockMeteringCore.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          meterId: 'llm.cost_usd',
          value: expect.any(Number),
        })
      );
    });

    it('should use default pricing for unknown models', async () => {
      const usageEvent = {
        tenantId: 'tenant-123',
        modelId: 'unknown-model',
        provider: 'unknown-provider',
        usage: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
        },
        idempotencyKey: 'cost-key-123',
      };

      const costRecord = await meteringService.trackCost(usageEvent);

      // Should still return a cost record with default pricing
      expect(costRecord).not.toBeNull();
      expect(costRecord.costUsd).toBeGreaterThanOrEqual(0);
    });
  });
});
