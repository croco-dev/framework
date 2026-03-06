import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AtomicQuotaNotSupportedProblem } from '../libs/problems/AtomicQuotaNotSupportedProblem';
import { QuotaExceededProblem } from '../libs/problems/QuotaExceededProblem';
import { QuotaManager } from '../libs/QuotaManager';
import type { UsageRecord } from '../libs/types';
import type { UsageStorage } from '../libs/UsageStorage';

describe('QuotaManager', () => {
  let quotaManager!: QuotaManager;
  let mockStorage!: UsageStorage;

  const createUsageRecord = (overrides: Partial<UsageRecord> = {}): UsageRecord => ({
    id: 'usage-123',
    tenantId: 'tenant-1',
    meterId: 'api_calls',
    value: 4,
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

    quotaManager = new QuotaManager({ usageStorage: mockStorage });
  });

  describe('checkAndRecord', () => {
    it('should use atomic storage result when within quota', async () => {
      const usageRecord = createUsageRecord();
      mockStorage.checkAndRecordWithinQuota = vi.fn().mockResolvedValue({
        exceeded: false,
        newUsage: 8,
      });

      const result = await quotaManager.checkAndRecord({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 4,
        quota: 10,
        allowOverQuota: false,
        usageRecord,
      });

      expect(result).toEqual({ exceeded: false, newUsage: 8 });
      expect(mockStorage.checkAndRecordWithinQuota).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 4,
        quota: 10,
        allowOverQuota: false,
        usageRecord,
      });
    });

    it('should throw when storage does not support atomic quota checks', async () => {
      await expect(
        quotaManager.checkAndRecord({
          tenantId: 'tenant-1',
          meterId: 'api_calls',
          value: 4,
          quota: 10,
          allowOverQuota: false,
          usageRecord: createUsageRecord(),
        })
      ).rejects.toThrow(AtomicQuotaNotSupportedProblem);
    });

    it('should return exceeded result from atomic storage', async () => {
      const usageRecord = createUsageRecord();
      mockStorage.checkAndRecordWithinQuota = vi.fn().mockResolvedValue({
        exceeded: true,
        newUsage: 12,
      });

      const result = await quotaManager.checkAndRecord({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 4,
        quota: 10,
        allowOverQuota: true,
        usageRecord,
      });

      expect(result).toEqual({ exceeded: true, newUsage: 12 });
      expect(mockStorage.checkAndRecordWithinQuota).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 4,
        quota: 10,
        allowOverQuota: true,
        usageRecord,
      });
    });
  });

  describe('validateOrThrow', () => {
    it('should throw QuotaExceededProblem when exceeded and allowOverQuota is false', () => {
      expect(() =>
        quotaManager.validateOrThrow({
          meterId: 'api_calls',
          quota: 10,
          allowOverQuota: false,
          exceeded: true,
          newUsage: 12,
        })
      ).toThrow(QuotaExceededProblem);
    });

    it('should not throw when exceeded and allowOverQuota is true', () => {
      expect(() =>
        quotaManager.validateOrThrow({
          meterId: 'api_calls',
          quota: 10,
          allowOverQuota: true,
          exceeded: true,
          newUsage: 12,
        })
      ).not.toThrow();
    });
  });
});
