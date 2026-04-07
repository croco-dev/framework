import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntitlementManager } from '../libs/EntitlementManager';
import { EntitlementOverageAllowedEvent, EntitlementQuotaExceededEvent } from '../libs/events';
import { InMemoryPlanEntitlementRegistry } from '../libs/InMemoryPlanEntitlementRegistry';
import {
  EntitlementEventPublisher,
  EntitlementMeterLookup,
  EntitlementQuotaChecker,
  type SubscriptionProvider,
} from '../libs/interfaces';
import { StaticSubscriptionProvider } from '../libs/StaticSubscriptionProvider';
import type { EntitlementQuotaStatus, EntitlementRule, UsageHistoryEntry, UsageHistoryPeriod } from '../libs/types';

class MockQuotaChecker extends EntitlementQuotaChecker {
  private quotaStatus: EntitlementQuotaStatus = {
    usage: 0,
    quota: 0,
    exceeded: false,
    remaining: 0,
  };

  setQuotaStatus(quotaStatus: EntitlementQuotaStatus): void {
    this.quotaStatus = quotaStatus;
  }

  async checkQuota(_tenantId: string, _featureId: string, quota: number): Promise<EntitlementQuotaStatus> {
    return {
      ...this.quotaStatus,
      quota,
    };
  }

  async getCurrentUsage(_tenantId: string, _featureId: string): Promise<number> {
    return this.quotaStatus.usage;
  }

  async resetUsage(_tenantId: string, _featureId: string, _billingCycleStart: Date): Promise<void> {}

  async getUsageHistory(
    _tenantId: string,
    _featureId: string,
    _period: UsageHistoryPeriod
  ): Promise<UsageHistoryEntry[]> {
    return [];
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

class MockEventPublisher extends EntitlementEventPublisher {
  readonly publish = vi.fn(async () => undefined);
}

describe('EntitlementManager', () => {
  let manager!: EntitlementManager;
  let registry!: InMemoryPlanEntitlementRegistry;
  let meterLookup!: MockMeterLookup;
  let quotaChecker!: MockQuotaChecker;
  let eventPublisher!: MockEventPublisher;

  beforeEach(() => {
    Container.reset();

    registry = new InMemoryPlanEntitlementRegistry();
    meterLookup = new MockMeterLookup();
    quotaChecker = new MockQuotaChecker();
    eventPublisher = new MockEventPublisher();

    Container.set(EntitlementEventPublisher.token, eventPublisher);

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
    quotaChecker.setQuotaStatus({
      usage: 10,
      quota: 50,
      exceeded: false,
      remaining: 40,
    });

    const result = await manager.check('tenant-1', 'api_calls');

    expect(result).toEqual({
      granted: true,
      featureKey: 'api_calls',
      type: 'metered',
      quota: 50,
      usage: 10,
      remaining: 40,
      exceeded: false,
      overagePolicy: 'BLOCK',
      planId: 'pro',
    });
  });

  it('should fallback to meter lookup quota when rule quota is missing', async () => {
    registry.register('pro', [{ featureKey: 'storage', type: 'metered', meterId: 'storage' }]);
    meterLookup.setQuota(250);
    quotaChecker.setQuotaStatus({
      usage: 25,
      quota: 250,
      exceeded: false,
      remaining: 225,
    });

    const result = await manager.check('tenant-1', 'storage');

    expect(result).toEqual({
      granted: true,
      featureKey: 'storage',
      type: 'metered',
      quota: 250,
      usage: 25,
      remaining: 225,
      exceeded: false,
      overagePolicy: 'BLOCK',
      planId: 'pro',
    });
  });

  it('should return no_subscription when tenant has no current plan', async () => {
    const subscriptionProvider: SubscriptionProvider = {
      getCurrentPlanId: vi.fn().mockResolvedValue(null),
    };
    manager = new EntitlementManager(registry, subscriptionProvider, quotaChecker, meterLookup);

    const result = await manager.check('tenant-1', 'advanced_support');

    expect(result).toEqual({
      granted: false,
      featureKey: 'advanced_support',
      type: 'boolean',
      reason: 'no_subscription',
    });
  });

  it('should return not_entitled when plan has no matching rule', async () => {
    registry.register('pro', [{ featureKey: 'advanced_support', type: 'boolean' }]);

    const result = await manager.check('tenant-1', 'audit_logs');

    expect(result).toEqual({
      granted: false,
      featureKey: 'audit_logs',
      type: 'boolean',
      reason: 'not_entitled',
      planId: 'pro',
    });
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
      planId: 'pro',
    });
  });

  it('should block requests that exceed quota with BLOCK policy', async () => {
    registry.register('pro', [{ featureKey: 'reports', type: 'metered', quota: 3, overagePolicy: 'BLOCK' }]);
    quotaChecker.setQuotaStatus({
      usage: 4,
      quota: 3,
      exceeded: true,
      remaining: -1,
    });

    const result = await manager.check('tenant-1', 'reports');

    expect(result).toEqual({
      granted: false,
      featureKey: 'reports',
      type: 'metered',
      quota: 3,
      usage: 4,
      remaining: -1,
      exceeded: true,
      reason: 'quota_exceeded',
      overagePolicy: 'BLOCK',
      planId: 'pro',
    });
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: EntitlementQuotaExceededEvent.eventName,
        tenantId: 'tenant-1',
        featureKey: 'reports',
        usage: 4,
        quota: 3,
      })
    );
  });

  it('should allow requests that exceed quota with WARN policy', async () => {
    registry.register('pro', [{ featureKey: 'reports', type: 'metered', quota: 3, overagePolicy: 'WARN' }]);
    quotaChecker.setQuotaStatus({
      usage: 4,
      quota: 3,
      exceeded: true,
      remaining: -1,
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await manager.check('tenant-1', 'reports');

    expect(result.granted).toBe(true);
    expect(result.overagePolicy).toBe('WARN');
    expect(result.exceeded).toBe(true);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: EntitlementQuotaExceededEvent.eventName })
    );

    warnSpy.mockRestore();
  });

  it('should allow requests that exceed quota with ALLOW_WITH_OVERAGE policy', async () => {
    registry.register('pro', [
      { featureKey: 'reports', type: 'metered', quota: 3, overagePolicy: 'ALLOW_WITH_OVERAGE' },
    ]);
    quotaChecker.setQuotaStatus({
      usage: 4,
      quota: 3,
      exceeded: true,
      remaining: -1,
    });

    const result = await manager.check('tenant-1', 'reports');

    expect(result.granted).toBe(true);
    expect(result.overagePolicy).toBe('ALLOW_WITH_OVERAGE');
    expect(eventPublisher.publish).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ eventName: EntitlementQuotaExceededEvent.eventName })
    );
    expect(eventPublisher.publish).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventName: EntitlementOverageAllowedEvent.eventName,
        tenantId: 'tenant-1',
        featureKey: 'reports',
        usage: 4,
        quota: 3,
        planId: 'pro',
      })
    );
  });
});
