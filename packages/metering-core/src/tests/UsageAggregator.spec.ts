import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeterRepository } from '../libs/MeterRepository';
import type { MeterDefinition, UsageRecord } from '../libs/types';
import { UsageAggregator } from '../libs/UsageAggregator';
import type { UsageStorage } from '../libs/UsageStorage';

describe('UsageAggregator', () => {
  let aggregator: UsageAggregator;
  let mockStorage: UsageStorage;
  let mockRepository: MeterRepository;

  const createMeter = (overrides: Partial<MeterDefinition> = {}): MeterDefinition => ({
    id: 'meter-123',
    tenantId: 'tenant-1',
    meterId: 'api_calls',
    type: 'COUNT',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createUsageRecord = (overrides: Partial<UsageRecord> = {}): UsageRecord => ({
    id: 'usage-123',
    tenantId: 'tenant-1',
    meterId: 'api_calls',
    value: 5,
    timestamp: new Date(),
    idempotencyKey: 'key-123',
    ...overrides,
  });

  beforeEach(() => {
    mockStorage = {
      record: vi.fn().mockResolvedValue(undefined),
      getUsage: vi.fn().mockResolvedValue(0),
      isIdempotent: vi.fn().mockResolvedValue(true),
      fetchUsageRecords: vi.fn().mockResolvedValue([]),
    };

    mockRepository = {
      findByMeterIdAndTenant: vi.fn(),
      save: vi.fn(),
      findAll: vi.fn(),
      findByTenant: vi.fn().mockResolvedValue([]),
      saveUsageRecords: vi.fn().mockResolvedValue(undefined),
    };

    aggregator = new UsageAggregator({
      usageStorage: mockStorage,
      meterRepository: mockRepository,
    });
  });

  describe('flushUsageToDB', () => {
    it('should fetch records from storage and save to repository', async () => {
      const records = [createUsageRecord({ id: 'usage-1', value: 5 }), createUsageRecord({ id: 'usage-2', value: 3 })];
      vi.mocked(mockStorage.fetchUsageRecords).mockResolvedValue(records);

      const result = await aggregator.flushUsageToDB('tenant-1', 'api_calls');

      expect(result.recordsFlushed).toBe(2);
      expect(mockStorage.fetchUsageRecords).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        period: 'billing_cycle',
      });
      expect(mockRepository.saveUsageRecords).toHaveBeenCalledWith(records);
    });

    it('should return 0 when no records to flush', async () => {
      vi.mocked(mockStorage.fetchUsageRecords).mockResolvedValue([]);

      const result = await aggregator.flushUsageToDB('tenant-1', 'api_calls');

      expect(result.recordsFlushed).toBe(0);
      expect(mockRepository.saveUsageRecords).not.toHaveBeenCalled();
    });

    it('should use provided period', async () => {
      vi.mocked(mockStorage.fetchUsageRecords).mockResolvedValue([]);

      await aggregator.flushUsageToDB('tenant-1', 'api_calls', 'day');

      expect(mockStorage.fetchUsageRecords).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        period: 'day',
      });
    });

    it('should handle large batch of records', async () => {
      const records = Array.from({ length: 1000 }, (_, i) => createUsageRecord({ id: `usage-${i}`, value: 1 }));
      vi.mocked(mockStorage.fetchUsageRecords).mockResolvedValue(records);

      const result = await aggregator.flushUsageToDB('tenant-1', 'api_calls');

      expect(result.recordsFlushed).toBe(1000);
    });
  });

  describe('flushAllForTenant', () => {
    it('should flush all meters for tenant', async () => {
      const meters = [
        createMeter({ meterId: 'api_calls' }),
        createMeter({ meterId: 'storage' }),
        createMeter({ meterId: 'bandwidth' }),
      ];
      vi.mocked(mockRepository.findByTenant).mockResolvedValue(meters);
      vi.mocked(mockStorage.fetchUsageRecords)
        .mockResolvedValueOnce([createUsageRecord({ value: 5 })])
        .mockResolvedValueOnce([createUsageRecord({ value: 3 })])
        .mockResolvedValueOnce([createUsageRecord({ value: 2 })]);

      const result = await aggregator.flushAllForTenant('tenant-1');

      expect(result.recordsFlushed).toBe(3);
      expect(mockStorage.fetchUsageRecords).toHaveBeenCalledTimes(3);
    });

    it('should return 0 when tenant has no meters', async () => {
      vi.mocked(mockRepository.findByTenant).mockResolvedValue([]);

      const result = await aggregator.flushAllForTenant('tenant-1');

      expect(result.recordsFlushed).toBe(0);
    });

    it('should handle mixed results', async () => {
      const meters = [createMeter({ meterId: 'api_calls' }), createMeter({ meterId: 'storage' })];
      vi.mocked(mockRepository.findByTenant).mockResolvedValue(meters);
      vi.mocked(mockStorage.fetchUsageRecords)
        .mockResolvedValueOnce([createUsageRecord(), createUsageRecord()])
        .mockResolvedValueOnce([]);

      const result = await aggregator.flushAllForTenant('tenant-1');

      expect(result.recordsFlushed).toBe(2);
    });
  });

  describe('getAggregatedUsage', () => {
    it('should return usage from storage', async () => {
      vi.mocked(mockStorage.getUsage).mockResolvedValue(150);

      const result = await aggregator.getAggregatedUsage({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        period: 'billing_cycle',
      });

      expect(result).toBe(150);
    });

    it('should pass all options to storage', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await aggregator.getAggregatedUsage({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        period: 'day',
        startDate,
        endDate,
      });

      expect(mockStorage.getUsage).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        period: 'day',
        startDate,
        endDate,
      });
    });
  });
});
