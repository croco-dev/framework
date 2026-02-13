export type MembershipRole = 'owner' | 'admin' | 'member' | 'viewer';

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
