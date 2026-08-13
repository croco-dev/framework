import type { Membership, MembershipCommandResult, MembershipRole } from "../types";

export type AddMembershipCommandResult = Extract<MembershipCommandResult, { operation: "add" }>;

export abstract class MembershipManager {
  abstract addMember(
    tenantId: string,
    userId: string,
    role: MembershipRole,
    idempotencyKey: string,
  ): Promise<Membership>;

  abstract addMemberCommand(
    tenantId: string,
    userId: string,
    role: MembershipRole,
    idempotencyKey: string,
  ): Promise<AddMembershipCommandResult>;

  abstract removeMember(tenantId: string, userId: string, idempotencyKey: string): Promise<void>;

  abstract updateRole(
    tenantId: string,
    userId: string,
    newRole: MembershipRole,
    idempotencyKey: string,
  ): Promise<Membership>;

  abstract transferOwnership(
    tenantId: string,
    fromUserId: string,
    toUserId: string,
    idempotencyKey: string,
  ): Promise<void>;

  abstract publishPendingEvents(limit?: number): Promise<number>;

  abstract getMember(tenantId: string, userId: string): Promise<Membership>;

  abstract listMembers(tenantId: string): Promise<Membership[]>;

  abstract listTenants(userId: string): Promise<Membership[]>;
}
