import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryBillingStore,
  type BillingLifecycleCommand,
  type Subscription,
} from "@croco/billing-core";
import { BillingStoreSubscriptionProvider } from "../libs/BillingStoreSubscriptionProvider";

const PLAN_VERSION_REF = "plan-pro@v1" as Subscription["planVersionRef"];

describe("BillingStoreSubscriptionProvider", () => {
  let store!: InMemoryBillingStore;
  let provider!: BillingStoreSubscriptionProvider;
  let subscription!: Subscription;

  beforeEach(async () => {
    store = new InMemoryBillingStore();
    provider = new BillingStoreSubscriptionProvider(store);
    subscription = {
      id: "subscription-1",
      billingAccountId: "account-1",
      externalSubscriptionId: "external-subscription-1",
      planId: "plan-pro",
      planVersionRef: PLAN_VERSION_REF,
      status: "active",
      currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
      lastSyncedAt: new Date("2026-07-01T00:00:00.000Z"),
    };

    await store.saveAccount({
      id: "account-1",
      tenantId: "tenant-1",
      externalCustomerId: "customer-1",
      email: "billing@example.com",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await store.saveSubscription(subscription);
  });

  it("uses local subscription state while provider mutation is pending", async () => {
    await saveCommand("pending_provider", "cancel_immediately");

    await expect(provider.getCurrentPlanId("tenant-1")).resolves.toBe("plan-pro");
  });

  it("returns the immutable plan version pinned to the subscription", async () => {
    await expect(provider.getCurrentPlanVersion("tenant-1")).resolves.toEqual({
      planId: "plan-pro",
      planVersionRef: PLAN_VERSION_REF,
    });
  });

  it("removes entitlements after an immediate cancellation reaches pending local", async () => {
    await saveCommand("pending_local", "cancel_immediately");

    await expect(provider.getCurrentPlanId("tenant-1")).resolves.toBeNull();
  });

  it.each(["cancel_at_period_end", "resume"] as const)(
    "keeps the command plan while %s is pending local",
    async (kind) => {
      await saveCommand("pending_local", kind);

      await expect(provider.getCurrentPlanId("tenant-1")).resolves.toBe("plan-pro");
    },
  );

  it("removes entitlements after same-subscription plan and period updates", async () => {
    await saveCommand("pending_local", "cancel_immediately");
    await store.saveSubscription({
      ...subscription,
      planId: "plan-enterprise",
      currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    });

    await expect(provider.getCurrentPlanId("tenant-1")).resolves.toBeNull();
  });

  it("uses a replacement subscription instead of a stale pending command", async () => {
    await saveCommand("pending_local", "cancel_immediately");
    await store.saveSubscription({
      ...subscription,
      id: "subscription-2",
      externalSubscriptionId: "external-subscription-2",
      planId: "plan-enterprise",
      currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    });

    await expect(provider.getCurrentPlanId("tenant-1")).resolves.toBe("plan-enterprise");
  });

  it("does not grant access when a same-identity row appears after absent resolution", async () => {
    await saveCommand("pending_local", "cancel_immediately");
    await store.deleteSubscription("account-1");

    const resolveLifecycleSubscription = store.resolveLifecycleSubscription.bind(store);
    vi.spyOn(store, "resolveLifecycleSubscription").mockImplementationOnce(async (command) => {
      const resolution = await resolveLifecycleSubscription(command);
      await store.saveSubscription(subscription);
      return resolution;
    });

    await expect(provider.getCurrentPlanId("tenant-1")).resolves.toBeNull();
  });

  it.each(["canceled", "revoked"] as const)(
    "does not grant a plan for a completed %s subscription",
    async (status) => {
      await store.saveSubscription({
        ...subscription,
        status,
      });

      await expect(provider.getCurrentPlanId("tenant-1")).resolves.toBeNull();
    },
  );

  function createCommand(
    state: BillingLifecycleCommand["state"],
    kind: BillingLifecycleCommand["kind"],
  ): BillingLifecycleCommand {
    const now = new Date("2026-07-29T00:00:00.000Z");
    return {
      idempotencyKey: `${kind}-command`,
      tenantId: "tenant-1",
      kind,
      subscription,
      state,
      revision: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  async function saveCommand(
    state: BillingLifecycleCommand["state"],
    kind: BillingLifecycleCommand["kind"],
  ): Promise<void> {
    let command = await store.createLifecycleCommand(createCommand("pending_provider", kind));
    if (state === "pending_provider") return;

    command = await store.saveLifecycleCommand({
      ...command,
      state: "pending_local",
    });
    if (state === "pending_local") return;

    await store.saveLifecycleCommand({
      ...command,
      state,
    });
  }
});
