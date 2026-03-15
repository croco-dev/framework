import type { HealthSignal, SignalCategory } from '@croco/customer-health-core';
import { SignalProvider } from '@croco/customer-health-core';
import { Component, Inject, Token } from '@croco/framework-context';

export type UsageData = {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  usage: number;
  limit: number;
  features: Array<{
    key: string;
    usage: number;
    limit: number;
  }>;
};

export interface UsageStorage {
  getUsage(tenantId: string, periodStart: Date, periodEnd: Date): Promise<UsageData>;
}

const USAGE_STORAGE_TOKEN = new Token<UsageStorage>('USAGE_STORAGE_TOKEN');

@Component()
export class MeteringSignalProvider extends SignalProvider {
  readonly category: SignalCategory = 'usage';

  constructor(@Inject(USAGE_STORAGE_TOKEN) private readonly usageStorage: UsageStorage) {
    super();
  }

  async collect(tenantId: string): Promise<HealthSignal[]> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const usageData = await this.usageStorage.getUsage(tenantId, periodStart, periodEnd);

    const signals: HealthSignal[] = [];

    const overallUsageScore = this.normalizeScore(usageData.usage, usageData.limit);
    signals.push({
      category: 'usage',
      name: 'overall_usage',
      value: overallUsageScore,
      weight: 0.5,
      rawValue: { usage: usageData.usage, limit: usageData.limit },
      collectedAt: now,
    });

    for (const feature of usageData.features) {
      const featureScore = this.normalizeScore(feature.usage, feature.limit);
      signals.push({
        category: 'usage',
        name: `feature_${feature.key}`,
        value: featureScore,
        weight: 0.5 / usageData.features.length,
        rawValue: { usage: feature.usage, limit: feature.limit },
        collectedAt: now,
      });
    }

    return signals;
  }

  private normalizeScore(usage: number, limit: number): number {
    if (limit === 0) {
      return 100;
    }
    const ratio = usage / limit;
    if (ratio <= 0.5) {
      return 100;
    }
    if (ratio <= 0.75) {
      return Math.round(100 - (ratio - 0.5) * 200);
    }
    return Math.round(Math.max(0, 50 - (ratio - 0.75) * 200));
  }
}
