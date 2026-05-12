import type { Membership, MembershipRole } from "../types";

export abstract class MembershipManager {
  abstract addMember(tenantId: string, userId: string, role: MembershipRole): Promise<Membership>;

  abstract removeMember(tenantId: string, userId: string): Promise<void>;

  abstract updateRole(
    tenantId: string,
    userId: string,
    newRole: MembershipRole,
  ): Promise<Membership>;

  abstract transferOwnership(tenantId: string, fromUserId: string, toUserId: string): Promise<void>;

  abstract getMember(tenantId: string, userId: string): Promise<Membership>;

  abstract listMembers(tenantId: string): Promise<Membership[]>;

  abstract listTenants(userId: string): Promise<Membership[]>;
}
