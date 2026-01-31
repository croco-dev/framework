import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsageQueryOptions, UsageRecord } from '../libs/types';
import type { UsageStorage } from '../libs/UsageStorage';

describe('UsageStorage', () => {
  let mockStorage: UsageStorage;

  beforeEach(() => {
    mockStorage = {
      record: vi.fn(),
      getUsage: vi.fn(),
      isIdempotent: vi.fn(),
      fetchUsageRecords: vi.fn(),
    };
  });

  describe('record', () => {
    it('should record usage', async () => {
      const usage: UsageRecord = {
        id: 'usage-123',
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 5,
        timestamp: new Date(),
        idempotencyKey: 'key-123',
      };

      vi.mocked(mockStorage.record).mockResolvedValue(undefined);

      await mockStorage.record(usage);

      expect(mockStorage.record).toHaveBeenCalledWith(usage);
    });
  });

  describe('getUsage', () => {
    it('should return total usage for period', async () => {
      const options: UsageQueryOptions = {
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        period: 'day',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      vi.mocked(mockStorage.getUsage).mockResolvedValue(150);

      const result = await mockStorage.getUsage(options);

      expect(result).toBe(150);
      expect(mockStorage.getUsage).toHaveBeenCalledWith(options);
    });

    it('should return 0 when no usage', async () => {
      const options: UsageQueryOptions = {
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        period: 'day',
      };

      vi.mocked(mockStorage.getUsage).mockResolvedValue(0);

      const result = await mockStorage.getUsage(options);

      expect(result).toBe(0);
    });
  });

  describe('isIdempotent', () => {
    it('should return true for new key', async () => {
      vi.mocked(mockStorage.isIdempotent).mockResolvedValue(true);

      const result = await mockStorage.isIdempotent('tenant-1', 'api_calls', 'new-key', 86400);

      expect(result).toBe(true);
      expect(mockStorage.isIdempotent).toHaveBeenCalledWith('tenant-1', 'api_calls', 'new-key', 86400);
    });

    it('should return false for duplicate key', async () => {
      vi.mocked(mockStorage.isIdempotent).mockResolvedValue(false);

      const result = await mockStorage.isIdempotent('tenant-1', 'api_calls', 'existing-key', 86400);

      expect(result).toBe(false);
    });
  });

  describe('fetchUsageRecords', () => {
    it('should return usage records for period', async () => {
      const options: UsageQueryOptions = {
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        period: 'day',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const records: UsageRecord[] = [
        {
          id: 'usage-1',
          tenantId: 'tenant-1',
          meterId: 'api_calls',
          value: 5,
          timestamp: new Date(),
          idempotencyKey: 'key-1',
        },
        {
          id: 'usage-2',
          tenantId: 'tenant-1',
          meterId: 'api_calls',
          value: 3,
          timestamp: new Date(),
          idempotencyKey: 'key-2',
        },
      ];

      vi.mocked(mockStorage.fetchUsageRecords).mockResolvedValue(records);

      const result = await mockStorage.fetchUsageRecords(options);

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(5);
    });

    it('should return empty array when no records', async () => {
      const options: UsageQueryOptions = {
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        period: 'day',
      };

      vi.mocked(mockStorage.fetchUsageRecords).mockResolvedValue([]);

      const result = await mockStorage.fetchUsageRecords(options);

      expect(result).toEqual([]);
    });
  });
});
