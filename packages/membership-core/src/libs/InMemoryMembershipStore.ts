import { MembershipStore } from "./MembershipStore";
import type {
  Membership,
  MembershipCreateInput,
  MembershipOwnerMutationInput,
  MembershipOwnerMutationResult,
  MembershipOwnershipTransferInput,
  MembershipOwnershipTransferResult,
  MembershipRole,
} from "./types";

export class InMemoryMembershipStore extends MembershipStore {
  private readonly storage = new Map<string, Membership>();

  async findByTenantAndUser(tenantId: string, userId: string): Promise<Membership | null> {
    const key = this.getKey(tenantId, userId);
    return this.storage.get(key) ?? null;
  }

  async findAllByTenant(tenantId: string): Promise<Membership[]> {
    return [...this.storage.values()].filter((membership) => membership.tenantId === tenantId);
  }

  async findAllByUser(userId: string): Promise<Membership[]> {
    return [...this.storage.values()].filter((membership) => membership.userId === userId);
  }

  async save(input: MembershipCreateInput): Promise<Membership> {
    const key = this.getKey(input.tenantId, input.userId);
    const now = new Date();
    const previous = this.storage.get(key);

    const membership: Membership = {
      id: input.id,
      tenantId: input.tenantId,
      userId: input.userId,
      role: input.role,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };

    this.storage.set(key, membership);
    return membership;
  }

  async delete(tenantId: string, userId: string): Promise<void> {
    const key = this.getKey(tenantId, userId);
    this.storage.delete(key);
  }

  async mutateOwner(input: MembershipOwnerMutationInput): Promise<MembershipOwnerMutationResult> {
    const key = this.getKey(input.tenantId, input.userId);
    const membership = this.storage.get(key);
    if (!membership) {
      return { status: "not_found" };
    }

    if (membership.role === "owner" && this.countOwners(input.tenantId) === 1) {
      return { status: "last_owner" };
    }

    if (input.operation === "remove") {
      this.storage.delete(key);
      return { status: "applied", membership };
    }

    const updated: Membership = {
      ...membership,
      role: input.role,
      updatedAt: new Date(),
    };
    this.storage.set(key, updated);
    return { status: "applied", membership: updated };
  }

  async transferOwnership(
    input: MembershipOwnershipTransferInput,
  ): Promise<MembershipOwnershipTransferResult> {
    const fromKey = this.getKey(input.tenantId, input.fromUserId);
    const toKey = this.getKey(input.tenantId, input.toUserId);
    const fromMembership = this.storage.get(fromKey);
    if (!fromMembership) {
      return { status: "not_found", userId: input.fromUserId };
    }
    if (fromMembership.role !== "owner") {
      return { status: "source_not_owner" };
    }

    const toMembership = this.storage.get(toKey);
    if (!toMembership) {
      return { status: "not_found", userId: input.toUserId };
    }
    if (fromKey === toKey) {
      return {
        status: "applied",
        fromMembership,
        toMembership,
        previousToRole: toMembership.role,
      };
    }

    const now = new Date();
    const updatedFrom = { ...fromMembership, role: "admin" as const, updatedAt: now };
    const updatedTo = { ...toMembership, role: "owner" as const, updatedAt: now };
    this.storage.set(toKey, updatedTo);
    this.storage.set(fromKey, updatedFrom);

    return {
      status: "applied",
      fromMembership: updatedFrom,
      toMembership: updatedTo,
      previousToRole: toMembership.role,
    };
  }

  async countByRole(tenantId: string, role: MembershipRole): Promise<number> {
    return [...this.storage.values()].filter(
      (membership) => membership.tenantId === tenantId && membership.role === role,
    ).length;
  }

  async countAll(tenantId: string): Promise<number> {
    return [...this.storage.values()].filter((membership) => membership.tenantId === tenantId)
      .length;
  }

  private getKey(tenantId: string, userId: string): string {
    return JSON.stringify([tenantId, userId]);
  }

  private countOwners(tenantId: string): number {
    return [...this.storage.values()].filter(
      (membership) => membership.tenantId === tenantId && membership.role === "owner",
    ).length;
  }
}
