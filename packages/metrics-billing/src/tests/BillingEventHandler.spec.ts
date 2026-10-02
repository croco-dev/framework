import type { BillingStore, Plan, PlanRegistry, PlanVersionDefinition } from "@croco/billing-core";
import {
  OrderPaidEvent,
  planVersionRef,
  PlanChangedEvent,
  SubscriptionCanceledEvent,
  SubscriptionRevokedEvent,
} from "@croco/billing-core";
import { EventBusConfig } from "@croco/events-core";
import type { DomainEvent, EventBus, EventSubscription } from "@croco/events-core";
import { MetricsRepository } from "@croco/metrics-core";
import type { MRRMovement } from "@croco/metrics-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingEventHandler } from "../libs/BillingEventHandler";
import {
  BillingMetricDroppedProblem,
  BillingMetricRecordingProblem,
  InvalidOrderPaymentReasonProblem,
} from "../libs/problems/BillingMetricsProblems";

describe("BillingEventHandler", () => {
  let handler!: BillingEventHandler;
  let planRegistry!: PlanRegistry;
  let billingStore!: BillingStore;
  let metricsRepository!: MetricsRepository;
  let recordedMovements: MRRMovement[];

  const asPlanVersion = (plan: Plan): PlanVersionDefinition => ({
    ref: planVersionRef(`${plan.id}@v1`),
    planId: plan.id,
    versionId: "v1",
    effectiveAt: "2026-01-01T00:00:00.000Z",
    name: plan.name,
    amount: plan.amount,
    currency: plan.currency,
    interval: plan.interval,
    intervalCount: plan.intervalCount,
    rating: { mode: "provider", provider: "test" },
    quantityPolicy: {
      minimumQuantity: 1,
      includedSeats: 0,
      seatQuota: 100,
      billableMembershipRoles: ["owner", "admin", "member"],
    },
    providerBindings: [
      {
        provider: "test",
        productId: plan.id,
        priceIds: [],
      },
    ],
  });

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
    planVersionRef: planVersionRef("plan-pro@v1"),
    status: "active" as const,
    currentPeriodEnd: new Date(),
    cancelAtPeriodEnd: false,
    lastSyncedAt: new Date(),
  };

  const createPlanChangedEvent = (previousPlanId: string, newPlanId: string) =>
    new PlanChangedEvent(
      "tenant-1",
      previousPlanId,
      newPlanId,
      "sub-stripe",
      planVersionRef(`${previousPlanId}@v1`),
      planVersionRef(`${newPlanId}@v1`),
    );

  const primaryEventKey = (event: { readonly eventName: string; readonly eventId: string }) =>
    `${event.eventName}_${event.eventId}`;

  const legacyTimestampEventKey = (event: {
    readonly eventName: string;
    readonly timestamp: Date;
  }) => `${event.eventName}_${event.timestamp.getTime()}`;

  const createMetricsRepository = (legacyRecords: readonly string[] = []): MetricsRepository => {
    const processedEventKeys = new Set(legacyRecords);
    const storedPrimaryKeys = new Set(legacyRecords);

    return {
      mrrMovementIdentityVersion: 2,
      recordMRRMovement: vi.fn(
        async (
          tenantId: string,
          movement: MRRMovement,
          _timestamp: Date,
          eventKey?: string,
          dedupeEventKeys: readonly string[] = [],
          legacyEventKeys: readonly string[] = [],
        ) => {
          const eventKeys = [...new Set(eventKey ? [eventKey, ...dedupeEventKeys] : [])];
          const scopedKeys = eventKeys.map((key) => `${tenantId}:${key}`);
          const alreadyClaimed = scopedKeys.some((key) => processedEventKeys.has(key));
          for (const key of scopedKeys) processedEventKeys.add(key);
          if (
            alreadyClaimed ||
            legacyEventKeys.some((key) => storedPrimaryKeys.has(`${tenantId}:${key}`))
          ) {
            return;
          }
          if (eventKey) storedPrimaryKeys.add(`${tenantId}:${eventKey}`);
          recordedMovements.push(movement);
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
      getPlanVersion: vi.fn(),
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

    recordedMovements = [];
    metricsRepository = createMetricsRepository();

    handler = new BillingEventHandler(planRegistry, billingStore, metricsRepository);
  });

  it.each([undefined, 1, 3])(
    "rejects repositories with unsupported movement identity version %s before writing",
    (version) => {
      const olderRepository = {
        ...metricsRepository,
        mrrMovementIdentityVersion: version,
        recordMRRMovement: vi.fn(
          async (
            _tenant: string,
            _movement: MRRMovement,
            _at: Date,
            _key?: string,
            _aliases?: readonly string[],
          ) => {},
        ),
      };

      expect(
        () =>
          new BillingEventHandler(
            planRegistry,
            billingStore,
            olderRepository as unknown as MetricsRepository,
          ),
      ).toThrowError(
        expect.objectContaining({ code: "metrics-billing/repository-contract-unsupported" }),
      );
      expect(olderRepository.recordMRRMovement).not.toHaveBeenCalled();
      expect(billingStore.findAccountByTenantId).not.toHaveBeenCalled();
    },
  );

  it("rejects a legacy subclass without inherited capability before replaying its historical row", () => {
    const event = createPlanChangedEvent("plan-pro", "plan-enterprise");
    const historicalKey = legacyTimestampEventKey(event);
    const rows = [{ eventKey: historicalKey }];
    const claims = new Set([historicalKey]);

    // @ts-expect-error Concrete providers must explicitly adopt the movement identity contract.
    class LegacyMetricsRepository extends MetricsRepository {
      recordMRRMovement = vi.fn(
        async (
          _tenant: string,
          _movement: MRRMovement,
          _at: Date,
          key?: string,
          aliases: readonly string[] = [],
        ) => {
          const keys = key ? [key, ...aliases] : [];
          if (keys.some((candidate) => claims.has(candidate))) return;
          keys.forEach((candidate) => claims.add(candidate));
          if (key) rows.push({ eventKey: key });
        },
      );
      recordSnapshot = vi.fn();
      getSnapshot = vi.fn();
      getMRRHistory = vi.fn();
      getRetentionMetrics = vi.fn();
    }

    const legacy = new LegacyMetricsRepository();
    expect(legacy.mrrMovementIdentityVersion).toBeUndefined();
    expect(() => new BillingEventHandler(planRegistry, billingStore, legacy)).toThrowError(
      expect.objectContaining({ code: "metrics-billing/repository-contract-unsupported" }),
    );
    expect(legacy.recordMRRMovement).not.toHaveBeenCalled();
    expect(rows).toEqual([{ eventKey: historicalKey }]);
  });

  it("subscribes to every decorated billing event when the bus starts", async () => {
    const subscriptions: EventSubscription[] = [];
    const eventBus = {
      subscribe: (subscription: EventSubscription) => {
        subscriptions.push(subscription);
      },
      unsubscribe: () => undefined,
      clear: () => undefined,
      publish: async (_event: DomainEvent) => undefined,
    } as unknown as EventBus;
    const config = new EventBusConfig();
    config.setEventBus(eventBus);

    await config.start({ handlers: [BillingEventHandler], resolver: { resolve: () => handler } });

    expect(subscriptions.map(({ eventName }) => eventName).sort()).toEqual(
      [
        OrderPaidEvent.eventName,
        PlanChangedEvent.eventName,
        SubscriptionCanceledEvent.eventName,
        SubscriptionRevokedEvent.eventName,
      ].sort(),
    );
  });

  describe("OrderPaidEvent", () => {
    it("should record new MRR when order is paid", async () => {
      const event = new OrderPaidEvent("tenant-1", "order-1", 2900, "USD", "subscription_create");

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlan));

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
        [],
        [legacyTimestampEventKey(event)],
      );
    });

    it("should normalize yearly plan to monthly MRR", async () => {
      const event = new OrderPaidEvent("tenant-1", "order-1", 29000, "USD", "subscription_create");

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue({
        ...mockSubscription,
        planId: "plan-pro-yearly",
      });
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlanYearly));

      await handler.handle(event);

      const callArgs = vi.mocked(metricsRepository.recordMRRMovement).mock.calls[0];
      const movement = callArgs[1];

      expect(movement.new.amount).toBe(2417);
    });

    it.each(["subscription_cycle", "subscription_update", "one_time"] as const)(
      "should not record MRR for %s payments",
      async (reason) => {
        const event = new OrderPaidEvent("tenant-1", `order-${reason}`, 2900, "USD", reason);

        await handler.handle(event);

        expect(billingStore.findAccountByTenantId).not.toHaveBeenCalled();
        expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
      },
    );

    it("should record reactivation MRR for authoritative reactivation payments", async () => {
      const event = new OrderPaidEvent(
        "tenant-1",
        "order-reactivation",
        2900,
        "USD",
        "subscription_reactivation",
      );

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlan));

      await handler.handle(event);

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledWith(
        "tenant-1",
        {
          new: { amount: 0, currency: "USD" },
          expansion: { amount: 0, currency: "USD" },
          contraction: { amount: 0, currency: "USD" },
          churned: { amount: 0, currency: "USD" },
          reactivation: { amount: 2900, currency: "USD" },
          net: { amount: 2900, currency: "USD" },
        },
        event.timestamp,
        primaryEventKey(event),
        [],
        [legacyTimestampEventKey(event)],
      );
    });

    it("should delegate duplicate prevention to repository across handler instances", async () => {
      const event = new OrderPaidEvent("tenant-1", "order-1", 2900, "USD", "subscription_create");

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlan));

      const firstHandler = new BillingEventHandler(planRegistry, billingStore, metricsRepository);
      const secondHandler = new BillingEventHandler(planRegistry, billingStore, metricsRepository);

      await firstHandler.handle(event);
      await secondHandler.handle(event);

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledTimes(2);
      const calls = vi.mocked(metricsRepository.recordMRRMovement).mock.calls;
      expect(calls[0]?.[3]).toBe(primaryEventKey(event));
      expect(calls[0]?.[5]).toEqual([legacyTimestampEventKey(event)]);
      expect(calls[1]?.[3]).toBe(primaryEventKey(event));
      expect(recordedMovements).toHaveLength(1);
      expect(calls[1]?.[5]).toEqual([legacyTimestampEventKey(event)]);
    });

    it.each([undefined, "legacy_unknown"])(
      "should reject invalid order payment reason %s before metric lookup",
      async (reason) => {
        const event = new OrderPaidEvent("tenant-1", "order-1", 2900, "USD", reason as never);

        const result = handler.handle(event);

        await expect(result).rejects.toBeInstanceOf(InvalidOrderPaymentReasonProblem);
        await expect(result).rejects.toMatchObject({
          code: "metrics-billing/invalid-order-payment-reason",
          extensions: { reason: typeof reason === "string" ? reason : null },
        });
        expect(billingStore.findAccountByTenantId).not.toHaveBeenCalled();
        expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
      },
    );

    it("should preserve distinct metrics for events with the same millisecond timestamp", async () => {
      const timestamp = new Date("2026-01-01T00:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(timestamp);

      try {
        const firstEvent = new OrderPaidEvent(
          "tenant-1",
          "order-1",
          2900,
          "USD",
          "subscription_create",
        );
        const secondEvent = new OrderPaidEvent(
          "tenant-1",
          "order-2",
          2900,
          "USD",
          "subscription_create",
        );

        vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
        vi.mocked(billingStore.findSubscription).mockResolvedValue(mockSubscription);
        vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlan));

        await handler.handle(firstEvent);
        await handler.handle(secondEvent);

        const calls = vi.mocked(metricsRepository.recordMRRMovement).mock.calls;
        expect(calls).toHaveLength(2);
        expect(recordedMovements).toHaveLength(2);
        expect(calls[0]?.[2]).toEqual(timestamp);
        expect(calls[1]?.[2]).toEqual(timestamp);
        expect(calls[0]?.[3]).toBe(primaryEventKey(firstEvent));
        expect(calls[1]?.[3]).toBe(primaryEventKey(secondEvent));
        expect(calls[0]?.[5]).toEqual([legacyTimestampEventKey(firstEvent)]);
        expect(calls[1]?.[5]).toEqual([legacyTimestampEventKey(secondEvent)]);
        expect(calls[0]?.[5]).toEqual(calls[1]?.[5]);
        expect(calls[0]?.[3]).not.toBe(calls[1]?.[3]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should surface dropped metric evidence if account is not found", async () => {
      const event = new OrderPaidEvent("tenant-1", "order-1", 2900, "USD", "subscription_create");

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
      const event = new OrderPaidEvent("tenant-1", "order-1", 2900, "USD", "subscription_create");

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
      const event = new OrderPaidEvent("tenant-1", "order-1", 2900, "USD", "subscription_create");

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscription).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlan));
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
    it("records distinct plan changes in the same millisecond and deduplicates each replay", async () => {
      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      const plans = [1000, 2000, 3000].map((amount, index) =>
        asPlanVersion({ ...mockPlan, id: `plan-${index}`, amount }),
      );
      vi.mocked(planRegistry.getPlanVersion).mockImplementation(
        async (ref) => plans.find((plan) => plan.ref === ref) ?? null,
      );
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
      try {
        const first = createPlanChangedEvent("plan-0", "plan-1");
        const second = createPlanChangedEvent("plan-1", "plan-2");
        expect(first.eventId).not.toBe(second.eventId);
        expect(first.timestamp).toEqual(second.timestamp);
        await Promise.all([handler.handle(first), handler.handle(second)]);
        await handler.handle(first);
        await new BillingEventHandler(planRegistry, billingStore, metricsRepository).handle(second);
        expect(recordedMovements).toHaveLength(2);
        expect(recordedMovements.map((movement) => movement.expansion.amount)).toEqual([
          1000, 1000,
        ]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("suppresses a replay of a stored legacy primary key", async () => {
      const event = createPlanChangedEvent("plan-basic", "plan-pro");
      metricsRepository = createMetricsRepository([`tenant-1:${legacyTimestampEventKey(event)}`]);
      handler = new BillingEventHandler(planRegistry, billingStore, metricsRepository);
      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlan));
      await handler.handle(event);
      await handler.handle(event);
      expect(recordedMovements).toHaveLength(0);
    });

    it.each([800, 1000])(
      "rejects a USD-to-EUR plan change to %i minor units without recording MRR",
      async (newAmount) => {
        const event = createPlanChangedEvent("plan-usd", "plan-eur");
        const previousPlan = asPlanVersion({
          ...mockPlan,
          id: "plan-usd",
          amount: 1000,
        });
        const newPlan = asPlanVersion({
          ...mockPlan,
          id: "plan-eur",
          amount: newAmount,
          currency: "EUR",
        });

        vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
        vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
        vi.mocked(planRegistry.getPlanVersion).mockImplementation(async (ref) => {
          if (ref === previousPlan.ref) return previousPlan;
          if (ref === newPlan.ref) return newPlan;
          return null;
        });

        await expect(handler.handle(event)).rejects.toMatchObject({
          code: "metrics-core/mixed-currency-mrr",
        });
        expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
      },
    );

    it("uses the exact version references carried by a version-aware event", async () => {
      const basicVersion = asPlanVersion({
        id: "plan-basic",
        name: "Basic Plan",
        amount: 900,
        currency: "USD",
        interval: "month",
        intervalCount: 1,
      });
      const event = new PlanChangedEvent(
        "tenant-1",
        "plan-basic",
        "plan-pro",
        "sub-stripe",
        basicVersion.ref,
        mockSubscription.planVersionRef,
      );

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlanVersion).mockImplementation((ref) => {
        if (ref === basicVersion.ref) return Promise.resolve(basicVersion);
        if (ref === mockSubscription.planVersionRef) {
          return Promise.resolve(asPlanVersion(mockPlan));
        }
        return Promise.resolve(null);
      });

      await handler.handle(event);

      expect(planRegistry.getPlan).not.toHaveBeenCalled();
      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledWith(
        "tenant-1",
        expect.objectContaining({
          expansion: { amount: 2000, currency: "USD" },
        }),
        event.timestamp,
        primaryEventKey(event),
        [],
        [legacyTimestampEventKey(event)],
      );
    });

    it("should record expansion MRR when upgrading plan", async () => {
      const event = createPlanChangedEvent("plan-basic", "plan-pro");

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
      vi.mocked(planRegistry.getPlanVersion).mockImplementation((ref) => {
        if (ref === planVersionRef("plan-basic@v1")) {
          return Promise.resolve(asPlanVersion(basicPlan));
        }
        if (ref === planVersionRef("plan-pro@v1")) {
          return Promise.resolve(asPlanVersion(mockPlan));
        }
        return Promise.resolve(null);
      });

      await handler.handle(event);

      const callArgs = vi.mocked(metricsRepository.recordMRRMovement).mock.calls[0];
      const movement = callArgs[1];

      expect(movement.expansion.amount).toBe(2000);
      expect(movement.net.amount).toBe(2000);
    });

    it("should record contraction MRR when downgrading plan", async () => {
      const event = createPlanChangedEvent("plan-pro", "plan-basic");

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
      vi.mocked(planRegistry.getPlanVersion).mockImplementation((ref) => {
        if (ref === planVersionRef("plan-basic@v1")) {
          return Promise.resolve(asPlanVersion(basicPlan));
        }
        if (ref === planVersionRef("plan-pro@v1")) {
          return Promise.resolve(asPlanVersion(mockPlan));
        }
        return Promise.resolve(null);
      });

      await handler.handle(event);

      const callArgs = vi.mocked(metricsRepository.recordMRRMovement).mock.calls[0];
      const movement = callArgs[1];

      expect(movement.contraction.amount).toBe(2000);
      expect(movement.net.amount).toBe(-2000);
    });

    it("should pass event key to repository for plan changes", async () => {
      const event = createPlanChangedEvent("plan-basic", "plan-pro");

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
      vi.mocked(planRegistry.getPlanVersion).mockImplementation((ref) => {
        if (ref === planVersionRef("plan-basic@v1")) {
          return Promise.resolve(asPlanVersion(basicPlan));
        }
        if (ref === planVersionRef("plan-pro@v1")) {
          return Promise.resolve(asPlanVersion(mockPlan));
        }
        return Promise.resolve(null);
      });

      await handler.handle(event);

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledWith(
        "tenant-1",
        expect.any(Object),
        event.timestamp,
        primaryEventKey(event),
        [],
        [legacyTimestampEventKey(event)],
      );
    });

    it("should record unchanged movement when the normalized MRR delta is zero", async () => {
      const event = createPlanChangedEvent("plan-pro", "plan-pro-yearly");

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
      vi.mocked(planRegistry.getPlanVersion).mockImplementation((ref) => {
        if (ref === planVersionRef("plan-pro@v1")) {
          return Promise.resolve(asPlanVersion(mockPlan));
        }
        if (ref === planVersionRef("plan-pro-yearly@v1")) {
          return Promise.resolve(asPlanVersion(equivalentMonthlyPlan));
        }
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
      const event = createPlanChangedEvent("plan-basic", "plan-pro");

      vi.mocked(billingStore.findAccountByTenantId).mockResolvedValue(mockAccount);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlanVersion).mockImplementation((ref) => {
        if (ref === planVersionRef("plan-basic@v1")) return Promise.resolve(null);
        if (ref === planVersionRef("plan-pro@v1")) {
          return Promise.resolve(asPlanVersion(mockPlan));
        }
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

  describe("SubscriptionRevokedEvent", () => {
    beforeEach(() => {
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlan));
    });

    it("records pinned churn once when a period-end cancellation reaches revocation", async () => {
      const ref = mockSubscription.planVersionRef;
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue({
        ...mockSubscription,
        planVersionRef: planVersionRef("plan-pro@v2"),
      });
      vi.mocked(planRegistry.getPlanVersion).mockImplementation(async (requestedRef) =>
        requestedRef === ref
          ? asPlanVersion(mockPlan)
          : asPlanVersion({ ...mockPlan, amount: 9900 }),
      );

      await handler.handle(
        new SubscriptionCanceledEvent("tenant-1", "sub-stripe", true, undefined, ref),
      );
      expect(recordedMovements).toHaveLength(0);

      const event = new SubscriptionRevokedEvent("tenant-1", "sub-stripe", ref);
      await handler.handle(event);
      await handler.handle(event);

      expect(recordedMovements).toHaveLength(1);
      expect(recordedMovements[0]).toMatchObject({
        churned: { amount: 2900, currency: "USD" },
        net: { amount: -2900, currency: "USD" },
      });
      expect(planRegistry.getPlanVersion).toHaveBeenCalledWith(ref);
      expect(billingStore.findSubscriptionByExternalId).not.toHaveBeenCalled();
    });

    it.each([false, true])(
      "deduplicates immediate cancellation and revocation (revokedFirst=%s)",
      async (revokedFirst) => {
        const canceled = new SubscriptionCanceledEvent(
          "tenant-1",
          "sub-stripe",
          false,
          undefined,
          mockSubscription.planVersionRef,
        );
        const revoked = new SubscriptionRevokedEvent(
          "tenant-1",
          "sub-stripe",
          mockSubscription.planVersionRef,
        );
        const events = revokedFirst ? [revoked, canceled] : [canceled, revoked];

        for (const event of events) await handler.handle(event);

        expect(metricsRepository.recordMRRMovement).toHaveBeenCalledTimes(2);
        expect(recordedMovements).toHaveLength(1);
        expect(recordedMovements[0]?.churned).toEqual({ amount: 2900, currency: "USD" });
      },
    );

    it("records distinct immediate cancellations in the same millisecond", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
      try {
        const first = new SubscriptionCanceledEvent(
          "tenant-1",
          "sub-a",
          false,
          undefined,
          mockSubscription.planVersionRef,
        );
        const second = new SubscriptionCanceledEvent(
          "tenant-1",
          "sub-b",
          false,
          undefined,
          mockSubscription.planVersionRef,
        );
        await handler.handle(first);
        await handler.handle(second);
        await handler.handle(first);
        expect(first.timestamp).toEqual(second.timestamp);
        expect(recordedMovements).toHaveLength(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("keeps historical cancellation replay and subsequent revocation to one churn", async () => {
      const canceled = new SubscriptionCanceledEvent(
        "tenant-1",
        "sub-stripe",
        false,
        undefined,
        mockSubscription.planVersionRef,
      );
      metricsRepository = createMetricsRepository([
        `tenant-1:${legacyTimestampEventKey(canceled)}`,
      ]);
      handler = new BillingEventHandler(planRegistry, billingStore, metricsRepository);
      await handler.handle(canceled);
      await handler.handle(
        new SubscriptionRevokedEvent("tenant-1", "sub-stripe", mockSubscription.planVersionRef),
      );
      expect(recordedMovements).toHaveLength(0);
    });

    it("records separate churn for distinct subscriptions revoked in the same millisecond", async () => {
      const [first, second] = (() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
        try {
          return [
            new SubscriptionRevokedEvent("tenant-1", "sub-a", mockSubscription.planVersionRef),
            new SubscriptionRevokedEvent("tenant-1", "sub-b", mockSubscription.planVersionRef),
          ] as const;
        } finally {
          vi.useRealTimers();
        }
      })();

      await handler.handle(first);
      await handler.handle(second);

      expect(first.timestamp).toEqual(second.timestamp);
      expect(recordedMovements).toHaveLength(2);
    });

    it("records revoked churn without reading a deleted subscription when the event pins the plan", async () => {
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(null);
      const event = new SubscriptionRevokedEvent(
        "tenant-1",
        "sub-stripe",
        mockSubscription.planVersionRef,
      );

      await handler.handle(event);

      expect(billingStore.findSubscriptionByExternalId).not.toHaveBeenCalled();
      expect(planRegistry.getPlanVersion).toHaveBeenCalledWith(mockSubscription.planVersionRef);
      expect(recordedMovements).toHaveLength(1);
      expect(recordedMovements[0]?.churned).toEqual({ amount: 2900, currency: "USD" });
    });

    it("looks up the pinned subscription plan for legacy revoked events", async () => {
      await handler.handle(new SubscriptionRevokedEvent("tenant-1", "sub-stripe"));

      expect(billingStore.findSubscriptionByExternalId).toHaveBeenCalledWith("sub-stripe");
      expect(planRegistry.getPlanVersion).toHaveBeenCalledWith(mockSubscription.planVersionRef);
      expect(recordedMovements).toHaveLength(1);
      expect(recordedMovements[0]?.churned).toEqual({ amount: 2900, currency: "USD" });
    });

    it("reports a missing subscription for legacy revoked events", async () => {
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(null);

      await expect(
        handler.handle(new SubscriptionRevokedEvent("tenant-1", "sub-stripe")),
      ).rejects.toMatchObject({
        code: "metrics-billing/metric-dropped",
        extensions: expect.objectContaining({
          reason: "subscription_not_found",
          resourceId: "sub-stripe",
        }),
      });
      expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
    });

    it.each([false, true])(
      "reports a missing revoked plan (eventPinsPlan=%s)",
      async (eventPinsPlan) => {
        vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(null);
        const ref = eventPinsPlan ? mockSubscription.planVersionRef : undefined;

        await expect(
          handler.handle(new SubscriptionRevokedEvent("tenant-1", "sub-stripe", ref)),
        ).rejects.toMatchObject({
          code: "metrics-billing/metric-dropped",
          extensions: expect.objectContaining({
            reason: "plan_not_found",
            resourceId: ref ?? mockSubscription.planId,
          }),
        });
        expect(billingStore.findSubscriptionByExternalId).toHaveBeenCalledTimes(
          eventPinsPlan ? 0 : 1,
        );
        expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
      },
    );

    it("preserves repository failure evidence for revoked churn", async () => {
      vi.mocked(metricsRepository.recordMRRMovement).mockRejectedValue(
        new Error("repository unavailable"),
      );

      await expect(
        handler.handle(
          new SubscriptionRevokedEvent("tenant-1", "sub-stripe", mockSubscription.planVersionRef),
        ),
      ).rejects.toBeInstanceOf(BillingMetricRecordingProblem);
    });
  });

  describe("SubscriptionCanceledEvent", () => {
    it("should not record churned MRR when cancellation is scheduled for period end", async () => {
      const event = new SubscriptionCanceledEvent("tenant-1", "sub-stripe", true);

      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlan));

      await handler.handle(event);

      expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
      expect(billingStore.findSubscriptionByExternalId).not.toHaveBeenCalled();
      expect(planRegistry.getPlanVersion).not.toHaveBeenCalled();
    });

    it("should record churned MRR when cancellation takes effect immediately", async () => {
      const event = new SubscriptionCanceledEvent("tenant-1", "sub-stripe", false);

      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlan));

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
        ["billing.subscription_churned_sub-stripe"],
        [legacyTimestampEventKey(event)],
      );
    });

    it.each([
      [mockPlan, 2900],
      [mockPlanYearly, 2417],
      [{ ...mockPlan, amount: 5800, intervalCount: 2 }, 2900],
    ])(
      "should record churn from the event plan after subscription deletion: %j",
      async (plan, amount) => {
        const ref = planVersionRef(`${plan.id}@v1`);
        const event = new SubscriptionCanceledEvent(
          "tenant-1",
          "sub-stripe",
          false,
          "cancel-1",
          ref,
        );
        vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(null);
        vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(plan));

        await handler.handle(event);

        expect(billingStore.findSubscriptionByExternalId).not.toHaveBeenCalled();
        expect(planRegistry.getPlanVersion).toHaveBeenCalledWith(ref);
        expect(metricsRepository.recordMRRMovement).toHaveBeenCalledWith(
          "tenant-1",
          expect.objectContaining({
            churned: { amount, currency: plan.currency },
            net: { amount: -amount, currency: plan.currency },
          }),
          event.timestamp,
          primaryEventKey(event),
          ["billing.subscription_churned_sub-stripe"],
          [legacyTimestampEventKey(event)],
        );
      },
    );

    it("should prefer the cancellation plan over a subsequently changed subscription", async () => {
      const ref = planVersionRef("plan-pro@v1");
      const event = new SubscriptionCanceledEvent("tenant-1", "sub-stripe", false, undefined, ref);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue({
        ...mockSubscription,
        planVersionRef: planVersionRef("plan-pro@v2"),
      });
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlan));

      await handler.handle(event);

      expect(planRegistry.getPlanVersion).toHaveBeenCalledWith(ref);
      expect(billingStore.findSubscriptionByExternalId).not.toHaveBeenCalled();
    });

    it("should report a missing event plan without substituting the current subscription plan", async () => {
      const ref = planVersionRef("plan-pro@v0");
      const event = new SubscriptionCanceledEvent("tenant-1", "sub-stripe", false, undefined, ref);
      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(null);

      await expect(handler.handle(event)).rejects.toMatchObject({
        code: "metrics-billing/metric-dropped",
        extensions: expect.objectContaining({ reason: "plan_not_found", resourceId: ref }),
      });
      expect(billingStore.findSubscriptionByExternalId).not.toHaveBeenCalled();
      expect(metricsRepository.recordMRRMovement).not.toHaveBeenCalled();
    });

    it("should surface repository failures when recording cancellation from its event plan", async () => {
      const event = new SubscriptionCanceledEvent(
        "tenant-1",
        "sub-stripe",
        false,
        undefined,
        mockSubscription.planVersionRef,
      );
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlan));
      vi.mocked(metricsRepository.recordMRRMovement).mockRejectedValue(
        new Error("repository unavailable"),
      );

      await expect(handler.handle(event)).rejects.toBeInstanceOf(BillingMetricRecordingProblem);
      expect(billingStore.findSubscriptionByExternalId).not.toHaveBeenCalled();
    });

    it("should pass event key to repository for cancellation events", async () => {
      const event = new SubscriptionCanceledEvent("tenant-1", "sub-stripe", false);

      vi.mocked(billingStore.findSubscriptionByExternalId).mockResolvedValue(mockSubscription);
      vi.mocked(planRegistry.getPlanVersion).mockResolvedValue(asPlanVersion(mockPlan));

      await handler.handle(event);

      expect(metricsRepository.recordMRRMovement).toHaveBeenCalledWith(
        "tenant-1",
        expect.any(Object),
        event.timestamp,
        primaryEventKey(event),
        ["billing.subscription_churned_sub-stripe"],
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
