import type {
  PlanVersionRef,
  ReconcileSubscriptionQuantityInput,
  SubscriptionQuantityReconciler,
  SubscriptionQuantitySource,
  SubscriptionQuantitySourceInput,
  SubscriptionQuantitySourceSnapshot,
} from "@croco/billing-core";
import type {
  Membership,
  MembershipCreatedEvent,
  MembershipRemovedEvent,
  MembershipUpdatedEvent,
} from "@croco/membership-core";

export class MembershipSeatQuantitySource implements SubscriptionQuantitySource {
  constructor(private readonly snapshotReader: MembershipSeatSnapshotReader) {}

  async getSnapshot(
    input: SubscriptionQuantitySourceInput,
  ): Promise<SubscriptionQuantitySourceSnapshot> {
    const { memberships, planVersionRef, sourceVersion } =
      await this.snapshotReader.getSeatSnapshot(input.tenantId);
    const billableRoles = new Set(input.planVersion.quantityPolicy.billableMembershipRoles);
    return {
      planVersionRef,
      sourceVersion,
      activeMembershipCount: memberships.length,
      billableMembershipCount: memberships.filter(({ role }) => billableRoles.has(role)).length,
      entitlementSeatQuota: input.planVersion.quantityPolicy.seatQuota,
      evidence: {
        membershipRevision: sourceVersion,
        activeMembershipCount: memberships.length,
      },
    };
  }
}

export type VersionedMembershipSeatSnapshot = {
  readonly planVersionRef: PlanVersionRef;
  readonly sourceVersion: number;
  readonly memberships: readonly Membership[];
};

export interface MembershipSeatSnapshotReader {
  getSeatSnapshot(tenantId: string): Promise<VersionedMembershipSeatSnapshot>;
}

export type MembershipQuantitySubscription = {
  readonly subscriptionId: string;
  readonly externalSubscriptionId: string;
  readonly planVersionRef: PlanVersionRef;
};

export class MembershipQuantityReconciliationHandler {
  constructor(
    private readonly reconciler: SubscriptionQuantityReconciler,
    private readonly resolveSubscription: (
      tenantId: string,
    ) => Promise<MembershipQuantitySubscription>,
  ) {}

  async handle(
    event: MembershipCreatedEvent | MembershipRemovedEvent | MembershipUpdatedEvent,
  ): Promise<void> {
    const tenantId = event.data.tenantId;
    const subscription = await this.resolveSubscription(tenantId);
    const input: ReconcileSubscriptionQuantityInput = {
      tenantId,
      ...subscription,
      reason: event.eventName,
    };
    await this.reconciler.createIntent(input);
  }
}
