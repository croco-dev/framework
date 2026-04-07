import { randomUUID } from 'node:crypto';
import type { EventPublisher } from '@croco/events-core';
import { Component } from '@croco/framework-context';
import { MembershipCreatedEvent } from './events/MembershipCreatedEvent';
import { MembershipRemovedEvent } from './events/MembershipRemovedEvent';
import { MembershipUpdatedEvent } from './events/MembershipUpdatedEvent';
import type { MembershipManager as AbstractMembershipManager } from './interfaces/AbstractMembershipManager';
import { MembershipOwnerGuard } from './MembershipOwnerGuard';
import type { MembershipStore } from './MembershipStore';
import {
  AlreadyMemberProblem,
  InvalidRoleProblem,
  MembershipNotFoundProblem,
  OwnershipTransferRequiredProblem,
  RoleHierarchyViolationProblem,
  SeatLimitExceededProblem,
} from './problems/MembershipProblems';
import type { SeatLimitChecker } from './SeatLimitChecker';
import { canDemote, canPromote, isHigherRole, isMembershipRole, type Membership, type MembershipRole } from './types';

@Component()
export class MembershipManager implements AbstractMembershipManager {
  private ownerGuard: MembershipOwnerGuard;

  constructor(
    private readonly store: MembershipStore,
    private readonly eventPublisher: EventPublisher,
    private readonly seatLimitChecker?: SeatLimitChecker
  ) {
    this.ownerGuard = new MembershipOwnerGuard(store);
  }

  async addMember(tenantId: string, userId: string, role: MembershipRole): Promise<Membership> {
    this.ensureValidRole(role);

    const existing = await this.store.findByTenantAndUser(tenantId, userId);
    if (existing) {
      throw new AlreadyMemberProblem(tenantId, userId);
    }

    await this.checkSeatLimit(tenantId);

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
    await this.ownerGuard.validateLastOwner(tenantId, userId, membership.role);

    await this.store.delete(tenantId, userId);
    await this.publishSafely(new MembershipRemovedEvent({ tenantId, userId, role: membership.role }));
  }

  async updateRole(tenantId: string, userId: string, newRole: MembershipRole): Promise<Membership> {
    this.ensureValidRole(newRole);

    const membership = await this.getMembershipOrThrow(tenantId, userId);
    if (membership.role === newRole) {
      return membership;
    }

    if (membership.role === 'owner' && newRole !== 'owner') {
      throw new OwnershipTransferRequiredProblem(tenantId, userId);
    }

    if (isHigherRole(newRole, membership.role) && !canPromote(membership.role, newRole)) {
      throw new RoleHierarchyViolationProblem(membership.role, newRole, 'promote');
    }

    if (isHigherRole(membership.role, newRole) && !canDemote(membership.role, newRole)) {
      throw new RoleHierarchyViolationProblem(membership.role, newRole, 'demote');
    }

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

  async transferOwnership(tenantId: string, fromUserId: string, toUserId: string): Promise<void> {
    const fromMembership = await this.getMembershipOrThrow(tenantId, fromUserId);
    if (fromMembership.role !== 'owner') {
      throw new OwnershipTransferRequiredProblem(tenantId, fromUserId);
    }

    const toMembership = await this.store.findByTenantAndUser(tenantId, toUserId);
    if (!toMembership) {
      throw new MembershipNotFoundProblem(tenantId, toUserId);
    }

    await this.store.save({
      id: fromMembership.id,
      tenantId,
      userId: fromUserId,
      role: 'admin',
    });

    await this.store.save({
      id: toMembership.id,
      tenantId,
      userId: toUserId,
      role: 'owner',
    });

    await this.publishSafely(
      new MembershipUpdatedEvent({
        tenantId,
        userId: fromUserId,
        oldRole: 'owner',
        newRole: 'admin',
      })
    );

    await this.publishSafely(
      new MembershipUpdatedEvent({
        tenantId,
        userId: toUserId,
        oldRole: toMembership.role,
        newRole: 'owner',
      })
    );
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
    if (!isMembershipRole(role)) {
      throw new InvalidRoleProblem(role);
    }
  }

  private async checkSeatLimit(tenantId: string): Promise<void> {
    if (!this.seatLimitChecker) return;

    const status = await this.seatLimitChecker.checkSeatAvailability(tenantId);
    if (status.exceeded) {
      throw new SeatLimitExceededProblem(tenantId, status.usage, status.quota);
    }
  }

  private async publishSafely(
    event: MembershipCreatedEvent | MembershipUpdatedEvent | MembershipRemovedEvent
  ): Promise<void> {
    await this.eventPublisher.publish(event);
  }
}
