import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EntitlementManager } from "../libs/EntitlementManager";
import { EntitlementOverageAllowedEvent, EntitlementQuotaExceededEvent } from "../libs/events";
import { InMemoryPlanEntitlementRegistry } from "../libs/InMemoryPlanEntitlementRegistry";
import {
  EntitlementEventPublisher,
  EntitlementMeterLookup,
  EntitlementQuotaChecker,
} from "../libs/interfaces";
import { StaticSubscriptionProvider } from "../libs/StaticSubscriptionProvider";
import type {
  EntitlementQuotaStatus,
  EntitlementRule,
  UsageHistoryEntry,
  UsageHistoryPeriod,
} from "../libs/types";

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

  async checkQuota(
    _tenantId: string,
    _featureId: string,
    quota: number,
  ): Promise<EntitlementQuotaStatus> {
    return {
      ...this.quotaStatus,
      quota,
    };
  }

  async getCurrentUsage(_tenantId: string, _featureId: string): Promise<number> {
    return this.quotaStatus.usage;
  }

  async resetUsage(
    _tenantId: string,
    _featureId: string,
    _billingCycleStart: Date,
  ): Promise<void> {}

  async getUsageHistory(
    _tenantId: string,
    _featureId: string,
    _period: UsageHistoryPeriod,
  ): Promise<UsageHistoryEntry[]> {
    return [];
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

class MockEventPublisher extends EntitlementEventPublisher {
  readonly publish = vi.fn(async () => undefined);
}

describe("EntitlementIntegration", () => {
  let manager!: EntitlementManager;
  let registry!: InMemoryPlanEntitlementRegistry;
  let subscriptionProvider!: StaticSubscriptionProvider;
  let quotaChecker!: MockQuotaChecker;
  let meterLookup!: MockMeterLookup;
  let eventPublisher!: MockEventPublisher;

  beforeEach(() => {
    Container.reset();
    registry = new InMemoryPlanEntitlementRegistry();
    quotaChecker = new MockQuotaChecker();
    meterLookup = new MockMeterLookup();
    subscriptionProvider = new StaticSubscriptionProvider("free");
    eventPublisher = new MockEventPublisher();

    Container.set(EntitlementEventPublisher.token, eventPublisher);

    manager = new EntitlementManager(registry, subscriptionProvider, quotaChecker, meterLookup);
  });

  describe("Scenario 1: Plan Upgrade (Free → Pro)", () => {
    it("should grant projects entitlement with Free plan (10 limit)", async () => {
      const freeRules: EntitlementRule[] = [{ featureKey: "projects", type: "static", value: 10 }];
      registry.register("free", freeRules);

      const result = await manager.check("tenant-1", "projects");

      expect(result.granted).toBe(true);
      if (result.granted) {
        expect(result.featureKey).toBe("projects");
        expect(result.type).toBe("static");
        expect(result.value).toBe(10);
        expect(result.planId).toBe("free");
      }
    });

    it("should grant projects entitlement with Pro plan (unlimited)", async () => {
      const proRules: EntitlementRule[] = [{ featureKey: "projects", type: "boolean" }];
      registry.register("pro", proRules);

      const proProvider = new StaticSubscriptionProvider("pro");
      const proManager = new EntitlementManager(registry, proProvider, quotaChecker, meterLookup);

      const result = await proManager.check("tenant-1", "projects");

      expect(result.granted).toBe(true);
      if (result.granted) {
        expect(result.featureKey).toBe("projects");
        expect(result.type).toBe("boolean");
        expect(result.planId).toBe("pro");
      }
    });

    it("should reflect plan change when switching from Free to Pro", async () => {
      const freeRules: EntitlementRule[] = [{ featureKey: "projects", type: "static", value: 10 }];
      registry.register("free", freeRules);

      const freeProvider = new StaticSubscriptionProvider("free");
      const freeManager = new EntitlementManager(registry, freeProvider, quotaChecker, meterLookup);

      const freeResult = await freeManager.check("tenant-1", "projects");
      expect(freeResult.granted).toBe(true);
      if (freeResult.granted) {
        expect(freeResult.type).toBe("static");
        expect(freeResult.value).toBe(10);
      }

      const proRules: EntitlementRule[] = [{ featureKey: "projects", type: "boolean" }];
      registry.register("pro", proRules);

      const proProvider = new StaticSubscriptionProvider("pro");
      const proManager = new EntitlementManager(registry, proProvider, quotaChecker, meterLookup);

      const proResult = await proManager.check("tenant-1", "projects");
      expect(proResult.granted).toBe(true);
      if (proResult.granted) {
        expect(proResult.type).toBe("boolean");
      }
    });
  });

  describe("Scenario 2: OveragePolicy Behavior", () => {
    it("should grant metered entitlement when usage within quota", async () => {
      const rules: EntitlementRule[] = [
        {
          featureKey: "api_calls",
          type: "metered",
          meterId: "api_calls",
          quota: 100,
          overagePolicy: "BLOCK",
        },
      ];
      registry.register("free", rules);
      quotaChecker.setQuotaStatus({ usage: 50, quota: 100, exceeded: false, remaining: 50 });

      const result = await manager.check("tenant-1", "api_calls");

      expect(result).toMatchObject({
        granted: true,
        status: "allowed",
        featureKey: "api_calls",
        type: "metered",
        quota: 100,
        usage: 50,
        remaining: 50,
        exceeded: false,
        overagePolicy: "BLOCK",
        planId: "free",
      });
    });

    it("should reject metered entitlement when quota exceeded and policy is BLOCK", async () => {
      registry.register("free", [
        {
          featureKey: "api_calls",
          type: "metered",
          meterId: "api_calls",
          quota: 100,
          overagePolicy: "BLOCK",
        },
      ]);
      quotaChecker.setQuotaStatus({ usage: 101, quota: 100, exceeded: true, remaining: -1 });

      const result = await manager.check("tenant-1", "api_calls");

      expect(result).toMatchObject({
        granted: false,
        status: "denied",
        featureKey: "api_calls",
        type: "metered",
        quota: 100,
        usage: 101,
        remaining: -1,
        exceeded: true,
        reason: "quota_exceeded",
        overagePolicy: "BLOCK",
        planId: "free",
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: EntitlementQuotaExceededEvent.eventName }),
      );
    });

    it("should warn and allow metered entitlement when quota exceeded and policy is WARN", async () => {
      registry.register("free", [
        {
          featureKey: "api_calls",
          type: "metered",
          meterId: "api_calls",
          quota: 100,
          overagePolicy: "WARN",
        },
      ]);
      quotaChecker.setQuotaStatus({ usage: 150, quota: 100, exceeded: true, remaining: -50 });

      const result = await manager.check("tenant-1", "api_calls");

      expect(result).toMatchObject({
        granted: true,
        status: "soft-limit",
        featureKey: "api_calls",
        type: "metered",
        quota: 100,
        usage: 150,
        remaining: -50,
        exceeded: true,
        overagePolicy: "WARN",
        planId: "free",
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: EntitlementQuotaExceededEvent.eventName }),
      );
    });

    it("should publish overage event and allow metered entitlement when policy is ALLOW_WITH_OVERAGE", async () => {
      registry.register("free", [
        {
          featureKey: "api_calls",
          type: "metered",
          meterId: "api_calls",
          meterBilling: "required",
          quota: 100,
          overagePolicy: "ALLOW_WITH_OVERAGE",
        },
      ]);
      quotaChecker.setQuotaStatus({ usage: 200, quota: 100, exceeded: true, remaining: -100 });

      const result = await manager.check("tenant-1", "api_calls");

      expect(result).toMatchObject({
        granted: true,
        status: "overage-allowed",
        featureKey: "api_calls",
        type: "metered",
        quota: 100,
        usage: 200,
        remaining: -100,
        exceeded: true,
        overagePolicy: "ALLOW_WITH_OVERAGE",
        planId: "free",
        planVersionRef: "legacy:free",
      });
      expect(eventPublisher.publish).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ eventName: EntitlementQuotaExceededEvent.eventName }),
      );
      expect(eventPublisher.publish).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ eventName: EntitlementOverageAllowedEvent.eventName }),
      );
    });

    it("should use meter lookup quota when rule quota is not specified", async () => {
      const rules: EntitlementRule[] = [
        {
          featureKey: "storage",
          type: "metered",
          meterId: "storage",
          overagePolicy: "BLOCK",
        },
      ];
      registry.register("free", rules);

      meterLookup.setQuota(500);
      quotaChecker.setQuotaStatus({ usage: 100, quota: 500, exceeded: false, remaining: 400 });

      const result = await manager.check("tenant-1", "storage");

      expect(result).toMatchObject({
        granted: true,
        status: "allowed",
        featureKey: "storage",
        type: "metered",
        quota: 500,
        usage: 100,
        remaining: 400,
        exceeded: false,
        overagePolicy: "BLOCK",
        planId: "free",
      });
    });

    it("should return no_quota_defined when both rule and meter lack quota", async () => {
      const rules: EntitlementRule[] = [
        {
          featureKey: "events",
          type: "metered",
          meterId: "events",
          overagePolicy: "BLOCK",
        },
      ];
      registry.register("free", rules);

      meterLookup.setQuota(null);

      const result = await manager.check("tenant-1", "events");

      expect(result).toMatchObject({
        granted: false,
        status: "denied",
        featureKey: "events",
        type: "metered",
        reason: "no_quota_defined",
        planId: "free",
      });
    });
  });
});
