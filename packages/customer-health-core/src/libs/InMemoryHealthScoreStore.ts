import { Component } from "@croco/framework-context";
import { HealthScoreStore } from "./interfaces";
import { cloneHealthTransitionEventIntent } from "./eventIntent";
import type { HealthTransitionEventIntent } from "./eventIntent";
import type { TenantHealthScore, TrendPeriod } from "./types";
import { HealthEventIntentConflictProblem } from "./problems/HealthProblems";

@Component()
export class InMemoryHealthScoreStore extends HealthScoreStore {
  private readonly store = new Map<string, TenantHealthScore[]>();
  private readonly eventIntents = new Map<string, HealthTransitionEventIntent>();
  private transitionSequence = 0;

  async saveTransition(
    score: TenantHealthScore,
    previous: TenantHealthScore | null,
    eventIntents: readonly HealthTransitionEventIntent[],
  ): Promise<
    | { readonly committed: true }
    | { readonly committed: false; readonly latest: TenantHealthScore | null }
  > {
    const { tenantId } = score;
    const history = this.store.get(tenantId) ?? [];
    const latest = history.at(-1) ?? null;
    if (!matchesPrevious(latest, previous)) {
      return { committed: false, latest };
    }
    for (const intent of eventIntents) {
      if (this.eventIntents.has(intent.eventId)) {
        throw new HealthEventIntentConflictProblem(intent.eventId);
      }
    }
    score.transitionVersion = String(++this.transitionSequence);
    history.push(score);
    this.store.set(tenantId, history);
    for (const intent of eventIntents) {
      this.eventIntents.set(intent.eventId, cloneHealthTransitionEventIntent(intent));
    }
    return { committed: true };
  }

  async listPendingEventIntents(
    tenantId: string,
    limit = 100,
  ): Promise<readonly HealthTransitionEventIntent[]> {
    if (!Number.isInteger(limit) || limit <= 0) return [];
    return [...this.eventIntents.values()]
      .filter((intent) => intent.tenantId === tenantId)
      .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())
      .slice(0, limit)
      .map(cloneHealthTransitionEventIntent);
  }

  async markEventIntentPublished(eventId: string): Promise<void> {
    this.eventIntents.delete(eventId);
  }

  async findLatest(tenantId: string): Promise<TenantHealthScore | null> {
    const history = this.store.get(tenantId);
    if (!history || history.length === 0) {
      return null;
    }
    return history[history.length - 1] ?? null;
  }

  async findHistory(tenantId: string, limit: number): Promise<TenantHealthScore[]> {
    const history = this.store.get(tenantId) ?? [];
    if (limit <= 0) {
      return [];
    }
    return history.slice(-limit);
  }

  async findHistoryByPeriod(
    tenantId: string,
    _period: TrendPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<TenantHealthScore[]> {
    const history = this.store.get(tenantId) ?? [];
    return history.filter(
      (score) => score.calculatedAt >= startDate && score.calculatedAt <= endDate,
    );
  }
}

function matchesPrevious(
  latest: TenantHealthScore | null,
  expected: TenantHealthScore | null,
): boolean {
  if (!latest || !expected) return latest === expected;
  if (latest.transitionVersion || expected.transitionVersion) {
    return latest.transitionVersion === expected.transitionVersion;
  }
  return (
    latest.tenantId === expected.tenantId &&
    latest.calculatedAt.getTime() === expected.calculatedAt.getTime() &&
    latest.overallScore === expected.overallScore &&
    latest.status === expected.status
  );
}
