import type { BillingStore, Plan, PlanRegistry } from "@croco/billing-core";
import { OrderPaidEvent, PlanChangedEvent, SubscriptionCanceledEvent } from "@croco/billing-core";
import type { MetricsRepository, MRRMovement } from "@croco/metrics-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingEventHandler } from "../libs/BillingEventHandler";
import {
  BillingMetricDroppedProblem,
  BillingMetricRecordingProblem,
} from "../libs/problems/BillingMetricsProblems";

describe("BillingEventHandler", () => {
  let handler!: BillingEventHandler;
  let planRegistry!: PlanRegistry;
  let billingStore!: BillingStore;
  let metricsRepository!: MetricsRepository;

  const mockPlan: Plan = {
    id: "plan-pro",
    name: "Pro Plan",
    amount: 2900,
    currency: "USD",
    interval: "month",
    intervalCount: 1,
  };

  const mockPlanYearly: Plan = {
    id: "plan-pro-yearly",
    name: "Pro Plan Yearly",
    amount: 29000,
    currency: "USD",
    interval: "year",
    intervalCount: 1,
  };

  const mockAccount = {
    id: "account-1",
    tenantId: "tenant-1",
    externalCustomerId: "cus-stripe",
    email: "test@example.com",
    createdAt: new Date(),
  };

  const mockSubscription = {
    id: "sub-1",
    billingAccountId: "account-1",
    externalSubscriptionId: "sub-stripe",
    planId: "plan-pro",
    status: "active" as const,
    currentPeriodEnd: new Date(),
    cancelAtPeriodEnd: false,
    lastSyncedAt: new Date(),
  };

  const primaryEventKey = (event: { readonly eventName: string; readonly eventId: string }) =>
    `${event.eventName}_${event.eventId}`;

  const legacyTimestampEventKey = (event: {
    readonly eventName: string;
    readonly timestamp: Date;
  }) => `${event.eventName}_${event.timestamp.getTime()}`;

  const createMetricsRepository = (): MetricsRepository => {
    const processedEventKeys = new Set<string>();

    return {
      recordMRRMovement: vi.fn(
        async (
          _tenantId: string,
          _movement: MRRMovement,
          _timestamp: Date,
          eventKey?: string,
          dedupeEventKeys: readonly string[] = [],
        ) => {
          const eventKeys = eventKey ? [eventKey, ...dedupeEventKeys] : [];
          if (eventKeys.some((key) => processedEventKeys.has(key))) {
            return;
          }

          for (const key of eventKeys) {
            processedEventKeys.add(key);
          }
        },
      ),
      recordSnapshot: vi.fn(),
      getSnapshot: vi.fn(),
      getMRRHistory: vi.fn(),
      getRetentionMetrics: vi.fn(),
    } as unknown as MetricsRepository;
  };

  beforeEach(() => {
    planRegistry = {
      getPlan: vi.fn(),
      getAllPlans: vi.fn(),
      getPlanAtDate: vi.fn(),
    } as unknown as PlanRegistry;

    billingStore = {
      findAccountByTenantId: vi.fn(),
      findAccountByExternalId: vi.fn(),
      saveAccount: vi.fn(),
      findSubscription: vi.fn(),
      findSubscriptionByExternalId: vi.fn(),
      saveSubscription: vi.fn(),
      saveOrder: vi.fn(),
      findOrdersByAccount: vi.fn(),
    } as unknown as BillingStore;

    metricsRepository = createMetricsRepository();

    handler = new BillingEventHandler(planRegistry, billingStore, metricsRepository);
  });

  describe("OrderPaidEvent", () => {
    it("should record new MRR when order is paid", async () => {
      const event = new OrderPaidEvent("tenant-1", "order-1", 2900, "USD");

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockResolvedValue(mockPlan);

      await handler.handle(event);

      const expectedMovement: MRRMovement = {
        new: { amount: 2900, currency: "USD" },
        expansion: { amount: 0, currency: "USD" },
        contraction: { amount: 0, currency: "USD" },
        churned: { amount: 0, currency: "USD" },
        reactivation: { amount: 0, currency: "USD" },
        net: { amount: 2900, currency: "USD" },
      };

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledWith(
        "tenant-1",
        expectedMovement,
        event.timestamp,
        primaryEventKey(event),
        [legacyTimestampEventKey(event)],
      );
    });

    it("should normalize yearly plan to monthly MRR", async () => {
      const event = new OrderPaidEvent("tenant-1", "order-1", 29000, "USD");

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue({
        ...mockSubscription,
        planId: "plan-pro-yearly",
      });
      vi.mocked(planRegistry.getPlan).mockResolvedValue(mockPlanYearly);

      await handler.handle(event);

      const callArgs = vi.mocked(metricsRepository.recordMRRMovement).mock.calls[0];
      const movement = callArgs[1];

      expect(movement.new.amount).toBeCloseTo(2416.67, 2);
    });

    it("should delegate duplicate prevention to repository across handler instances", async () => {
      const event = new OrderPaidEvent("tenant-1", "order-1", 2900, "USD");

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockResolvedValue(mockPlan);

      const firstHandler = new BillingEventHandler(planRegistry, billingStore, metricsRepository);
      const secondHandler = new BillingEventHandler(planRegistry, billingStore, metricsRepository);

      await firstHandler.handle(event);
      await secondHandler.handle(event);

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledTimes(2);
      const calls = vi.mocked(metricsRepository.recordMRRMovement).mock.calls;
      expect(calls[0]?.[3]).toBe(primaryEventKey(event));
      expect(calls[0]?.[4]).toEqual([legacyTimestampEventKey(event)]);
      expect(calls[1]?.[3]).toBe(primaryEventKey(event));
      expect(calls[1]?.[4]).toEqual([legacyTimestampEventKey(event)]);
    });

    it("should preserve distinct metrics for events with the same millisecond timestamp", async () => {
      const timestamp = new Date("2026-01-01T00:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(timestamp);

      try {
        const firstEvent = new OrderPaidEvent("tenant-1", "order-1", 2900, "USD");
        const secondEvent = new OrderPaidEvent("tenant-1", "order-2", 2900, "USD");

        vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
        vi.mocked(billingStore.findSubscription).mockResolvedValue(mockSubscription);
        vi.mocked(planRegistry.getPlan).mockResolvedValue(mockPlan);

        await handler.handle(firstEvent);
        await handler.handle(secondEvent);

        const calls = vi.mocked(metricsRepository.recordMRRMovement).mock.calls;
        expect(calls).toHaveLength(2);
        expect(calls[0]?.[2]).toEqual(timestamp);
        expect(calls[1]?.[2]).toEqual(timestamp);
        expect(calls[0]?.[3]).toBe(primaryEventKey(firstEvent));
        expect(calls[1]?.[3]).toBe(primaryEventKey(secondEvent));
        expect(calls[0]?.[4]).toEqual([legacyTimestampEventKey(firstEvent)]);
        expect(calls[1]?.[4]).toEqual([legacyTimestampEventKey(secondEvent)]);
        expect(calls[0]?.[4]).toEqual(calls[1]?.[4]);
        expect(calls[0]?.[3]).not.toBe(calls[1]?.[3]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should surface dropped metric evidence if account is not found", async () => {
      const event = new OrderPaidEvent("tenant-1", "order-1", 2900, "USD");

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(null);

      await expect(handler.handle(event)).rejects.toMatchObject({
        code: "metrics-billing/metric-dropped",
        extensions: expect.objectContaining({
          reason: "account_not_found",
          resourceId: "tenant-1",
        }),
      });

      expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
    });

    it("should surface dropped metric evidence if subscription is not found", async () => {
      const event = new OrderPaidEvent("tenant-1", "order-1", 2900, "USD");

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue(null);

      const result = handler.handle(event);

      await expect(result).rejects.toBeInstanceOf(BillingMetricDroppedProblem);
      await expect(result).rejects.toMatchObject({
        extensions: expect.objectContaining({
          reason: "subscription_not_found",
          resourceId: "account-1",
        }),
      });

      expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
    });

    it("should surface repository failures as stable recording Problems", async () => {
      const event = new OrderPaidEvent("tenant-1", "order-1", 2900, "USD");

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockResolvedValue(mockPlan);
      vi.mocked(metricsRepository.recordMRRMovement).mockRejectedValueOnce(
        new BillingMetricRecordingProblem({
          eventName: "metrics.repository",
          tenantId: "tenant-1",
          eventKey: "repository-write",
        }),
      );

      const result = handler.handle(event);

      await expect(result).rejects.toBeInstanceOf(BillingMetricRecordingProblem);
      await expect(result).rejects.toMatchObject({
        code: "metrics-billing/recording-failed",
        extensions: expect.objectContaining({
          eventName: "billing.order_paid",
          tenantId: "tenant-1",
          eventKey: primaryEventKey(event),
        }),
      });
    });
  });

  describe("PlanChangedEvent", () => {
    it("should record expansion MRR when upgrading plan", async () => {
      const event = new PlanChangedEvent("tenant-1", "plan-basic", "plan-pro", "sub-stripe");

      const basicPlan: Plan = {
        id: "plan-basic",
        name: "Basic Plan",
        amount: 900,
        currency: "USD",
        interval: "month",
        intervalCount: 1,
      };

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockImplementation((id: string) => {
        if (id === "plan-basic") return Promise.resolve(basicPlan);
        if (id === "plan-pro") return Promise.resolve(mockPlan);
        return Promise.resolve(null);
      });

      await handler.handle(event);

      const callArgs = vi.mocked(metricsRepository.recordMRRMovement).mock.calls[0];
      const movement = callArgs[1];

      expect(movement.expansion.amount).toBe(2000);
      expect(movement.net.amount).toBe(2000);
    });

    it("should record contraction MRR when downgrading plan", async () => {
      const event = new PlanChangedEvent("tenant-1", "plan-pro", "plan-basic", "sub-stripe");

      const basicPlan: Plan = {
        id: "plan-basic",
        name: "Basic Plan",
        amount: 900,
        currency: "USD",
        interval: "month",
        intervalCount: 1,
      };

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockImplementation((id: string) => {
        if (id === "plan-basic") return Promise.resolve(basicPlan);
        if (id === "plan-pro") return Promise.resolve(mockPlan);
        return Promise.resolve(null);
      });

      await handler.handle(event);

      const callArgs = vi.mocked(metricsRepository.recordMRRMovement).mock.calls[0];
      const movement = callArgs[1];

      expect(movement.contraction.amount).toBe(2000);
      expect(movement.net.amount).toBe(-2000);
    });

    it("should pass event key to repository for plan changes", async () => {
      const event = new PlanChangedEvent("tenant-1", "plan-basic", "plan-pro", "sub-stripe");

      const basicPlan: Plan = {
        id: "plan-basic",
        name: "Basic Plan",
        amount: 900,
        currency: "USD",
        interval: "month",
        intervalCount: 1,
      };

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockImplementation((id: string) => {
        if (id === "plan-basic") return Promise.resolve(basicPlan);
        if (id === "plan-pro") return Promise.resolve(mockPlan);
        return Promise.resolve(null);
      });

      await handler.handle(event);

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledWith(
        "tenant-1",
        expect.any(Object),
        event.timestamp,
        primaryEventKey(event),
        [legacyTimestampEventKey(event)],
      );
    });

    it("should record unchanged movement when the normalized MRR delta is zero", async () => {
      const event = new PlanChangedEvent("tenant-1", "plan-pro", "plan-pro-yearly", "sub-stripe");

      const equivalentMonthlyPlan: Plan = {
        id: "plan-pro-yearly",
        name: "Pro Plan Yearly Equivalent",
        amount: 34800,
        currency: "USD",
        interval: "year",
        intervalCount: 1,
      };

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockImplementation((id: string) => {
        if (id === "plan-pro") return Promise.resolve(mockPlan);
        if (id === "plan-pro-yearly") return Promise.resolve(equivalentMonthlyPlan);
        return Promise.resolve(null);
      });

      await handler.handle(event);

      const callArgs = vi.mocked(metricsRepository.recordMRRMovement).mock.calls[0];
      const movement = callArgs?.[1];

      expect(movement).toEqual({
        new: { amount: 0, currency: "USD" },
        expansion: { amount: 0, currency: "USD" },
        contraction: { amount: 0, currency: "USD" },
        churned: { amount: 0, currency: "USD" },
        reactivation: { amount: 0, currency: "USD" },
        net: { amount: 0, currency: "USD" },
      });
    });

    it("should surface missing plan evidence without recording a metric", async () => {
      const event = new PlanChangedEvent("tenant-1", "plan-basic", "plan-pro", "sub-stripe");

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockImplementation((id: string) => {
        if (id === "plan-basic") return Promise.resolve(null);
        if (id === "plan-pro") return Promise.resolve(mockPlan);
        return Promise.resolve(null);
      });

      await expect(handler.handle(event)).rejects.toMatchObject({
        code: "metrics-billing/metric-dropped",
        extensions: expect.objectContaining({
          reason: "plan_not_found",
          resourceId: "plan-basic",
          tenantId: "tenant-1",
          eventKey: primaryEventKey(event),
        }),
      });
      expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
    });
  });

  describe("SubscriptionCanceledEvent", () => {
    it("should record churned MRR when subscription is canceled", async () => {
      const event = new SubscriptionCanceledEvent("tenant-1", "sub-stripe", false);

      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockResolvedValue(mockPlan);

      await handler.handle(event);

      const expectedMovement: MRRMovement = {
        new: { amount: 0, currency: "USD" },
        expansion: { amount: 0, currency: "USD" },
        contraction: { amount: 0, currency: "USD" },
        churned: { amount: 2900, currency: "USD" },
        reactivation: { amount: 0, currency: "USD" },
        net: { amount: -2900, currency: "USD" },
      };

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledWith(
        "tenant-1",
        expectedMovement,
        event.timestamp,
        primaryEventKey(event),
        [legacyTimestampEventKey(event)],
      );
    });

    it("should pass event key to repository for cancellation events", async () => {
      const event = new SubscriptionCanceledEvent("tenant-1", "sub-stripe", false);

      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlan).mockResolvedValue(mockPlan);

      await handler.handle(event);

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledWith(
        "tenant-1",
        expect.any(Object),
        event.timestamp,
        primaryEventKey(event),
        [legacyTimestampEventKey(event)],
      );
    });

    it("should surface dropped metric evidence if subscription is not found", async () => {
      const event = new SubscriptionCanceledEvent("tenant-1", "sub-stripe", false);

      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(null);

      await expect(handler.handle(event)).rejects.toMatchObject({
        code: "metrics-billing/metric-dropped",
        extensions: expect.objectContaining({
          reason: "subscription_not_found",
          resourceId: "sub-stripe",
        }),
      });

      expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
    });
  });
});
