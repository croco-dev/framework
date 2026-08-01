// Constructor dependencies must remain runtime values for emitted design:paramtypes metadata.
/* oxlint-disable typescript/consistent-type-imports */
import { randomUUID } from "node:crypto";
import {
  EventAfterCommitRequiresActiveTransactionProblem,
  EventPublisher,
} from "@croco/events-core";
import { Component } from "@croco/framework-context";
import { MembershipCreatedEvent } from "./events/MembershipCreatedEvent";
import { MembershipRemovedEvent } from "./events/MembershipRemovedEvent";
import { MembershipUpdatedEvent } from "./events/MembershipUpdatedEvent";
import type { MembershipManager as AbstractMembershipManager } from "./interfaces/AbstractMembershipManager";
import { MembershipStore } from "./MembershipStore";
import {
  AlreadyMemberProblem,
  InvalidRoleProblem,
  LastOwnerProblem,
  MembershipNotFoundProblem,
  OwnershipTransferRequiredProblem,
  RoleHierarchyViolationProblem,
  SeatLimitExceededProblem,
} from "./problems/MembershipProblems";
import { LastOwnerCannotBeRemovedProblem } from "./problems/LastOwnerCannotBeRemovedProblem";
import { SeatLimitChecker } from "./SeatLimitChecker";
import {
  canDemote,
  canPromote,
  isHigherRole,
  isMembershipRole,
  type Membership,
  type MembershipRole,
} from "./types";

@Component()
export class MembershipManager implements AbstractMembershipManager {
  constructor(
    private readonly store: MembershipStore,
    private readonly eventPublisher: EventPublisher,
    private readonly seatLimitChecker: SeatLimitChecker | undefined = undefined,
  ) {}

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

    await this.publishAfterCommitOrNow(new MembershipCreatedEvent({ tenantId, userId, role }));
    return membership;
  }

  async removeMember(tenantId: string, userId: string): Promise<void> {
    const result = await this.store.mutateOwner({
      tenantId,
      userId,
      operation: "remove",
    });
    if (result.status === "not_found") {
      throw new MembershipNotFoundProblem(tenantId, userId);
    }
    if (result.status === "last_owner" || result.status === "conflict") {
      throw new LastOwnerCannotBeRemovedProblem(tenantId, userId);
    }

    await this.publishAfterCommitOrNow(
      new MembershipRemovedEvent({ tenantId, userId, role: result.membership.role }),
    );
  }

  async updateRole(tenantId: string, userId: string, newRole: MembershipRole): Promise<Membership> {
    this.ensureValidRole(newRole);

    const membership = await this.getMembershipOrThrow(tenantId, userId);
    if (membership.role === newRole) {
      return membership;
    }

    if (isHigherRole(newRole, membership.role) && !canPromote(membership.role, newRole)) {
      throw new RoleHierarchyViolationProblem(membership.role, newRole, "promote");
    }

    if (isHigherRole(membership.role, newRole) && !canDemote(membership.role, newRole)) {
      throw new RoleHierarchyViolationProblem(membership.role, newRole, "demote");
    }

    let updated: Membership;
    if (newRole !== "owner") {
      const result = await this.store.mutateOwner({
        tenantId,
        userId,
        operation: "demote",
        role: newRole,
      });
      if (result.status === "not_found") {
        throw new MembershipNotFoundProblem(tenantId, userId);
      }
      if (result.status === "last_owner" || result.status === "conflict") {
        throw new LastOwnerProblem(tenantId, userId, "demote");
      }
      updated = result.membership;
    } else {
      updated = await this.store.save({
        id: membership.id,
        tenantId,
        userId,
        role: newRole,
      });
    }

    await this.publishAfterCommitOrNow(
      new MembershipUpdatedEvent({
        tenantId,
        userId,
        oldRole: membership.role,
        newRole,
      }),
    );

    return updated;
  }

  async transferOwnership(tenantId: string, fromUserId: string, toUserId: string): Promise<void> {
    const result = await this.store.transferOwnership({ tenantId, fromUserId, toUserId });
    if (result.status === "not_found") {
      throw new MembershipNotFoundProblem(tenantId, result.userId);
    }
    if (result.status === "source_not_owner" || result.status === "conflict") {
      throw new OwnershipTransferRequiredProblem(tenantId, fromUserId);
    }
    if (fromUserId === toUserId) {
      return;
    }

    await this.publishAfterCommitOrNow(
      new MembershipUpdatedEvent({
        tenantId,
        userId: fromUserId,
        oldRole: "owner",
        newRole: result.fromMembership.role,
      }),
    );

    await this.publishAfterCommitOrNow(
      new MembershipUpdatedEvent({
        tenantId,
        userId: toUserId,
        oldRole: result.previousToRole,
        newRole: result.toMembership.role,
      }),
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
    event: MembershipCreatedEvent | MembershipUpdatedEvent | MembershipRemovedEvent,
  ): Promise<void> {
    await this.eventPublisher.publishNow(event);
  }

  private async publishAfterCommitOrNow(
    event: MembershipCreatedEvent | MembershipUpdatedEvent | MembershipRemovedEvent,
  ): Promise<void> {
    try {
      this.eventPublisher.publishAfterCommit(event);
    } catch (error) {
      if (!(error instanceof EventAfterCommitRequiresActiveTransactionProblem)) {
        throw error;
      }

      await this.publishSafely(event);
    }
  }
}
