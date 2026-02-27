import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    it('should record when within quota', async () => {
      const usageRecord = createUsageRecord();
      vi.mocked(mockStorage.getUsage).mockResolvedValue(4);

      const result = await quotaManager.checkAndRecord({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 4,
        quota: 10,
        allowOverQuota: false,
        usageRecord,
      });

      expect(result).toEqual({ exceeded: false, newUsage: 8 });
      expect(mockStorage.record).toHaveBeenCalledWith(usageRecord);
    });

    it('should not record when over quota and allowOverQuota is false', async () => {
      const usageRecord = createUsageRecord();
      vi.mocked(mockStorage.getUsage).mockResolvedValue(8);

      const result = await quotaManager.checkAndRecord({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 4,
        quota: 10,
        allowOverQuota: false,
        usageRecord,
      });

      expect(result).toEqual({ exceeded: true, newUsage: 12 });
      expect(mockStorage.record).not.toHaveBeenCalled();
    });

    it('should record when over quota and allowOverQuota is true', async () => {
      const usageRecord = createUsageRecord();
      vi.mocked(mockStorage.getUsage).mockResolvedValue(8);

      const result = await quotaManager.checkAndRecord({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 4,
        quota: 10,
        allowOverQuota: true,
        usageRecord,
      });

      expect(result).toEqual({ exceeded: true, newUsage: 12 });
      expect(mockStorage.record).toHaveBeenCalledWith(usageRecord);
    });

    it('BUG-11 동시 할당량 소진에서 정확한 임계값 도달', async () => {
      let consumedUsage = 0;

      vi.mocked(mockStorage.getUsage).mockImplementation(async () => {
        await Promise.resolve();
        return consumedUsage;
      });
      vi.mocked(mockStorage.record).mockImplementation(async (usage) => {
        consumedUsage += usage.value;
      });

      const first = quotaManager.checkAndRecord({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 4,
        quota: 10,
        allowOverQuota: false,
        usageRecord: createUsageRecord({ id: 'usage-1', idempotencyKey: 'bug-11-first' }),
      });
      const second = quotaManager.checkAndRecord({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 4,
        quota: 10,
        allowOverQuota: false,
        usageRecord: createUsageRecord({ id: 'usage-2', idempotencyKey: 'bug-11-second' }),
      });
      const third = quotaManager.checkAndRecord({
        tenantId: 'tenant-1',
        meterId: 'api_calls',
        value: 4,
        quota: 10,
        allowOverQuota: false,
        usageRecord: createUsageRecord({ id: 'usage-3', idempotencyKey: 'bug-11-third' }),
      });

      const settled = await Promise.allSettled([first, second, third]);
      const successResults = settled.filter(
        (result): result is PromiseFulfilledResult<{ exceeded: boolean; newUsage: number }> =>
          result.status === 'fulfilled'
      );
      const overQuotaResults = successResults.filter((result) => result.value.exceeded);
      const acceptedResults = successResults.filter((result) => !result.value.exceeded);

      expect(successResults).toHaveLength(3);
      expect(acceptedResults).toHaveLength(2);
      expect(overQuotaResults).toHaveLength(1);
      expect(overQuotaResults[0].value.newUsage).toBe(12);
      expect(consumedUsage).toBe(8);
      expect(mockStorage.record).toHaveBeenCalledTimes(2);
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
