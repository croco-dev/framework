import type { PolicyDecisionSourceLocation, PolicyDecisionTrace } from "@croco/access-core";

export type EntitlementType = "boolean" | "metered" | "static";

export type OveragePolicy = "BLOCK" | "WARN" | "ALLOW_WITH_OVERAGE";

export type EntitlementCheckStatus =
  | "allowed"
  | "denied"
  | "soft-limit"
  | "overage-allowed"
  | "unknown";

export type EntitlementFailureReason =
  | "no_subscription"
  | "inactive_subscription"
  | "not_entitled"
  | "no_quota_defined"
  | "quota_exceeded"
  | "provider_unavailable"
  | "resource_not_found"
  | (string & {});

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
  status: EntitlementCheckStatus;
  featureKey: string;
  type: EntitlementType;
  usage?: number;
  quota?: number;
  remaining?: number;
  exceeded?: boolean;
  value?: number;
  planId?: string;
  reason?: EntitlementFailureReason;
  overagePolicy?: OveragePolicy;
  trace?: PolicyDecisionTrace;
};

export type EntitlementCheckOptions = {
  readonly subjectRef?: string;
  readonly ruleId?: string;
  readonly sourceLocation?: PolicyDecisionSourceLocation;
  readonly inputs?: Record<string, unknown>;
};
