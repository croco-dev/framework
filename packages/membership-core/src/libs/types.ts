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

export type MembershipOwnerMutationInput =
  | {
      tenantId: string;
      userId: string;
      operation: "remove";
    }
  | {
      tenantId: string;
      userId: string;
      operation: "demote";
      role: Exclude<MembershipRole, "owner">;
    };

export type MembershipOwnerMutationResult =
  | {
      status: "applied";
      membership: Membership;
    }
  | {
      status: "last_owner";
    }
  | {
      status: "conflict";
    }
  | {
      status: "not_found";
    };

export type MembershipOwnershipTransferInput = {
  tenantId: string;
  fromUserId: string;
  toUserId: string;
};

export type MembershipOwnershipTransferResult =
  | {
      status: "applied";
      fromMembership: Membership;
      toMembership: Membership;
      previousToRole: MembershipRole;
    }
  | {
      status: "not_found";
      userId: string;
    }
  | {
      status: "source_not_owner";
    }
  | {
      status: "conflict";
    };

export type MembershipCommand =
  | {
      readonly operation: "add";
      readonly idempotencyKey: string;
      readonly membershipId: string;
      readonly tenantId: string;
      readonly userId: string;
      readonly role: MembershipRole;
    }
  | {
      readonly operation: "remove";
      readonly idempotencyKey: string;
      readonly tenantId: string;
      readonly userId: string;
    }
  | {
      readonly operation: "update_role";
      readonly idempotencyKey: string;
      readonly tenantId: string;
      readonly userId: string;
      readonly role: MembershipRole;
    }
  | {
      readonly operation: "transfer_ownership";
      readonly idempotencyKey: string;
      readonly tenantId: string;
      readonly fromUserId: string;
      readonly toUserId: string;
    };

export type MembershipCommandResult =
  | {
      readonly operation: "add";
      readonly membership: Membership;
      readonly replayed: boolean;
    }
  | {
      readonly operation: "update_role";
      readonly membership: Membership;
      readonly previousRole: MembershipRole;
      readonly replayed: boolean;
    }
  | {
      readonly operation: "remove";
      readonly membership: Membership;
      readonly replayed: boolean;
    }
  | {
      readonly operation: "transfer_ownership";
      readonly fromMembership: Membership;
      readonly toMembership: Membership;
      readonly previousToRole: MembershipRole;
      readonly replayed: boolean;
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
