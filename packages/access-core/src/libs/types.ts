export type RelationTuple = {
  object: string;
  relation: string;
  subject: string;
};

export type CheckRequest = {
  tenantId: string;
  subject: string;
  relation: string;
  object: string;
};

export type CheckResult = {
  allowed: boolean;
};

export type GrantRequest = {
  tenantId: string;
  tuple: RelationTuple;
};

export type RevokeRequest = {
  tenantId: string;
  tuple: RelationTuple;
};

export type ListRequest = {
  tenantId: string;
  object?: string;
  subject?: string;
  relation?: string;
};
