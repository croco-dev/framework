import type { DomainEvent } from "@croco/events-core";
import { Token } from "@croco/framework-context";
import type {
  EntitlementCheckStatus,
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

export type EntitlementGuardAuditResource = {
  readonly type: string;
  readonly id: string;
};

export type EntitlementGuardAuditRoute = {
  readonly controllerName: string;
  readonly handlerName: string;
  readonly routeId: string;
};

export type EntitlementGuardAuditEvent = {
  readonly type: "entitlement.guard.allowed" | "entitlement.guard.denied";
  readonly tenantId: string;
  readonly feature: string;
  readonly status: EntitlementCheckStatus;
  readonly userId?: string;
  readonly resource?: EntitlementGuardAuditResource;
  readonly route?: EntitlementGuardAuditRoute;
  readonly reason?: string;
  readonly problemCode?: string;
  readonly metadata?: Record<string, string | number | boolean | null | undefined>;
};

export abstract class EntitlementAuditSink {
  static readonly token = new Token<EntitlementAuditSink>("EntitlementAuditSink");

  abstract recordEntitlementGuard(event: EntitlementGuardAuditEvent): void | Promise<void>;
}
