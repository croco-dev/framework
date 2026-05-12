import { Component } from "@croco/framework-context";
import { HealthScoreStore } from "./interfaces";
import type { TenantHealthScore, TrendPeriod } from "./types";

@Component()
export class InMemoryHealthScoreStore extends HealthScoreStore {
  private readonly store = new Map<string, TenantHealthScore[]>();

  async save(score: TenantHealthScore): Promise<void> {
    const { tenantId } = score;
    const history = this.store.get(tenantId) ?? [];
    history.push(score);
    this.store.set(tenantId, history);
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
