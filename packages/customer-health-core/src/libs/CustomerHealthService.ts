import { Component } from '@croco/framework-context';
import type { HealthScoreCalculator } from './HealthScoreCalculator';
import type { HealthScoreStore, HealthSignalRegistry } from './interfaces';
import type { HealthScoreProfile, TenantHealthScore } from './types';

@Component()
export class CustomerHealthService {
  constructor(
    private readonly signalRegistry: HealthSignalRegistry,
    private readonly store: HealthScoreStore,
    private readonly calculator: HealthScoreCalculator
  ) {}

  async calculateAndStore(tenantId: string, profile: HealthScoreProfile): Promise<TenantHealthScore> {
    const providers = this.signalRegistry.getProviders();
    const signals: unknown[] = [];
    for (const provider of providers) {
      const providerSignals = await provider.collect(tenantId);
      signals.push(...providerSignals);
    }

    const score = this.calculator.calculate(signals as Parameters<HealthScoreCalculator['calculate']>[0], profile);
    score.tenantId = tenantId;

    const previous = await this.store.findLatest(tenantId);
    if (previous) {
      score.previousScore = previous.overallScore;
      score.trend = this.calculator.determineTrend(score.overallScore, previous.overallScore);
    }

    await this.store.save(score);

    await this.publishEvents(score, previous);

    return score;
  }

  async getLatest(tenantId: string): Promise<TenantHealthScore | null> {
    return this.store.findLatest(tenantId);
  }

  private async publishEvents(score: TenantHealthScore, previous: TenantHealthScore | null): Promise<void> {
    // TODO: 이벤트 클래스(HealthStatusChangedEvent, HealthScoreDroppedEvent) 생성 후 구현
    // const publisher = new EventPublisher();
    // if (previous && previous.status !== score.status) {
    //   await publisher.publish(new HealthStatusChangedEvent(...));
    // }
    // if (previous && score.overallScore < previous.overallScore) {
    //   await publisher.publish(new HealthScoreDroppedEvent(...));
    // }
  }
}
