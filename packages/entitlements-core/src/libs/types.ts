export type EntitlementType = 'boolean' | 'metered' | 'static';

export type OveragePolicy = 'block' | 'warn' | 'allow';

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
};
