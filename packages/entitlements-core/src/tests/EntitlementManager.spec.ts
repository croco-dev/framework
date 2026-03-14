import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntitlementManager } from '../libs/EntitlementManager';
import { InMemoryPlanEntitlementRegistry } from '../libs/InMemoryPlanEntitlementRegistry';
import { EntitlementMeterLookup, EntitlementQuotaChecker, type SubscriptionProvider } from '../libs/interfaces';
import { StaticSubscriptionProvider } from '../libs/StaticSubscriptionProvider';
import type { EntitlementRule } from '../libs/types';

class MockQuotaChecker extends EntitlementQuotaChecker {
  async checkQuota(): Promise<{ exceeded: boolean; usage: number }> {
    return { exceeded: false, usage: 0 };
  }
}

class MockMeterLookup extends EntitlementMeterLookup {
  private quota: number | null = 100;

  setQuota(quota: number | null): void {
    this.quota = quota;
  }

  async getMeterQuota(): Promise<number | null> {
    return this.quota;
  }
}

describe('EntitlementManager', () => {
  let manager!: EntitlementManager;
  let registry!: InMemoryPlanEntitlementRegistry;
  let meterLookup!: MockMeterLookup;
  let quotaChecker!: MockQuotaChecker;

  beforeEach(() => {
    Container.reset();

    registry = new InMemoryPlanEntitlementRegistry();
    meterLookup = new MockMeterLookup();
    quotaChecker = new MockQuotaChecker();

    manager = new EntitlementManager(registry, new StaticSubscriptionProvider('pro'), quotaChecker, meterLookup);
  });

  it('should grant boolean entitlement', async () => {
    registry.register('pro', [{ featureKey: 'advanced_support', type: 'boolean' }]);

    const result = await manager.check('tenant-1', 'advanced_support');

    expect(result).toEqual({
      granted: true,
      featureKey: 'advanced_support',
      type: 'boolean',
      planId: 'pro',
    });
  });

  it('should grant static entitlement with value', async () => {
    registry.register('pro', [{ featureKey: 'team_members', type: 'static', value: 10 }]);

    const result = await manager.check('tenant-1', 'team_members');

    expect(result).toEqual({
      granted: true,
      featureKey: 'team_members',
      type: 'static',
      value: 10,
      planId: 'pro',
    });
  });

  it('should use rule quota before meter lookup quota for metered entitlement', async () => {
    registry.register('pro', [
      {
        featureKey: 'api_calls',
        type: 'metered',
        meterId: 'api_calls',
        quota: 50,
      },
    ]);
    meterLookup.setQuota(100);

    const result = await manager.check('tenant-1', 'api_calls');

    expect(result).toEqual({
      granted: true,
      featureKey: 'api_calls',
      type: 'metered',
      quota: 50,
      planId: 'pro',
    });
  });

  it('should fallback to meter lookup quota when rule quota is missing', async () => {
    registry.register('pro', [{ featureKey: 'storage', type: 'metered', meterId: 'storage' }]);
    meterLookup.setQuota(250);

    const result = await manager.check('tenant-1', 'storage');

    expect(result).toEqual({
      granted: true,
      featureKey: 'storage',
      type: 'metered',
      quota: 250,
      planId: 'pro',
    });
  });

  it('should return no_subscription when tenant has no current plan', async () => {
    const subscriptionProvider: SubscriptionProvider = {
      getCurrentPlanId: vi.fn().mockResolvedValue(null),
    };
    manager = new EntitlementManager(registry, subscriptionProvider, quotaChecker, meterLookup);

    const result = await manager.check('tenant-1', 'advanced_support');

    expect(result).toEqual({ granted: false, reason: 'no_subscription' });
  });

  it('should return not_entitled when plan has no matching rule', async () => {
    registry.register('pro', [{ featureKey: 'advanced_support', type: 'boolean' }]);

    const result = await manager.check('tenant-1', 'audit_logs');

    expect(result).toEqual({ granted: false, reason: 'not_entitled' });
  });

  it('should return no_quota_defined when metered rule and meter both lack quota', async () => {
    const rules: EntitlementRule[] = [{ featureKey: 'events', type: 'metered', meterId: 'events' }];
    registry.register('pro', rules);
    meterLookup.setQuota(null);

    const result = await manager.check('tenant-1', 'events');

    expect(result).toEqual({
      granted: false,
      featureKey: 'events',
      type: 'metered',
      reason: 'no_quota_defined',
    });
  });
});
