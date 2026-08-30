import { Component, Container, Inject } from "@croco/framework-context";
import { createHealthTransitionEventIntents } from "./eventIntent";
import type { HealthTransitionEventIntent } from "./eventIntent";
import { HealthScoreDroppedEvent, HealthStatusChangedEvent } from "./events";
import { HealthScoreCalculator } from "./HealthScoreCalculator";
import { CustomerHealthEventPublisher, HealthScoreStore, HealthSignalRegistry } from "./interfaces";
import {
  HealthEventPublisherNotConfiguredProblem,
  HealthTransitionPersistenceRetryExhaustedProblem,
} from "./problems/HealthProblems";
import type { HealthScoreProfile, HealthTrend, TenantHealthScore } from "./types";

const MAX_TRANSITION_PERSISTENCE_ATTEMPTS = 3;
const TRANSITION_PERSISTENCE_RETRY_BASE_DELAY_MS = 10;

@Component()
export class CustomerHealthService {
  constructor(
    @Inject(HealthSignalRegistry.token) private readonly signalRegistry: HealthSignalRegistry,
    @Inject(HealthScoreStore.token) private readonly store: HealthScoreStore,
    @Inject(() => HealthScoreCalculator) private readonly calculator: HealthScoreCalculator,
  ) {}

  async calculateAndStore(
    tenantId: string,
    profile: HealthScoreProfile,
  ): Promise<TenantHealthScore> {
    const providers = this.signalRegistry.getProviders();
    const allSignals: {
      category: string;
      name: string;
      value: number;
      weight: number;
      rawValue: unknown;
      collectedAt: Date;
    }[] = [];

    for (const provider of providers) {
      const providerSignals = await provider.collect(tenantId);
      allSignals.push(...providerSignals);
    }

    const score = this.calculator.calculate(allSignals, profile);
    score.tenantId = tenantId;

    const previous = await this.store.findLatest(tenantId);
    await this.persistTransition(score, previous);

    const eventPublisher = this.getEventPublisher();
    if (eventPublisher) {
      const intents = await this.store.listPendingEventIntents(tenantId, 100);
      await this.publishEventIntents(intents, eventPublisher);
    }

    return score;
  }

  private async persistTransition(
    score: TenantHealthScore,
    initialPrevious: TenantHealthScore | null,
  ): Promise<void> {
    let previous = initialPrevious;

    for (let attempt = 1; attempt <= MAX_TRANSITION_PERSISTENCE_ATTEMPTS; attempt += 1) {
      this.applyPreviousScore(score, previous);
      const eventIntents = createHealthTransitionEventIntents(previous, score);
      const commit = await this.store.saveTransition(score, previous, eventIntents);
      if (commit.committed) return;

      previous = commit.latest;
      if (attempt < MAX_TRANSITION_PERSISTENCE_ATTEMPTS) {
        await waitForTransitionPersistenceRetry(attempt);
      }
    }

    throw new HealthTransitionPersistenceRetryExhaustedProblem(
      score.tenantId,
      MAX_TRANSITION_PERSISTENCE_ATTEMPTS,
    );
  }

  async publishPendingEvents(tenantId: string, limit = 100): Promise<number> {
    const eventPublisher = this.getEventPublisher();
    if (!eventPublisher) throw new HealthEventPublisherNotConfiguredProblem();

    const intents = await this.store.listPendingEventIntents(tenantId, limit);
    await this.publishEventIntents(intents, eventPublisher);
    return intents.length;
  }

  async getLatest(tenantId: string): Promise<TenantHealthScore | null> {
    return this.store.findLatest(tenantId);
  }

  async getTrend(
    tenantId: string,
    days: number,
  ): Promise<{ trend: HealthTrend; changePercentage: number } | null> {
    const history = await this.store.findHistory(tenantId, days + 1);
    if (history.length < 2) {
      return null;
    }

    const sorted = history.sort((a, b) => a.calculatedAt.getTime() - b.calculatedAt.getTime());
    const oldest = sorted[0];
    const newest = sorted[sorted.length - 1];

    const changePercentage =
      oldest.overallScore === 0
        ? newest.overallScore * 100
        : ((newest.overallScore - oldest.overallScore) / oldest.overallScore) * 100;

    let trend: HealthTrend;
    if (changePercentage >= 5) {
      trend = "improving";
    } else if (changePercentage <= -5) {
      trend = "declining";
    } else {
      trend = "stable";
    }

    return { trend, changePercentage };
  }

  private async publishEventIntents(
    intents: readonly HealthTransitionEventIntent[],
    eventPublisher: CustomerHealthEventPublisher,
  ): Promise<void> {
    for (const intent of intents) {
      const event = this.restoreEvent(intent);
      await eventPublisher.publishIdempotently(event);
      await this.store.markEventIntentPublished(intent.eventId);
    }
  }

  private getEventPublisher(): CustomerHealthEventPublisher | null {
    return Container.has(CustomerHealthEventPublisher.token)
      ? Container.get(CustomerHealthEventPublisher.token)
      : null;
  }

  private restoreEvent(intent: HealthTransitionEventIntent) {
    const event =
      intent.data.kind === "status_changed"
        ? new HealthStatusChangedEvent(
            intent.data.tenantId,
            intent.data.oldStatus,
            intent.data.newStatus,
            intent.data.score,
            intent.eventId,
            intent.occurredAt,
          )
        : new HealthScoreDroppedEvent(
            intent.data.tenantId,
            intent.data.previousScore,
            intent.data.currentScore,
            intent.data.dropPercentage,
            intent.eventId,
            intent.occurredAt,
          );
    return event;
  }

  private applyPreviousScore(score: TenantHealthScore, previous: TenantHealthScore | null): void {
    if (!previous) {
      delete score.previousScore;
      score.trend = "stable";
      return;
    }
    score.previousScore = previous.overallScore;
    score.trend = this.calculator.determineTrend(score.overallScore, previous.overallScore);
  }
}

function waitForTransitionPersistenceRetry(attempt: number): Promise<void> {
  const delayMs = TRANSITION_PERSISTENCE_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
