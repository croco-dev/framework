import type { PolicyDecisionSourceLocation, PolicyDecisionTrace } from "./PolicyDecisionTrace.js";

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
  ruleId?: string;
  sourceLocation?: PolicyDecisionSourceLocation;
  inputs?: Record<string, unknown>;
}

export type CheckResult =
  | {
      readonly decision: "allow";
      readonly allowed: true;
      readonly reason?: string;
      readonly trace?: PolicyDecisionTrace;
    }
  | {
      readonly decision: "deny";
      readonly allowed: false;
      readonly reason?: string;
      readonly trace?: PolicyDecisionTrace;
    }
  | {
      readonly decision: "abstain";
      readonly allowed: false;
      readonly reason?: string;
      readonly trace?: PolicyDecisionTrace;
    };

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

export type AccessRuleMetadata = {
  readonly objectType: string;
  readonly relation: Relation;
  readonly ruleId: string;
  readonly sourceLocation?: PolicyDecisionSourceLocation;
};
