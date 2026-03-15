import { beforeEach, describe, expect, it } from 'vitest';
import { EntitlementManager } from '../libs/EntitlementManager';
import { InMemoryPlanEntitlementRegistry } from '../libs/InMemoryPlanEntitlementRegistry';
import { EntitlementMeterLookup, EntitlementQuotaChecker } from '../libs/interfaces';
import { StaticSubscriptionProvider } from '../libs/StaticSubscriptionProvider';
import type { EntitlementRule } from '../libs/types';

class MockQuotaChecker extends EntitlementQuotaChecker {
  private usageValue = 0;
  private exceededValue = false;

  setUsage(usage: number): void {
    this.usageValue = usage;
  }

  setExceeded(exceeded: boolean): void {
    this.exceededValue = exceeded;
  }

  async checkQuota(): Promise<{ exceeded: boolean; usage: number }> {
    return { exceeded: this.exceededValue, usage: this.usageValue };
  }
}

class MockMeterLookup extends EntitlementMeterLookup {
  private quotaValue: number | null = 100;

  setQuota(quota: number | null): void {
    this.quotaValue = quota;
  }

  async getMeterQuota(): Promise<number | null> {
    return this.quotaValue;
  }
}

describe('EntitlementIntegration', () => {
  let manager!: EntitlementManager;
  let registry!: InMemoryPlanEntitlementRegistry;
  let subscriptionProvider!: StaticSubscriptionProvider;
  let quotaChecker!: MockQuotaChecker;
  let meterLookup!: MockMeterLookup;

  beforeEach(() => {
    registry = new InMemoryPlanEntitlementRegistry();
    quotaChecker = new MockQuotaChecker();
    meterLookup = new MockMeterLookup();
    subscriptionProvider = new StaticSubscriptionProvider('free');

    manager = new EntitlementManager(registry, subscriptionProvider, quotaChecker, meterLookup);
  });

  describe('Scenario 1: Plan Upgrade (Free → Pro)', () => {
    it('should grant projects entitlement with Free plan (10 limit)', async () => {
      const freeRules: EntitlementRule[] = [{ featureKey: 'projects', type: 'static', value: 10 }];
      registry.register('free', freeRules);

      const result = await manager.check('tenant-1', 'projects');

      expect(result.granted).toBe(true);
      if (result.granted) {
        expect(result.featureKey).toBe('projects');
        expect(result.type).toBe('static');
        expect(result.value).toBe(10);
        expect(result.planId).toBe('free');
      }
    });

    it('should grant projects entitlement with Pro plan (unlimited)', async () => {
      const proRules: EntitlementRule[] = [{ featureKey: 'projects', type: 'boolean' }];
      registry.register('pro', proRules);

      const proProvider = new StaticSubscriptionProvider('pro');
      const proManager = new EntitlementManager(registry, proProvider, quotaChecker, meterLookup);

      const result = await proManager.check('tenant-1', 'projects');

      expect(result.granted).toBe(true);
      if (result.granted) {
        expect(result.featureKey).toBe('projects');
        expect(result.type).toBe('boolean');
        expect(result.planId).toBe('pro');
      }
    });

    it('should reflect plan change when switching from Free to Pro', async () => {
      const freeRules: EntitlementRule[] = [{ featureKey: 'projects', type: 'static', value: 10 }];
      registry.register('free', freeRules);

      const freeProvider = new StaticSubscriptionProvider('free');
      const freeManager = new EntitlementManager(registry, freeProvider, quotaChecker, meterLookup);

      const freeResult = await freeManager.check('tenant-1', 'projects');
      expect(freeResult.granted).toBe(true);
      if (freeResult.granted) {
        expect(freeResult.type).toBe('static');
        expect(freeResult.value).toBe(10);
      }

      const proRules: EntitlementRule[] = [{ featureKey: 'projects', type: 'boolean' }];
      registry.register('pro', proRules);

      const proProvider = new StaticSubscriptionProvider('pro');
      const proManager = new EntitlementManager(registry, proProvider, quotaChecker, meterLookup);

      const proResult = await proManager.check('tenant-1', 'projects');
      expect(proResult.granted).toBe(true);
      if (proResult.granted) {
        expect(proResult.type).toBe('boolean');
      }
    });
  });

  describe('Scenario 2: OveragePolicy Behavior', () => {
    it('should grant metered entitlement when usage within quota (block policy)', async () => {
      const rules: EntitlementRule[] = [
        {
          featureKey: 'api_calls',
          type: 'metered',
          meterId: 'api_calls',
          quota: 100,
          overagePolicy: 'block',
        },
      ];
      registry.register('free', rules);

      quotaChecker.setUsage(50);
      quotaChecker.setExceeded(false);

      const result = await manager.check('tenant-1', 'api_calls');

      expect(result.granted).toBe(true);
      if (result.granted) {
        expect(result.featureKey).toBe('api_calls');
        expect(result.type).toBe('metered');
        expect(result.quota).toBe(100);
        expect(result.planId).toBe('free');
      }
    });

    it('should grant metered entitlement when usage equals quota (block policy)', async () => {
      const rules: EntitlementRule[] = [
        {
          featureKey: 'api_calls',
          type: 'metered',
          meterId: 'api_calls',
          quota: 100,
          overagePolicy: 'block',
        },
      ];
      registry.register('free', rules);

      quotaChecker.setUsage(100);
      quotaChecker.setExceeded(false);

      const result = await manager.check('tenant-1', 'api_calls');

      expect(result.granted).toBe(true);
      if (result.granted) {
        expect(result.featureKey).toBe('api_calls');
        expect(result.type).toBe('metered');
        expect(result.quota).toBe(100);
        expect(result.planId).toBe('free');
      }
    });

    it('should grant metered entitlement with warn policy when quota exceeded', async () => {
      const rules: EntitlementRule[] = [
        {
          featureKey: 'api_calls',
          type: 'metered',
          meterId: 'api_calls',
          quota: 100,
          overagePolicy: 'warn',
        },
      ];
      registry.register('free', rules);

      quotaChecker.setUsage(150);
      quotaChecker.setExceeded(true);

      const result = await manager.check('tenant-1', 'api_calls');

      expect(result.granted).toBe(true);
      if (result.granted) {
        expect(result.featureKey).toBe('api_calls');
        expect(result.type).toBe('metered');
        expect(result.quota).toBe(100);
        expect(result.planId).toBe('free');
      }
    });

    it('should grant metered entitlement with allow policy when quota exceeded', async () => {
      const rules: EntitlementRule[] = [
        {
          featureKey: 'api_calls',
          type: 'metered',
          meterId: 'api_calls',
          quota: 100,
          overagePolicy: 'allow',
        },
      ];
      registry.register('free', rules);

      quotaChecker.setUsage(200);
      quotaChecker.setExceeded(true);

      const result = await manager.check('tenant-1', 'api_calls');

      expect(result.granted).toBe(true);
      if (result.granted) {
        expect(result.featureKey).toBe('api_calls');
        expect(result.type).toBe('metered');
        expect(result.quota).toBe(100);
        expect(result.planId).toBe('free');
      }
    });

    it('should use meter lookup quota when rule quota is not specified', async () => {
      const rules: EntitlementRule[] = [
        {
          featureKey: 'storage',
          type: 'metered',
          meterId: 'storage',
          overagePolicy: 'block',
        },
      ];
      registry.register('free', rules);

      meterLookup.setQuota(500);

      const result = await manager.check('tenant-1', 'storage');

      expect(result.granted).toBe(true);
      if (result.granted) {
        expect(result.featureKey).toBe('storage');
        expect(result.type).toBe('metered');
        expect(result.quota).toBe(500);
        expect(result.planId).toBe('free');
      }
    });

    it('should return no_quota_defined when both rule and meter lack quota', async () => {
      const rules: EntitlementRule[] = [
        {
          featureKey: 'events',
          type: 'metered',
          meterId: 'events',
          overagePolicy: 'block',
        },
      ];
      registry.register('free', rules);

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
});
