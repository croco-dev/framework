import { AtomicQuotaNotSupportedProblem } from "./problems/AtomicQuotaNotSupportedProblem";
import { QuotaExceededProblem } from "./problems/QuotaExceededProblem";
import type { UsageRecord } from "./types";
import type { AtomicQuotaCheckResult, UsageStorage } from "./UsageStorage";

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

  constructor(options: QuotaManagerOptions) {
    this.usageStorage = options.usageStorage;
  }

  async checkAndRecord(options: QuotaCheckAndRecordOptions): Promise<QuotaCheckAndRecordResult> {
    if (!this.usageStorage.checkAndRecordWithinQuota) {
      throw new AtomicQuotaNotSupportedProblem();
    }

    const atomicResult = await this.usageStorage.checkAndRecordWithinQuota(options);
    return this.toQuotaCheckResult(atomicResult);
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
}
