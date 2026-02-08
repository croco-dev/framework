import { describe, expect, it } from 'vitest';
import { LlmCostBudgetExceededEvent } from '../libs/events/LlmCostBudgetExceededEvent';
import { LlmUsageRecordedEvent } from '../libs/events/LlmUsageRecordedEvent';
import type { LlmUsageRecord } from '../libs/types';

describe('Events', () => {
  describe('LlmUsageRecordedEvent', () => {
    it('should create event with usage record', () => {
      const usage: LlmUsageRecord = {
        promptTokens: 100,
        completionTokens: 50,
        modelId: 'gpt-4',
        provider: 'openai',
        costUsd: 0.003,
        idempotencyKey: 'test-key',
        tenantId: 'tenant-123',
        timestamp: new Date(),
      };

      const event = new LlmUsageRecordedEvent('tenant-123', usage);

      expect(event.tenantId).toBe('tenant-123');
      expect(event.usage).toEqual(usage);
    });
  });

  describe('LlmCostBudgetExceededEvent', () => {
    it('should create event for daily limit exceeded', () => {
      const event = new LlmCostBudgetExceededEvent('tenant-123', 15.0, 10.0, 'daily');

      expect(event.tenantId).toBe('tenant-123');
      expect(event.currentCost).toBe(15.0);
      expect(event.limit).toBe(10.0);
      expect(event.period).toBe('daily');
    });

    it('should create event for monthly limit exceeded', () => {
      const event = new LlmCostBudgetExceededEvent('tenant-123', 150.0, 100.0, 'monthly');

      expect(event.tenantId).toBe('tenant-123');
      expect(event.currentCost).toBe(150.0);
      expect(event.limit).toBe(100.0);
      expect(event.period).toBe('monthly');
    });
  });
});
