export type MembershipRole = 'owner' | 'admin' | 'member' | 'viewer';

export const VALID_MEMBERSHIP_ROLES = ['owner', 'admin', 'member', 'viewer'] as const satisfies MembershipRole[];

export function isMembershipRole(role: string): role is MembershipRole {
  return VALID_MEMBERSHIP_ROLES.some((validRole) => validRole === role);
}

export type Membership = {
  id: string;
  tenantId: string;
  userId: string;
  role: MembershipRole;
  createdAt: Date;
  updatedAt: Date;
};

export type MembershipCreateInput = {
  id: string;
  tenantId: string;
  userId: string;
  role: MembershipRole;
};

export type MembershipUpdateInput = {
  role: MembershipRole;
};
