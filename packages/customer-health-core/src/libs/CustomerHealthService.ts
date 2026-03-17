import { EventPublisher } from '@croco/events-core';
import { Component, Container, Inject } from '@croco/framework-context';
import { HealthScoreDroppedEvent, HealthStatusChangedEvent } from './events';
import { HealthScoreCalculator } from './HealthScoreCalculator';
import { HealthScoreStore, HealthSignalRegistry } from './interfaces';
import type { HealthScoreProfile, TenantHealthScore } from './types';

const SCORE_DROP_EVENT_THRESHOLD_PERCENT = 20;

@Component()
export class CustomerHealthService {
  constructor(
    @Inject(HealthSignalRegistry.token) private readonly signalRegistry: HealthSignalRegistry,
    @Inject(HealthScoreStore.token) private readonly store: HealthScoreStore,
    @Inject(() => HealthScoreCalculator) private readonly calculator: HealthScoreCalculator
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
    const eventPublisher = this.getEventPublisher();
    if (!previous || !eventPublisher) {
      return;
    }

    if (previous.status !== score.status) {
      await eventPublisher.publish(
        new HealthStatusChangedEvent(score.tenantId, previous.status, score.status, score.overallScore)
      );
    }

    const dropPercentage = this.calculateDropPercentage(previous.overallScore, score.overallScore);
    if (dropPercentage >= SCORE_DROP_EVENT_THRESHOLD_PERCENT) {
      await eventPublisher.publish(
        new HealthScoreDroppedEvent(score.tenantId, previous.overallScore, score.overallScore, dropPercentage)
      );
    }
  }

  private getEventPublisher(): EventPublisher | null {
    if (!Container.has(EventPublisher)) {
      return null;
    }

    return Container.get(EventPublisher);
  }

  private calculateDropPercentage(previousScore: number, currentScore: number): number {
    if (previousScore <= 0 || currentScore >= previousScore) {
      return 0;
    }

    return ((previousScore - currentScore) / previousScore) * 100;
  }
}
