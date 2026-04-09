import type { HealthSignal, SignalCategory } from '@croco/customer-health-core';
import { SignalProvider } from '@croco/customer-health-core';
import { Component, Inject, Token } from '@croco/framework-context';

/**
 * 건강 점수 계산에 필요한 사용량 데이터 구조입니다.
 */
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

/**
 * 사용량 데이터를 제공하는 저장소 인터페이스입니다.
 */
export interface UsageStorage {
  getUsage(tenantId: string, periodStart: Date, periodEnd: Date): Promise<UsageData>;
}

/**
 * 사용량 저장소 주입에 사용하는 토큰입니다.
 */
export const USAGE_STORAGE_TOKEN = new Token<UsageStorage>('USAGE_STORAGE_TOKEN');

/**
 * 사용량 데이터를 usage 카테고리 신호로 변환하는 구현체입니다.
 */
@Component()
export class MeteringSignalProvider extends SignalProvider {
  readonly category: SignalCategory = 'usage';

  /**
   * 사용량 저장소를 받아 신호 제공자를 초기화합니다.
   */
  constructor(@Inject(USAGE_STORAGE_TOKEN) private readonly usageStorage: UsageStorage) {
    super();
  }

  /**
   * 월간 사용량을 바탕으로 usage 신호를 수집합니다.
   */
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
