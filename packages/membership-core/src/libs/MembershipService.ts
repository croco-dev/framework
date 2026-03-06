import { randomUUID } from 'node:crypto';
import type { EventPublisher } from '@croco/events-core';
import { Component } from '@croco/framework-context';
import { MembershipCreatedEvent } from './events/MembershipCreatedEvent';
import { MembershipRemovedEvent } from './events/MembershipRemovedEvent';
import { MembershipUpdatedEvent } from './events/MembershipUpdatedEvent';
import { MembershipOwnerGuard } from './MembershipOwnerGuard';
import type { MembershipStore } from './MembershipStore';
import { AlreadyMemberProblem, InvalidRoleProblem, MembershipNotFoundProblem } from './problems/MembershipProblems';
import type { Membership, MembershipRole } from './types';

const VALID_ROLES: MembershipRole[] = ['owner', 'admin', 'member', 'viewer'];

@Component()
export class MembershipService {
  private readonly ownerGuard: MembershipOwnerGuard;

  constructor(
    private readonly store: MembershipStore,
    private readonly eventPublisher: EventPublisher
  ) {
    this.ownerGuard = new MembershipOwnerGuard(this.store);
  }

  async addMember(tenantId: string, userId: string, role: MembershipRole): Promise<Membership> {
    this.ensureValidRole(role);

    const existing = await this.store.findByTenantAndUser(tenantId, userId);
    if (existing) {
      throw new AlreadyMemberProblem(tenantId, userId);
    }

    const membership = await this.store.save({
      id: randomUUID(),
      tenantId,
      userId,
      role,
    });

    await this.publishSafely(new MembershipCreatedEvent({ tenantId, userId, role }));
    return membership;
  }

  async removeMember(tenantId: string, userId: string): Promise<void> {
    const membership = await this.getMembershipOrThrow(tenantId, userId);

    await this.ownerGuard.validateOwnerMutation({
      tenantId,
      userId,
      currentRole: membership.role,
      operation: 'remove',
    });

    await this.store.delete(tenantId, userId);
    await this.publishSafely(new MembershipRemovedEvent({ tenantId, userId, role: membership.role }));
  }

  async updateRole(tenantId: string, userId: string, newRole: MembershipRole): Promise<Membership> {
    this.ensureValidRole(newRole);

    const membership = await this.getMembershipOrThrow(tenantId, userId);
    if (membership.role === newRole) {
      return membership;
    }

    await this.ownerGuard.validateOwnerMutation({
      tenantId,
      userId,
      currentRole: membership.role,
      operation: 'demote',
      nextRole: newRole,
    });

    const updated = await this.store.save({
      id: membership.id,
      tenantId,
      userId,
      role: newRole,
    });

    await this.publishSafely(
      new MembershipUpdatedEvent({
        tenantId,
        userId,
        oldRole: membership.role,
        newRole,
      })
    );

    return updated;
  }

  async getMember(tenantId: string, userId: string): Promise<Membership> {
    return this.getMembershipOrThrow(tenantId, userId);
  }

  async listMembers(tenantId: string): Promise<Membership[]> {
    return this.store.findAllByTenant(tenantId);
  }

  async listTenants(userId: string): Promise<Membership[]> {
    return this.store.findAllByUser(userId);
  }

  private async getMembershipOrThrow(tenantId: string, userId: string): Promise<Membership> {
    const membership = await this.store.findByTenantAndUser(tenantId, userId);
    if (!membership) {
      throw new MembershipNotFoundProblem(tenantId, userId);
    }

    return membership;
  }

  private ensureValidRole(role: string): void {
    if (!VALID_ROLES.includes(role as MembershipRole)) {
      throw new InvalidRoleProblem(role);
    }
  }

  private async publishSafely(
    event: MembershipCreatedEvent | MembershipUpdatedEvent | MembershipRemovedEvent
  ): Promise<void> {
    await this.eventPublisher.publish(event);
  }
}
