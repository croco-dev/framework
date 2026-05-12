export type MembershipRole = "owner" | "admin" | "member" | "viewer";

export const VALID_MEMBERSHIP_ROLES = [
  "owner",
  "admin",
  "member",
  "viewer",
] as const satisfies MembershipRole[];

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

export const ROLE_HIERARCHY: Record<MembershipRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export function isHigherRole(roleA: MembershipRole, roleB: MembershipRole): boolean {
  return ROLE_HIERARCHY[roleA] > ROLE_HIERARCHY[roleB];
}

export function isLowerRole(roleA: MembershipRole, roleB: MembershipRole): boolean {
  return ROLE_HIERARCHY[roleA] < ROLE_HIERARCHY[roleB];
}

export function canDemote(fromRole: MembershipRole, toRole: MembershipRole): boolean {
  return isHigherRole(fromRole, toRole) || fromRole === toRole;
}

export function canPromote(fromRole: MembershipRole, toRole: MembershipRole): boolean {
  return isLowerRole(fromRole, toRole) || fromRole === toRole;
}
