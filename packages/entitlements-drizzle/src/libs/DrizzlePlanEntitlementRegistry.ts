import type { EntitlementRule } from '@croco/entitlements-core';
import { PlanEntitlementRegistry } from '@croco/entitlements-core';
import { Token } from '@croco/framework-context';
import type { DrizzleDb } from '@croco/tx-drizzle';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { planEntitlements } from './schema';

type DrizzleEntitlementsClient = DrizzleDb & NodePgDatabase<Record<string, never>>;

interface PlanEntitlementsRow {
  id: string;
  planId: string;
  featureKey: string;
  type: string;
  value: number | null;
  meterId: string | null;
  quota: number | null;
  overagePolicy: string | null;
  createdAt: Date | null;
}

export const DRIZZLE_TOKEN = new Token<DrizzleEntitlementsClient>('DRIZZLE_TOKEN');

export type { DrizzleEntitlementsClient };

export class DrizzlePlanEntitlementRegistry extends PlanEntitlementRegistry {
  constructor(private readonly db: DrizzleEntitlementsClient) {
    super();
  }

  async getEntitlements(planId: string): Promise<EntitlementRule[]> {
    const rows = await this.db.select().from(planEntitlements).where(eq(planEntitlements.planId, planId));

    const result = rows as PlanEntitlementsRow[];

    return result.map((row) => ({
      featureKey: row.featureKey,
      type: row.type as EntitlementRule['type'],
      value: row.value ?? undefined,
      meterId: row.meterId ?? undefined,
      quota: row.quota ?? undefined,
      overagePolicy: (row.overagePolicy as EntitlementRule['overagePolicy']) ?? undefined,
    }));
  }

  async findRule(planId: string, featureKey: string): Promise<EntitlementRule | null> {
    const entitlements = await this.getEntitlements(planId);
    return entitlements.find((rule) => rule.featureKey === featureKey) ?? null;
  }
}
