import { MembershipStore } from './MembershipStore';
import type { Membership, MembershipCreateInput, MembershipRole } from './types';

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

  async countByRole(tenantId: string, role: MembershipRole): Promise<number> {
    return [...this.storage.values()].filter(
      (membership) => membership.tenantId === tenantId && membership.role === role
    ).length;
  }

  private getKey(tenantId: string, userId: string): string {
    return `${tenantId}:${userId}`;
  }
}
