import { Component, Inject } from '@croco/framework-context';
import {
  EntitlementMeterLookup,
  EntitlementQuotaChecker,
  PlanEntitlementRegistry,
  SubscriptionProvider,
} from './interfaces';
import type { EntitlementCheckResult, EntitlementRule } from './types';

@Component()
export class EntitlementManager {
  constructor(
    @Inject(PlanEntitlementRegistry.token) private readonly registry: PlanEntitlementRegistry,
    @Inject(SubscriptionProvider.token) private readonly subscriptionProvider: SubscriptionProvider,
    @Inject(EntitlementQuotaChecker.token) private readonly quotaChecker: EntitlementQuotaChecker,
    @Inject(EntitlementMeterLookup.token) private readonly meterLookup: EntitlementMeterLookup
  ) {}

  async check(
    tenantId: string,
    featureKey: string
  ): Promise<EntitlementCheckResult | { granted: false; reason: string }> {
    const planId = await this.subscriptionProvider.getCurrentPlanId(tenantId);
    if (!planId) {
      return { granted: false, reason: 'no_subscription' };
    }

    const rule = await this.registry.findRule(planId, featureKey);
    if (!rule) {
      return { granted: false, reason: 'not_entitled' };
    }

    switch (rule.type) {
      case 'boolean':
        return {
          granted: true,
          featureKey,
          type: 'boolean',
          planId,
        };

      case 'static':
        return {
          granted: true,
          featureKey,
          type: 'static',
          value: rule.value,
          planId,
        };

      case 'metered':
        return this.checkMetered(tenantId, featureKey, rule, planId);
    }
  }

  private async checkMetered(
    tenantId: string,
    featureKey: string,
    rule: EntitlementRule,
    planId: string
  ): Promise<EntitlementCheckResult> {
    void this.quotaChecker;

    const meterQuota = rule.meterId ? await this.meterLookup.getMeterQuota(tenantId, rule.meterId) : null;
    const quota = rule.quota ?? meterQuota;

    if (quota == null) {
      return {
        granted: false,
        featureKey,
        type: 'metered',
        reason: 'no_quota_defined',
      };
    }

    return {
      granted: true,
      featureKey,
      type: 'metered',
      quota,
      planId,
    };
  }
}
