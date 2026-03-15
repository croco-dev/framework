import type { TenantHealthScore } from '@croco/customer-health-core';
import { HealthScoreStore } from '@croco/customer-health-core';
import { Component, Inject, Token } from '@croco/framework-context';
import type { DrizzleDb, DrizzleInsertFn, DrizzleSelectFn } from '@croco/tx-drizzle';
import { desc, eq } from 'drizzle-orm';
import { tenantHealthScores } from './schema';

export type DrizzleHealthClient = DrizzleDb & {
  insert: DrizzleInsertFn;
  select: DrizzleSelectFn;
};

const DRIZZLE_TOKEN = new Token<DrizzleHealthClient>('DRIZZLE_TOKEN');

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
    return result[0] ?? null;
  }

  async findHistory(tenantId: string, limit: number): Promise<TenantHealthScore[]> {
    return this.db
      .select()
      .from(tenantHealthScores)
      .where(eq(tenantHealthScores.tenantId, tenantId))
      .orderBy(desc(tenantHealthScores.calculatedAt))
      .limit(limit);
  }
}
