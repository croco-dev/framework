import { describe, expect, it } from 'vitest';
import type {
  AggregationPeriod,
  FlushResult,
  MeterDefinition,
  MeterType,
  RecordOptions,
  UsageQueryOptions,
  UsageRecord,
} from '../libs/types';

describe('types', () => {
  describe('MeterType', () => {
    it('should accept valid meter types', () => {
      const count: MeterType = 'COUNT';
      const uniqueCount: MeterType = 'UNIQUE_COUNT';
      const customEvent: MeterType = 'CUSTOM_EVENT';

      expect(count).toBe('COUNT');
      expect(uniqueCount).toBe('UNIQUE_COUNT');
      expect(customEvent).toBe('CUSTOM_EVENT');
    });
  });

  describe('MeterDefinition', () => {
    it('should create a valid meter definition', () => {
      const meter: MeterDefinition = {
        id: 'meter-123',
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        type: 'COUNT',
        quota: 1000,
        allowOverQuota: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(meter.id).toBe('meter-123');
      expect(meter.type).toBe('COUNT');
    });

    it('should allow optional fields', () => {
      const meter: MeterDefinition = {
        id: 'meter-123',
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        type: 'COUNT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(meter.quota).toBeUndefined();
      expect(meter.allowOverQuota).toBeUndefined();
    });
  });

  describe('UsageRecord', () => {
    it('should create a valid usage record', () => {
      const record: UsageRecord = {
        id: 'usage-123',
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 5,
        timestamp: new Date(),
        idempotencyKey: 'key-123',
      };

      expect(record.value).toBe(5);
      expect(record.idempotencyKey).toBe('key-123');
    });
  });

  describe('RecordOptions', () => {
    it('should create record options with required fields', () => {
      const options: RecordOptions = {
        tenantId: 'tenant-1',
        meterId: 'api_calls',
      };

      expect(options.tenantId).toBe('tenant-1');
      expect(options.value).toBeUndefined();
    });

    it('should create record options with all fields', () => {
      const options: RecordOptions = {
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 10,
        idempotencyKey: 'custom-key',
        metadata: { userId: 'user-1' },
      };

      expect(options.value).toBe(10);
      expect(options.metadata?.userId).toBe('user-1');
    });
  });

  describe('UsageQueryOptions', () => {
    it('should create usage query options', () => {
      const options: UsageQueryOptions = {
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        period: 'day',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      expect(options.period).toBe('day');
    });
  });

  describe('AggregationPeriod', () => {
    it('should accept valid aggregation periods', () => {
      const hour: AggregationPeriod = 'hour';
      const day: AggregationPeriod = 'day';
      const billingCycle: AggregationPeriod = 'billing_cycle';

      expect(hour).toBe('hour');
      expect(day).toBe('day');
      expect(billingCycle).toBe('billing_cycle');
    });
  });

  describe('FlushResult', () => {
    it('should create a flush result', () => {
      const result: FlushResult = {
        recordsFlushed: 100,
      };

      expect(result.recordsFlushed).toBe(100);
    });
  });
});
