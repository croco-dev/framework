import { Component, Inject, InjectOptional } from "@croco/framework-context";
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

type PersistTransitionResult =
  | { kind: "committed"; eventPublicationDeferred: boolean }
  | { kind: "superseded"; latest: TenantHealthScore };

@Component()
export class CustomerHealthService {
  constructor(
    @Inject(HealthSignalRegistry.token) private readonly signalRegistry: HealthSignalRegistry,
    @Inject(HealthScoreStore.token) private readonly store: HealthScoreStore,
    @Inject(() => HealthScoreCalculator) private readonly calculator: HealthScoreCalculator,
    @InjectOptional(CustomerHealthEventPublisher.token)
    private readonly eventPublisher?: CustomerHealthEventPublisher,
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
    const persistence = await this.persistTransition(score, previous);
    if (persistence.kind === "superseded") return persistence.latest;

    const eventPublisher = this.getEventPublisher();
    if (eventPublisher && !persistence.eventPublicationDeferred) {
      const intents = await this.store.listPendingEventIntents(tenantId, 100);
      await this.publishEventIntents(intents, eventPublisher);
    }

    return score;
  }

  private async persistTransition(
    score: TenantHealthScore,
    initialPrevious: TenantHealthScore | null,
  ): Promise<PersistTransitionResult> {
    let previous = initialPrevious;

    for (let attempt = 1; attempt <= MAX_TRANSITION_PERSISTENCE_ATTEMPTS; attempt += 1) {
      this.applyPreviousScore(score, previous);
      const eventIntents = createHealthTransitionEventIntents(previous, score);
      const commit = await this.store.saveTransition(score, previous, eventIntents);
      if (commit.committed) {
        return {
          kind: "committed",
          eventPublicationDeferred: commit.eventPublicationDeferred === true,
        };
      }

      if (commit.latest && commit.latest.calculatedAt.getTime() > score.calculatedAt.getTime()) {
        return { kind: "superseded", latest: commit.latest };
      }

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
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const history = await this.store.findHistoryByPeriod(tenantId, "day", startDate, now);
    if (history.length < 2) {
      return null;
    }

    const sorted = [...history].sort((a, b) => a.calculatedAt.getTime() - b.calculatedAt.getTime());
    const hasOrderedVersions = this.store.transitionVersionOrdering === "ascending-decimal";
    const oldest = getTrendEndpoint(sorted, sorted[0], "oldest", hasOrderedVersions);
    const newest = getTrendEndpoint(
      sorted,
      sorted[sorted.length - 1],
      "newest",
      hasOrderedVersions,
    );
    if (oldest === undefined || newest === undefined) return null;

    const changePercentage = oldest === 0 ? newest * 100 : ((newest - oldest) / oldest) * 100;

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
    return this.eventPublisher ?? null;
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

function getTrendEndpoint(
  history: readonly TenantHealthScore[],
  boundary: TenantHealthScore,
  direction: "oldest" | "newest",
  hasOrderedVersions: boolean,
): number | undefined {
  const timestamp = boundary.calculatedAt.getTime();
  const tied = history.filter((score) => score.calculatedAt.getTime() === timestamp);
  if (tied.every((score) => score.overallScore === boundary.overallScore)) {
    return boundary.overallScore;
  }

  // A legacy or opaque CAS token cannot determine the order of differing scores.
  if (!hasOrderedVersions) return undefined;
  const scoresBySequence = new Map<bigint, number>();
  let endpointSequence: bigint | undefined;
  for (const { transitionVersion, overallScore } of tied) {
    if (transitionVersion === undefined || !/^0*[1-9][0-9]*$/.test(transitionVersion))
      return undefined;

    const sequence = BigInt(transitionVersion);
    const previousScore = scoresBySequence.get(sequence);
    if (previousScore !== undefined && previousScore !== overallScore) return undefined;
    scoresBySequence.set(sequence, overallScore);
    if (
      endpointSequence === undefined ||
      (direction === "oldest" ? sequence < endpointSequence : sequence > endpointSequence)
    ) {
      endpointSequence = sequence;
    }
  }
  return endpointSequence === undefined ? undefined : scoresBySequence.get(endpointSequence);
}

function waitForTransitionPersistenceRetry(attempt: number): Promise<void> {
  const delayMs = TRANSITION_PERSISTENCE_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
