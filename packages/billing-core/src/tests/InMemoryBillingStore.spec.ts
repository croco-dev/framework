import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBillingStore } from "../libs/InMemoryBillingStore";
import { InMemoryPlanRegistry, planVersionRef } from "../libs/InMemoryPlanRegistry";
import {
  SubscriptionPlanVersionMigrationProblem,
  SubscriptionPlanVersionMigrationRequiredProblem,
  SubscriptionPlanVersionImmutableProblem,
  SubscriptionPlanVersionResolutionProblem,
  WebhookAlreadyProcessedProblem,
} from "../libs/problems/BillingProblems";
import type { BillingAccount, LegacySubscription, Order, Subscription } from "../types";

function createPlanRegistry(): InMemoryPlanRegistry {
  return new InMemoryPlanRegistry([
    {
      ref: planVersionRef("plan-pro@2025-01"),
      planId: "plan-pro",
      version: "2025-01",
      effectiveAt: "2025-01-01T00:00:00.000Z",
      publishedAt: "2024-12-01T00:00:00.000Z",
      plan: {
        id: "plan-pro",
        name: "Pro",
        amount: 2_900,
        currency: "USD",
        interval: "month",
        intervalCount: 1,
      },
      rating: { mode: "croco-rated" },
      providerBindings: [],
    },
    {
      ref: planVersionRef("plan-pro@v1"),
      planId: "plan-pro",
      version: "v1",
      effectiveAt: "2026-01-01T00:00:00.000Z",
      publishedAt: "2025-12-01T00:00:00.000Z",
      plan: {
        id: "plan-pro",
        name: "Pro",
        amount: 3_900,
        currency: "USD",
        interval: "month",
        intervalCount: 1,
      },
      rating: { mode: "croco-rated" },
      providerBindings: [],
    },
    {
      ref: planVersionRef("plan-enterprise@v1"),
      planId: "plan-enterprise",
      version: "v1",
      effectiveAt: "2026-01-01T00:00:00.000Z",
      publishedAt: "2025-12-01T00:00:00.000Z",
      plan: {
        id: "plan-enterprise",
        name: "Enterprise",
        amount: 9_900,
        currency: "USD",
        interval: "month",
        intervalCount: 1,
      },
      rating: { mode: "croco-rated" },
      providerBindings: [],
    },
    {
      ref: planVersionRef("plan-pro@v2"),
      planId: "plan-pro",
      version: "v2",
      effectiveAt: "2027-01-01T00:00:00.000Z",
      publishedAt: "2026-12-01T00:00:00.000Z",
      plan: {
        id: "plan-pro",
        name: "Pro",
        amount: 4_900,
        currency: "USD",
        interval: "month",
        intervalCount: 1,
      },
      rating: { mode: "croco-rated" },
      providerBindings: [],
    },
  ]);
}

describe("InMemoryBillingStore", () => {
  let store!: InMemoryBillingStore;
  let planRegistry!: InMemoryPlanRegistry;

  beforeEach(() => {
    planRegistry = createPlanRegistry();
    store = new InMemoryBillingStore(planRegistry);
  });

  describe("findAccountByTenantId", () => {
    it("should return null when account does not exist", async () => {
      const result = await store.findAccountByTenantId("non-existent");
      expect(result).toBeNull();
    });

    it("should return account when it exists", async () => {
      const account: BillingAccount = {
        id: "tenant-1",
        tenantId: "tenant-1",
        externalCustomerId: "ext-cust-1",
        email: "test@example.com",
        createdAt: new Date(),
      };
      await store.saveAccount(account);

      const result = await store.findAccountByTenantId("tenant-1");
      expect(result).toEqual(account);
    });
  });

  describe("saveAccount and findAccountByExternalId", () => {
    it("should save account and find by external ID", async () => {
      const account: BillingAccount = {
        id: "tenant-1",
        tenantId: "tenant-1",
        externalCustomerId: "ext-cust-1",
        email: "test@example.com",
        createdAt: new Date(),
      };
      await store.saveAccount(account);

      const result = await store.findAccountByExternalId("ext-cust-1");
      expect(result).toEqual(account);
    });

    it("should return null when finding by non-existent external ID", async () => {
      const result = await store.findAccountByExternalId("non-existent");
      expect(result).toBeNull();
    });

    it("should remove stale external ID mappings when an account is re-saved with a new external ID", async () => {
      const originalAccount: BillingAccount = {
        id: "tenant-1",
        tenantId: "tenant-1",
        externalCustomerId: "ext-cust-1",
        email: "test@example.com",
        createdAt: new Date(),
      };

      await store.saveAccount(originalAccount);

      const updatedAccount: BillingAccount = {
        ...originalAccount,
        externalCustomerId: "ext-cust-2",
      };

      await store.saveAccount(updatedAccount);

      expect(await store.findAccountByExternalId("ext-cust-1")).toBeNull();
      expect(await store.findAccountByExternalId("ext-cust-2")).toEqual(updatedAccount);
    });

    it("should delete account and clear lookup indices", async () => {
      const account: BillingAccount = {
        id: "tenant-1",
        tenantId: "tenant-1",
        externalCustomerId: "ext-cust-1",
        email: "test@example.com",
        createdAt: new Date(),
      };

      await store.saveAccount(account);
      await store.deleteAccount(account.id);

      expect(await store.findAccountByTenantId(account.tenantId)).toBeNull();
      expect(await store.findAccountByExternalId(account.externalCustomerId)).toBeNull();
    });
  });

  describe("findSubscription", () => {
    it("should return null when subscription does not exist", async () => {
      const result = await store.findSubscription("non-existent");
      expect(result).toBeNull();
    });

    it("should return subscription when it exists", async () => {
      const subscription: Subscription = {
        id: "sub-1",
        billingAccountId: "tenant-1",
        externalSubscriptionId: "ext-sub-1",
        planId: "plan-pro",
        planVersionRef: planVersionRef("plan-pro@v1"),
        status: "active",
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      const result = await store.findSubscription("tenant-1");
      expect(result).toEqual(subscription);
    });
  });

  describe("saveSubscription and findSubscriptionByExternalId", () => {
    it("should save subscription and find by external ID", async () => {
      const subscription: Subscription = {
        id: "sub-1",
        billingAccountId: "tenant-1",
        externalSubscriptionId: "ext-sub-1",
        planId: "plan-pro",
        planVersionRef: planVersionRef("plan-pro@v1"),
        status: "active",
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      const result = await store.findSubscriptionByExternalId("ext-sub-1");
      expect(result).toEqual(subscription);
    });

    it("should return null when finding by non-existent external subscription ID", async () => {
      const result = await store.findSubscriptionByExternalId("non-existent");
      expect(result).toBeNull();
    });

    it("should delete subscription and clear external subscription lookup", async () => {
      const subscription: Subscription = {
        id: "sub-1",
        billingAccountId: "tenant-1",
        externalSubscriptionId: "ext-sub-1",
        planId: "plan-pro",
        planVersionRef: planVersionRef("plan-pro@v1"),
        status: "active",
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };

      await store.saveSubscription(subscription);
      await store.deleteSubscription(subscription.billingAccountId);

      expect(await store.findSubscription(subscription.billingAccountId)).toBeNull();
      expect(
        await store.findSubscriptionByExternalId(subscription.externalSubscriptionId),
      ).toBeNull();
    });

    it("rejects changing a pinned version through the ordinary save path", async () => {
      const subscription: Subscription = {
        id: "sub-1",
        billingAccountId: "tenant-1",
        externalSubscriptionId: "ext-sub-1",
        planId: "plan-pro",
        planVersionRef: planVersionRef("plan-pro@v1"),
        status: "active",
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(subscription);

      await expect(
        store.saveSubscription({
          ...subscription,
          planVersionRef: planVersionRef("plan-pro@v2"),
        }),
      ).rejects.toBeInstanceOf(SubscriptionPlanVersionImmutableProblem);
      await expect(
        store.saveSubscription({
          ...subscription,
          planId: "plan-enterprise",
          planVersionRef: planVersionRef("plan-enterprise@v1"),
        }),
      ).rejects.toBeInstanceOf(SubscriptionPlanVersionImmutableProblem);
      await expect(store.findSubscription(subscription.billingAccountId)).resolves.toMatchObject({
        planVersionRef: planVersionRef("plan-pro@v1"),
      });
    });

    it("protects the stored pin from caller and returned-object mutation", async () => {
      const source = {
        id: "sub-1",
        billingAccountId: "tenant-1",
        externalSubscriptionId: "ext-sub-1",
        planId: "plan-pro",
        planVersionRef: planVersionRef("plan-pro@v1"),
        status: "active" as const,
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await store.saveSubscription(source);
      source.planVersionRef = planVersionRef("plan-pro@v2");

      const returned = await store.findSubscription(source.billingAccountId);
      expect(returned).not.toBeNull();
      (returned as { planVersionRef: ReturnType<typeof planVersionRef> }).planVersionRef =
        planVersionRef("plan-pro@v3");

      await expect(store.findSubscription(source.billingAccountId)).resolves.toMatchObject({
        planId: "plan-pro",
        planVersionRef: planVersionRef("plan-pro@v1"),
      });
    });

    it("rejects unpublished and cross-family refs on the initial save", async () => {
      const subscription: Subscription = {
        id: "sub-1",
        billingAccountId: "tenant-1",
        externalSubscriptionId: "ext-sub-1",
        planId: "plan-pro",
        planVersionRef: planVersionRef("plan-pro@missing"),
        status: "active",
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };

      await expect(store.saveSubscription(subscription)).rejects.toBeInstanceOf(
        SubscriptionPlanVersionResolutionProblem,
      );
      await expect(
        store.saveSubscription({
          ...subscription,
          planVersionRef: planVersionRef("plan-enterprise@v1"),
        }),
      ).rejects.toBeInstanceOf(SubscriptionPlanVersionResolutionProblem);
      await expect(store.findSubscription(subscription.billingAccountId)).resolves.toBeNull();
    });
  });

  describe("legacy subscription migration", () => {
    const legacySubscription: LegacySubscription = {
      id: "sub-legacy",
      billingAccountId: "tenant-legacy",
      externalSubscriptionId: "ext-sub-legacy",
      planId: "plan-pro",
      status: "active",
      currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
      lastSyncedAt: new Date("2026-07-01T00:00:00.000Z"),
    };
    it("requires an explicit version instead of silently selecting the latest", async () => {
      store.importLegacySubscription(legacySubscription);

      await expect(store.findSubscription("tenant-legacy")).rejects.toBeInstanceOf(
        SubscriptionPlanVersionMigrationRequiredProblem,
      );
      await expect(store.findLegacySubscriptions()).resolves.toEqual([legacySubscription]);
      await expect(
        store.saveSubscription({
          ...legacySubscription,
          planVersionRef: planVersionRef("plan-pro@v1"),
        }),
      ).rejects.toBeInstanceOf(SubscriptionPlanVersionMigrationRequiredProblem);
    });

    it("pins the caller-selected version and preserves the legacy plan family", async () => {
      store.importLegacySubscription(legacySubscription);
      const grandfatheredRef = planVersionRef("plan-pro@2025-01");

      await expect(
        store.migrateSubscriptionPlanVersion({
          externalSubscriptionId: legacySubscription.externalSubscriptionId,
          planId: legacySubscription.planId,
          planVersionRef: grandfatheredRef,
        }),
      ).resolves.toMatchObject({
        planId: "plan-pro",
        planVersionRef: grandfatheredRef,
      });
      await expect(store.findLegacySubscriptions()).resolves.toEqual([]);
      await expect(store.findSubscription("tenant-legacy")).resolves.toMatchObject({
        planVersionRef: grandfatheredRef,
      });
    });

    it("rejects a mismatched family and a second migration", async () => {
      store.importLegacySubscription(legacySubscription);

      await expect(
        store.migrateSubscriptionPlanVersion({
          externalSubscriptionId: legacySubscription.externalSubscriptionId,
          planId: "plan-enterprise",
          planVersionRef: planVersionRef("plan-enterprise@v1"),
        }),
      ).rejects.toBeInstanceOf(SubscriptionPlanVersionMigrationProblem);

      await store.migrateSubscriptionPlanVersion({
        externalSubscriptionId: legacySubscription.externalSubscriptionId,
        planId: legacySubscription.planId,
        planVersionRef: planVersionRef("plan-pro@v1"),
      });
      await expect(
        store.migrateSubscriptionPlanVersion({
          externalSubscriptionId: legacySubscription.externalSubscriptionId,
          planId: legacySubscription.planId,
          planVersionRef: planVersionRef("plan-pro@v2"),
        }),
      ).rejects.toBeInstanceOf(SubscriptionPlanVersionMigrationProblem);
    });

    it("rejects unpublished versions and versions from another plan family", async () => {
      store.importLegacySubscription(legacySubscription);

      await expect(
        store.migrateSubscriptionPlanVersion({
          externalSubscriptionId: legacySubscription.externalSubscriptionId,
          planId: legacySubscription.planId,
          planVersionRef: planVersionRef("plan-pro@missing"),
        }),
      ).rejects.toBeInstanceOf(SubscriptionPlanVersionMigrationProblem);
      await expect(
        store.migrateSubscriptionPlanVersion({
          externalSubscriptionId: legacySubscription.externalSubscriptionId,
          planId: legacySubscription.planId,
          planVersionRef: planVersionRef("plan-enterprise@v1"),
        }),
      ).rejects.toBeInstanceOf(SubscriptionPlanVersionMigrationProblem);
    });

    it("uses compare-and-set semantics when migrations race", async () => {
      store.importLegacySubscription(legacySubscription);

      const results = await Promise.allSettled([
        store.migrateSubscriptionPlanVersion({
          externalSubscriptionId: legacySubscription.externalSubscriptionId,
          planId: legacySubscription.planId,
          planVersionRef: planVersionRef("plan-pro@2025-01"),
        }),
        store.migrateSubscriptionPlanVersion({
          externalSubscriptionId: legacySubscription.externalSubscriptionId,
          planId: legacySubscription.planId,
          planVersionRef: planVersionRef("plan-pro@v1"),
        }),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect(results.find((result) => result.status === "rejected")).toMatchObject({
        reason: expect.any(SubscriptionPlanVersionMigrationProblem),
      });
    });
  });

  describe("saveOrder and findOrdersByAccount", () => {
    it("should save order and find by account ID", async () => {
      const order1: Order = {
        id: "order-1",
        billingAccountId: "tenant-1",
        externalOrderId: "ext-order-1",
        amount: 1000,
        currency: "USD",
        reason: "subscription_cycle",
        paidAt: new Date(),
      };
      const order2: Order = {
        id: "order-2",
        billingAccountId: "tenant-1",
        externalOrderId: "ext-order-2",
        amount: 2000,
        currency: "USD",
        reason: "one_time",
        paidAt: new Date(),
      };

      await store.saveOrder(order1);
      await store.saveOrder(order2);

      const result = await store.findOrdersByAccount("tenant-1");
      expect(result).toHaveLength(2);
      expect(result).toEqual([order1, order2]);
    });

    it("should return empty array when no orders exist", async () => {
      const result = await store.findOrdersByAccount("non-existent");
      expect(result).toEqual([]);
    });

    it("should only return orders for specific account", async () => {
      const order1: Order = {
        id: "order-1",
        billingAccountId: "tenant-1",
        externalOrderId: "ext-order-1",
        amount: 1000,
        currency: "USD",
        reason: "subscription_cycle",
        paidAt: new Date(),
      };
      const order2: Order = {
        id: "order-2",
        billingAccountId: "tenant-2",
        externalOrderId: "ext-order-2",
        amount: 2000,
        currency: "USD",
        reason: "one_time",
        paidAt: new Date(),
      };

      await store.saveOrder(order1);
      await store.saveOrder(order2);

      const result1 = await store.findOrdersByAccount("tenant-1");
      const result2 = await store.findOrdersByAccount("tenant-2");

      expect(result1).toEqual([order1]);
      expect(result2).toEqual([order2]);
    });
  });

  describe("webhook reservation lifecycle", () => {
    it("should reject a completed webhook when reserving the same event again", async () => {
      await store.reserveWebhook("event-1", "subscription.created");
      await store.completeWebhook("event-1");

      await expect(store.reserveWebhook("event-1", "subscription.created")).rejects.toBeInstanceOf(
        WebhookAlreadyProcessedProblem,
      );
    });

    it("should allow reserving the same event after a failed reservation", async () => {
      await store.reserveWebhook("event-1", "subscription.created");
      await store.failWebhook("event-1");

      await expect(
        store.reserveWebhook("event-1", "subscription.created"),
      ).resolves.toBeUndefined();
    });

    it("should reject completion when the webhook was not reserved", async () => {
      await expect(store.completeWebhook("event-1")).rejects.toBeInstanceOf(
        WebhookAlreadyProcessedProblem,
      );
    });

    it("should reject duplicate webhook reservations", async () => {
      await store.reserveWebhook("event-1", "subscription.created");

      await expect(store.reserveWebhook("event-1", "subscription.created")).rejects.toBeInstanceOf(
        WebhookAlreadyProcessedProblem,
      );
    });

    it("should allow exactly one concurrent reservation for the same event", async () => {
      const results = await Promise.allSettled([
        store.reserveWebhook("event-concurrent", "subscription.created"),
        store.reserveWebhook("event-concurrent", "subscription.created"),
      ]);

      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({
        reason: expect.any(WebhookAlreadyProcessedProblem),
      });
    });
  });

  describe("reset", () => {
    it("should clear all data", async () => {
      const account: BillingAccount = {
        id: "tenant-1",
        tenantId: "tenant-1",
        externalCustomerId: "ext-cust-1",
        email: "test@example.com",
        createdAt: new Date(),
      };
      const subscription: Subscription = {
        id: "sub-1",
        billingAccountId: "tenant-1",
        externalSubscriptionId: "ext-sub-1",
        planId: "plan-pro",
        planVersionRef: planVersionRef("plan-pro@v1"),
        status: "active",
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      const order: Order = {
        id: "order-1",
        billingAccountId: "tenant-1",
        externalOrderId: "ext-order-1",
        amount: 1000,
        currency: "USD",
        reason: "subscription_cycle",
        paidAt: new Date(),
      };
      await store.saveAccount(account);
      await store.saveSubscription(subscription);
      await store.saveOrder(order);
      await store.reserveWebhook("event-1", "subscription.created");
      await store.completeWebhook("event-1");

      store.reset();

      expect(await store.findAccountByTenantId("tenant-1")).toBeNull();
      expect(await store.findAccountByExternalId("ext-cust-1")).toBeNull();
      expect(await store.findSubscription("tenant-1")).toBeNull();
      expect(await store.findSubscriptionByExternalId("ext-sub-1")).toBeNull();
      expect(await store.findOrdersByAccount("tenant-1")).toEqual([]);
      await expect(
        store.reserveWebhook("event-1", "subscription.created"),
      ).resolves.toBeUndefined();
    });
  });
});
