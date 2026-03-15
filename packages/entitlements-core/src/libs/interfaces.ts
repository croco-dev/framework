import { Token } from '@croco/framework-context';
import type { EntitlementRule } from './types';

export abstract class SubscriptionProvider {
  static readonly token = new Token<SubscriptionProvider>('SubscriptionProvider');

  abstract getCurrentPlanId(tenantId: string): Promise<string | null>;
}

export abstract class PlanEntitlementRegistry {
  static readonly token = new Token<PlanEntitlementRegistry>('PlanEntitlementRegistry');

  abstract getEntitlements(planId: string): Promise<EntitlementRule[]>;

  abstract findRule(planId: string, featureKey: string): Promise<EntitlementRule | null>;
}

export abstract class EntitlementQuotaChecker {
  static readonly token = new Token<EntitlementQuotaChecker>('EntitlementQuotaChecker');

  abstract checkQuota(tenantId: string, meterId: string, quota: number): Promise<{ exceeded: boolean; usage: number }>;
}

export abstract class EntitlementMeterLookup {
  static readonly token = new Token<EntitlementMeterLookup>('EntitlementMeterLookup');

  abstract getMeterQuota(tenantId: string, meterId: string): Promise<number | null>;
}
