export type ResourceObject = `${string}:${string}`;

export type Subject = `user:${string}` | `role:${string}` | `group:${string}`;

export type Relation = "owner" | "editor" | "viewer" | "admin" | "member" | string;

export interface RelationTuple {
  object: ResourceObject;
  relation: Relation;
  subject: Subject;
}

export interface CheckRequest {
  tenantId: string;
  subject: Subject;
  relation: Relation;
  object: ResourceObject;
}

export interface CheckResult {
  allowed: boolean;
}

export interface GrantRequest {
  tenantId: string;
  tuple: RelationTuple;
}

export interface RevokeRequest {
  tenantId: string;
  tuple: RelationTuple;
}

export interface ListRequest {
  tenantId: string;
  object?: ResourceObject;
  subject?: Subject;
  relation?: Relation;
}
