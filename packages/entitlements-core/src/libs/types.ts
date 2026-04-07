export type EntitlementType = 'boolean' | 'metered' | 'static';

export type OveragePolicy = 'BLOCK' | 'WARN' | 'ALLOW_WITH_OVERAGE';

export type UsageHistoryPeriod = {
  startDate: Date;
  endDate: Date;
};

export type UsageHistoryEntry = {
  timestamp: Date;
  usage: number;
};

export type EntitlementQuotaStatus = {
  usage: number;
  quota: number;
  exceeded: boolean;
  remaining: number;
};

export type EntitlementRule = {
  featureKey: string;
  type: EntitlementType;
  value?: number;
  meterId?: string;
  quota?: number;
  overagePolicy?: OveragePolicy;
};

export type PlanEntitlements = {
  planId: string;
  entitlements: EntitlementRule[];
};

export type EntitlementCheckResult = {
  granted: boolean;
  featureKey: string;
  type: EntitlementType;
  usage?: number;
  quota?: number;
  remaining?: number;
  exceeded?: boolean;
  value?: number;
  planId?: string;
  reason?: string;
  overagePolicy?: OveragePolicy;
};
