import type { EntitlementRule } from '@croco/entitlements-core';
import { PlanEntitlementRegistry } from '@croco/entitlements-core';
import { Token } from '@croco/framework-context';
import type { DrizzleDb, DrizzleSelectFn } from '@croco/tx-drizzle';
import { eq } from 'drizzle-orm';
import { planEntitlements } from './schema';

type DrizzleEntitlementsClient = DrizzleDb & {
  select: DrizzleSelectFn;
};

type PlanEntitlementsRow = typeof planEntitlements.$inferSelect;

export const DRIZZLE_TOKEN = new Token<DrizzleEntitlementsClient>('DRIZZLE_TOKEN');

export class DrizzlePlanEntitlementRegistry extends PlanEntitlementRegistry {
  constructor(private readonly db: DrizzleEntitlementsClient) {
    super();
  }

  async getEntitlements(planId: string): Promise<EntitlementRule[]> {
    const result = await this.db.select().from(planEntitlements).where(eq(planEntitlements.planId, planId));

    return result.map((row: PlanEntitlementsRow) => ({
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
