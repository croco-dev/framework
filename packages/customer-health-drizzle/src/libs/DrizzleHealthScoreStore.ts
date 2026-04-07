import type { TenantHealthScore, TrendPeriod } from '@croco/customer-health-core';
import { HealthScoreStore } from '@croco/customer-health-core';
import { Component, Inject, Token } from '@croco/framework-context';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { tenantHealthScores } from './schema';

export type DrizzleHealthClient = NodePgDatabase<Record<string, never>>;

export const DRIZZLE_TOKEN = new Token<DrizzleHealthClient>('DRIZZLE_TOKEN');

type TenantHealthScoreRow = {
  tenantId: string;
  overallScore: number;
  status: 'healthy' | 'at_risk' | 'critical';
  categoryScores: Record<string, number>;
  signals: unknown[];
  trend: 'improving' | 'stable' | 'declining';
  previousScore: number | null;
  calculatedAt: Date;
};

@Component()
export class DrizzleHealthScoreStore extends HealthScoreStore {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleHealthClient) {
    super();
  }

  async save(score: TenantHealthScore): Promise<void> {
    await this.db.insert(tenantHealthScores).values(score);
  }

  async findLatest(tenantId: string): Promise<TenantHealthScore | null> {
    const result = await this.db
      .select()
      .from(tenantHealthScores)
      .where(eq(tenantHealthScores.tenantId, tenantId))
      .orderBy(desc(tenantHealthScores.calculatedAt))
      .limit(1);
    const row = result[0] as TenantHealthScoreRow | undefined;
    return row ? this.mapToTenantHealthScore(row) : null;
  }

  async findHistory(tenantId: string, limit: number): Promise<TenantHealthScore[]> {
    const results = await this.db
      .select()
      .from(tenantHealthScores)
      .where(eq(tenantHealthScores.tenantId, tenantId))
      .orderBy(desc(tenantHealthScores.calculatedAt))
      .limit(limit);
    return (results as TenantHealthScoreRow[]).map((row) => this.mapToTenantHealthScore(row));
  }

  async findHistoryByPeriod(
    tenantId: string,
    _period: TrendPeriod,
    startDate: Date,
    endDate: Date
  ): Promise<TenantHealthScore[]> {
    const results = await this.db
      .select()
      .from(tenantHealthScores)
      .where(
        and(
          eq(tenantHealthScores.tenantId, tenantId),
          gte(tenantHealthScores.calculatedAt, startDate),
          lte(tenantHealthScores.calculatedAt, endDate)
        )
      )
      .orderBy(desc(tenantHealthScores.calculatedAt));
    return (results as TenantHealthScoreRow[]).map((row) => this.mapToTenantHealthScore(row));
  }

  private mapToTenantHealthScore(row: TenantHealthScoreRow): TenantHealthScore {
    return {
      tenantId: row.tenantId,
      overallScore: row.overallScore,
      status: row.status,
      categoryScores: row.categoryScores as Record<'usage' | 'business' | 'engagement', number>,
      signals: row.signals as Array<{
        category: 'usage' | 'business' | 'engagement';
        name: string;
        value: number;
        weight: number;
        rawValue: unknown;
        collectedAt: Date;
      }>,
      trend: row.trend,
      previousScore: row.previousScore ?? undefined,
      calculatedAt: row.calculatedAt,
    };
  }
}
