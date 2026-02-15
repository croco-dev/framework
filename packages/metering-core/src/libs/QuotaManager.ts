import { QuotaExceededProblem } from './problems/QuotaExceededProblem';
import type { UsageRecord } from './types';
import type { AtomicQuotaCheckResult, UsageStorage } from './UsageStorage';

export type QuotaManagerOptions = {
  usageStorage: UsageStorage;
};

export type QuotaCheckAndRecordOptions = {
  tenantId: string;
  meterId: string;
  value: number;
  quota: number;
  allowOverQuota: boolean;
  usageRecord: UsageRecord;
};

export type QuotaCheckAndRecordResult = {
  exceeded: boolean;
  newUsage: number;
};

export class QuotaManager {
  private readonly usageStorage: UsageStorage;
  private readonly quotaLocks = new Map<string, Promise<void>>();

  constructor(options: QuotaManagerOptions) {
    this.usageStorage = options.usageStorage;
  }

  async checkAndRecord(options: QuotaCheckAndRecordOptions): Promise<QuotaCheckAndRecordResult> {
    if (this.usageStorage.checkAndRecordWithinQuota) {
      const atomicResult = await this.usageStorage.checkAndRecordWithinQuota(options);
      return this.toQuotaCheckResult(atomicResult);
    }

    const lockKey = this.buildLockKey(options.tenantId, options.meterId);

    return this.withQuotaLock(lockKey, async () => {
      const currentUsage = await this.usageStorage.getUsage({
        tenantId: options.tenantId,
        meterId: options.meterId,
        period: 'billing_cycle',
      });
      const newUsage = currentUsage + options.value;
      const exceeded = newUsage > options.quota;

      if (!exceeded || options.allowOverQuota) {
        await this.usageStorage.record(options.usageRecord);
      }

      return { exceeded, newUsage };
    });
  }

  private toQuotaCheckResult(result: AtomicQuotaCheckResult): QuotaCheckAndRecordResult {
    return {
      exceeded: result.exceeded,
      newUsage: result.newUsage,
    };
  }

  validateOrThrow(options: {
    meterId: string;
    quota: number;
    allowOverQuota: boolean;
    exceeded: boolean;
    newUsage: number;
  }): void {
    if (!options.exceeded || options.allowOverQuota) {
      return;
    }

    throw new QuotaExceededProblem(options.meterId, options.newUsage, options.quota);
  }

  private async withQuotaLock<T>(lockKey: string, operation: () => Promise<T>): Promise<T> {
    const previousLock = this.quotaLocks.get(lockKey) ?? Promise.resolve();

    let releaseCurrentLock = () => {};
    const currentLock = new Promise<void>((resolve) => {
      releaseCurrentLock = resolve;
    });
    const lockQueue = previousLock.then(async () => currentLock);
    this.quotaLocks.set(lockKey, lockQueue);

    await previousLock;

    try {
      return await operation();
    } finally {
      releaseCurrentLock();
      if (this.quotaLocks.get(lockKey) === lockQueue) {
        this.quotaLocks.delete(lockKey);
      }
    }
  }

  private buildLockKey(tenantId: string, meterId: string): string {
    return `${tenantId}:${meterId}`;
  }
}
