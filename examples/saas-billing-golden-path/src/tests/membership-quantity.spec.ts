import "reflect-metadata";
import {
  InMemoryPlanRegistry,
  InMemorySubscriptionQuantityReconciliationStore,
  planVersionRef,
  SubscriptionQuantityReconciler,
  SubscriptionQuantityReconciliationFailedProblem,
} from "@croco/billing-core";
import type {
  LicensedQuantityGateway,
  PlanVersionRef,
  SetLicensedQuantityInput,
  SetLicensedQuantityResult,
} from "@croco/billing-core";
import { InMemoryMembershipStore, MembershipManager } from "@croco/membership-core";
import type {
  MembershipCreatedEvent,
  MembershipRemovedEvent,
  MembershipStore,
  MembershipUpdatedEvent,
} from "@croco/membership-core";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MembershipQuantityReconciliationHandler,
  MembershipSeatQuantitySource,
} from "../integrations/MembershipSeatQuantitySource";
import type {
  MembershipSeatSnapshotReader,
  VersionedMembershipSeatSnapshot,
} from "../integrations/MembershipSeatQuantitySource";

const PLAN_VERSION_REF = planVersionRef("growth@2026-01");
const NEXT_PLAN_VERSION_REF = planVersionRef("growth@2026-02");

class LicensedQuantityFixtureGateway implements LicensedQuantityGateway {
  quantity = 1;
  unavailable = false;
  readonly updates: SetLicensedQuantityInput[] = [];
  private acceptedSourceVersion = 0;
  private readonly acceptedIds = new Set<string>();

  async getQuantity(): Promise<{ quantity: number }> {
    if (this.unavailable) {
      throw new SubscriptionQuantityReconciliationFailedProblem("external-subscription-1");
    }
    return { quantity: this.quantity };
  }

  async setQuantity(input: SetLicensedQuantityInput): Promise<SetLicensedQuantityResult> {
    if (this.unavailable) {
      throw new SubscriptionQuantityReconciliationFailedProblem(input.externalSubscriptionId);
    }
    if (this.acceptedIds.has(input.operationId)) {
      return { status: "duplicate", observation: { quantity: this.quantity } };
    }
    if (input.sourceVersion < this.acceptedSourceVersion) {
      return {
        status: "stale",
        observation: { quantity: this.quantity },
        acceptedSourceVersion: this.acceptedSourceVersion,
      };
    }
    this.acceptedIds.add(input.operationId);
    this.acceptedSourceVersion = input.sourceVersion;
    this.quantity = input.quantity;
    this.updates.push(input);
    return { status: "applied", observation: { quantity: this.quantity } };
  }
}

class VersionedInMemoryMembershipStore
  extends InMemoryMembershipStore
  implements MembershipSeatSnapshotReader
{
  private readonly snapshots = new Map<string, VersionedMembershipSeatSnapshot>();

  constructor(private planRef: PlanVersionRef) {
    super();
  }

  override async save(input: Parameters<MembershipStore["save"]>[0]) {
    const membership = await super.save(input);
    await this.capture(input.tenantId);
    return membership;
  }

  override async mutateOwner(input: Parameters<MembershipStore["mutateOwner"]>[0]) {
    const result = await super.mutateOwner(input);
    if (result.status === "applied") await this.capture(input.tenantId);
    return result;
  }

  override async transferOwnership(input: Parameters<MembershipStore["transferOwnership"]>[0]) {
    const result = await super.transferOwnership(input);
    if (result.status === "applied" && input.fromUserId !== input.toUserId) {
      await this.capture(input.tenantId);
    }
    return result;
  }

  async getSeatSnapshot(tenantId: string): Promise<VersionedMembershipSeatSnapshot> {
    const snapshot = this.snapshots.get(tenantId);
    return snapshot
      ? { ...snapshot, memberships: snapshot.memberships.map((membership) => ({ ...membership })) }
      : {
          planVersionRef: this.planRef,
          sourceVersion: 0,
          memberships: [],
        };
  }

  async assignPlanVersion(tenantId: string, planRef: PlanVersionRef): Promise<void> {
    this.planRef = planRef;
    await this.capture(tenantId);
  }

  private async capture(tenantId: string): Promise<void> {
    const previous = this.snapshots.get(tenantId);
    this.snapshots.set(tenantId, {
      planVersionRef: this.planRef,
      sourceVersion: (previous?.sourceVersion ?? 0) + 1,
      memberships: await super.findAllByTenant(tenantId),
    });
  }
}

describe("membership-to-billing licensed quantity golden path", () => {
  let afterCommitHooks!: Array<() => Promise<void>>;
  let gateway!: LicensedQuantityFixtureGateway;
  let manager!: MembershipManager;
  let membershipStore!: VersionedInMemoryMembershipStore;
  let planRegistry!: InMemoryPlanRegistry;
  let quantityStore!: InMemorySubscriptionQuantityReconciliationStore;
  let reconciler!: SubscriptionQuantityReconciler;
  let source!: MembershipSeatQuantitySource;

  beforeEach(async () => {
    membershipStore = new VersionedInMemoryMembershipStore(PLAN_VERSION_REF);
    await membershipStore.save({
      id: "membership-owner",
      tenantId: "tenant-1",
      userId: "owner-1",
      role: "owner",
    });
    source = new MembershipSeatQuantitySource(membershipStore);
    gateway = new LicensedQuantityFixtureGateway();
    quantityStore = new InMemorySubscriptionQuantityReconciliationStore();
    planRegistry = new InMemoryPlanRegistry();
    await planRegistry.publishPlanVersion({
      ref: PLAN_VERSION_REF,
      planId: "growth",
      versionId: "2026-01",
      effectiveAt: "2026-01-01T00:00:00.000Z",
      name: "Growth",
      amount: 9900,
      currency: "USD",
      interval: "month",
      intervalCount: 1,
      rating: { mode: "provider", provider: "fixture" },
      quantityPolicy: {
        minimumQuantity: 1,
        includedSeats: 0,
        seatQuota: 10,
        billableMembershipRoles: ["owner", "member"],
      },
      providerBindings: [{ provider: "fixture", productId: "growth", priceIds: [] }],
    });
    reconciler = new SubscriptionQuantityReconciler({
      source,
      gateway,
      store: quantityStore,
      planRegistry,
      repairSource: {
        listCandidates: async () => {
          const snapshot = await membershipStore.getSeatSnapshot("tenant-1");
          return [
            {
              tenantId: "tenant-1",
              subscriptionId: "subscription-1",
              externalSubscriptionId: "external-subscription-1",
              planVersionRef: snapshot.planVersionRef,
              reason: "subscription.inventory",
            },
          ];
        },
      },
    });
    const handler = new MembershipQuantityReconciliationHandler(reconciler, async () => ({
      subscriptionId: "subscription-1",
      externalSubscriptionId: "external-subscription-1",
      planVersionRef: PLAN_VERSION_REF,
    }));
    afterCommitHooks = [];
    manager = new MembershipManager({
      store: membershipStore,
      eventDelivery: "development",
      eventPublisher: {
        publishIdempotently: async (
          event: MembershipCreatedEvent | MembershipRemovedEvent | MembershipUpdatedEvent,
        ) => {
          afterCommitHooks.push(() => handler.handle(event));
        },
      },
    });
  });

  it("persists membership before creating an inspectable quantity intent after commit", async () => {
    await manager.addMember("tenant-1", "member-1", "member", "add:member-1");

    await expect(
      membershipStore.findByTenantAndUser("tenant-1", "member-1"),
    ).resolves.toMatchObject({ role: "member" });
    await expect(
      quantityStore.findCurrent("tenant-1", "external-subscription-1"),
    ).resolves.toBeNull();

    await manager.publishPendingEvents();
    await afterCommitHooks[0]?.();

    await expect(
      quantityStore.findCurrent("tenant-1", "external-subscription-1"),
    ).resolves.toMatchObject({
      state: "pending",
      activeMembershipCount: 2,
      billableMembershipCount: 2,
      desiredQuantity: 2,
      providerQuantity: null,
    });
    expect(gateway.updates).toHaveLength(0);

    await expect(reconciler.repair(1)).resolves.toMatchObject({ requested: 1, inSync: 1 });
    expect(gateway.quantity).toBe(2);
  });

  it("keeps a committed membership when the provider is unavailable and repairs it later", async () => {
    gateway.unavailable = true;
    await manager.addMember("tenant-1", "member-1", "member", "add:member-1");
    await manager.publishPendingEvents();
    await afterCommitHooks[0]?.();
    await reconciler.repair(1);

    await expect(
      membershipStore.findByTenantAndUser("tenant-1", "member-1"),
    ).resolves.not.toBeNull();
    await expect(
      quantityStore.findCurrent("tenant-1", "external-subscription-1"),
    ).resolves.toMatchObject({
      state: "retryable_failed",
      desiredQuantity: 2,
    });

    gateway.unavailable = false;
    await expect(reconciler.repair(10)).resolves.toMatchObject({ requested: 1, inSync: 1 });
    expect(gateway.quantity).toBe(2);
  });

  it("recovers the first missed membership event before any quantity intent exists", async () => {
    await membershipStore.save({
      id: "membership-missed-first",
      tenantId: "tenant-1",
      userId: "member-missed-first",
      role: "member",
    });

    await expect(
      quantityStore.findCurrent("tenant-1", "external-subscription-1"),
    ).resolves.toBeNull();
    await expect(reconciler.repair(1)).resolves.toEqual({
      requested: 1,
      inSync: 1,
      failed: 0,
      superseded: 0,
    });
    expect(gateway.quantity).toBe(2);
  });

  it("reduces quantity on removal and a bounded repair scan recovers missed event delivery", async () => {
    await manager.addMember("tenant-1", "member-1", "member", "add:member-1");
    await manager.publishPendingEvents();
    await afterCommitHooks.shift()?.();
    await reconciler.repair(1);
    await manager.removeMember("tenant-1", "member-1", "remove:member-1");
    await manager.publishPendingEvents();
    await afterCommitHooks.shift()?.();
    await reconciler.repair(1);
    expect(gateway.quantity).toBe(1);

    await membershipStore.save({
      id: "membership-missed",
      tenantId: "tenant-1",
      userId: "member-missed",
      role: "member",
    });
    await expect(reconciler.repair(1)).resolves.toMatchObject({ requested: 1, inSync: 1 });
    expect(gateway.quantity).toBe(2);
    expect(gateway.updates.map(({ quantity }) => quantity)).toEqual([2, 1, 2]);
  });

  it("reconciles add and role-change bursts from the final committed membership state", async () => {
    await manager.addMember("tenant-1", "member-1", "member", "add:member-1");
    await manager.addMember("tenant-1", "member-2", "member", "add:member-2");
    await manager.publishPendingEvents();
    await Promise.all(afterCommitHooks.splice(0).map((hook) => hook()));
    expect(gateway.updates).toHaveLength(0);
    await reconciler.repair(1);
    expect(gateway.quantity).toBe(3);

    await manager.updateRole("tenant-1", "member-1", "admin", "promote:member-1");
    await manager.updateRole("tenant-1", "member-2", "admin", "promote:member-2");
    await manager.publishPendingEvents();
    await Promise.all(afterCommitHooks.splice(0).map((hook) => hook()));
    await reconciler.repair(1);

    expect(gateway.quantity).toBe(1);
    await expect(
      quantityStore.findCurrent("tenant-1", "external-subscription-1"),
    ).resolves.toMatchObject({
      activeMembershipCount: 3,
      billableMembershipCount: 1,
      desiredQuantity: 1,
      providerQuantity: 1,
      state: "in_sync",
    });
  });

  it("supersedes the prior quantity intent when the assigned immutable plan version changes", async () => {
    await reconciler.createIntent({
      tenantId: "tenant-1",
      subscriptionId: "subscription-1",
      externalSubscriptionId: "external-subscription-1",
      planVersionRef: PLAN_VERSION_REF,
      reason: "subscription.created",
    });
    await reconciler.repair(1);

    await planRegistry.publishPlanVersion({
      ref: NEXT_PLAN_VERSION_REF,
      planId: "growth",
      versionId: "2026-02",
      effectiveAt: "2026-02-01T00:00:00.000Z",
      name: "Growth",
      amount: 12900,
      currency: "USD",
      interval: "month",
      intervalCount: 1,
      rating: { mode: "provider", provider: "fixture" },
      quantityPolicy: {
        minimumQuantity: 2,
        includedSeats: 0,
        seatQuota: 20,
        billableMembershipRoles: ["owner", "member"],
      },
      providerBindings: [{ provider: "fixture", productId: "growth-v2", priceIds: [] }],
    });
    await membershipStore.assignPlanVersion("tenant-1", NEXT_PLAN_VERSION_REF);

    await expect(
      reconciler.createIntent({
        tenantId: "tenant-1",
        subscriptionId: "subscription-1",
        externalSubscriptionId: "external-subscription-1",
        planVersionRef: NEXT_PLAN_VERSION_REF,
        reason: "subscription.plan_changed",
      }),
    ).resolves.toMatchObject({
      planVersionRef: NEXT_PLAN_VERSION_REF,
      sourceVersion: 2,
      desiredQuantity: 2,
      state: "pending",
    });
    await expect(reconciler.repair(1)).resolves.toMatchObject({ requested: 1, inSync: 1 });
    expect(gateway.quantity).toBe(2);
  });
});
