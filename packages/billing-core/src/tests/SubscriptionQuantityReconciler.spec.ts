import { describe, expect, it, vi } from "vitest";
import {
  InMemoryPlanRegistry,
  InMemorySubscriptionQuantityReconciliationStore,
  InvalidSubscriptionQuantityProblem,
  planVersionRef,
  SubscriptionQuantityReconciler,
} from "../index";
import type {
  LicensedQuantityGateway,
  PlanVersionDefinition,
  SetLicensedQuantityInput,
  SetLicensedQuantityResult,
  SubscriptionQuantitySource,
  SubscriptionQuantityRepairSource,
  SubscriptionQuantitySnapshot,
  SubscriptionQuantitySourceSnapshot,
} from "../index";

const PLAN_VERSION_REF = planVersionRef("growth@2026-01");

function createPlanVersion(overrides: Partial<PlanVersionDefinition> = {}): PlanVersionDefinition {
  return {
    ref: PLAN_VERSION_REF,
    planId: "growth",
    versionId: "2026-01",
    effectiveAt: "2026-01-01T00:00:00.000Z",
    name: "Growth",
    amount: 9900,
    currency: "USD",
    interval: "month",
    intervalCount: 1,
    rating: { mode: "provider", provider: "test" },
    quantityPolicy: {
      minimumQuantity: 1,
      includedSeats: 2,
      seatQuota: 25,
      billableMembershipRoles: ["owner", "admin", "member"],
    },
    providerBindings: [{ provider: "test", productId: "growth-2026", priceIds: [] }],
    ...overrides,
  };
}

class MutableQuantitySource implements SubscriptionQuantitySource {
  private snapshot: SubscriptionQuantitySourceSnapshot = {
    planVersionRef: PLAN_VERSION_REF,
    sourceVersion: 1,
    activeMembershipCount: 5,
    billableMembershipCount: 5,
    entitlementSeatQuota: 25,
    evidence: { membershipRevision: 1 },
  };

  setSnapshot(snapshot: Partial<SubscriptionQuantitySourceSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...snapshot,
      evidence: snapshot.evidence ?? this.snapshot.evidence,
    };
  }

  async getSnapshot(): Promise<SubscriptionQuantitySourceSnapshot> {
    return {
      ...this.snapshot,
      evidence: { ...this.snapshot.evidence },
    };
  }
}

class ConformingQuantityGateway implements LicensedQuantityGateway {
  getCalls = 0;
  setCalls: SetLicensedQuantityInput[] = [];
  failWith: Error | null = null;
  setFailWith: Error | null = null;
  reportedSetQuantity: number | null = null;
  beforeGet: (() => Promise<void>) | null = null;
  private readonly quantities = new Map<string, number>();
  private readonly acceptedSourceVersions = new Map<string, number>();
  private readonly results = new Map<string, SetLicensedQuantityResult>();

  constructor(initialQuantity: number) {
    this.quantities.set("external-subscription-1", initialQuantity);
  }

  get quantity(): number {
    return this.quantities.get("external-subscription-1") ?? 0;
  }

  set quantity(value: number) {
    this.quantities.set("external-subscription-1", value);
  }

  seedAcceptedSource(
    sourceVersion: number,
    quantity: number,
    externalSubscriptionId = "external-subscription-1",
  ): void {
    this.acceptedSourceVersions.set(externalSubscriptionId, sourceVersion);
    this.quantities.set(externalSubscriptionId, quantity);
  }

  async getQuantity(
    externalSubscriptionId: string,
  ): Promise<{ quantity: number; providerVersion: string }> {
    this.getCalls += 1;
    if (this.beforeGet) await this.beforeGet();
    if (this.failWith) throw this.failWith;
    const acceptedSourceVersion = this.acceptedSourceVersions.get(externalSubscriptionId) ?? -1;
    return {
      quantity: this.quantities.get(externalSubscriptionId) ?? 0,
      providerVersion: `provider-${acceptedSourceVersion}`,
    };
  }

  async setQuantity(input: SetLicensedQuantityInput): Promise<SetLicensedQuantityResult> {
    this.setCalls.push(input);
    if (this.setFailWith) throw this.setFailWith;
    if (this.failWith) throw this.failWith;
    const operationKey = `${input.externalSubscriptionId}:${input.operationId}`;
    const quantity = this.quantities.get(input.externalSubscriptionId) ?? 0;
    const acceptedSourceVersion =
      this.acceptedSourceVersions.get(input.externalSubscriptionId) ?? -1;
    const prior = this.results.get(operationKey);
    if (prior) {
      return {
        status: "duplicate",
        observation: {
          quantity,
          providerVersion: `provider-${input.sourceVersion}`,
        },
      };
    }
    if (input.sourceVersion < acceptedSourceVersion) {
      return {
        status: "stale",
        observation: {
          quantity,
          providerVersion: `provider-${acceptedSourceVersion}`,
        },
        acceptedSourceVersion,
      };
    }

    this.acceptedSourceVersions.set(input.externalSubscriptionId, input.sourceVersion);
    this.quantities.set(input.externalSubscriptionId, input.quantity);
    const result: SetLicensedQuantityResult = {
      status: "applied",
      observation: {
        quantity: this.reportedSetQuantity ?? input.quantity,
        providerVersion: `provider-${input.sourceVersion}`,
      },
    };
    this.results.set(operationKey, result);
    return result;
  }
}

async function createFixture(
  initialProviderQuantity = 0,
  repairSource?: SubscriptionQuantityRepairSource,
) {
  const registry = new InMemoryPlanRegistry();
  await registry.publishPlanVersion(createPlanVersion());
  const source = new MutableQuantitySource();
  const gateway = new ConformingQuantityGateway(initialProviderQuantity);
  const store = new InMemorySubscriptionQuantityReconciliationStore();
  const events: string[] = [];
  const reconciler = new SubscriptionQuantityReconciler({
    source,
    gateway,
    store,
    planRegistry: registry,
    repairSource,
    eventPublisher: {
      publishNow: async (event) => {
        events.push(event.eventName);
      },
    },
  });

  return { events, gateway, reconciler, registry, source, store };
}

function reconcile(reconciler: SubscriptionQuantityReconciler) {
  return reconciler.reconcile({
    tenantId: "tenant-1",
    subscriptionId: "subscription-1",
    externalSubscriptionId: "external-subscription-1",
    planVersionRef: PLAN_VERSION_REF,
    reason: "membership.changed",
  });
}

function createInventoryRepairSource(): SubscriptionQuantityRepairSource {
  return {
    listCandidates: async () => [
      {
        tenantId: "tenant-1",
        subscriptionId: "subscription-1",
        externalSubscriptionId: "external-subscription-1",
        planVersionRef: PLAN_VERSION_REF,
        reason: "inventory.scan",
      },
    ],
  };
}

describe("SubscriptionQuantityReconciler", () => {
  it("derives provider quantity from the immutable plan policy and membership evidence", async () => {
    const { events, gateway, reconciler } = await createFixture(1);

    const result = await reconcile(reconciler);

    expect(result).toMatchObject({
      activeMembershipCount: 5,
      billableMembershipCount: 5,
      entitlementSeatQuota: 25,
      desiredQuantity: 3,
      providerQuantity: 3,
      state: "in_sync",
      sourceVersion: 1,
    });
    expect(gateway.setCalls).toHaveLength(1);
    expect(events).toEqual([
      "billing.subscription_quantity.drift_detected",
      "billing.subscription_quantity.reconciliation_succeeded",
      "billing.subscription_quantity.drift_recovered",
    ]);
  });

  it("treats duplicate delivery for the same source version and quantity as idempotent success", async () => {
    const { gateway, reconciler } = await createFixture();

    const first = await reconcile(reconciler);
    const replay = await reconcile(reconciler);

    expect(replay.reconciliationId).toBe(first.reconciliationId);
    expect(replay.state).toBe("in_sync");
    expect(gateway.setCalls).toHaveLength(1);
    expect(gateway.getCalls).toBe(1);
  });

  it("supersedes a stale concurrent reconciliation without overwriting the newer quantity", async () => {
    const { gateway, reconciler, source, store } = await createFixture();
    let releaseFirstGet: (() => void) | undefined;
    const firstGetBlocked = new Promise<void>((resolve) => {
      releaseFirstGet = resolve;
    });
    let getCount = 0;
    gateway.beforeGet = async () => {
      getCount += 1;
      if (getCount === 1) await firstGetBlocked;
    };

    const stale = reconcile(reconciler);
    await vi.waitFor(() => expect(getCount).toBe(1));
    source.setSnapshot({
      sourceVersion: 2,
      activeMembershipCount: 7,
      billableMembershipCount: 7,
      evidence: { membershipRevision: 2 },
    });
    let current: SubscriptionQuantitySnapshot | undefined;
    let staleResult: SubscriptionQuantitySnapshot | undefined;
    try {
      current = await reconcile(reconciler);
      releaseFirstGet?.();
      staleResult = await stale;
    } finally {
      releaseFirstGet?.();
    }

    expect(current).toMatchObject({ sourceVersion: 2, desiredQuantity: 5, state: "in_sync" });
    expect(staleResult).toMatchObject({ sourceVersion: 2, desiredQuantity: 5, state: "in_sync" });
    expect(gateway.quantity).toBe(5);
    await expect(store.findCurrent("tenant-1", "external-subscription-1")).resolves.toMatchObject({
      sourceVersion: 2,
      desiredQuantity: 5,
      providerQuantity: 5,
      state: "in_sync",
    });
  });

  it("reduces provider quantity after a member is removed without touching subscription identity", async () => {
    const { gateway, reconciler, source } = await createFixture();
    await reconcile(reconciler);
    source.setSnapshot({
      sourceVersion: 2,
      activeMembershipCount: 3,
      billableMembershipCount: 3,
      evidence: { membershipRevision: 2 },
    });

    const reduced = await reconcile(reconciler);

    expect(reduced).toMatchObject({
      subscriptionId: "subscription-1",
      externalSubscriptionId: "external-subscription-1",
      desiredQuantity: 1,
      providerQuantity: 1,
      state: "in_sync",
    });
    expect(gateway.setCalls.map(({ quantity }) => quantity)).toEqual([3, 1]);
  });

  it("persists retryable provider failure and converges it through a bounded repair scan", async () => {
    const { gateway, reconciler, store } = await createFixture();
    gateway.failWith = new Error("provider unavailable");

    const failed = await reconcile(reconciler);

    expect(failed).toMatchObject({
      state: "retryable_failed",
      lastFailure: {
        code: "billing/subscription-quantity-reconciliation-failed",
        retryable: true,
        status: 500,
      },
    });
    await expect(reconciler.getDiagnostics()).resolves.toMatchObject({
      retryExhausted: 0,
    });

    gateway.failWith = null;
    await expect(reconciler.repair(10)).resolves.toEqual({
      requested: 1,
      inSync: 1,
      failed: 0,
      superseded: 0,
    });
    await expect(store.findCurrent("tenant-1", "external-subscription-1")).resolves.toMatchObject({
      state: "in_sync",
      providerQuantity: 3,
      lastFailure: undefined,
    });
  });

  it("discovers a first missed event through a bounded repair source", async () => {
    const registry = new InMemoryPlanRegistry();
    await registry.publishPlanVersion(createPlanVersion());
    const source = new MutableQuantitySource();
    const gateway = new ConformingQuantityGateway(0);
    const store = new InMemorySubscriptionQuantityReconciliationStore();
    const listCandidates = vi.fn(async () => [
      {
        tenantId: "tenant-1",
        subscriptionId: "subscription-1",
        externalSubscriptionId: "external-subscription-1",
        planVersionRef: PLAN_VERSION_REF,
        reason: "inventory.scan",
      },
    ]);
    const reconciler = new SubscriptionQuantityReconciler({
      source,
      gateway,
      store,
      planRegistry: registry,
      repairSource: { listCandidates },
    });

    await expect(reconciler.repair(1)).resolves.toEqual({
      requested: 1,
      inSync: 1,
      failed: 0,
      superseded: 0,
    });
    expect(listCandidates).toHaveBeenCalledWith(1);
    expect(gateway.quantity).toBe(3);
    await expect(store.findCurrent("tenant-1", "external-subscription-1")).resolves.toMatchObject({
      state: "in_sync",
      sourceVersion: 1,
    });
  });

  it("advances a bounded inventory cursor beyond previously in-sync subscriptions", async () => {
    const registry = new InMemoryPlanRegistry();
    await registry.publishPlanVersion(createPlanVersion());
    const source = new MutableQuantitySource();
    const gateway = new ConformingQuantityGateway(0);
    const store = new InMemorySubscriptionQuantityReconciliationStore();
    let cursor = 0;
    const reconciler = new SubscriptionQuantityReconciler({
      source,
      gateway,
      store,
      planRegistry: registry,
      repairSource: {
        listCandidates: async () => {
          cursor += 1;
          return [
            {
              tenantId: `tenant-${cursor}`,
              subscriptionId: `subscription-${cursor}`,
              externalSubscriptionId: `external-subscription-${cursor}`,
              planVersionRef: PLAN_VERSION_REF,
              reason: "inventory.scan",
            },
          ];
        },
      },
    });

    await expect(reconciler.repair(1)).resolves.toMatchObject({ requested: 1, inSync: 1 });
    await expect(reconciler.repair(1)).resolves.toMatchObject({ requested: 1, inSync: 1 });

    expect(cursor).toBe(2);
    await expect(store.findCurrent("tenant-1", "external-subscription-1")).resolves.toMatchObject({
      state: "in_sync",
    });
    await expect(store.findCurrent("tenant-2", "external-subscription-2")).resolves.toMatchObject({
      state: "in_sync",
    });
  });

  it("isolates invalid repair candidates so later subscriptions still converge", async () => {
    const registry = new InMemoryPlanRegistry();
    await registry.publishPlanVersion(createPlanVersion());
    const source = new MutableQuantitySource();
    const gateway = new ConformingQuantityGateway(0);
    const store = new InMemorySubscriptionQuantityReconciliationStore();
    const reconciler = new SubscriptionQuantityReconciler({
      source,
      gateway,
      store,
      planRegistry: registry,
      repairSource: {
        listCandidates: async () => [
          {
            tenantId: "tenant-invalid",
            subscriptionId: "subscription-invalid",
            planVersionRef: planVersionRef("missing@1"),
            reason: "inventory.scan",
          },
          {
            tenantId: "tenant-1",
            subscriptionId: "subscription-1",
            externalSubscriptionId: "external-subscription-1",
            planVersionRef: PLAN_VERSION_REF,
            reason: "inventory.scan",
          },
        ],
      },
    });

    await expect(reconciler.repair(2)).resolves.toEqual({
      requested: 2,
      inSync: 1,
      failed: 1,
      superseded: 0,
    });
    expect(gateway.quantity).toBe(3);
  });

  it("detects and repairs provider-side drift during a periodic scan", async () => {
    const { gateway, reconciler, store } = await createFixture(0, createInventoryRepairSource());
    await reconcile(reconciler);
    gateway.quantity = 99;

    await expect(reconciler.repair(1)).resolves.toEqual({
      requested: 1,
      inSync: 1,
      failed: 0,
      superseded: 0,
    });
    expect(gateway.quantity).toBe(3);
    expect(gateway.setCalls).toHaveLength(2);
    expect(gateway.setCalls[1]?.operationId).not.toBe(gateway.setCalls[0]?.operationId);
    await expect(store.findCurrent("tenant-1", "external-subscription-1")).resolves.toMatchObject({
      state: "in_sync",
      desiredQuantity: 3,
      providerQuantity: 3,
    });
  });

  it("reuses the provider operation identity after an ambiguous update failure", async () => {
    const { gateway, reconciler } = await createFixture();
    gateway.setFailWith = new Error("provider response unavailable");

    await expect(reconcile(reconciler)).resolves.toMatchObject({
      state: "retryable_failed",
      attemptCount: 1,
    });
    gateway.setFailWith = null;
    await expect(reconciler.repair(1)).resolves.toMatchObject({ requested: 1, inSync: 1 });

    expect(gateway.setCalls).toHaveLength(2);
    expect(gateway.setCalls[1]?.operationId).toBe(gateway.setCalls[0]?.operationId);
    expect(gateway.quantity).toBe(3);
  });

  it("does not report in sync when the provider returns a different applied quantity", async () => {
    const { gateway, reconciler, store } = await createFixture();
    gateway.reportedSetQuantity = 99;

    await expect(reconcile(reconciler)).resolves.toMatchObject({
      state: "retryable_failed",
      providerQuantity: 99,
      lastFailure: {
        code: "billing/subscription-quantity-provider-mismatch",
        retryable: true,
      },
    });
    await expect(store.findCurrent("tenant-1", "external-subscription-1")).resolves.toMatchObject({
      state: "retryable_failed",
      providerQuantity: 99,
    });
    await expect(reconciler.getDiagnostics()).resolves.toMatchObject({
      providerMismatches: 1,
      truncated: false,
    });
  });

  it("uses a fresh provider operation identity after a quantity mismatch", async () => {
    const { gateway, reconciler } = await createFixture();
    gateway.reportedSetQuantity = 99;

    await expect(reconcile(reconciler)).resolves.toMatchObject({
      state: "retryable_failed",
      lastFailure: { code: "billing/subscription-quantity-provider-mismatch" },
    });
    const firstOperationId = gateway.setCalls[0]?.operationId;
    gateway.reportedSetQuantity = null;
    gateway.quantity = 99;

    await expect(reconciler.repair(1)).resolves.toMatchObject({ requested: 1, inSync: 1 });

    expect(gateway.setCalls[1]?.operationId).not.toBe(firstOperationId);
  });

  it("records a terminal mismatch when the provider has accepted a newer unknown source", async () => {
    const { gateway, reconciler, store } = await createFixture();
    gateway.seedAcceptedSource(10, 7);

    await expect(reconcile(reconciler)).resolves.toMatchObject({
      state: "terminal_failed",
      providerQuantity: 7,
      providerAcceptedSourceVersion: 10,
      lastFailure: {
        code: "billing/subscription-quantity-provider-source-ahead",
        retryable: false,
      },
    });
    await expect(store.findCurrent("tenant-1", "external-subscription-1")).resolves.toMatchObject({
      state: "terminal_failed",
      providerAcceptedSourceVersion: 10,
    });
    await expect(reconciler.repair(1)).resolves.toMatchObject({ requested: 0 });
    await expect(reconciler.getDiagnostics()).resolves.toMatchObject({
      providerMismatches: 1,
    });
  });

  it("keeps a completed reconciliation in sync when best-effort event publication fails", async () => {
    const registry = new InMemoryPlanRegistry();
    await registry.publishPlanVersion(createPlanVersion());
    const source = new MutableQuantitySource();
    const gateway = new ConformingQuantityGateway(0);
    const store = new InMemorySubscriptionQuantityReconciliationStore();
    const reconciler = new SubscriptionQuantityReconciler({
      source,
      gateway,
      store,
      planRegistry: registry,
      eventPublisher: {
        publishNow: async () => {
          throw new Error("event transport unavailable");
        },
      },
    });

    await expect(reconcile(reconciler)).resolves.toMatchObject({
      state: "in_sync",
      providerQuantity: 3,
    });
    await expect(store.findCurrent("tenant-1", "external-subscription-1")).resolves.toMatchObject({
      state: "in_sync",
      providerQuantity: 3,
      lastFailure: undefined,
    });
  });

  it("stops retrying after deterministic retry exhaustion", async () => {
    const registry = new InMemoryPlanRegistry();
    await registry.publishPlanVersion(createPlanVersion());
    const source = new MutableQuantitySource();
    const gateway = new ConformingQuantityGateway(0);
    gateway.failWith = new Error("provider unavailable");
    const store = new InMemorySubscriptionQuantityReconciliationStore();
    const reconciler = new SubscriptionQuantityReconciler({
      source,
      gateway,
      store,
      planRegistry: registry,
      maxAttempts: 2,
    });

    await reconcile(reconciler);
    await expect(reconciler.repair(1)).resolves.toMatchObject({ requested: 1, failed: 1 });

    await expect(store.findCurrent("tenant-1", "external-subscription-1")).resolves.toMatchObject({
      state: "terminal_failed",
      attemptCount: 2,
      lastFailure: { retryable: true },
    });
    await expect(reconciler.getDiagnostics()).resolves.toMatchObject({ retryExhausted: 1 });
    await expect(reconciler.repair(1)).resolves.toMatchObject({ requested: 0 });
  });

  it("applies minimum and included-seat policy without producing a negative quantity", async () => {
    const { gateway, reconciler, source } = await createFixture(1);
    source.setSnapshot({
      activeMembershipCount: 1,
      billableMembershipCount: 1,
    });

    const result = await reconcile(reconciler);

    expect(result).toMatchObject({ desiredQuantity: 1, providerQuantity: 1, state: "in_sync" });
    expect(gateway.setCalls).toHaveLength(0);
  });

  it("rejects source evidence from a different plan or entitlement quota", async () => {
    const { reconciler, source } = await createFixture();
    source.setSnapshot({ entitlementSeatQuota: 50 });

    await expect(reconcile(reconciler)).rejects.toMatchObject({
      code: "billing/subscription-quantity-source-mismatch",
      status: 409,
    });
  });

  it("isolates and reports a source mismatch discovered by repair", async () => {
    const { reconciler, source, store } = await createFixture(0, createInventoryRepairSource());
    await reconcile(reconciler);
    source.setSnapshot({ sourceVersion: 2, entitlementSeatQuota: 50 });

    await expect(reconciler.repair(1)).resolves.toMatchObject({ requested: 1, failed: 1 });
    await expect(store.findCurrent("tenant-1", "external-subscription-1")).resolves.toMatchObject({
      state: "terminal_failed",
      lastFailure: { code: "billing/subscription-quantity-source-mismatch" },
    });
    await expect(reconciler.getDiagnostics()).resolves.toMatchObject({ sourceMismatches: 1 });
  });

  it("rejects unbounded repair limits", async () => {
    const { reconciler } = await createFixture();

    await expect(reconciler.repair(0)).rejects.toBeInstanceOf(InvalidSubscriptionQuantityProblem);
    await expect(reconciler.repair(1_001)).rejects.toBeInstanceOf(
      InvalidSubscriptionQuantityProblem,
    );
  });
});
