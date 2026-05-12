import type { DomainEvent } from "@croco/events-core";
import { Token } from "@croco/framework-context";
import type {
  EntitlementQuotaStatus,
  EntitlementRule,
  UsageHistoryEntry,
  UsageHistoryPeriod,
} from "./types";

export abstract class SubscriptionProvider {
  static readonly token = new Token<SubscriptionProvider>("SubscriptionProvider");

  abstract getCurrentPlanId(tenantId: string): Promise<string | null>;
}

export abstract class PlanEntitlementRegistry {
  static readonly token = new Token<PlanEntitlementRegistry>("PlanEntitlementRegistry");

  abstract getEntitlements(planId: string): Promise<EntitlementRule[]>;

  abstract findRule(planId: string, featureKey: string): Promise<EntitlementRule | null>;
}

export abstract class EntitlementQuotaChecker {
  static readonly token = new Token<EntitlementQuotaChecker>("EntitlementQuotaChecker");

  abstract checkQuota(
    tenantId: string,
    featureId: string,
    quota: number,
  ): Promise<EntitlementQuotaStatus>;

  abstract getCurrentUsage(tenantId: string, featureId: string): Promise<number>;

  abstract resetUsage(tenantId: string, featureId: string, billingCycleStart: Date): Promise<void>;

  abstract getUsageHistory(
    tenantId: string,
    featureId: string,
    period: UsageHistoryPeriod,
  ): Promise<UsageHistoryEntry[]>;
}

export abstract class EntitlementMeterLookup {
  static readonly token = new Token<EntitlementMeterLookup>("EntitlementMeterLookup");

  abstract getMeterQuota(tenantId: string, meterId: string): Promise<number | null>;
}

export abstract class EntitlementEventPublisher {
  static readonly token = new Token<EntitlementEventPublisher>("EntitlementEventPublisher");

  abstract publish(event: DomainEvent): Promise<void>;
}
